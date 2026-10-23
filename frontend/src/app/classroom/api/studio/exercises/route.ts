import { teacherResponse, readJson } from "@/lib/classroom/studio/http";
import { createSchema } from "@/lib/classroom/studio/validation";
import { createExercise, listExercises } from "@/lib/classroom/studio/repository";
export async function GET(request: Request) {
  return teacherResponse(request, false, () => listExercises(Object.fromEntries(new URL(request.url).searchParams)));
}
export async function POST(request: Request) {
  return teacherResponse(request, true, async () => {
    const value = createSchema.parse(await readJson(request));
    return createExercise(value.language, value.title);
  }, 201);
}
