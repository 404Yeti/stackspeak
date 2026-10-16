import type { PublicTestCase } from "@/lib/api";

/**
 * Python-style display of JSON test data (`None`, `True`, `[1, 2]`). Display
 * only. JSON can't distinguish `20.0` from `20`, so whole floats show as ints.
 */
export function pyRepr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${pyRepr(v)}`).join(", ")}}`;
  }
  return String(value);
}

export function expectedOutcome(testCase: PublicTestCase): string {
  return testCase.expected_exception
    ? `raises ${testCase.expected_exception}`
    : `returns ${pyRepr(testCase.expected_output)}`;
}
