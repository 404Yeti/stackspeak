import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MicButton } from "./MicButton";

describe("MicButton", () => {
  it("is always rendered disabled, since it has no working functionality", () => {
    render(<MicButton state="idle" />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("describes each state for assistive tech as preview-only", () => {
    render(<MicButton state="recording" />);
    expect(screen.getByRole("button", { name: /preview only/i })).toBeInTheDocument();
  });
});
