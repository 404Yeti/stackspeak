import { describe, expect, it } from "vitest";
import { draftSchema, emptyDraft, projectStudent, studentSchema, validatePublish } from "./validation";
import { publishableDraft, syntheticGuide } from "@/test/studioFixtures";

describe("Studio validation and projection", () => {
  it("saves incomplete drafts but requires meaningful content for publishing", () => {
    expect(draftSchema.parse(emptyDraft("C#")).content.language).toBe("C#");
    expect(() => validatePublish(emptyDraft("Python"))).toThrow();
    expect(() => validatePublish(publishableDraft())).not.toThrow();
  });
  it("bounds nested data and rejects private fields at every public boundary", () => {
    const draft = publishableDraft();
    expect(() => draftSchema.parse({ ...draft, teacherGuide: syntheticGuide() })).toThrow();
    expect(() => draftSchema.parse({ ...draft, content: { ...draft.content, readCode: "x".repeat(20001) } })).toThrow();
    expect(() => draftSchema.parse({ ...draft, vocabulary: [{ ...draft.vocabulary[0], privateNotes: "secret" }] })).toThrow();
    const student = projectStudent("seed-id", "seed-slug", 1, draft);
    expect(JSON.stringify(student)).not.toContain("PRIVATE_CANARY");
    expect(() => studentSchema.parse({ ...student, guide: syntheticGuide() })).toThrow();
  });
  it("preserves noncontiguous Read lines and rejects stale/duplicate references", () => {
    const draft = publishableDraft();
    draft.vocabulary[0].readLines = [1, 3];
    expect(draftSchema.parse(draft).vocabulary[0].readLines).toEqual([1, 3]);
    draft.vocabulary[0].readLines = [1, 1];
    expect(() => draftSchema.parse(draft)).toThrow();
    draft.vocabulary[0].readLines = [9999];
    expect(() => draftSchema.parse(draft)).toThrow();
  });
  it("keeps text inert and supports C# and Advanced without executing code", () => {
    const draft = publishableDraft();
    draft.content.language = "C#";
    draft.content.difficulty = "Advanced";
    draft.content.readContent = "<script>alert('x')</script>";
    expect(projectStudent("id", "slug", 1, draft).readContent).toBe(draft.content.readContent);
  });
});
