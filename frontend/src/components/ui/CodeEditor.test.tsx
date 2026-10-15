import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeEditor } from "./CodeEditor";

describe("CodeEditor", () => {
  it("renders the filename and a read-only label", () => {
    render(<CodeEditor filename="main.py" code="print('hi')" />);
    expect(screen.getByText("main.py")).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
  });

  it("renders line numbers matching the code's line count", () => {
    render(<CodeEditor filename="main.py" code={"a\nb\nc"} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
