import { describe, expect, it } from "vitest";
import type { PublicTestCase } from "@/lib/api";
import { describeInput, pickTraceFocusIndex } from "./traceFocus";

const c = (input: unknown, is_edge_case = false): PublicTestCase => ({
  description: "d",
  input,
  expected_output: 1,
  is_edge_case,
});

describe("pickTraceFocusIndex", () => {
  it("prefers the empty-list case wherever it sits", () => {
    expect(pickTraceFocusIndex([c([1]), c([], true), c([2])])).toBe(1);
    expect(pickTraceFocusIndex([c([1]), c([2]), c([3]), c([])])).toBe(3);
  });

  it("falls back to the first edge case, then the first case", () => {
    expect(pickTraceFocusIndex([c([1]), c([2], true), c([3], true)])).toBe(1);
    expect(pickTraceFocusIndex([c([1]), c([2])])).toBe(0);
  });

  it("returns null when there are no cases", () => {
    expect(pickTraceFocusIndex([])).toBeNull();
  });
});

describe("describeInput", () => {
  it("names the empty list in plain language", () => {
    expect(describeInput([])).toBe("an empty list");
    expect(describeInput([1, 2])).toBe("this input");
    expect(describeInput(null)).toBe("this input");
  });
});
