import { describe, expect, it } from "vitest";
import {
  MAX_ANSWER_CHARS,
  STAGE_ORDER,
  blockedReason,
  flowReducer,
  initialState,
  isSubstantive,
  type FlowState,
} from "./challengeReducer";

const STARTER = "def f():\n    pass";
const LONG = "this is a long enough answer";

function at(stage: FlowState["stage"], overrides: Partial<FlowState> = {}): FlowState {
  return { ...initialState(STARTER), stage, ...overrides };
}

describe("flowReducer", () => {
  it("starts at Read with the starter code", () => {
    const state = initialState(STARTER);
    expect(state.stage).toBe("read");
    expect(state.code).toBe(STARTER);
  });

  it("follows READ → EXPLAIN → FIX → TRACE → DEFEND → FEEDBACK", () => {
    expect(STAGE_ORDER).toEqual(["read", "explain", "fix", "trace", "defend", "feedback"]);
  });

  it("advances from Read freely", () => {
    expect(flowReducer(at("read"), { type: "next", traceFocusIndex: null }).stage).toBe("explain");
  });

  it("refuses to leave Explain without a substantive explanation", () => {
    const blocked = flowReducer(at("explain", { explanation: "short" }), { type: "next", traceFocusIndex: null });
    expect(blocked.stage).toBe("explain");

    const ok = flowReducer(at("explain", { explanation: LONG }), { type: "next", traceFocusIndex: null });
    expect(ok.stage).toBe("fix");
  });

  it("counts non-whitespace characters, not raw length", () => {
    expect(isSubstantive("          \n\n          ")).toBe(false);
    expect(isSubstantive("abcdefghij")).toBe(true);
  });

  it("refuses to leave Fix without a diagnosis", () => {
    expect(flowReducer(at("fix"), { type: "next", traceFocusIndex: null }).stage).toBe("fix");
    expect(flowReducer(at("fix", { diagnosis: LONG }), { type: "next", traceFocusIndex: null }).stage).toBe("trace");
  });

  it("requires the focus exercise to be compared before leaving Trace", () => {
    const base = at("trace", { revealed: { 3: true } });
    expect(flowReducer(base, { type: "next", traceFocusIndex: 3 }).stage).toBe("trace");

    // Marks on other cases (e.g. from an older draft) don't count.
    const other = { ...base, marks: { 0: "matches" } as FlowState["marks"] };
    expect(flowReducer(other, { type: "next", traceFocusIndex: 3 }).stage).toBe("trace");

    const done = { ...base, marks: { 3: "unsure" } as FlowState["marks"] };
    expect(flowReducer(done, { type: "next", traceFocusIndex: 3 }).stage).toBe("defend");
  });

  it("does not leave Trace when the exercise hasn't loaded", () => {
    expect(blockedReason(at("trace"), null)).toMatch(/hasn't loaded/);
    expect(flowReducer(at("trace", { marks: { 0: "matches" } }), { type: "next", traceFocusIndex: null }).stage).toBe("trace");
  });

  it("refuses to leave Defend without a defense, and Feedback is terminal", () => {
    expect(flowReducer(at("defend"), { type: "next", traceFocusIndex: null }).stage).toBe("defend");
    expect(flowReducer(at("defend", { defense: LONG }), { type: "next", traceFocusIndex: null }).stage).toBe("feedback");
    expect(flowReducer(at("feedback"), { type: "next", traceFocusIndex: null }).stage).toBe("feedback");
  });

  it("goes back but never before Read", () => {
    expect(flowReducer(at("fix"), { type: "back" }).stage).toBe("explain");
    expect(flowReducer(at("read"), { type: "back" }).stage).toBe("read");
  });

  it("cannot skip stages — only one step per next", () => {
    const state = at("read", { explanation: LONG, diagnosis: LONG, defense: LONG });
    expect(flowReducer(state, { type: "next", traceFocusIndex: null }).stage).toBe("explain");
  });

  it("keeps drafts when navigating back", () => {
    const state = at("fix", { explanation: LONG, code: "edited" });
    const back = flowReducer(state, { type: "back" });
    expect(back.explanation).toBe(LONG);
    expect(back.code).toBe("edited");
  });

  it("resets code to the starter without touching answers", () => {
    const state = at("fix", { code: "edited", diagnosis: LONG });
    const reset = flowReducer(state, { type: "resetCode", starterCode: STARTER });
    expect(reset.code).toBe(STARTER);
    expect(reset.diagnosis).toBe(LONG);
  });

  it("only reveals a trace case after a prediction", () => {
    expect(flowReducer(at("trace"), { type: "reveal", index: 0 }).revealed[0]).toBeUndefined();
    const predicted = flowReducer(at("trace"), { type: "setPrediction", index: 0, value: "5.0" });
    expect(flowReducer(predicted, { type: "reveal", index: 0 }).revealed[0]).toBe(true);
  });

  it("only accepts a mark after the case is revealed", () => {
    expect(flowReducer(at("trace"), { type: "mark", index: 0, mark: "matches" }).marks[0]).toBeUndefined();
    const revealed = at("trace", { revealed: { 0: true } });
    expect(flowReducer(revealed, { type: "mark", index: 0, mark: "differs" }).marks[0]).toBe("differs");
  });

  it("keeps technical and communication ticks on separate axes", () => {
    let state = at("feedback");
    state = flowReducer(state, { type: "toggleTechnical", index: 0 });
    expect(state.technical[0]).toBe(true);
    expect(state.communication[0]).toBeUndefined();
    state = flowReducer(state, { type: "toggleTechnical", index: 0 });
    expect(state.technical[0]).toBe(false);
  });

  it("caps free-text length", () => {
    const state = flowReducer(at("explain"), {
      type: "setExplanation",
      value: "x".repeat(MAX_ANSWER_CHARS + 50),
    });
    expect(state.explanation).toHaveLength(MAX_ANSWER_CHARS);
  });
});
