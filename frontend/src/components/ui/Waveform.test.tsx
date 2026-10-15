import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Waveform } from "./Waveform";

describe("Waveform", () => {
  it("renders as a labeled static image, not a live visualization", () => {
    render(<Waveform />);
    expect(screen.getByRole("img", { name: /idle/i })).toBeInTheDocument();
  });

  it("labels the active state as preview only", () => {
    render(<Waveform active />);
    expect(screen.getByRole("img", { name: /preview only/i })).toBeInTheDocument();
  });
});
