import { connection } from "next/server";
import { headers } from "next/headers";
import { pinnedSnapshot } from "@/lib/classroom/studio/recovery";
import { notFound } from "next/navigation";
import { sharedExercise } from "@/lib/classroom/content";
import { ClassroomWorkspace } from "@/features/classroom/ClassroomWorkspace";
export default async function StudentExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const databaseMode = ["database", "recovery"].includes(process.env.CLASSROOM_CONTENT_SOURCE ?? "");
  if (databaseMode) await connection();
  const exercise = databaseMode
    ? await pinnedSnapshot(slug, (await headers()).get("x-stackspeak-publication"))
    : sharedExercise(slug);
  if (!exercise) notFound();
  return <ClassroomWorkspace exercise={exercise} />;
}
