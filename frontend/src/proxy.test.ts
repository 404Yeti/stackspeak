// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const snapshots = vi.hoisted(() => ({ currentStudentSnapshot: vi.fn(), studentSnapshotPin: vi.fn(() => "SERVER_PIN") }));
vi.mock("@/lib/classroom/studio/publicationSnapshot", () => snapshots);
import { proxy } from "./proxy";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("Student HTTP publication boundary", () => {
  it("returns real HTTP 404 for missing/private source lessons before rendering", async () => {
    vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "seed");
    for (const slug of ["csharp-await-task", "does-not-exist", "invalid%20slug", "python-loop-accumulator/extra"]) {
      const response = await proxy(new NextRequest(`https://classroom.test/exercises/${slug}`));
      expect(response.status).toBe(404); expect(await response.text()).not.toContain("readCode");
    }
  });
  it("preserves published source links and overwrites forged publication headers", async () => {
    vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "seed");
    const response = await proxy(new NextRequest("https://classroom.test/exercises/python-loop-accumulator", { headers: { "x-stackspeak-publication": "FORGED" } }));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify([...response.headers])).not.toContain("FORGED");
  });
  it("returns hard404 for revoked/draft Studio slugs and503 on outages, without stale fallback", async () => {
    vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "studio");
    snapshots.currentStudentSnapshot.mockResolvedValueOnce(null).mockRejectedValueOnce(Error("DB down"));
    expect((await proxy(new NextRequest("https://classroom.test/exercises/lesson-revoked"))).status).toBe(404);
    expect((await proxy(new NextRequest("https://classroom.test/exercises/lesson-revoked"))).status).toBe(503);
    expect((await proxy(new NextRequest("https://classroom.test/exercises/python-loop-accumulator"))).status).toBe(200);
    expect((await proxy(new NextRequest("https://classroom.test/exercises/csharp-await-task"))).status).toBe(404);
    expect(snapshots.currentStudentSnapshot).toHaveBeenCalledTimes(2);
  });
  it("replaces a caller pin with a fresh server-authorized snapshot", async () => {
    vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "studio");
    snapshots.currentStudentSnapshot.mockResolvedValueOnce({ slug: "lesson-live" });
    const response = await proxy(new NextRequest("https://classroom.test/exercises/lesson-live", { headers: { "x-stackspeak-publication": "FORGED" } }));
    expect(response.status).toBe(200);
    expect(JSON.stringify([...response.headers])).not.toContain("FORGED");
    expect(response.headers.get("x-middleware-request-x-stackspeak-publication")).toBe("SERVER_PIN");
  });
  it("blocks cloud database cutover instead of trusting ephemeral recovery files", async () => {
    vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "database"); vi.stubEnv("VERCEL", "1");
    expect((await proxy(new NextRequest("https://classroom.test/exercises/python-loop-accumulator"))).status).toBe(503);
  });
});
