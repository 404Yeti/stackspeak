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

  it("defaults to the small in-app header lockup", () => {
    const { container } = render(<Logo />);
    expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("logo-icon.svg"));
  });

  it("uses the dedicated small-variant icon asset for the large marketing lockup", () => {
    const { container } = render(<Logo size="lg" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("logo-icon-sm.svg"),
    );
  });
});
