import "server-only";
import records from "../../../content/classroom/exercises.json";
import { requireTeacher } from "./auth";
import {
  isShareable,
  parseExercises,
  studentProjection,
  summarize,
} from "./schema";

const exercises = parseExercises(records);
/** Authorization lives at the data boundary as well as the guide API boundary. */
export async function teacherLibrary() {
  await requireTeacher();
  return exercises.map((e) => ({
    ...summarize(e),
    publication: e.publication,
    sharing: e.sharing,
  }));
}
export async function teacherExercise(slug: string) {
  await requireTeacher();
  return exercises.find((e) => e.slug === slug);
}
export function sharedExercise(slug: string) {
  const exercise = exercises.find((e) => e.slug === slug && isShareable(e));
  return exercise ? studentProjection(exercise) : undefined;
}
