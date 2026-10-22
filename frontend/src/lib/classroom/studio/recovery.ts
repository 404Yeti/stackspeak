import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, rename, stat, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import { StudioError } from "./errors";
import { slugSchema, studentSchema, type StudioStudentExercise } from "./validation";
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const registrySchema = z.record(slugSchema, hashSchema.nullable()).refine((v) => Object.keys(v).length <= 2000);
type Registry = z.infer<typeof registrySchema>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function root() {
  const path = process.env.CLASSROOM_RECOVERY_DIR;
  // Local reference adapter only. Vercel's ephemeral disks are NOT durable recovery storage.
  if (process.env.VERCEL || !path || !isAbsolute(path)) throw new StudioError(503, "Durable publication storage is not configured. Publishing is unavailable.");
  return path;
}
async function prepareRoot() {
  const directory = root();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await stat(directory);
  if ((info.mode & 0o077) !== 0) throw new StudioError(503, "Publication directory must be private.");
  await mkdir(join(directory, "snapshots"), { recursive: true, mode: 0o700 });
  return directory;
}
async function boundedRead(path: string, max: number) {
  const file = await open(path, "r");
  try {
    if ((await file.stat()).size > max) throw new Error("Publication file is too large");
    const bytes = Buffer.alloc(max + 1);
    let total = 0;
    while (total <= max) {
      const { bytesRead } = await file.read(bytes, total, max + 1 - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > max) throw new Error("Publication file is too large");
    return bytes.subarray(0, total).toString("utf8");
  } finally { await file.close(); }
}
async function registry(): Promise<Registry> {
  try { return registrySchema.parse(JSON.parse(await boundedRead(join(root(), "registry.json"), 512 * 1024))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    try { await stat(join(root(), "database-delivery.fence")); }
    catch (fenceError) { if ((fenceError as NodeJS.ErrnoException).code === "ENOENT") return {}; throw fenceError; }
    throw new StudioError(503, "Publication registry is missing. Restore the independent recovery store before serving exercises.");
  }
}
async function atomicWrite(path: string, text: string) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, "wx", 0o600);
  try { await file.writeFile(text, "utf8"); await file.sync(); } finally { await file.close(); }
  await rename(temporary, path);
  const directory = await open(root(), "r");
  try { await directory.sync(); } finally { await directory.close(); }
}
export type PublicationLedger = {
  deny: (slug: string) => Promise<void>;
  activate: (payload: StudioStudentExercise) => Promise<void>;
};
/** Write-ahead deny + immutable snapshots. Failure/crash denies publication, never revives it. */
export async function withPublicationLedger<T>(action: (ledger: PublicationLedger) => Promise<T>) {
  const directory = await prepareRoot();
  if (process.env.CLASSROOM_CONTENT_SOURCE === "recovery") throw new StudioError(503, "Studio is read-only during recovery.");
  const lockPath = join(directory, "publication.lock");
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch { throw new StudioError(503, "Another publication is in progress, or a recovery review is required. Retry later."); }
  try {
    const current = await registry();
    await atomicWrite(join(directory, "registry.json"), JSON.stringify(current));
    if (process.env.CLASSROOM_CONTENT_SOURCE === "database")
      await atomicWrite(join(directory, "database-delivery.fence"), "database delivery requires journal-preserving recovery\n");
    const persist = () => atomicWrite(join(directory, "registry.json"), JSON.stringify(registrySchema.parse(current)));
    const ledger: PublicationLedger = {
      deny: async (slug) => { current[slugSchema.parse(slug)] = null; await persist(); },
      activate: async (input) => {
        const payload = studentSchema.parse(input);
        const serialized = JSON.stringify(payload);
        const key = digest(serialized);
        await atomicWrite(join(directory, "snapshots", `${key}.json`), serialized);
        // Sync snapshot directory before making the snapshot visible in the registry.
        const snapshots = await open(join(directory, "snapshots"), "r");
        try { await snapshots.sync(); } finally { await snapshots.close(); }
        current[payload.slug] = key; await persist();
      },
    };
    return await action(ledger);
  } finally { await lock.close(); await unlink(lockPath); }
}
export async function recoverySnapshot(slug: string) {
  const key = (await registry())[slugSchema.parse(slug)];
  if (!key) return null;
  return { key, exercise: await snapshotByKey(key) };
}
async function snapshotByKey(key: string) {
  hashSchema.parse(key);
  const text = await boundedRead(join(root(), "snapshots", `${key}.json`), 262144);
  if (digest(text) !== key) throw new Error("Publication checksum mismatch");
  return studentSchema.parse(JSON.parse(text));
}
function signingKey() {
  const value = process.env.CLASSROOM_SESSION_SECRET;
  if (!value || value.length < 64) throw new Error("Publication boundary is unavailable");
  return value;
}
/** Pin the proxy's publication decision across rendering, even if unpublish races the render. */
export function publicationPin(slug: string, key: string) {
  const body = Buffer.from(JSON.stringify({ slug, key, expires: Date.now() + 5 * 60_000 })).toString("base64url");
  return `${body}.${createHmac("sha256", signingKey()).update(body).digest("hex")}`;
}
export async function pinnedSnapshot(slug: string, pin: string | null) {
  if (!pin || pin.length > 1024) throw new Error("Missing publication decision");
  const [body, signature] = pin.split(".");
  const expected = createHmac("sha256", signingKey()).update(body).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(signature ?? "") || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw new Error("Invalid publication decision");
  const value = z.strictObject({ slug: slugSchema, key: hashSchema, expires: z.number() }).parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
  if (value.slug !== slug || value.expires < Date.now()) throw new Error("Expired publication decision");
  const exercise = await snapshotByKey(value.key);
  if (exercise.slug !== slug) throw new Error("Invalid publication snapshot");
  return exercise;
}
// Used by importer/recovery tests to prove snapshots contain only the public DTO.
export const publicChecksum = (value: StudioStudentExercise) => digest(JSON.stringify(studentSchema.parse(value)));

/** A cutover fence prevents accidental rollback to the stale source catalog. Keep its configuration on rollback. */
export async function assertSeedDeliverySafe() {
  if (!process.env.CLASSROOM_RECOVERY_DIR) return;
  try { await stat(join(root(), "database-delivery.fence")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  throw new StudioError(503, "Use recovery mode after a database cutover; source rollback could revive unpublished lessons.");
}
export async function assertDatabaseDeliveryReady() {
  await stat(join(root(), "database-delivery.fence"));
}
