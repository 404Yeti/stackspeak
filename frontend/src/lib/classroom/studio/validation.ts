import { z } from "zod";

const text = (max: number) => z.string().max(max).refine((s) => !s.includes("\0"), "NUL is not allowed");
const list = (max = 1000) => z.array(text(max)).max(50);
export const questionSchema = z.strictObject({ id: text(80).min(1), prompt: text(2000) });
export const vocabularySchema = z.strictObject({
  term: text(120).min(1), definition: text(2000), example: text(2000),
  speakingPrompt: text(1000).optional(), pronunciation: text(500).optional(),
  readLines: z.array(z.number().int().min(1).max(20001)).min(1).max(500)
    .refine((a) => new Set(a).size === a.length, "Duplicate line reference").optional(),
});
export const contentSchema = z.strictObject({
  title: text(200), description: text(4000), language: z.enum(["Python", "C#"]),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]), topic: text(100),
  topics: list(100), tags: list(100), learningObjectives: list(1000),
  filename: text(120).min(1), minutes: z.number().int().min(1).max(240),
  instructions: text(8000), readContent: text(8000), readCode: text(20000),
  questions: z.array(questionSchema).max(50),
  fix: z.strictObject({ instructions: text(8000), buggyCode: text(20000), hints: list(2000) }),
}).superRefine((v, ctx) => {
  if (new Set(v.questions.map((q) => q.id)).size !== v.questions.length)
    ctx.addIssue({ code: "custom", path: ["questions"], message: "Question IDs must be unique" });
});
export const draftSchema = z.strictObject({
  content: contentSchema, vocabulary: z.array(vocabularySchema).max(100),
}).superRefine((v, ctx) => {
  if (new Set(v.vocabulary.map((x) => x.term.toLowerCase())).size !== v.vocabulary.length)
    ctx.addIssue({ code: "custom", path: ["vocabulary"], message: "Terms must be unique" });
  v.vocabulary.forEach((entry, i) => {
    if (entry.readLines?.some((n) => n > v.content.readCode.split("\n").length))
      ctx.addIssue({ code: "custom", path: ["vocabulary", i, "readLines"], message: "Line is outside Read code" });
  });
});
export const guideSchema = z.strictObject({
  idealExplanation: text(8000), spokenExplanation: text(8000), expectedSolution: text(20000),
  debuggingGuidance: text(8000), teachingHints: list(2000), followUpQuestions: list(2000),
  privateNotes: text(8000), misunderstandings: list(2000),
  answers: z.array(z.strictObject({ questionId: text(80).min(1), spokenExample: text(8000), listenFor: list(2000) })).max(50),
}).superRefine((v, ctx) => {
  if (new Set(v.answers.map((a) => a.questionId)).size !== v.answers.length)
    ctx.addIssue({ code: "custom", path: ["answers"], message: "Answer question IDs must be unique" });
});
export const versionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const changeSchema = z.strictObject({ expectedVersion: versionSchema, draft: draftSchema });
export const guideChangeSchema = z.strictObject({ expectedVersion: versionSchema, guide: guideSchema });
export const actionSchema = z.strictObject({ expectedVersion: versionSchema });
export const createSchema = z.strictObject({ language: z.enum(["Python", "C#"]), title: text(200).optional() });
export const idSchema = z.uuid();
export const slugSchema = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type Draft = z.infer<typeof draftSchema>;
export type Guide = z.infer<typeof guideSchema>;
export const publishedContentSchema = contentSchema.superRefine((v, ctx) => {
  for (const key of ["title", "description", "topic", "instructions", "readCode"] as const)
    if (!v[key].trim()) ctx.addIssue({ code: "custom", path: [key], message: "Required to publish" });
  if (!v.learningObjectives.length || !v.learningObjectives.every((x) => x.trim()))
    ctx.addIssue({ code: "custom", path: ["learningObjectives"], message: "Add learning objectives" });
  if (!v.questions.length || !v.questions.every((x) => x.prompt.trim()))
    ctx.addIssue({ code: "custom", path: ["questions"], message: "Add explanation questions" });
  if (!v.fix.instructions.trim() || !v.fix.buggyCode.trim())
    ctx.addIssue({ code: "custom", path: ["fix"], message: "Add a Fix task and starter code" });
});
export function validatePublish(draft: Draft) {
  draftSchema.parse(draft);
  publishedContentSchema.parse(draft.content);
  z.array(vocabularySchema.refine((v) => !!v.definition.trim() && !!v.example.trim(), "Complete vocabulary definitions/examples"))
    .min(1).parse(draft.vocabulary);
}
export function emptyDraft(language: "Python" | "C#", title = ""): Draft {
  return { content: { title, description: "", language, difficulty: "Beginner", topic: "", topics: [], tags: [],
    learningObjectives: [], filename: language === "Python" ? "lesson.py" : "Lesson.cs", minutes: 20,
    instructions: "", readContent: "", readCode: "", questions: [], fix: { instructions: "", buggyCode: "", hints: [] } }, vocabulary: [] };
}
// This strict public schema is also the load-time boundary for stored snapshots.
export const studentSchema = z.strictObject({
  id: text(100).min(1), slug: slugSchema, version: versionSchema,
  title: text(200), description: text(4000), language: z.enum(["Python", "C#"]),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]), topics: list(100), tags: list(100),
  minutes: z.number().int().min(1).max(240), filename: text(120).min(1), instructions: text(8000),
  readContent: text(8000), learningObjectives: list(1000), readCode: text(20000),
  vocabulary: z.array(vocabularySchema).max(100), questions: z.array(questionSchema).max(50),
  fix: z.strictObject({ instructions: text(8000), buggyCode: text(20000), hints: list(2000) }),
});
export type StudioStudentExercise = z.infer<typeof studentSchema>;
export function projectStudent(id: string, slug: string, version: number, draft: Draft): StudioStudentExercise {
  const d = draftSchema.parse(draft); // strict parse rejects accidental private fields
  const c = d.content;
  return studentSchema.parse({ id, slug, version, title: c.title, description: c.description,
    language: c.language, difficulty: c.difficulty, topics: [...new Set([c.topic, ...c.topics].filter(Boolean))], tags: c.tags, minutes: c.minutes,
    filename: c.filename, instructions: c.instructions, readCode: c.readCode, readContent: c.readContent,
    learningObjectives: c.learningObjectives, questions: c.questions.map((q) => ({ id: q.id, prompt: q.prompt })),
    vocabulary: d.vocabulary.map((v) => ({ term: v.term, definition: v.definition, example: v.example,
      ...(v.readLines ? { readLines: [...v.readLines] } : {}),
      ...(v.speakingPrompt !== undefined ? { speakingPrompt: v.speakingPrompt } : {}),
      ...(v.pronunciation !== undefined ? { pronunciation: v.pronunciation } : {}) })),
    fix: { instructions: c.fix.instructions, buggyCode: c.fix.buggyCode, hints: [...c.fix.hints] } });
}
