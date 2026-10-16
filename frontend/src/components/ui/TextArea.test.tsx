import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextArea } from "./TextArea";

describe("TextArea", () => {
  it("associates its label and hint with the field", () => {
    render(<TextArea id="t" label="Your answer" value="" onChange={() => {}} hint="Be specific." />);
    const field = screen.getByLabelText("Your answer");
    expect(field).toHaveAccessibleDescription("Be specific.");
  });

  it("reports changes", () => {
    const onChange = vi.fn();
    render(<TextArea id="t" label="Your answer" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledWith("hello");
  });
});
