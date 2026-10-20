import type {
  ExerciseRecord,
  ExerciseSummary,
  StudentExercise,
  TeacherGuide,
} from "@/features/classroom/types";

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected object");
  return value as Record<string, unknown>;
};
const text = (value: unknown) => {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Expected nonempty text");
};
const texts = (value: unknown) => {
  if (!Array.isArray(value) || !value.length)
    throw new Error("Expected nonempty list");
  value.forEach(text);
};

/** Validate version-controlled content at build/load time, including guide/question links. */
export function parseExercises(value: unknown): ExerciseRecord[] {
  if (!Array.isArray(value)) throw new Error("Expected exercise array");
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const item of value) {
    const e = object(item);
    for (const key of [
      "id",
      "slug",
      "title",
      "description",
      "filename",
      "instructions",
      "readCode",
    ])
      text(e[key]);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(e.slug)))
      throw new Error("Invalid slug");
    if (ids.has(String(e.id)) || slugs.has(String(e.slug)))
      throw new Error("Duplicate exercise");
    ids.add(String(e.id));
    slugs.add(String(e.slug));
    if (!["Python", "C#", "JavaScript", "C++"].includes(String(e.language)))
      throw new Error("Invalid language");
    if (!["Beginner", "Intermediate"].includes(String(e.difficulty)))
      throw new Error("Invalid difficulty");
    if (
      !["published", "draft"].includes(String(e.publication)) ||
      !["public", "private"].includes(String(e.sharing))
    )
      throw new Error("Invalid publication state");
    if (
      !Number.isInteger(e.version) ||
      Number(e.version) < 1 ||
      !Number.isInteger(e.minutes) ||
      Number(e.minutes) < 1
    )
      throw new Error("Invalid version or duration");
    texts(e.topics);
    texts(e.tags);
    if (!Array.isArray(e.vocabulary) || !e.vocabulary.length)
      throw new Error("Missing vocabulary");
    for (const value of e.vocabulary) {
      const v = object(value);
      for (const key of ["term", "definition", "example"]) text(v[key]);
      if (v.speakingPrompt !== undefined) text(v.speakingPrompt);
      if (
        v.readLines !== undefined &&
        (!Array.isArray(v.readLines) ||
          !v.readLines.length ||
          !v.readLines.every(
            (n) =>
              Number.isInteger(n) &&
              n > 0 &&
              n <= String(e.readCode).split("\n").length,
          ))
      )
        throw new Error("Invalid vocabulary line reference");
    }
    if (!Array.isArray(e.questions) || !e.questions.length)
      throw new Error("Missing questions");
    const questionIds = e.questions.map((q) => {
      const v = object(q);
      text(v.id);
      text(v.prompt);
      return v.id;
    });
    if (new Set(questionIds).size !== questionIds.length)
      throw new Error("Duplicate question");
    const fix = object(e.fix);
    text(fix.instructions);
    text(fix.buggyCode);
    texts(fix.hints);
    if ("teacher" in e)
      throw new Error(
        "Teacher guides must not be stored in the exercise catalog",
      );
  }
  return value as ExerciseRecord[];
}

export function summarize(e: ExerciseRecord): ExerciseSummary {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    language: e.language,
    difficulty: e.difficulty,
    topics: [...e.topics],
    tags: [...e.tags],
    minutes: e.minutes,
  };
}

/** Allowlist at every level: never serialize an internal record with object spread. */
export function studentProjection(e: ExerciseRecord): StudentExercise {
  return {
    ...summarize(e),
    version: e.version,
    filename: e.filename,
    instructions: e.instructions,
    readCode: e.readCode,
    vocabulary: e.vocabulary.map((v) => ({
      term: v.term,
      definition: v.definition,
      example: v.example,
      ...(v.speakingPrompt ? { speakingPrompt: v.speakingPrompt } : {}),
      ...(v.readLines ? { readLines: [...v.readLines] } : {}),
    })),
    questions: e.questions.map((q) => ({ id: q.id, prompt: q.prompt })),
    fix: {
      instructions: e.fix.instructions,
      buggyCode: e.fix.buggyCode,
      hints: [...e.fix.hints],
    },
  };
}

export const isShareable = (e: ExerciseRecord) =>
  e.publication === "published" && e.sharing === "public";

/** Runtime validation and explicit projection of separately supplied private guides. */
export function parseGuides(
  value: unknown,
  exercises: ExerciseRecord[],
): Record<string, TeacherGuide> {
  const source = object(value);
  const result: Record<string, TeacherGuide> = {};
  for (const [slug, raw] of Object.entries(source)) {
    const exercise = exercises.find((e) => e.slug === slug);
    if (!exercise) throw new Error("Unknown guide exercise");
    const guide = object(raw);
    text(guide.correction);
    for (const key of ["notes", "misunderstandings", "followUps"])
      texts(guide[key]);
    if (
      !Array.isArray(guide.answers) ||
      guide.answers.length !== exercise.questions.length
    )
      throw new Error("Missing answers");
    const ids = new Set();
    const answers = guide.answers.map((raw) => {
      const answer = object(raw);
      text(answer.questionId);
      text(answer.spokenExample);
      texts(answer.listenFor);
      if (
        !exercise.questions.some((q) => q.id === answer.questionId) ||
        ids.has(answer.questionId)
      )
        throw new Error("Invalid answer question");
      ids.add(answer.questionId);
      return {
        questionId: answer.questionId as string,
        spokenExample: answer.spokenExample as string,
        listenFor: [...(answer.listenFor as string[])],
      };
    });
    result[slug] = {
      answers,
      correction: guide.correction as string,
      notes: [...(guide.notes as string[])],
      misunderstandings: [...(guide.misunderstandings as string[])],
      followUps: [...(guide.followUps as string[])],
    };
  }
  return result;
}
