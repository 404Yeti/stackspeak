import { expect, test, type Page } from "@playwright/test";
import {
  VIEWPORTS,
  completeFlow,
  expectNoHorizontalOverflow,
  startChallenge,
  toDefend,
  toExplain,
  toFix,
  toTrace,
  toFeedback,
} from "./helpers";

// Next.js injects its own role="alert" route announcer; target the app's alert.
const appAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

// The whole journey, at every required width. Each stage is checked for
// horizontal overflow, and the correct progress indicator for the width.
for (const viewport of VIEWPORTS) {
  test.describe(`viewport ${viewport.name}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("completes READ → FEEDBACK, then restarts", async ({ page }) => {
      const wide = viewport.width >= 1024;
      await startChallenge(page);
      await expectNoHorizontalOverflow(page);

      // Workspace top bar replaces the global nav on this route only.
      await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Exit" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Challenge stage progress" })).toBeVisible({ visible: wide });
      await expect(page.getByText("Step 1 of 6 · Read")).toBeVisible({ visible: !wide });

      await toExplain(page);
      await expectNoHorizontalOverflow(page);
      await toFix(page);
      await expectNoHorizontalOverflow(page);
      await toTrace(page);
      await expectNoHorizontalOverflow(page);
      await toDefend(page);
      await expectNoHorizontalOverflow(page);
      await toFeedback(page);
      await expectNoHorizontalOverflow(page);

      // Feedback: separate axes, reference labeled as one valid answer, no score.
      await expect(page.getByRole("group", { name: "Technical understanding" })).toBeVisible();
      await expect(page.getByRole("group", { name: "Communication" })).toBeVisible();
      await expect(page.getByText("This is one reference implementation, not the only valid answer.")).toBeVisible();
      await expect(page.getByText(/has not evaluated your answers/)).toBeVisible();

      // Restart returns to Read with state cleared.
      await page.getByRole("button", { name: "Start over" }).click();
      await page.getByRole("button", { name: "Yes, start over" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Read the code" })).toBeVisible();
      await page.getByRole("button", { name: "Start explaining" }).click();
      await expect(page.getByLabel("What does this code do?")).toHaveValue("");
    });
  });
}

test.describe("behavior", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("cannot continue until the stage's requirement is met", async ({ page }) => {
    await startChallenge(page);
    await toExplain(page);
    const next = page.getByRole("button", { name: "Continue to Fix" });
    await expect(next).toBeDisabled();
    await expect(page.getByText(/at least 10 characters/)).toBeVisible();
    await page.getByLabel("What does this code do?").fill("short");
    await expect(next).toBeDisabled();
    await page.getByLabel("What does this code do?").fill("a sufficiently long explanation");
    await expect(next).toBeEnabled();
  });

  test("moves focus to the stage heading and marks the current step", async ({ page }) => {
    await startChallenge(page);
    await toExplain(page);
    await expect(page.getByRole("heading", { level: 2, name: "Explain the code" })).toBeFocused();
    await expect(page.getByRole("listitem").filter({ hasText: "Explain" }).first()).toHaveAttribute(
      "aria-current",
      "step",
    );
    // The stage after "Fix" is Trace, never "Run".
    await expect(page.getByText("Run", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Trace", { exact: true })).toBeVisible();
  });

  test("Back keeps answers; Reset code asks first and restores the starter", async ({ page }) => {
    await startChallenge(page);
    await toExplain(page);
    await toFix(page);
    const editor = page.getByLabel(/main\.py — your code/);
    const starter = await editor.inputValue();
    await editor.fill("def get_average(nums):\n    return 0");
    await page.getByRole("button", { name: "Reset code" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(editor).toHaveValue("def get_average(nums):\n    return 0");
    await page.getByRole("button", { name: "Reset code" }).click();
    await page.getByRole("button", { name: "Yes, reset" }).click();
    await expect(editor).toHaveValue(starter);

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("What does this code do?")).not.toHaveValue("");
  });

  test("a refresh keeps the draft (sessionStorage)", async ({ page }) => {
    await startChallenge(page);
    await toExplain(page);
    await toFix(page);
    await page.getByLabel("Where is the bug, and why?").fill("diagnosis that survives a reload");
    await page.waitForTimeout(500); // draft saves are debounced
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Fix the function" })).toBeVisible();
    await expect(page.getByLabel("Where is the bug, and why?")).toHaveValue("diagnosis that survives a reload");
  });

  test("works when sessionStorage is blocked", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "sessionStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await startChallenge(page);
    await toExplain(page);
    await toFix(page);
    await toTrace(page);
    await toDefend(page);
    await toFeedback(page);
  });

  test("trace requires a prediction before revealing the expected outcome", async ({ page }) => {
    await startChallenge(page);
    await toExplain(page);
    await toFix(page);
    await toTrace(page);
    const first = page.getByRole("group", { name: /^Case 1/ });
    await expect(first.getByRole("button", { name: "Reveal expected outcome" })).toBeDisabled();
    await expect(first.getByText(/^Expected:/)).toHaveCount(0);
    // No fabricated results: no pass/fail wording or terminal anywhere on the stage.
    await expect(page.getByText(/passed|failed|pytest|\$ /i)).toHaveCount(0);
    await expect(page.getByText(/did not run your code/)).toBeVisible();
  });

  test("reaching Defend then going back and forth keeps trace marks", async ({ page }) => {
    await startChallenge(page);
    await toExplain(page);
    await toFix(page);
    await toTrace(page);
    await toDefend(page);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Trace it by hand" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to Defend" })).toBeEnabled();
  });

  test("Exit leaves the workspace", async ({ page }) => {
    await startChallenge(page);
    await page.getByRole("link", { name: "Exit" }).click();
    await expect(page).toHaveURL("/");
  });

  test("other routes keep the existing navigation", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });
});

test.describe("loading and errors", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("shows a loading state while the challenge loads", async ({ page }) => {
    await page.route("**/api/challenges", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto("/daily-challenge");
    await expect(page.getByRole("status")).toContainText("Loading today's challenge");
    await expect(page.getByRole("heading", { level: 1, name: "Average of a List" })).toBeVisible();
  });

  test("a failed load shows an error and Retry recovers", async ({ page }) => {
    let failures = 1;
    await page.route("**/api/challenges", async (route) => {
      if (failures > 0) {
        failures -= 1;
        await route.abort("connectionrefused");
      } else {
        await route.continue();
      }
    });
    await page.goto("/daily-challenge");
    await expect(appAlert(page)).toContainText("Couldn't load today's challenge");
    await expect(appAlert(page)).toContainText("couldn't reach");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Average of a List" })).toBeVisible();
  });

  test("a 500 from the server is reported, not crashed on", async ({ page }) => {
    await page.route("**/api/challenges", (route) => route.fulfill({ status: 500, body: "boom" }));
    await page.goto("/daily-challenge");
    await expect(appAlert(page)).toContainText("ran into a problem");
  });

  test("a failed Feedback load keeps the student's answers and Retry recovers", async ({ page }) => {
    let failures = 1;
    await page.route("**/api/challenges/*/review", async (route) => {
      if (failures > 0) {
        failures -= 1;
        await route.fulfill({ status: 500, body: "boom" });
      } else {
        await route.continue();
      }
    });
    await startChallenge(page);
    await toExplain(page);
    await toFix(page);
    await toTrace(page);
    await toDefend(page);
    await page.getByLabel("Why did you fix it this way?").fill("a defense long enough to count");
    await page.getByRole("button", { name: "Continue to Feedback" }).click();
    await expect(appAlert(page)).toContainText("Your answers so far are safe");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("This is one reference implementation, not the only valid answer.")).toBeVisible();
    await expect(page.getByText("a defense long enough to count")).toBeVisible();
  });
});

test.describe("public/private boundary", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("stage content and the solution are only fetched, and shown, when their stage is reached", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/")) requested.push(`${request.method()} ${url.pathname}`);
    });
    const bodyText = () => page.evaluate(() => document.body.innerText);
    const { SOLUTION_MARKER } = await import("./helpers");

    await startChallenge(page);
    expect(requested).toEqual(["GET /api/challenges", "GET /api/challenges/average-of-list"]);

    await toExplain(page);
    await toFix(page);
    expect(requested.some((r) => /trace|defend|review/.test(r))).toBe(false);
    // The initial payload doesn't contain the bug, so neither can the page.
    expect((await bodyText()).toLowerCase()).not.toContain("zerodivisionerror");
    expect(await page.content()).not.toContain(SOLUTION_MARKER);

    await toTrace(page);
    expect(requested).toContain("GET /api/challenges/average-of-list/trace");
    expect(requested.some((r) => /defend|review/.test(r))).toBe(false);

    await toDefend(page);
    expect(requested).toContain("GET /api/challenges/average-of-list/defend");
    expect(requested.some((r) => /review/.test(r))).toBe(false);
    expect(await page.content()).not.toContain(SOLUTION_MARKER);

    await toFeedback(page);
    expect(requested).toContain("GET /api/challenges/average-of-list/review");
    expect(await page.content()).toContain(SOLUTION_MARKER);
  });

  test("nothing the student writes is sent anywhere", async ({ page }) => {
    const nonGet: string[] = [];
    const urlsWithAnswers: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET") nonGet.push(`${request.method()} ${request.url()}`);
      if (/summary|divides|ValueError|sufficiently/i.test(decodeURIComponent(request.url()))) {
        urlsWithAnswers.push(request.url());
      }
    });
    await completeFlow(page);
    expect(nonGet).toEqual([]);
    expect(urlsWithAnswers).toEqual([]);
  });

  test("the initial load response is spoiler-free and instructor-free", async ({ request }) => {
    const response = await request.get("http://localhost:8000/api/challenges/average-of-list");
    const raw = (await response.text()).toLowerCase();
    for (const forbidden of [
      "zerodivisionerror",
      "valueerror",
      "bug_description",
      "expected_behavior",
      "test_cases",
      "corrected_solution",
      "instructor_notes",
      "evaluation_guidance",
      "hidden",
    ]) {
      expect(raw, forbidden).not.toContain(forbidden);
    }
  });
});
