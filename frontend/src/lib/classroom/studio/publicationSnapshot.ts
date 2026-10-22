import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { database } from "./database";
import { StudioError } from "./errors";
import { studentSchema, type StudioStudentExercise } from "./validation";
import { sharedExercise } from "../content";
import { parseExercises } from "../schema";
import catalog from "../../../../content/classroom/exercises.json";
const sourceExercises = parseExercises(catalog);
const PIN_LIMIT = 6 * 1024;
const TTL = 5 * 60_000;
export function reservedSourceSlug(slug: string) { return sourceExercises.some((e) => e.slug === slug); }
/** Only fixed legacy source URLs use seeds. Database lessons NEVER fall back on failure. */
export async function currentStudentSnapshot(slug: string): Promise<StudioStudentExercise | null> {
  if (reservedSourceSlug(slug)) {
    const legacy = sharedExercise(slug);
    return legacy ? studentSchema.parse({ ...legacy, readContent: legacy.readContent ?? "", learningObjectives: legacy.learningObjectives ?? [] }) : null;
  }
  const rows = await database("reader")`select student_payload from classroom.published_exercises where slug = ${slug}`;
  if (!rows[0]) return null;
  const value = studentSchema.parse(rows[0].student_payload);
  if (value.slug !== slug) throw new StudioError(503, "Publication storage is inconsistent.");
  return value;
}
function bodyFor(input: StudioStudentExercise) {
  const payload = studentSchema.parse(input);
  const text = JSON.stringify(payload);
  if (Buffer.byteLength(text) > 262144) throw new StudioError(422, "Exercise is too large to publish.");
  const body = `${Date.now() + TTL}.${deflateRawSync(text).toString("base64url")}`;
  if (Buffer.byteLength(body) + 65 > PIN_LIMIT) throw new StudioError(422, "Exercise is too large to publish. Shorten its code, questions or vocabulary.");
  return body;
}
export function validateSnapshotTransport(value: StudioStudentExercise) { bodyFor(value); }
function key() {
  const secret = process.env.CLASSROOM_SESSION_SECRET;
  if (!secret || secret.length < 64) throw new StudioError(503, "Publication boundary is unavailable.");
  return secret;
}
function signature(body: string) { return createHmac("sha256", key()).update(`studio-snapshot-v1:${body}`).digest("hex"); }
/** Signed public-only snapshot stays inside the server request, never in client props. */
export function studentSnapshotPin(value: StudioStudentExercise) {
  const body = bodyFor(value);
  return `${body}.${signature(body)}`;
}
export function readStudentSnapshotPin(slug: string, token: string | null) {
  if (!token || Buffer.byteLength(token) > PIN_LIMIT) throw new Error("Missing publication decision");
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d{13}$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) throw new Error("Invalid publication decision");
  const body = `${parts[0]}.${parts[1]}`;
  if (!timingSafeEqual(Buffer.from(signature(body)), Buffer.from(parts[2]))) throw new Error("Invalid publication decision");
  const expires = Number(parts[0]);
  if (expires < Date.now() || expires > Date.now() + TTL + 1000) throw new Error("Expired publication decision");
  const value = studentSchema.parse(JSON.parse(inflateRawSync(Buffer.from(parts[1], "base64url"), { maxOutputLength: 262144 }).toString("utf8")));
  if (value.slug !== slug) throw new Error("Invalid publication snapshot");
  return value;
}
