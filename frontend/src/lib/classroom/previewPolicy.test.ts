// @vitest-environment node
import { describe, expect, it } from "vitest";
import rule from "../../../../docs/classroom/preview-firewall-rule.json";

// These policy tests guard accidental production scope/OR groups. Actual WAF
// counters, route normalization and HTTP 429 still need a deployed preview test.
describe("reviewed preview perimeter policy", () => {
  function matches(environment: string, route: string, method: string) {
    const request: Record<string, string> = { environment, route, method };
    return rule.conditionGroup.some((group) =>
      group.conditions.every(
        (condition) =>
          condition.op === "eq" && request[condition.type] === condition.value,
      ),
    );
  }
  it("covers the preview login handler and excludes every production request", () => {
    expect(matches("preview", "/classroom/session", "POST")).toBe(true);
    for (const route of [
      "/classroom/session",
      "/",
      "/exercises/python-loop-accumulator",
    ]) {
      for (const method of ["POST", "GET", "DELETE"]) {
        expect(matches("production", route, method)).toBe(false);
      }
    }
    expect(matches("preview", "/classroom/session", "GET")).toBe(false);
    expect(matches("preview", "/daily-challenge", "POST")).toBe(false);
    expect(
      matches("preview", "/exercises/python-loop-accumulator", "POST"),
    ).toBe(false);
  });
  it("uses one bounded shared fixed-window/IP policy with a 429 action and no bypass", () => {
    expect(rule.active).toBe(true);
    expect(rule.conditionGroup).toHaveLength(1);
    expect(rule.action.mitigate).toEqual({
      action: "rate_limit",
      rateLimit: {
        algo: "fixed_window",
        window: 60,
        limit: 10,
        keys: ["ip"],
        action: "rate_limit",
      },
    });
  });
});
