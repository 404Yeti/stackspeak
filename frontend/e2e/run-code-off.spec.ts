import { expect, test } from "@playwright/test";
import { startChallenge, toExplain, toFix } from "./helpers";

// This suite is built with the Run Code flag OFF (the production default). Nothing may run, load, or contact a runner.
test("Run Code is off by default: no Run button, no runner iframe, no runner requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await startChallenge(page);
  await toExplain(page);
  await toFix(page);

  await expect(page.getByRole("button", { name: /run code/i })).toHaveCount(0);
  await expect(page.getByTestId("run-output")).toHaveCount(0);
  await expect(page.getByText(/nothing runs it/i)).toBeVisible();
  expect(await page.locator("iframe").count()).toBe(0);
  expect(requests.filter((url) => /runner|:4310|pyodide/i.test(url))).toEqual([]);
});
