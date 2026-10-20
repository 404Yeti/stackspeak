import { notFound } from "next/navigation";
import { sharedExercise } from "@/lib/classroom/content";
import { ClassroomWorkspace } from "@/features/classroom/ClassroomWorkspace";
export default async function StudentExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const exercise = sharedExercise((await params).slug);
  if (!exercise) notFound();
  return <ClassroomWorkspace exercise={exercise} />;
}
