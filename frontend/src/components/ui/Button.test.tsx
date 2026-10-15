import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a native button by default", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
  });

  it("renders a link when href is provided", () => {
    render(<Button href="/daily-challenge">Start challenge</Button>);

    const link = screen.getByRole("link", { name: "Start challenge" });
    expect(link).toHaveAttribute("href", "/daily-challenge");
  });
});
