import { NextResponse, type NextRequest } from "next/server";
import catalog from "../content/classroom/exercises.json";
import { isShareable, parseExercises } from "@/lib/classroom/schema";
import { publicationPin, recoverySnapshot, assertSeedDeliverySafe, assertDatabaseDeliveryReady } from "@/lib/classroom/studio/recovery";
import { slugSchema } from "@/lib/classroom/studio/validation";
import { currentStudentSnapshot, studentSnapshotPin } from "@/lib/classroom/studio/publicationSnapshot";
const seeds = parseExercises(catalog);
function unavailable(status: number) {
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${status === 404 ? "Exercise not found" : "Exercise temporarily unavailable"} — StackSpeak</title></head><body><main><h1>${status === 404 ? "This page could not be found." : "Exercise temporarily unavailable"}</h1><p>${status === 404 ? "This exercise is not published or does not exist." : "Please try again shortly."}</p><a href="/">StackSpeak home</a></main></body></html>`, {
    status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" },
  });
}
/** Resolve status BEFORE Next streams. Does not authorize teachers or alter login/WAF paths. */
export async function proxy(request: NextRequest) {
  let slug;
  try { slug = slugSchema.parse(decodeURIComponent(request.nextUrl.pathname.replace(/^\/exercises\//, "").replace(/\/$/, ""))); }
  catch { return unavailable(404); }
  const headers = new Headers(request.headers);
  headers.delete("x-stackspeak-publication"); // never trust a caller-supplied publication decision
  if (process.env.CLASSROOM_CONTENT_SOURCE === "studio") {
    try {
      const source = seeds.find((e) => e.slug === slug);
      if (source) { if (!isShareable(source)) return unavailable(404); }
      else {
        const payload = await currentStudentSnapshot(slug);
        if (!payload) return unavailable(404);
        headers.set("x-stackspeak-publication", studentSnapshotPin(payload));
      }
    } catch { return unavailable(503); }
  } else if (!process.env.CLASSROOM_CONTENT_SOURCE || process.env.CLASSROOM_CONTENT_SOURCE === "seed") {
    try { await assertSeedDeliverySafe(); } catch { return unavailable(503); }
    if (!seeds.some((e) => e.slug === slug && isShareable(e))) return unavailable(404);
  } else if (["database", "recovery"].includes(process.env.CLASSROOM_CONTENT_SOURCE) && !process.env.VERCEL) {
    try {
      await assertDatabaseDeliveryReady();
      const snapshot = await recoverySnapshot(slug);
      if (!snapshot) return unavailable(404);
      headers.set("x-stackspeak-publication", publicationPin(slug, snapshot.key));
    } catch { return unavailable(503); }
  } else return unavailable(503); // cloud database cutover needs a reviewed durable recovery adapter
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: "/exercises/:path*" };
