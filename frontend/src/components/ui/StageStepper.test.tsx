import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageStepper } from "./StageStepper";

describe("StageStepper", () => {
  it("renders all six stages", () => {
    render(<StageStepper stage="Read" />);
    for (const label of ["Read", "Explain", "Fix", "Trace", "Defend", "Feedback"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("labels the list for assistive tech", () => {
    render(<StageStepper stage="Fix" />);
    expect(screen.getByRole("list", { name: "Challenge stage progress" })).toBeInTheDocument();
  });

  it("marks only the current stage with aria-current=step", () => {
    render(<StageStepper stage="Fix" />);
    const current = screen.getAllByRole("listitem").filter((li) => li.hasAttribute("aria-current"));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Fix");
    expect(current[0]).toHaveAttribute("aria-current", "step");
  });
});
