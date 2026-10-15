import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageStepper } from "./StageStepper";

describe("StageStepper", () => {
  it("renders all six stages", () => {
    render(<StageStepper stage="Read" />);
    for (const label of ["Read", "Explain", "Fix", "Run", "Defend", "Feedback"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("labels the list for assistive tech", () => {
    render(<StageStepper stage="Fix" />);
    expect(screen.getByRole("list", { name: "Challenge stage progress" })).toBeInTheDocument();
  });
});
