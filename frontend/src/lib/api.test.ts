import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  getChallenge,
  getChallengeReview,
  getDailyChallenge,
  type ChallengeLoad,
} from "./api";

const LOAD: ChallengeLoad = {
  id: "average-of-list",
  version: 2,
  title: "Average of a List",
  language: "python",
  difficulty: "beginner",
  topic: "Lists",
  learning_objectives: ["a"],
  starter_code: "def f(): pass",
  explain_prompts: ["p"],
  fix_prompts: ["q"],
};

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const fn = vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(String(input))));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("challenge api client", () => {
  it("loads the daily challenge as the first listed challenge", async () => {
    const fetchMock = mockFetch((url) =>
      url.endsWith("/api/challenges")
        ? json([{ id: LOAD.id, version: 2, title: LOAD.title, language: "python", difficulty: "beginner", topic: "Lists" }])
        : json(LOAD),
    );
    const challenge = await getDailyChallenge();
    expect(challenge.id).toBe("average-of-list");
    expect(fetchMock.mock.calls.map((c) => String(c[0]).replace(/^.*\/api/, "/api"))).toEqual([
      "/api/challenges",
      "/api/challenges/average-of-list",
    ]);
  });

  it("never requests stage content other than what's asked for", async () => {
    const fetchMock = mockFetch(() => json(LOAD));
    await getChallenge("average-of-list");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toMatch(/review|trace|defend/);
  });

  it("classifies a 404", async () => {
    mockFetch(() => new Response("{}", { status: 404 }));
    await expect(getChallenge("nope")).rejects.toMatchObject({ kind: "not_found" });
  });

  it("classifies a 500", async () => {
    mockFetch(() => new Response("oops", { status: 500 }));
    await expect(getChallenge("x")).rejects.toMatchObject({ kind: "server" });
  });

  it("classifies a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("failed to fetch"))));
    const error = await getChallenge("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "network" });
  });

  it("rejects a response with an unexpected shape", async () => {
    mockFetch(() => json({ id: "x" }));
    await expect(getChallenge("x")).rejects.toMatchObject({ kind: "invalid" });
    mockFetch(() => json({ bug_description: "b" }));
    await expect(getChallengeReview("x")).rejects.toMatchObject({ kind: "invalid" });
  });

  it("reports an empty catalog as not found", async () => {
    mockFetch(() => json([]));
    await expect(getDailyChallenge()).rejects.toMatchObject({ kind: "not_found" });
  });

  it("times out", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
      ),
    );
    const pending = getChallenge("x").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(await pending).toMatchObject({ kind: "timeout" });
  });

  it("surfaces a caller abort instead of a user-facing error", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
      ),
    );
    const pending = getChallenge("x", controller.signal).catch((e: unknown) => e);
    controller.abort();
    const error = await pending;
    expect(error).not.toBeInstanceOf(ApiError);
  });
});
