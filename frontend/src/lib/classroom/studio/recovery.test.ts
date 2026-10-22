// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { pinnedSnapshot, publicationPin, recoverySnapshot, withPublicationLedger, assertSeedDeliverySafe } from "./recovery";
import { projectStudent } from "./validation";
import { publishableDraft, syntheticGuide } from "@/test/studioFixtures";
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "stackspeak-recovery-test-"));
  vi.stubEnv("CLASSROOM_RECOVERY_DIR", directory); vi.stubEnv("CLASSROOM_SESSION_SECRET", "x".repeat(96));
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
describe("Durable public recovery and publication pinning", () => {
  it("survives restart reads, retains tombstones, and pins a request without exposing future requests", async () => {
    const payload = projectStudent("id", "lesson", 1, publishableDraft());
    await withPublicationLedger(async (ledger) => { await ledger.deny("lesson"); await ledger.activate(payload); });
    const snapshot = await recoverySnapshot("lesson");
    expect(snapshot?.exercise).toEqual(payload);
    const pin = publicationPin("lesson", snapshot!.key);
    await expect(withPublicationLedger(async (ledger) => { await ledger.deny("lesson"); throw new Error("Simulated DB failure after deny"); })).rejects.toThrow();
    expect(await recoverySnapshot("lesson")).toBeNull();
    expect(await pinnedSnapshot("lesson", pin)).toEqual(payload); // request admitted before unpublish
    await expect(pinnedSnapshot("another-lesson", pin)).rejects.toThrow();
    await expect(pinnedSnapshot("lesson", pin + "x")).rejects.toThrow();
  });
  it("rejects private fields and corrupt artifacts rather than falling back to seeds", async () => {
    const payload = projectStudent("id", "lesson", 1, publishableDraft());
    await expect(withPublicationLedger((ledger) => ledger.activate({ ...payload, guide: syntheticGuide() } as typeof payload))).rejects.toThrow();
    await writeFile(join(directory, "registry.json"), "{corrupt");
    await expect(recoverySnapshot("python-loop-accumulator")).rejects.toThrow();
  });
  it("serializes publishers and refuses an orphaned crash lock without auto-breaking it", async () => {
    await writeFile(join(directory, "publication.lock"), "", { mode: 0o600 });
    await expect(withPublicationLedger(async () => true)).rejects.toMatchObject({ status: 503 });
  });
  it("refuses ephemeral cloud storage and expired pins", async () => {
    const payload = projectStudent("id", "lesson", 1, publishableDraft());
    await withPublicationLedger((ledger) => ledger.activate(payload));
    const snapshot = await recoverySnapshot("lesson");
    const pin = publicationPin("lesson", snapshot!.key);
    const now = Date.now(); vi.spyOn(Date, "now").mockReturnValue(now + 6 * 60_000);
    await expect(pinnedSnapshot("lesson", pin)).rejects.toThrow("Expired");
    vi.restoreAllMocks();
    vi.stubEnv("VERCEL", "1");
    await expect(withPublicationLedger(async () => true)).rejects.toMatchObject({ status: 503 });
  });
  it("blocks stale source rollback after cutover and keeps recovery read-only", async () => {
    vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "database");
    await withPublicationLedger((ledger) => ledger.activate(projectStudent("id", "lesson", 1, publishableDraft())));
    vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "seed");
    await expect(assertSeedDeliverySafe()).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "recovery");
    expect((await recoverySnapshot("lesson"))?.exercise.title).toBe(publishableDraft().content.title);
    await expect(withPublicationLedger(async () => true)).rejects.toMatchObject({ status: 503 });
  });

});
