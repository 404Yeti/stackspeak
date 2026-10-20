import type { ExerciseRecord, TeacherGuide } from "@/features/classroom/types";
/** Deliberately public test data. These are not lesson answers or teaching material. */
export function makeTestGuides(
  exercises: ExerciseRecord[],
  marker = "PUBLIC TEST FIXTURE",
) {
  return Object.fromEntries(
    exercises.map((exercise) => [
      exercise.slug,
      {
        answers: exercise.questions.map((question) => ({
          questionId: question.id,
          spokenExample: `${marker}: test-only response for ${question.id}.`,
          listenFor: ["Test-only concept"],
        })),
        correction: `${marker}: test-only correction`,
        notes: ["Test-only teaching note"],
        misunderstandings: ["Test-only misunderstanding"],
        followUps: ["Test-only follow-up question?"],
      } satisfies TeacherGuide,
    ]),
  );
}
