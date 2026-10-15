import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./Logo";

describe("Logo", () => {
  it("renders the StackSpeak wordmark", () => {
    render(<Logo />);
    expect(screen.getByText("Stack")).toBeInTheDocument();
    expect(screen.getByText("Speak")).toBeInTheDocument();
  });

  it("renders the icon as decorative (adjacent text already labels it)", () => {
    const { container } = render(<Logo />);
    // alt="" correctly removes it from the accessibility tree (role "presentation",
    // not "img") — assert on the raw element rather than getByRole("img").
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
