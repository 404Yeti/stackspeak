import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTestGuides } from "@/test/classroomFixtures";
import records from "../../../content/classroom/exercises.json";
import { parseExercises, studentProjection } from "@/lib/classroom/schema";
import { ExerciseLibrary } from "./ExerciseLibrary";
import { ClassroomWorkspace } from "./ClassroomWorkspace";
import { HighlightedCode } from "./HighlightedCode";

vi.mock("next/image", () => ({
  default: (props: object) => <span {...props} />,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const exercises = parseExercises(records);
const exercise = studentProjection(exercises[0]);
const guide = makeTestGuides(exercises)[exercise.slug];

describe("Classroom teaching workflow", () => {
  it("searches all words and combines filters without inventing languages", () => {
    render(<ExerciseLibrary exercises={exercises} />);
    expect(
      screen.queryByRole("option", { name: "JavaScript" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Python loops" },
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "Follow the running total" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "C#" },
    });
    expect(screen.getByText("No exercises match yet")).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear filters" })[0],
    );
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByText("Private draft")).toBeInTheDocument();
  });
  it("moves through stages, retains edits between stages, and confirms reset", () => {
    render(<ClassroomWorkspace exercise={exercise} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to Explain/ }),
    );
    const notes = screen.getByLabelText(/What is the purpose/);
    fireEvent.change(notes, {
      target: { value: "It initializes the total once." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continue to Fix/ }));
    const code = screen.getByRole("textbox", { name: /totals.py/ });
    fireEvent.change(code, { target: { value: "my draft" } });
    fireEvent.click(screen.getByRole("button", { name: /01\s*Read/ }));
    fireEvent.click(screen.getByRole("button", { name: /03\s*Fix/ }));
    expect(screen.getByRole("textbox", { name: /totals.py/ })).toHaveValue(
      "my draft",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset exercise" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep working" }));
    expect(code).toHaveValue("my draft");
    fireEvent.click(screen.getByRole("button", { name: "Reset exercise" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear and reset" }));
    fireEvent.click(screen.getByRole("button", { name: /03\s*Fix/ }));
    expect(screen.getByRole("textbox", { name: /totals.py/ })).toHaveValue(
      exercise.fix.buggyCode,
    );
    expect(
      screen.queryByText(/Teacher-only|Answer guide/),
    ).not.toBeInTheDocument();
  });
  it("fetches guides only after deliberate reveal and removes them for presentation", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => guide });
    vi.stubGlobal("fetch", fetch);
    render(<ClassroomWorkspace exercise={exercise} teacher shareable />);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reveal guide" }));
    expect(
      (await screen.findAllByText(/Ideal spoken explanation:/))[0],
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Present lesson" }));
    expect(
      screen.queryByText(/Ideal spoken explanation:/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Reveal guide|Hide guide/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit presentation" }));
    expect(
      screen.getByRole("button", { name: "Reveal guide" }),
    ).toBeInTheDocument();
  });
  it("discards a delayed guide response after presentation starts", async () => {
    let resolve!: (value: object) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    );
    render(<ClassroomWorkspace exercise={exercise} teacher />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal guide" }));
    fireEvent.click(screen.getByRole("button", { name: "Present lesson" }));
    resolve({ ok: true, json: async () => guide });
    fireEvent.click(screen.getByRole("button", { name: "Exit presentation" }));
    expect(
      screen.queryByText(/Ideal spoken explanation:/),
    ).not.toBeInTheDocument();
  });
  it("shows guide failures and keeps private drafts unshareable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<ClassroomWorkspace exercise={exercise} teacher />);
    expect(
      screen.queryByRole("button", { name: "Copy student link" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal guide" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "couldn’t be loaded",
    );
  });
  it("adjusts code size separately for teaching and presentation", () => {
    render(<ClassroomWorkspace exercise={exercise} teacher />);
    expect(screen.getByLabelText("Code font size")).toHaveTextContent("16 px");
    fireEvent.click(screen.getByRole("button", { name: "Increase code size" }));
    expect(screen.getByLabelText("Code font size")).toHaveTextContent("18 px");
    fireEvent.click(screen.getByRole("button", { name: "Present lesson" }));
    expect(screen.getByLabelText("Code font size")).toHaveTextContent("22 px");
    fireEvent.click(screen.getByRole("button", { name: "Exit presentation" }));
    expect(screen.getByLabelText("Code font size")).toHaveTextContent("18 px");
  });
  it("links vocabulary to Read lines while preserving a Fix draft", () => {
    const { container } = render(<ClassroomWorkspace exercise={exercise} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Highlight accumulator in Read code",
      }),
    );
    expect(container.querySelector('[data-code-line="2"]')).toHaveClass(
      "classroom-line-focused",
    );
    expect(container.querySelector('[data-code-line="4"]')).toHaveClass(
      "classroom-line-focused",
    );
    fireEvent.click(screen.getByRole("button", { name: /03\s*Fix/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /totals.py/ }), {
      target: { value: "my draft" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Vocabulary" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Highlight accumulator in Read code",
      }),
    );
    expect(
      screen
        .getAllByRole("status")
        .map((n) => n.textContent)
        .join(" "),
    ).toContain("Read code, lines 2, 4");
    fireEvent.click(screen.getByRole("button", { name: /03\s*Fix/ }));
    expect(screen.getByRole("textbox", { name: /totals.py/ })).toHaveValue(
      "my draft",
    );
  });
  it("reports missing private configuration without blocking the exercise", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    render(<ClassroomWorkspace exercise={exercise} teacher />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal guide" }));
    expect(
      await screen.findByText(/private teacher guide hasn’t been configured/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /03\s*Fix/ }));
    expect(screen.getByRole("textbox", { name: /totals.py/ })).toBeEnabled();
  });
  it("renders code as escaped text", () => {
    const { container } = render(
      <HighlightedCode code={'<script>alert("hi")</script>'} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container).toHaveTextContent('<script>alert("hi")</script>');
  });
});
