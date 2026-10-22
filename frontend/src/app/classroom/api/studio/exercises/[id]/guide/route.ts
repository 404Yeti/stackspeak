import { teacherResponse, readJson } from "@/lib/classroom/studio/http";
import { guideChangeSchema } from "@/lib/classroom/studio/validation";
import { getGuide, saveGuide } from "@/lib/classroom/studio/repository";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return teacherResponse(request, false, async () => getGuide((await context.params).id));
}
export async function PUT(request: Request, context: Context) {
  return teacherResponse(request, true, async () => {
    const value = guideChangeSchema.parse(await readJson(request));
    return saveGuide((await context.params).id, value.expectedVersion, value.guide);
  });
}
