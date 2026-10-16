import type { PublicTestCase } from "@/lib/api";

/**
 * Trace shows ONE prediction exercise, not the whole public test list (the
 * other cases stay in the API). The empty-list edge case is the lesson this
 * challenge teaches, so it is preferred; otherwise the first edge case, then
 * the first case. Returns the index into `cases` (draft state is keyed by it),
 * or null when there are no cases.
 */
export function pickTraceFocusIndex(cases: PublicTestCase[]): number | null {
  if (cases.length === 0) return null;
  const empty = cases.findIndex((c) => Array.isArray(c.input) && c.input.length === 0);
  if (empty !== -1) return empty;
  const edge = cases.findIndex((c) => c.is_edge_case);
  return edge !== -1 ? edge : 0;
}

/** Plain-language name for an input, used in the prediction question. */
export function describeInput(input: unknown): string {
  return Array.isArray(input) && input.length === 0 ? "an empty list" : "this input";
}
