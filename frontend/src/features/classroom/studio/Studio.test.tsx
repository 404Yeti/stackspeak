import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { StudioEditor } from "./StudioEditor";
import { StudioLibrary } from "./StudioLibrary";
import { ContentTab } from "./ContentTab";
import { VocabularyTab } from "./VocabularyTab";
import { GuideTab } from "./GuideTab";
import { publishableDraft, syntheticGuide } from "@/test/studioFixtures";
const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./client", async (original) => ({ ...(await original<object>()), studioRequest: api.request }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("Classroom Studio components", () => {
  it("renders the content builder with code editors and stable questions", () => {
    const value = publishableDraft().content; const change = vi.fn();
    render(<ContentTab value={value} onChange={change} />);
    expect(screen.getByLabelText("Exercise title")).toHaveValue(value.title);
    expect(screen.getByLabelText(/Read code ·/)).toHaveValue(value.readCode);
    fireEvent.click(screen.getByRole("button", { name: "Add question" }));
    expect(change.mock.calls[0][0].questions).toHaveLength(value.questions.length + 1);
  });
  it("supports vocabulary addition/deletion/reordering and line references", () => {
    const draft = publishableDraft(); const change = vi.fn(); render(<VocabularyTab draft={draft} onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Move vocabulary 2 up" }));
    expect(change.mock.calls[0][0][0]).toEqual(draft.vocabulary[1]);
    fireEvent.click(screen.getByRole("button", { name: "Add vocabulary" }));
    expect(change.mock.calls[1][0]).toHaveLength(draft.vocabulary.length + 1);
  });
  it("keeps guides separate and renders actual student preview without the guide", async () => {
    const draft = publishableDraft(); const guide = syntheticGuide();
    const initial = { id: "id", slug: "slug", publication: "draft" as const, version: 0, lockVersion: 1, updatedAt: "", hasUnpublishedChanges: false, draft };
    api.request.mockResolvedValue({ guide, lockVersion: 1 });
    render(<StudioEditor initial={initial} deliveryEnabled />);
    expect(api.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: /Teacher Guide/ }));
    await waitFor(() => expect(screen.getByLabelText("Private teaching notes")).toHaveValue(guide.privateNotes));
    fireEvent.click(screen.getByRole("tab", { name: /Preview/ }));
    expect(screen.queryByDisplayValue(guide.privateNotes)).not.toBeInTheDocument();
    expect(screen.queryByText(guide.idealExplanation)).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Exercise stages" })).toBeInTheDocument();
  });
  it("renders the private guide field set with a clear boundary", () => {
    render(<GuideTab value={syntheticGuide()} draft={publishableDraft()} onChange={vi.fn()} />);
    expect(screen.getByText("Teacher-only guide")).toBeInTheDocument();
    expect(screen.getByLabelText("Ideal technical explanation")).toBeInTheDocument();
    expect(screen.getByLabelText(/Expected corrected code ·/)).toBeInTheDocument();
  });
  it("shows the library's filters, Create action and truthful storage failure", async () => {
    api.request.mockRejectedValue(new Error("Exercise storage is unavailable."));
    render(<StudioLibrary />);
    expect(screen.getByRole("button", { name: /Create Exercise/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Exercise storage is unavailable."));
  });
});
