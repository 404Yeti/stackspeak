import { teacherResponse } from "@/lib/classroom/studio/http";
import { previewExercise } from "@/lib/classroom/studio/repository";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return teacherResponse(request, false, async () => previewExercise((await context.params).id));
}
