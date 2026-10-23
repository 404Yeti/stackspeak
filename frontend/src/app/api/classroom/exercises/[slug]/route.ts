import { publishedExercise } from "@/lib/classroom/studio/repository";
import { slugSchema } from "@/lib/classroom/studio/validation";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
/** Public API uses only the restricted reader. Existing student pages are not switched yet. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Exercise not found." }, { status: 404, headers });
  try {
    const exercise = await publishedExercise(slug.data);
    return exercise ? Response.json(exercise, { headers }) : Response.json({ error: "Exercise not found." }, { status: 404, headers });
  } catch {
    return Response.json({ error: "Exercise storage is unavailable." }, { status: 503, headers });
  }
}
