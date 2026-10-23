import type { Draft, Guide } from "@/lib/classroom/studio/validation";
export type EditorRecord = {
  id: string; slug: string; publication: "draft" | "published"; lockVersion: number;
  recoveredReadLines?: number[];
  version: number; updatedAt: string; hasUnpublishedChanges: boolean; draft: Draft;
};
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function studioRequest<T>(path: string, method = "GET", data?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/classroom/api/studio/exercises${path}`, {
    method, credentials: "same-origin", cache: "no-store", signal,
    ...(data === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  });
  const body = await response.json();
  if (!response.ok) {
    const issues = body.issues?.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("; ");
    throw new ApiError(response.status, response.status === 401 ? "Your session expired. Sign in again before saving." : issues || body.error || "Request failed. Please retry.");
  }
  return body as T;
}
export function emptyGuide(): Guide {
  return { idealExplanation: "", spokenExplanation: "", expectedSolution: "", debuggingGuidance: "", teachingHints: [],
    followUpQuestions: [], privateNotes: "", misunderstandings: [], answers: [] };
}
