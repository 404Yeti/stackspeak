import { describe, expect, it } from "vitest";
import { primaryNavLinks } from "./navigation";

describe("primaryNavLinks", () => {
  it("includes Home and Daily Challenge as fully implemented routes", () => {
    const home = primaryNavLinks.find((link) => link.href === "/");
    const dailyChallenge = primaryNavLinks.find((link) => link.href === "/daily-challenge");

    expect(home?.comingSoon).toBeUndefined();
    expect(dailyChallenge?.comingSoon).toBeUndefined();
  });

  it("marks Courses, Practice Lab, and Progress as coming soon", () => {
    const comingSoonRoutes = primaryNavLinks
      .filter((link) => link.comingSoon)
      .map((link) => link.href);

    expect(comingSoonRoutes).toEqual(["/courses", "/practice-lab", "/progress"]);
  });
});
