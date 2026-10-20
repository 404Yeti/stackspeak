import { isTeacher } from "@/lib/classroom/auth";
import { privateGuide } from "@/lib/classroom/guides";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!(await isTeacher()))
    return Response.json(
      { error: "Sign in to view the teaching guide." },
      { status: 401, headers },
    );
  const result = await privateGuide((await params).slug);
  if (result.state === "missing")
    return Response.json(
      { error: "Exercise not found." },
      { status: 404, headers },
    );
  if (result.state === "unavailable")
    return Response.json(
      { error: "Teaching guide unavailable in this environment." },
      { status: 503, headers },
    );
  return Response.json(result.guide, { headers });
}
