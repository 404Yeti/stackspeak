import { teacherLibrary } from "@/lib/classroom/content";
import { ExerciseLibrary } from "@/features/classroom/ExerciseLibrary";
export default async function ClassroomPage() {
  return <ExerciseLibrary exercises={await teacherLibrary()} />;
}
