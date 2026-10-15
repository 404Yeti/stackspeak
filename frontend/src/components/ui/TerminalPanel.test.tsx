import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TerminalPanel } from "./TerminalPanel";

describe("TerminalPanel", () => {
  it("renders the command and a passed summary", () => {
    render(
      <TerminalPanel
        command="pytest test_average.py"
        results={[{ label: "Calculates average correctly", status: "pass" }]}
        summary="1 passed, 0 failed"
        outcome="passed"
      />,
    );
    expect(screen.getByText("$ pytest test_average.py")).toBeInTheDocument();
    expect(screen.getByText("Run passed")).toBeInTheDocument();
    expect(screen.getByText("1 passed, 0 failed")).toBeInTheDocument();
  });

  it("renders a failed outcome", () => {
    render(
      <TerminalPanel
        command="pytest test_average.py"
        results={[{ label: "Handles empty list", status: "fail" }]}
        summary="0 passed, 1 failed"
        outcome="failed"
      />,
    );
    expect(screen.getByText("Run failed")).toBeInTheDocument();
  });
});
