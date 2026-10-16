import { expect, type Page } from "@playwright/test";

export const VIEWPORTS = [
  { name: "320", width: 320, height: 700 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
] as const;

/** Appears only in the reference solution — must never reach the page before Feedback. */
export const SOLUTION_MARKER = "cannot compute the average of an empty list";

export const ANSWER = "This function adds up the numbers and divides by how many there are.";

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

export async function startChallenge(page: Page) {
  await page.goto("/daily-challenge");
  await expect(page.getByRole("heading", { level: 1, name: "Average of a List" })).toBeVisible();
}

export async function toExplain(page: Page) {
  await page.getByRole("button", { name: "Start explaining" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Explain the code" })).toBeVisible();
}

export async function toFix(page: Page) {
  await page.getByLabel("What does this code do?").fill(ANSWER);
  await page.getByRole("button", { name: "Continue to Fix" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Fix the function" })).toBeVisible();
}

export async function toTrace(page: Page) {
  await page.getByLabel("Where is the bug, and why?").fill("It divides by len(nums), which is zero for an empty list.");
  await page.getByRole("button", { name: "Continue to Trace" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Trace it by hand" })).toBeVisible();
}

export async function traceAllCases(page: Page) {
  const cases = page.getByRole("group", { name: /^Case \d/ });
  await expect(cases).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) {
    const group = cases.nth(i);
    await group.getByRole("textbox").fill("returns a number");
    await group.getByRole("button", { name: "Reveal expected outcome" }).click();
    await expect(group.getByText(/^Expected:/)).toBeVisible();
    await group.getByLabel("My prediction matched").check();
  }
}

export async function toDefend(page: Page) {
  await traceAllCases(page);
  await page.getByRole("button", { name: "Continue to Defend" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Defend your fix" })).toBeVisible();
}

export async function toFeedback(page: Page) {
  await page.getByLabel("Why did you fix it this way?").fill("I raise ValueError because a silent default could hide a bug.");
  await page.getByRole("button", { name: "Continue to Feedback" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Review your work" })).toBeVisible();
}

export async function completeFlow(page: Page) {
  await startChallenge(page);
  await toExplain(page);
  await toFix(page);
  await toTrace(page);
  await toDefend(page);
  await toFeedback(page);
}
