import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("uses a subtle border by default", () => {
    const { container } = render(<Card>content</Card>);
    expect(container.firstChild).toHaveClass("border-border-subtle");
  });

  it("uses an accent border when highlighted", () => {
    const { container } = render(<Card highlighted>content</Card>);
    expect(container.firstChild).toHaveClass("border-accent");
    expect(container.firstChild).not.toHaveClass("border-border-subtle");
  });

  it("applies elevated styling when requested", () => {
    const { container } = render(<Card elevation="elevated">content</Card>);
    expect(container.firstChild).toHaveClass("bg-elevated");
  });
});
