import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PipMascot } from "./PipMascot";

describe("PipMascot", () => {
  it("renders the idle expression with a descriptive label by default", () => {
    render(<PipMascot expression="idle" />);
    expect(screen.getByRole("img", { name: /pip.*idle/i })).toBeInTheDocument();
  });

  it("accepts a custom alt override", () => {
    render(<PipMascot expression="success" alt="Pip celebrating a passing test" />);
    expect(screen.getByRole("img", { name: "Pip celebrating a passing test" })).toBeInTheDocument();
  });
});
