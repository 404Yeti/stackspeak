// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
import { proxy } from "./proxy";
afterEach(() => vi.unstubAllEnvs());
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
  it("blocks cloud database cutover instead of trusting ephemeral recovery files", async () => {
    vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "database"); vi.stubEnv("VERCEL", "1");
    expect((await proxy(new NextRequest("https://classroom.test/exercises/python-loop-accumulator"))).status).toBe(503);
  });
});
