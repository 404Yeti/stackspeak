import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeInput } from "./CodeInput";

describe("CodeInput", () => {
  it("is an editable, labeled textarea showing the code", () => {
    render(<CodeInput id="c" filename="main.py" value={"a\nb"} onChange={() => {}} />);
    const field = screen.getByLabelText(/main\.py — your code/);
    expect(field).toHaveValue("a\nb");
    expect(screen.getByText("Editing")).toBeInTheDocument();
  });

  it("shows a line number per line", () => {
    render(<CodeInput id="c" filename="main.py" value={"a\nb\nc"} onChange={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("disables spellcheck/autocorrect and reports edits", () => {
    const onChange = vi.fn();
    render(<CodeInput id="c" filename="main.py" value="" onChange={onChange} />);
    const field = screen.getByLabelText(/your code/);
    expect(field).toHaveAttribute("spellcheck", "false");
    fireEvent.change(field, { target: { value: "x = 1" } });
    expect(onChange).toHaveBeenCalledWith("x = 1");
  });
});
