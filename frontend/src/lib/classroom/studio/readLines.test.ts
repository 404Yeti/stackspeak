import { describe, expect, it } from "vitest";
import { parseReadLines } from "./readLines";
import { changeSchema, draftSchema, projectStudent, recoverStoredDraft, studentSchema } from "./validation";
import { publishableDraft } from "@/test/studioFixtures";

describe("vocabulary Read line parsing", () => {
  it.each([["1", [1]], ["1,2", [1, 2]], ["", []], ["1, ", [1]], [" , ", []]] as const)("parses %j safely", (input, lines) => {
    expect(parseReadLines(input, 10)).toEqual({ lines });
  });
  it.each(["word", "1,word", "0", "-1", "1.5", "1e1", "0x1", "1,1", "11", "Infinity"])("rejects %j", (input) => {
    expect(parseReadLines(input, 10).error).toMatch(/whole line numbers/);
  });
  it("accepts empty draft references, but never null/NaN, and preserves the public contract", () => {
    const draft = publishableDraft(); draft.vocabulary[0].readLines = [];
    expect(changeSchema.parse({ expectedVersion: 1, draft }).draft.vocabulary[0].readLines).toEqual([]);
    const student = projectStudent("id", "lesson", 1, draft);
    expect(student.vocabulary[0]).not.toHaveProperty("readLines");
    for (const invalid of [null, NaN]) {
      expect(draftSchema.safeParse({ ...draft, vocabulary: [{ ...draft.vocabulary[0], readLines: [invalid] }] }).success).toBe(false);
      expect(studentSchema.safeParse({ ...student, vocabulary: [{ ...student.vocabulary[0], readLines: [invalid] }] }).success).toBe(false);
    }
  });
  it("recovers only stored draft references, preserving vocabulary text and order", () => {
    const draft = publishableDraft();
    draft.vocabulary = draft.vocabulary.slice(0, 2);
    const vocabulary = [...draft.vocabulary, { term: "third", definition: "Keep definition", example: "Keep example", pronunciation: "keep", readLines: [null, 1] }];
    const result = recoverStoredDraft({ content: draft.content, vocabulary });
    expect(result.recoveredReadLines).toEqual([3]);
    expect(result.draft.vocabulary).toEqual([...draft.vocabulary, { ...vocabulary[2], readLines: [1] }]);
    const empty = recoverStoredDraft({ content: draft.content, vocabulary: [{ ...vocabulary[2], readLines: [null] }] });
    expect(empty.draft.vocabulary[0].readLines).toEqual([]);
  });
});
