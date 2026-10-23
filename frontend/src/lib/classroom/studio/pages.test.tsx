import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ allowed: false }));
vi.mock("../auth", () => ({ requireTeacher: async () => { if (!auth.allowed) throw new Error("SIGN_IN"); } }));
vi.mock("./repository", () => ({ getExercise: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import StudioPage from "@/app/classroom/studio/page";
import EditorPage from "@/app/classroom/studio/[id]/page";
afterEach(() => { auth.allowed = false; });
describe("Studio page boundaries", () => {
  it("requires teacher login before rendering the library or resolving an exercise", async () => {
    await expect(StudioPage()).rejects.toThrow("SIGN_IN");
    await expect(EditorPage({ params: Promise.resolve({ id: "invalid" }), searchParams: Promise.resolve({}) })).rejects.toThrow("SIGN_IN");
    auth.allowed = true; expect((await StudioPage()).type).toBeDefined();
    await expect(EditorPage({ params: Promise.resolve({ id: "invalid" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  });
});
