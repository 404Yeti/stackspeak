import { expect, test, type Page } from "@playwright/test";
import {
  SOLUTION_MARKER,
  VIEWPORTS,
  completeFlow,
  expectNoHorizontalOverflow,
  startChallenge,
  toExplain,
  toFix,
  toTrace,
} from "../e2e/helpers";

const RUNNER_ORIGIN = "http://127.0.0.1:4310";
const editor = (page: Page) => page.getByLabel("main.py — your code");
const runButton = (page: Page) => page.getByRole("button", { name: /Run code|Running…/ });
const status = (page: Page) => page.getByTestId("run-status");
const output = (page: Page) => page.getByTestId("run-output");

async function setCode(page: Page, code: string) {
  await editor(page).fill(code);
}

/** Opens the Fix stage and waits until the runner has completed its handshake. */
async function openFix(page: Page) {
  await startChallenge(page);
  await toExplain(page);
  await toFix(page);
  await expect(status(page)).toHaveText("Python is ready.");
  await expect(runButton(page)).toBeEnabled();
}

async function runAndWait(page: Page, done: RegExp) {
  await runButton(page).click();
  await expect(status(page)).toHaveText(done, { timeout: 60_000 });
}

test.describe("Run Code in the Fix stage (real Python in the isolated runner)", () => {
  test("runs the starter code and shows its real output and timing", async ({ page }) => {
    await openFix(page);
    await runAndWait(page, /Your program finished running\./);
    await expect(output(page)).toContainText("20.0");
    await expect(page.getByTestId("run-timing")).toContainText(/Ran in \d+(\.\d+)? ?(ms|s)/);
    // Honest by design: a clean run is not a verdict.
    await expect(page.getByText(/does not check your fix/i)).toBeVisible();
    await expect(page.getByText(/tests? passed|is correct|well done/i)).toHaveCount(0);
  });

  test("shows the real traceback for the starter code's bug, then a stderr line, then a syntax error", async ({ page }) => {
    await openFix(page);

    await setCode(page, "def get_average(nums):\n    return sum(nums) / len(nums)\n\nprint(get_average([]))");
    await runAndWait(page, /stopped with ZeroDivisionError/);
    await expect(page.getByTestId("run-traceback")).toContainText("ZeroDivisionError: division by zero");
    await expect(page.getByTestId("run-traceback")).toContainText("main.py");

    await setCode(page, "import sys\nprint('to stdout')\nprint('to stderr', file=sys.stderr)");
    await runAndWait(page, /Your program finished running\./);
    await expect(output(page).locator('[data-stream="stdout"]')).toContainText("to stdout");
    await expect(output(page).locator('[data-stream="stderr"]')).toContainText("to stderr");

    await setCode(page, "def broken(:\n    pass");
    await runAndWait(page, /syntax error/);
    await expect(page.getByTestId("run-traceback")).toContainText("SyntaxError");
  });

  test("an endless loop is stopped at the time limit and the next run works on a fresh interpreter", async ({ page }) => {
    await openFix(page);
    await setCode(page, "leaked = 42\nwhile True:\n    pass");
    await runButton(page).click();
    await expect(runButton(page)).toBeDisabled();
    await expect(status(page)).toHaveText(/Stopped after 5 seconds/, { timeout: 30_000 });

    await setCode(page, "print('leaked' in dir())");
    await runAndWait(page, /finished running/);
    await expect(output(page)).toContainText("False");
  });

  test("a print flood stops at the output limit", async ({ page }) => {
    await openFix(page);
    await setCode(page, "while True:\n    print('x' * 200)");
    await runAndWait(page, /printed more than 64 KB/);
    await expect(page.getByText(/Output was cut off/)).toBeVisible();
  });

  test("Stop cancels a running program", async ({ page }) => {
    await openFix(page);
    await setCode(page, "while True:\n    pass");
    await runButton(page).click();
    await expect(status(page)).toHaveText(/Running your code/);
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(status(page)).toHaveText("You stopped the program.");
    await expect(runButton(page)).toBeEnabled();
  });

  test("many sequential runs; double-clicking Run starts exactly one", async ({ page }) => {
    await openFix(page);
    for (const n of [1, 2, 3]) {
      await setCode(page, `print(${n} * 111)`);
      await runAndWait(page, /finished running/);
      await expect(output(page)).toContainText(String(n * 111));
      await expect(output(page)).not.toContainText(String((n - 1) * 111 || "none"));
    }
    await setCode(page, "import time\ntime.sleep(1)\nprint('once')");
    await runButton(page).dblclick();
    await expect(status(page)).toHaveText(/finished running/, { timeout: 30_000 });
    await expect(output(page)).toHaveText("once\n");
  });

  test("keyboard: Run is reachable by Tab and Enter, and Ctrl+Enter runs from the editor", async ({ page }) => {
    await openFix(page);
    await setCode(page, "print('via ctrl-enter')");
    await editor(page).focus();
    await page.keyboard.press("Control+Enter");
    await expect(status(page)).toHaveText(/finished running/, { timeout: 60_000 });
    await expect(output(page)).toContainText("via ctrl-enter");

    await setCode(page, "print('via button')");
    await runButton(page).focus();
    await expect(runButton(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(output(page)).toContainText("via button", { timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Output" })).toHaveAttribute("tabindex", "0");
  });

  test("the draft survives a reload, Reset clears the output, and leaving the stage removes the runner iframe", async ({ page }) => {
    await openFix(page);
    await setCode(page, "print('draft that must survive')");
    await runAndWait(page, /finished running/);
    expect(await page.locator(`iframe[src^="${RUNNER_ORIGIN}"]`).count()).toBe(1);
    expect(await page.locator("iframe").first().getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");

    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Fix the function" })).toBeVisible();
    await expect(editor(page)).toHaveValue("print('draft that must survive')");

    await expect(status(page)).toHaveText("Python is ready.");
    await runAndWait(page, /finished running/);
    await page.getByRole("button", { name: "Reset code" }).click();
    await page.getByRole("button", { name: "Yes, reset" }).click();
    await expect(output(page)).not.toContainText("draft that must survive");
    await expect(editor(page)).toHaveValue(/def get_average/);

    await toTrace(page);
    await expect(page.locator("iframe")).toHaveCount(0); // cleanup on navigation: no runner left behind
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.locator(`iframe[src^="${RUNNER_ORIGIN}"]`)).toHaveCount(1);
  });

  test("student code is never sent over the network: only the isolated runner ever sees it", async ({ page }) => {
    const marker = "UNIQUE_STUDENT_MARKER_91c2";
    const seen: { method: string; url: string; body: string }[] = [];
    page.on("request", (r) => seen.push({ method: r.method(), url: r.url(), body: r.postData() ?? "" }));
    await openFix(page);
    await setCode(page, `# ${marker}\nprint("${marker}")`);
    await runAndWait(page, /finished running/);
    await expect(output(page)).toContainText(marker);

    expect(seen.filter((r) => (r.url + r.body).includes(marker))).toEqual([]);
    expect(seen.filter((r) => r.method !== "GET" && !r.url.startsWith("data:"))).toEqual([]);
    const backend = seen.filter((r) => r.url.startsWith("http://localhost:8000"));
    expect(backend.every((r) => r.method === "GET" && r.url.includes("/api/challenges"))).toBe(true);
    // The runner's answer key can't exist: the page never contains the reference solution before Feedback.
    expect(await page.content()).not.toContain(SOLUTION_MARKER);
  });

  test("when the runner is unreachable, Run says so, editing still works, and the rest of the flow continues", async ({ page }) => {
    await page.route(`${RUNNER_ORIGIN}/**`, (route) => route.abort());
    await startChallenge(page);
    await toExplain(page);
    await toFix(page);
    await expect(status(page)).toHaveText(/couldn't be reached.*still edit your code/, { timeout: 30_000 });
    await expect(runButton(page)).toBeDisabled();
    await setCode(page, "print('still editable')");
    await expect(editor(page)).toHaveValue("print('still editable')");
    await expect(page.getByRole("button", { name: "Try connecting again" })).toBeVisible();
    await toTrace(page); // Run is optional: the journey is unaffected
  });

  test("Run is optional: the journey continues to Trace without ever running, and the answer key stays hidden until Feedback", async ({ page }) => {
    await startChallenge(page);
    await toExplain(page);
    await toFix(page);
    await expect(status(page)).toHaveText("Python is ready.");
    expect(await page.content()).not.toContain(SOLUTION_MARKER);
    await toTrace(page);
    expect(await page.content()).not.toContain(SOLUTION_MARKER);
  });
});

test.describe("Run Code layout at every required width", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}px: Run, output and traceback fit, no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFix(page);
      await expectNoHorizontalOverflow(page);
      await setCode(page, "print('a fairly long line ' + 'x' * 120)\n1 / 0");
      await runAndWait(page, /stopped with ZeroDivisionError/);
      await expectNoHorizontalOverflow(page);
      await expect(runButton(page)).toBeVisible();
      await expect(output(page)).toBeVisible();
      await expect(page.getByTestId("run-traceback")).toBeVisible();
      await runButton(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results-run/screens/fix-run-${viewport.name}.png`, fullPage: true });
    });
  }
});

test("completeFlow helper still reaches Feedback with the flag on (full journey)", async ({ page }) => {
  await completeFlow(page);
  await expect(page.getByRole("heading", { level: 2, name: "Review your work" })).toBeVisible();
});
