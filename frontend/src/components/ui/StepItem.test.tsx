import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepItem } from "./StepItem";

describe("StepItem", () => {
  it("shows the step number for an upcoming step", () => {
    render(<StepItem label="Explain" number={2} state="upcoming" />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Explain")).toBeInTheDocument();
  });

  it("shows the step number for an active step", () => {
    render(<StepItem label="Fix" number={3} state="active" />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
