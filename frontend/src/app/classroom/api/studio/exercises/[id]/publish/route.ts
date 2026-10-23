import { teacherResponse, readJson } from "@/lib/classroom/studio/http";
import { actionSchema } from "@/lib/classroom/studio/validation";
import { publishExercise } from "@/lib/classroom/studio/repository";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return teacherResponse(request, true, async () => {
    const value = actionSchema.parse(await readJson(request));
    return publishExercise((await context.params).id, value.expectedVersion);
  });
}
