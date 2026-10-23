import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "./useAutosave";
import { publishableDraft, syntheticGuide } from "@/test/studioFixtures";
import { ApiError } from "./client";
const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./client", async (original) => ({ ...(await original<object>()), studioRequest: api.request }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });
describe("Studio autosave", () => {
  it("debounces changes, acknowledges persistence and warns while dirty", async () => {
    vi.useFakeTimers(); api.request.mockResolvedValue({ lockVersion: 2 });
    const draft = publishableDraft();
    const { result, rerender } = renderHook(({ value }) => useAutosave("exercise", 1, value, null), { initialProps: { value: draft } });
    rerender({ value: { ...draft, content: { ...draft.content, title: "New title" } } });
    expect(result.current.dirty).toBe(true);
    const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(999); }); expect(api.request).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(api.request).toHaveBeenCalledTimes(1); expect(result.current.status).toBe("Saved"); expect(result.current.dirty).toBe(false);
  });
  it("serializes draft and guide saves using the returned shared version", async () => {
    vi.useFakeTimers(); api.request.mockResolvedValueOnce({ lockVersion: 2 }).mockResolvedValueOnce({ lockVersion: 3 });
    const draft = publishableDraft(); const guide = syntheticGuide();
    const { result, rerender } = renderHook(({ value, g }) => useAutosave("exercise", 1, value, g), { initialProps: { value: draft, g: null as typeof guide | null } });
    act(() => result.current.acceptGuide(guide));
    rerender({ value: { ...draft, content: { ...draft.content, title: "Changed" } }, g: { ...guide, privateNotes: "Private later edit" } });
    await act(async () => { await result.current.save(); });
    expect(api.request.mock.calls[0][2].expectedVersion).toBe(1);
    expect(api.request.mock.calls[1][0]).toBe("/exercise/guide");
    expect(api.request.mock.calls[1][2].expectedVersion).toBe(2);
    expect(result.current.dirty).toBe(false);
  });
  it("rejects nonfinite state before JSON serialization can turn it into null", async () => {
    vi.useFakeTimers(); const draft = publishableDraft();
    const { result, rerender } = renderHook(({ value }) => useAutosave("exercise", 1, value, null), { initialProps: { value: draft } });
    const invalid = structuredClone(draft); invalid.vocabulary[0].readLines = [NaN];
    rerender({ value: invalid });
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(api.request).not.toHaveBeenCalled(); expect(result.current.status).toBe("Not saved");
  });
  it("clears a local validation error when corrected back to the saved reference", async () => {
    vi.useFakeTimers(); const draft = publishableDraft();
    const { result, rerender } = renderHook(({ error }) => useAutosave("exercise", 1, draft, null, error), { initialProps: { error: "" } });
    rerender({ error: "Vocabulary 3: use whole numbers" });
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(result.current.status).toBe("Not saved"); expect(result.current.dirty).toBe(true);
    rerender({ error: "" });
    expect(result.current.status).toBe("Saved"); expect(result.current.error).toBe("");
    expect(result.current.dirty).toBe(false); expect(api.request).not.toHaveBeenCalled();
  });
  it("saves recovered drafts even without a further edit", async () => {
    vi.useFakeTimers(); api.request.mockResolvedValue({ lockVersion: 2 });
    const draft = publishableDraft(); draft.vocabulary[0].readLines = [];
    const { result } = renderHook(() => useAutosave("exercise", 1, draft, null, "", true));
    expect(result.current.dirty).toBe(true);
    await act(async () => { await result.current.save(); });
    expect(api.request.mock.calls[0][2].draft.vocabulary[0].readLines).toEqual([]);
    expect(result.current.dirty).toBe(false);
  });
  it("does not report Saved on failure and blocks stale/expired sessions", async () => {
    vi.useFakeTimers(); api.request.mockRejectedValue(new ApiError(409, "Reload before saving"));
    const draft = publishableDraft();
    const { result, rerender } = renderHook(({ value }) => useAutosave("exercise", 1, value, null), { initialProps: { value: draft } });
    rerender({ value: { ...draft, content: { ...draft.content, title: "Unsaved" } } });
    await act(async () => { await result.current.save(); });
    expect(result.current.status).toBe("Not saved"); expect(result.current.dirty).toBe(true); expect(result.current.blocked).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(api.request).toHaveBeenCalledTimes(1);
  });
});
