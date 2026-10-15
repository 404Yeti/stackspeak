import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("renders the label", () => {
    render(<Chip label="Python" />);
    expect(screen.getByText("Python")).toBeInTheDocument();
  });
});
