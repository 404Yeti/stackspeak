import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState } from "./challengeReducer";
import { clearDraft, draftKey, loadDraft, parseDraft, saveDraft } from "./draftStorage";

const KEY = draftKey("average-of-list", 2);

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("draftStorage", () => {
  it("versions the key by challenge id and content version", () => {
    expect(KEY).toBe("stackspeak:daily:average-of-list:v2");
  });

  it("round-trips a draft", () => {
    const state = { ...initialState("code"), stage: "fix" as const, diagnosis: "because", marks: { 0: "unsure" as const } };
    saveDraft(KEY, state);
    expect(loadDraft(KEY)).toEqual(state);
  });

  it("clears a draft", () => {
    saveDraft(KEY, initialState("code"));
    clearDraft(KEY);
    expect(loadDraft(KEY)).toBeNull();
  });

  it("rejects corrupt, wrong-schema, or tampered values", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ schema: 99, ...initialState("c") }))).toBeNull();
    expect(parseDraft(JSON.stringify({ schema: 1, ...initialState("c"), stage: "nope" }))).toBeNull();
    expect(parseDraft(JSON.stringify({ schema: 1, ...initialState("c"), marks: { 0: "perfect" } }))).toBeNull();
    expect(parseDraft(JSON.stringify({ schema: 1, ...initialState("c"), code: 5 }))).toBeNull();
  });

  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveDraft(KEY, initialState("c"))).not.toThrow();
    expect(loadDraft(KEY)).toBeNull();
    expect(() => clearDraft(KEY)).not.toThrow();
  });
});
