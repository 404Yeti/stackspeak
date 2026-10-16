import { describe, expect, it } from "vitest";
import { expectedOutcome, pyRepr } from "./pyRepr";

describe("pyRepr", () => {
  it("renders Python-style literals", () => {
    expect(pyRepr([10, 20, 30])).toBe("[10, 20, 30]");
    expect(pyRepr([])).toBe("[]");
    expect(pyRepr(null)).toBe("None");
    expect(pyRepr(true)).toBe("True");
    expect(pyRepr("hi")).toBe('"hi"');
  });

  it("describes expected outcomes without implying a run happened", () => {
    expect(expectedOutcome({ description: "d", input: [], expected_exception: "ValueError", is_edge_case: true })).toBe(
      "raises ValueError",
    );
    expect(expectedOutcome({ description: "d", input: [1], expected_output: 1, is_edge_case: false })).toBe("returns 1");
  });
});
