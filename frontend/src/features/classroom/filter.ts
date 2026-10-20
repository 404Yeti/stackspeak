import type { ExerciseSummary } from "./types";

export function filterExercises(
  exercises: ExerciseSummary[],
  query: string,
  language: string,
  topic: string,
  difficulty: string,
) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return exercises.filter((exercise) => {
    const text = [
      exercise.title,
      exercise.description,
      exercise.language,
      ...exercise.topics,
      ...exercise.tags,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      words.every((word) => text.includes(word)) &&
      (!language || exercise.language === language) &&
      (!topic || exercise.topics.includes(topic)) &&
      (!difficulty || exercise.difficulty === difficulty)
    );
  });
}
