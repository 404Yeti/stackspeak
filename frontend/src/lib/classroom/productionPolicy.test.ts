// @vitest-environment node
import { describe, expect, it } from "vitest";
import preview from "../../../../docs/classroom/preview-firewall-rule.json";
import candidate from "../../../../docs/classroom/production-firewall-rule.proposed.json";

// Logical scope checks, not proof of deployed counters or Vercel normalization.
describe("proposed Production login perimeter", () => {
  function matches(
    environment: string,
    method: string,
    path: string,
    route = path,
  ) {
    const request: Record<string, string> = {
      environment,
      method,
      path,
      route,
    };
    return candidate.conditionGroup.some((group) =>
      group.conditions.every((c) => {
        if (c.op === "eq") return request[c.type] === c.value;
        if (c.op === "re") return new RegExp(c.value).test(request[c.type]);
        return false;
      }),
    );
  }
  it("preserves the existing Preview group and uses one unchanged regional IP quota", () => {
    expect(candidate.conditionGroup[0]).toEqual(preview.conditionGroup[0]);
    expect(candidate.action).toEqual(preview.action);
    expect(candidate.action.mitigate.rateLimit).toEqual({
      algo: "fixed_window",
      window: 60,
      limit: 10,
      keys: ["ip"],
      action: "rate_limit",
    });
    expect(candidate.conditionGroup).toHaveLength(3);
    for (const group of candidate.conditionGroup) {
      expect(group.conditions).toContainEqual({
        type: "method",
        op: "eq",
        value: "POST",
      });
      expect(
        group.conditions.filter((c) => c.type === "environment"),
      ).toHaveLength(1);
      expect(
        group.conditions.some((c) => c.type === "route" || c.type === "path"),
      ).toBe(true);
    }
  });
  it("covers the canonical Production path before app release and resolved aliases afterward", () => {
    expect(matches("production", "POST", "/classroom/session", "")).toBe(true);
    expect(matches("production", "POST", "/classroom/session/", "")).toBe(true);
    expect(
      matches(
        "production",
        "POST",
        "/classroom/%73ession",
        "/classroom/session",
      ),
    ).toBe(true);
    expect(
      matches("production", "POST", "/classroom/session", "/classroom/session"),
    ).toBe(true);
    expect(matches("preview", "POST", "/classroom/session")).toBe(true);
  });
  it("excludes student, guide, logout, unrelated paths, methods and environments", () => {
    for (const environment of ["preview", "production", "development", ""]) {
      for (const path of [
        "/",
        "/daily-challenge",
        "/classroom/login",
        "/classroom/logout",
        "/exercises/python-loop-accumulator",
        "/classroom/api/guide/python-loop-accumulator",
        "/classroom/session-extra",
      ]) {
        for (const method of ["GET", "POST", "DELETE"]) {
          expect(matches(environment, method, path)).toBe(false);
        }
      }
    }
    for (const method of ["GET", "HEAD", "OPTIONS", "DELETE"]) {
      expect(matches("production", method, "/classroom/session")).toBe(false);
    }
    expect(matches("development", "POST", "/classroom/session")).toBe(false);
  });
});
