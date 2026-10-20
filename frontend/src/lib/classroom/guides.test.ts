// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ allowed: true }));
vi.mock("./auth", () => ({
  requireTeacher: async () => {
    if (!auth.allowed) throw new Error("SIGN_IN");
  },
}));
import records from "../../../content/classroom/exercises.json";
import { parseExercises, parseGuides } from "./schema";
import { makeTestGuides } from "@/test/classroomFixtures";
import { privateGuide } from "./guides";
const exercises = parseExercises(records);
const testGuides = makeTestGuides(exercises);
beforeEach(() => {
  auth.allowed = true;
  vi.stubEnv("CLASSROOM_GUIDES_JSON", "");
  vi.stubEnv("CLASSROOM_GUIDES_FILE", "");
});
afterEach(() => vi.unstubAllEnvs());
describe("Private runtime guide boundary", () => {
  it("requires teacher authorization before reading configuration", async () => {
    auth.allowed = false;
    await expect(privateGuide(exercises[0].slug)).rejects.toThrow("SIGN_IN");
  });
  it("fails closed for absent, oversized or malformed runtime values without a source fallback", async () => {
    expect((await privateGuide(exercises[0].slug)).state).toBe("unavailable");
    for (const value of [
      "{private-invalid",
      "x".repeat(49 * 1024),
      JSON.stringify({ unknown: testGuides[exercises[0].slug] }),
    ]) {
      vi.stubEnv("CLASSROOM_GUIDES_JSON", value);
      expect((await privateGuide(exercises[0].slug)).state).toBe("unavailable");
    }
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CLASSROOM_GUIDES_FILE", "/tmp/not-a-deployment-guide.json");
    vi.stubEnv("CLASSROOM_GUIDES_JSON", "");
    expect((await privateGuide(exercises[0].slug)).state).toBe("unavailable");
  });
  it("validates and allowlists supplied guides only at authenticated runtime", async () => {
    vi.stubEnv("CLASSROOM_GUIDES_JSON", JSON.stringify(testGuides));
    const result = await privateGuide(exercises[0].slug);
    expect(result.state).toBe("available");
    expect((await privateGuide("unknown")).state).toBe("missing");
    const source = structuredClone(testGuides);
    Object.assign(source[exercises[0].slug], {
      unexpectedSecret: "DO NOT SERIALIZE",
    });
    expect(JSON.stringify(parseGuides(source, exercises))).not.toContain(
      "DO NOT SERIALIZE",
    );
    source[exercises[0].slug].answers[0].questionId = "not-a-question";
    expect(() => parseGuides(source, exercises)).toThrow();
  });
});
