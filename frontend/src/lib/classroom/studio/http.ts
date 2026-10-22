import "server-only";
import { z } from "zod";
import { sameOrigin } from "../auth";
import { authorizeTeacher } from "./authorization";
import { StudioError } from "./errors";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new StudioError(415, "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new StudioError(400, "Missing request body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 256 * 1024) { await reader.cancel(); throw new StudioError(413, "Exercise payload is too large."); }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError(400, "Invalid JSON body.");
  } finally { reader.releaseLock(); }
}
export async function teacherResponse(request: Request, mutation: boolean, action: () => Promise<unknown>, status = 200) {
  try {
    await authorizeTeacher(); // authorize before parsing IDs, bodies or accessing storage
    if (mutation && !sameOrigin(request)) throw new StudioError(403, "Forbidden.");
    return Response.json(await action(), { status, headers });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Check the highlighted fields.",
      issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422, headers });
    if (error instanceof StudioError) return Response.json({ error: error.message }, { status: error.status, headers });
    // SQL/JSON errors can embed private values. Never return/log the original error.
    return Response.json({ error: "Exercise storage is unavailable." }, { status: 503, headers });
  }
}
