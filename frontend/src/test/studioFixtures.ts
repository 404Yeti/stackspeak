import { draftSchema, guideSchema } from "@/lib/classroom/studio/validation";
import catalog from "../../content/classroom/exercises.json";
export function publishableDraft() {
  const e = catalog[0];
  return draftSchema.parse({ content: { title: e.title, description: e.description, language: e.language,
    difficulty: e.difficulty, topic: e.topics[0], topics: e.topics, tags: e.tags,
    learningObjectives: ["Explain the loop"], filename: e.filename, minutes: e.minutes,
    instructions: e.instructions, readContent: "", readCode: e.readCode, questions: e.questions, fix: e.fix }, vocabulary: e.vocabulary });
}
export function syntheticGuide() {
  return guideSchema.parse({ idealExplanation: "PRIVATE_CANARY_TECHNICAL", spokenExplanation: "PRIVATE_CANARY_SPOKEN",
    expectedSolution: "PRIVATE_CANARY_SOLUTION", debuggingGuidance: "", teachingHints: [], followUpQuestions: [],
    privateNotes: "PRIVATE_CANARY_NOTES", answers: [], misunderstandings: [] });
}
