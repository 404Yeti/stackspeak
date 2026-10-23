import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/classroom/auth";
import { getExercise } from "@/lib/classroom/studio/repository";
import { StudioError } from "@/lib/classroom/studio/errors";
import { StudioEditor } from "@/features/classroom/studio/StudioEditor";
export default async function StudioEditorPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }>;
}) {
  await requireTeacher();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  let initial;
  try { initial = await getExercise(id); }
  catch (error) { if (error instanceof StudioError && error.status === 404) notFound(); throw error; }
  return <StudioEditor initial={initial} deliveryEnabled={process.env.CLASSROOM_CONTENT_SOURCE === "studio" || (process.env.CLASSROOM_CONTENT_SOURCE === "database" && !process.env.VERCEL)}
    startPreview={(await searchParams).tab === "preview"} />;
}
