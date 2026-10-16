import { fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ChallengeLoad, ChallengeTrace } from "@/lib/api";
import { flowReducer, initialState } from "./challengeReducer";
import { TraceStage, type TraceContent } from "./TraceStage";

const STARTER = "def get_average(nums):\n    return sum(nums) / len(nums)";

const CHALLENGE = { id: "x", version: 2, starter_code: STARTER } as ChallengeLoad;

const TRACE: ChallengeTrace = {
  id: "x",
  version: 2,
  expected_behavior: "Raises ValueError for an empty list.",
  trace_prompts: ["Walk through it."],
  test_cases: [
    { description: "typical", input: [10, 20, 30], expected_output: 20, is_edge_case: false },
    { description: "negatives", input: [-10, 5, -3], expected_output: -2.67, is_edge_case: false },
    { description: "decimals", input: [1.5, 2.5, 3], expected_output: 2.33, is_edge_case: false },
    { description: "empty", input: [], expected_exception: "ValueError", is_edge_case: true },
  ],
};

const ready: TraceContent = { data: TRACE, error: undefined, loading: false, retry: vi.fn() };

function Harness({ code = STARTER, content = ready }: { code?: string; content?: TraceContent }) {
  const [state, dispatch] = useReducer(flowReducer, { ...initialState(STARTER), stage: "trace" as const, code });
  const next = vi.fn();
  return (
    <TraceStage
      challenge={CHALLENGE}
      state={state}
      dispatch={dispatch}
      focusHeading={false}
      onBack={() => {}}
      onNext={next}
      blockedReason={state.marks[3] === undefined ? "blocked" : null}
      content={content}
    />
  );
}

describe("TraceStage", () => {
  it("shows exactly one prediction exercise — the empty-list case", () => {
    render(<Harness />);
    expect(screen.getAllByRole("region", { name: /^Predict:/ })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 3, name: "Predict: what happens with an empty list?" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Reveal expected outcome" })).toHaveLength(1);
    expect(screen.getByText("get_average([])")).toBeInTheDocument();
    // The other public cases are not rendered.
    expect(screen.queryByText(/typical|negatives|decimals/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\[10, 20, 30\]/)).not.toBeInTheDocument();
  });

  it("labels the student's edited code as their current code", () => {
    render(<Harness code={"def get_average(nums):\n    return 0"} />);
    expect(screen.getByRole("heading", { level: 3, name: "Your current code" })).toBeInTheDocument();
    expect(screen.getByText(/return 0/)).toBeInTheDocument();
    expect(screen.getByText(/code you edited in Fix/)).toBeInTheDocument();
  });

  it("identifies unedited code as the starter code", () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { level: 3, name: "Starter code" })).toBeInTheDocument();
    expect(screen.getByText(/this is the starter code/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your current code" })).not.toBeInTheDocument();
  });

  it("says plainly that nothing was run, and shows no results, scores, or AI feedback", () => {
    render(<Harness />);
    expect(screen.getByRole("note")).toHaveTextContent("StackSpeak did not run your code");
    expect(screen.queryByText(/passed|failed|pytest|score|AI feedback/i)).not.toBeInTheDocument();
  });

  it("gives nothing away before the reveal, and requires a prediction first", () => {
    render(<Harness />);
    const reveal = screen.getByRole("button", { name: "Reveal expected outcome" });
    expect(reveal).toBeDisabled();
    expect(screen.queryByText(/Expected outcome/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ValueError/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Raises ValueError for an empty list/)).not.toBeInTheDocument();
  });

  it("flows prediction → reveal → self-comparison → continue", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Continue to Defend" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/What does your code do when it receives an empty list/), {
      target: { value: "it raises an error" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal expected outcome" }));

    const exercise = screen.getByRole("region", { name: /^Predict:/ });
    expect(within(exercise).getByText(/Expected outcome:/)).toHaveTextContent("raises ValueError");
    expect(within(exercise).getByText(/not a result from running your code/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to Defend" })).toBeDisabled();

    fireEvent.click(within(exercise).getByLabelText("My prediction matched"));
    expect(screen.getByRole("button", { name: "Continue to Defend" })).toBeEnabled();
  });

  it("shows loading and error states with Retry instead of an exercise", () => {
    const retry = vi.fn();
    const { rerender } = render(<Harness content={{ data: undefined, error: undefined, loading: true, retry }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the trace exercise");
    expect(screen.queryByRole("region", { name: /^Predict:/ })).not.toBeInTheDocument();

    rerender(
      <Harness
        content={{ data: undefined, error: { kind: "network", message: "x", name: "ApiError" } as never, loading: false, retry }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });
});
