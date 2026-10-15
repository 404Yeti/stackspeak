import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TestResultRow } from "./TestResultRow";

describe("TestResultRow", () => {
  it("renders the label for a passing result", () => {
    render(<TestResultRow label="Calculates average correctly" status="pass" />);
    expect(screen.getByText("Calculates average correctly")).toBeInTheDocument();
  });

  it("renders the label for a failing result", () => {
    render(<TestResultRow label="Handles empty list" status="fail" />);
    expect(screen.getByText("Handles empty list")).toBeInTheDocument();
  });
});
