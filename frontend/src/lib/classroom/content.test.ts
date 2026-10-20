import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ requireTeacher: async () => {} }));
import records from "../../../content/classroom/exercises.json";
import { sharedExercise, teacherLibrary } from "./content";
import { isShareable, parseExercises, studentProjection } from "./schema";
import { filterExercises } from "@/features/classroom/filter";

describe("Classroom content boundary", () => {
  it("validates all seeds and serves only published public exercises", async () => {
    const exercises = parseExercises(records);
    expect(exercises).toHaveLength(4);
    for (const e of exercises) {
      expect(!!sharedExercise(e.slug)).toBe(isShareable(e));
      const publicJson = JSON.stringify(studentProjection(e));
      expect(publicJson).not.toMatch(
        /"teacher"|"correction"|"listenFor"|"publication"/,
      );
    }
    expect(sharedExercise("does-not-exist")).toBeUndefined();
    expect(sharedExercise("csharp-await-task")).toBeUndefined();
    expect((await teacherLibrary()).every((e) => !("teacher" in e))).toBe(true);
  });
  it("allowlists nested fields even if a future internal record has new secrets", () => {
    const e = structuredClone(records[0]);
    Object.assign(e.vocabulary[0], { secret: "PRIVATE VOCAB" });
    Object.assign(e.fix, { correctedSolution: "PRIVATE FIX" });
    Object.assign(e.questions[0], { answer: "PRIVATE QUESTION" });
    expect(
      JSON.stringify(studentProjection(parseExercises([e])[0])),
    ).not.toContain("PRIVATE");
  });
  it("rejects duplicate slugs, invalid states and embedded answer guides", () => {
    expect(() => parseExercises([records[0], records[0]])).toThrow("Duplicate");
    expect(() =>
      parseExercises([{ ...records[0], publication: "invalid" }]),
    ).toThrow();
    expect(() => parseExercises([{ ...records[0], teacher: {} }])).toThrow(
      "must not",
    );
    expect(() => parseExercises([{ ...records[0], minutes: -1 }])).toThrow();
  });
  it("combines search, language, topic and difficulty", async () => {
    const library = await teacherLibrary();
    expect(
      filterExercises(library, "PYTHON loops", "Python", "loops", "Beginner"),
    ).toHaveLength(1);
    expect(
      filterExercises(library, "", "C#", "LINQ", "Intermediate"),
    ).toHaveLength(1);
    expect(filterExercises(library, "", "JavaScript", "", "")).toHaveLength(0);
  });
});
