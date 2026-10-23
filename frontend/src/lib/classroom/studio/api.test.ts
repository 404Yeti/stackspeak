import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ allowed: false }));
vi.mock("../auth", () => ({ isTeacher: async () => auth.allowed,
  sameOrigin: (r: Request) => r.headers.get("origin") === "https://classroom.test" }));
const store = vi.hoisted(() => ({ createExercise: vi.fn(async () => ({ id: "test-id" })),
  listExercises: vi.fn(async () => ({ exercises: [] })) }));
vi.mock("./repository", () => store);
import { GET, POST } from "@/app/classroom/api/studio/exercises/route";
import { readJson, teacherResponse } from "./http";

const req = (body: string, origin = "https://classroom.test", type = "application/json") =>
  new Request("https://classroom.test/classroom/api/studio/exercises", { method: "POST", headers: { origin, "content-type": type }, body });
afterEach(() => { auth.allowed = false; vi.clearAllMocks(); });
describe("Studio HTTP security", () => {
  it("authorizes before storage or request validation and never redirects API callers", async () => {
    expect((await GET(req(""))).status).toBe(401);
    expect((await POST(req("not json"))).status).toBe(401);
    expect(store.listExercises).not.toHaveBeenCalled();
    expect(store.createExercise).not.toHaveBeenCalled();
  });
  it("guards every Studio route handler before data access", async () => {
    const modules = [
      await import("@/app/classroom/api/studio/exercises/[id]/route"),
      await import("@/app/classroom/api/studio/exercises/[id]/guide/route"),
      await import("@/app/classroom/api/studio/exercises/[id]/preview/route"),
      await import("@/app/classroom/api/studio/exercises/[id]/duplicate/route"),
      await import("@/app/classroom/api/studio/exercises/[id]/publish/route"),
      await import("@/app/classroom/api/studio/exercises/[id]/unpublish/route"),
    ];
    for (const routeModule of modules) for (const handler of Object.values(routeModule)) {
      const response = await handler(req("not json"), { params: Promise.resolve({ id: "invalid-id" }) });
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });
  it("rejects missing/foreign origins and forwarded-header spoofing", async () => {
    auth.allowed = true;
    for (const origin of ["", "https://attacker.test"]) {
      const request = req('{"language":"Python"}', origin);
      request.headers.set("x-forwarded-host", "classroom.test");
      expect((await POST(request)).status).toBe(403);
    }
    expect(store.createExercise).not.toHaveBeenCalled();
  });
  it("validates bodies and returns private no-store/nosniff responses", async () => {
    auth.allowed = true;
    expect((await POST(req('{"language":"Ruby"}'))).status).toBe(422);
    expect((await POST(req('{"language":"Python","publication":"published"}'))).status).toBe(422);
    expect((await POST(req("{}", undefined, "text/plain"))).status).toBe(415);
    expect((await POST(req("{"))).status).toBe(400);
    const response = await POST(req('{"language":"C#"}'));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("bounds chunked bodies without trusting Content-Length and sanitizes DB errors", async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(256 * 1024 + 1)); controller.close(); } });
    const request = new Request("https://classroom.test", { method: "POST", body: stream, duplex: "half",
      headers: { "content-type": "application/json" } } as RequestInit);
    await expect(readJson(request)).rejects.toMatchObject({ status: 413 });
    auth.allowed = true;
    const response = await teacherResponse(req("{}"), true, async () => { throw new Error("PRIVATE_CANARY_DB_PASSWORD"); });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_CANARY");
  });
});
