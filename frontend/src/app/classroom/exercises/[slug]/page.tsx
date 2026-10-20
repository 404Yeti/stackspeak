import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/classroom/auth";
import { teacherExercise } from "@/lib/classroom/content";
import { isShareable, studentProjection } from "@/lib/classroom/schema";
import { ClassroomWorkspace } from "@/features/classroom/ClassroomWorkspace";
export default async function TeacherExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireTeacher();
  const record = await teacherExercise((await params).slug);
  if (!record) notFound();
  // Even teacher page hydration excludes answers. Reveal fetches them separately.
  return (
    <ClassroomWorkspace
      exercise={studentProjection(record)}
      teacher
      shareable={isShareable(record)}
    />
  );
}
