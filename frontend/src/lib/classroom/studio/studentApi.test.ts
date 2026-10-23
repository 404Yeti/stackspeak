import { beforeEach, describe, expect, it, vi } from "vitest";
const store = vi.hoisted(() => ({ publishedExercise: vi.fn() }));
vi.mock("./repository", () => store);
import { GET } from "@/app/api/classroom/exercises/[slug]/route";
const get = (slug: string) => GET(new Request("https://classroom.test"), { params: Promise.resolve({ slug }) });
beforeEach(() => vi.clearAllMocks());
describe("Public Studio exercise API", () => {
  it("returns actual 404 for missing/unpublished slugs and no-store for successful responses", async () => {
    store.publishedExercise.mockResolvedValue(null);
    expect((await get("unpublished-lesson")).status).toBe(404);
    expect((await get("invalid slug")).status).toBe(404);
    store.publishedExercise.mockResolvedValue({ title: "Published lesson" });
    const response = await get("published-lesson");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("reports storage failure without resurrecting a source-backed seed or returning SQL details", async () => {
    store.publishedExercise.mockRejectedValue(new Error("PRIVATE_CANARY"));
    const response = await get("python-loop-accumulator");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_CANARY");
  });
});
