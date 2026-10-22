export type Language = "Python" | "C#" | "JavaScript" | "C++";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type Stage = "Read" | "Explain" | "Fix";
export type VocabularyEntry = {
  term: string;
  definition: string;
  example: string;
  speakingPrompt?: string;
  pronunciation?: string;
  /** One-based references to the supplied Read code, never inferred from a draft. */
  readLines?: number[];
};
export type ExerciseSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  language: Language;
  difficulty: Difficulty;
  topics: string[];
  tags: string[];
  minutes: number;
};
/** Explicit student DTO. Never add teacher fields to this type. */
export type StudentExercise = ExerciseSummary & {
  version: number;
  filename: string;
  instructions: string;
  readCode: string;
  readContent?: string;
  learningObjectives?: string[];
  vocabulary: VocabularyEntry[];
  questions: { id: string; prompt: string }[];
  fix: { instructions: string; buggyCode: string; hints: string[] };
};
export type TeacherGuide = {
  answers: { questionId: string; spokenExample: string; listenFor: string[] }[];
  correction: string;
  notes: string[];
  misunderstandings: string[];
  followUps: string[];
};
export type ExerciseRecord = StudentExercise & {
  publication: "published" | "draft";
  sharing: "public" | "private";
};
