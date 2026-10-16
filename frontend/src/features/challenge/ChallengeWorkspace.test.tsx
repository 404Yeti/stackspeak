import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type ChallengeLoad } from "@/lib/api";
import { ChallengeWorkspace } from "./ChallengeWorkspace";
import { draftKey } from "./draftStorage";

const CHALLENGE: ChallengeLoad = {
  id: "average-of-list",
  version: 2,
  title: "Average of a List",
  language: "python",
  difficulty: "beginner",
  topic: "Lists",
  learning_objectives: ["Trace a loop"],
  starter_code: "def get_average(nums):\n    return 1",
  explain_prompts: ["What does it do?"],
  fix_prompts: ["What is wrong?"],
};

const api = vi.hoisted(() => ({
  getDailyChallenge: vi.fn(),
  getChallengeTrace: vi.fn(),
  getChallengeDefend: vi.fn(),
  getChallengeReview: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  ...api,
}));

beforeEach(() => {
  api.getDailyChallenge.mockResolvedValue(CHALLENGE);
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("ChallengeWorkspace", () => {
  it("shows a loading status, then the Read stage with the starter code", async () => {
    render(<ChallengeWorkspace />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading today's challenge");

    expect(await screen.findByRole("heading", { level: 1, name: "Average of a List" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Read the code" })).toBeInTheDocument();
    expect(screen.getByText(/def get_average/)).toBeInTheDocument();
  });

  it("never requests later-stage content on the Read stage", async () => {
    render(<ChallengeWorkspace />);
    await screen.findByRole("heading", { level: 1, name: "Average of a List" });
    expect(api.getChallengeTrace).not.toHaveBeenCalled();
    expect(api.getChallengeDefend).not.toHaveBeenCalled();
    expect(api.getChallengeReview).not.toHaveBeenCalled();
  });

  it("shows an error with Retry, and recovers", async () => {
    api.getDailyChallenge.mockRejectedValueOnce(new ApiError("network", "down"));
    render(<ChallengeWorkspace />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load today's challenge");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Average of a List" })).toBeInTheDocument();
    expect(api.getDailyChallenge).toHaveBeenCalledTimes(2);
  });

  it("gates Continue on a substantive explanation", async () => {
    render(<ChallengeWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Start explaining" }));

    const next = screen.getByRole("button", { name: "Continue to Fix" });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText("What does this code do?"), {
      target: { value: "It returns the mean of the numbers." },
    });
    expect(next).toBeEnabled();
  });

  it("restores a saved draft after a reload", async () => {
    window.sessionStorage.setItem(
      draftKey("average-of-list", 2),
      JSON.stringify({
        schema: 1,
        stage: "fix",
        explanation: "saved explanation",
        diagnosis: "saved diagnosis",
        code: "edited code",
        predictions: {},
        revealed: {},
        marks: {},
        defense: "",
        technical: {},
        communication: {},
      }),
    );
    render(<ChallengeWorkspace />);

    expect(await screen.findByRole("heading", { level: 2, name: "Fix the function" })).toBeInTheDocument();
    expect(screen.getByLabelText("Where is the bug, and why?")).toHaveValue("saved diagnosis");
    await waitFor(() => expect(screen.getByLabelText(/your code/)).toHaveValue("edited code"));
  });

  it("ignores a corrupt draft and starts at Read", async () => {
    window.sessionStorage.setItem(draftKey("average-of-list", 2), "{not json");
    render(<ChallengeWorkspace />);
    expect(await screen.findByRole("heading", { level: 2, name: "Read the code" })).toBeInTheDocument();
  });

  it("labels the stage after Fix as Trace, never Run", async () => {
    render(<ChallengeWorkspace />);
    await screen.findByRole("heading", { level: 1, name: "Average of a List" });
    expect(screen.getAllByText("Trace").length).toBeGreaterThan(0);
    expect(screen.queryByText("Run")).not.toBeInTheDocument();
  });
});
