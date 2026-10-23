// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("./database", () => ({ database: (role: string) => { if (role !== "reader") throw Error("Wrong role"); return mock.read; } }));
import { currentStudentSnapshot, studentSnapshotPin, readStudentSnapshotPin, validateSnapshotTransport } from "./publicationSnapshot";
import { publishableDraft } from "@/test/studioFixtures";
import { projectStudent } from "./validation";
const payload = () => projectStudent("synthetic", "lesson-synthetic", 1, publishableDraft());
beforeEach(() => { vi.stubEnv("CLASSROOM_SESSION_SECRET", "s".repeat(64)); mock.read.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("Database-authoritative student snapshots", () => {
  it("preserves fixed source URLs during DB failure and never resolves their private draft from DB", async () => {
    mock.read.mockRejectedValue(Error("DB down"));
    expect((await currentStudentSnapshot("python-loop-accumulator"))?.language).toBe("Python");
    expect((await currentStudentSnapshot("csharp-linq-deferred"))?.language).toBe("C#");
    expect(await currentStudentSnapshot("csharp-await-task")).toBeNull();
    expect(mock.read).not.toHaveBeenCalled();
  });
  it("reads only published payloads afresh and never resurrects a revoked lesson", async () => {
    mock.read.mockResolvedValueOnce([{ student_payload: payload() }]).mockResolvedValueOnce([]).mockRejectedValueOnce(Error("DB down"));
    expect(await currentStudentSnapshot("lesson-synthetic")).toEqual(payload());
    expect(await currentStudentSnapshot("lesson-synthetic")).toBeNull();
    await expect(currentStudentSnapshot("lesson-synthetic")).rejects.toThrow("DB down");
    expect(mock.read).toHaveBeenCalledTimes(3);
  });
  it("rejects private fields and incorrect slug from database payloads", async () => {
    mock.read.mockResolvedValue([{ student_payload: { ...payload(), privateNotes: "PRIVATE" } }]);
    await expect(currentStudentSnapshot("lesson-synthetic")).rejects.toThrow();
    mock.read.mockResolvedValue([{ student_payload: payload() }]);
    await expect(currentStudentSnapshot("other-lesson")).rejects.toThrow("inconsistent");
  });
  it("pins a public-only Python/C# snapshot across an in-flight unpublish without a second DB read", () => {
    for (const language of ["Python", "C#"] as const) {
      const value = { ...payload(), language }; const token = studentSnapshotPin(value);
      expect(readStudentSnapshotPin(value.slug, token)).toEqual(value);
      expect(mock.read).not.toHaveBeenCalled();
    }
    expect(() => studentSnapshotPin({ ...payload(), privateNotes: "PRIVATE" } as never)).toThrow();
  });
  it("rejects forged, wrong-slug, expired and oversized decisions", () => {
    vi.useFakeTimers(); const token = studentSnapshotPin(payload());
    expect(() => readStudentSnapshotPin("other-lesson", token)).toThrow();
    expect(() => readStudentSnapshotPin("lesson-synthetic", token.slice(0, -2) + "zz")).toThrow();
    expect(() => readStudentSnapshotPin("lesson-synthetic", "x".repeat(7000))).toThrow();
    vi.advanceTimersByTime(300001);
    expect(() => readStudentSnapshotPin("lesson-synthetic", token)).toThrow("Expired");
  });
  it("rejects incompressible oversized publications before a database commit", () => {
    const value = payload(); value.readCode = randomBytes(9000).toString("hex");
    expect(() => validateSnapshotTransport(value)).toThrow("too large");
  });
});
