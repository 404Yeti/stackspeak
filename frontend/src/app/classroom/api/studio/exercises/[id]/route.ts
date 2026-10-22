import { teacherResponse, readJson } from "@/lib/classroom/studio/http";
import { actionSchema, changeSchema } from "@/lib/classroom/studio/validation";
import { getExercise, saveDraft, deleteExercise } from "@/lib/classroom/studio/repository";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return teacherResponse(request, false, async () => getExercise((await context.params).id));
}
export async function PATCH(request: Request, context: Context) {
  return teacherResponse(request, true, async () => {
    const value = changeSchema.parse(await readJson(request));
    return saveDraft((await context.params).id, value.expectedVersion, value.draft);
  });
}
export async function DELETE(request: Request, context: Context) {
  return teacherResponse(request, true, async () => {
    const value = actionSchema.parse(await readJson(request));
    return deleteExercise((await context.params).id, value.expectedVersion);
  });
}
