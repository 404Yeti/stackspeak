import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const records = JSON.parse(
  readFileSync("content/classroom/exercises.json", "utf8"),
);
const guides = JSON.parse(process.env.CLASSROOM_TEST_GUIDES!);
async function signIn(page: Page) {
  await page.goto("/classroom/login");
  await page
    .getByLabel("Teacher password")
    .fill(process.env.CLASSROOM_E2E_PASSWORD!);
  await page.getByRole("button", { name: "Open Classroom" }).click();
  await expect(
    page.getByRole("heading", { name: /Your next great lesson/ }),
  ).toBeVisible();
}

test("anonymous access cannot read teacher guides, private exercises, HTML or client chunks", async ({
  page,
  request,
}) => {
  await page.goto("/classroom");
  await expect(page.getByLabel("Teacher password")).toBeVisible();
  for (const slug of [
    "python-loop-accumulator",
    "csharp-await-task",
    "unknown",
  ]) {
    const guide = await request.get(`/classroom/api/guide/${slug}`);
    expect(guide.status()).toBe(401);
    expect(await guide.text()).not.toContain("spokenExample");
  }
  await page.goto("/exercises/csharp-await-task");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  const response = await request.get("/exercises/python-loop-accumulator");
  const html = await response.text();
  expect(html).not.toContain("spokenExample");
  for (const exercise of records) {
    for (const answer of guides[exercise.slug].answers)
      expect(html).not.toContain(answer.spokenExample);
    expect(html).not.toContain("Private draft for teacher review");
  }
  const files = (path: string): string[] =>
    readdirSync(path).flatMap((name) => {
      const p = join(path, name);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  const javascript = files(".next/static")
    .filter((p) => p.endsWith(".js"))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  for (const exercise of records) {
    for (const answer of guides[exercise.slug].answers)
      expect(javascript).not.toContain(answer.spokenExample);
    for (const note of guides[exercise.slug].notes)
      expect(javascript).not.toContain(note);
  }
});

test("teacher teaches, reveals privately, presents, shares, edits and resets", async ({
  page,
  context,
  browser,
  browserName,
}) => {
  await signIn(page);
  await page.screenshot({
    path: "../docs/classroom/library.png",
    fullPage: true,
  });
  await page.getByRole("searchbox").fill("Python loops");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Open Follow the running total" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Walk through the code" }),
  ).toBeVisible();
  await expect(
    page.getByText("Ideal spoken explanation:", { exact: false }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "../docs/classroom/teacher-workspace.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reveal guide" }).click();
  await expect(
    page.getByText("Ideal spoken explanation:", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Present lesson" }).click();
  await expect(page.getByRole("button", { name: "Hide guide" })).toHaveCount(0);
  await expect(
    page.getByText("Ideal spoken explanation:", { exact: false }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "../docs/classroom/presentation.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Exit presentation" }).click();
  await expect(
    page.getByRole("button", { name: "Reveal guide" }),
  ).toBeVisible();
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy student link" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "http://localhost:3001/exercises/python-loop-accumulator",
    );
  } else {
    // Clipboard permission names are Chromium-specific. Verify graceful refusal separately.
    await page.getByRole("button", { name: "Copy student link" }).click();
    await expect(
      page.getByRole("link", { name: "Open student view in a new tab" }),
    ).toHaveAttribute("href", "/exercises/python-loop-accumulator");
  }
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await student.goto("http://localhost:3001/exercises/python-loop-accumulator");
  await expect(
    student.getByRole("heading", { name: "Follow the running total" }),
  ).toBeVisible();
  await expect(
    student.getByRole("button", { name: "Reveal guide" }),
  ).toHaveCount(0);
  expect(
    (
      await studentContext.request.get(
        "http://localhost:3001/classroom/api/guide/python-loop-accumulator",
      )
    ).status(),
  ).toBe(401);
  await studentContext.close();
  await page.getByRole("button", { name: /Continue to Explain/ }).click();
  await page
    .getByLabel(/What is the purpose/)
    .fill("It starts the total at zero.");
  await page.getByRole("button", { name: /Continue to Fix/ }).click();
  const editor = page.getByRole("textbox", { name: /totals.py/ });
  await editor.fill("def total_points(points):\n    return sum(points)");
  await page.getByRole("button", { name: "Syntax preview" }).click();
  await expect(page.getByText("Your syntax preview")).toBeVisible();
  await page.getByRole("button", { name: "Back to editing" }).click();
  await expect(editor).toHaveValue(
    "def total_points(points):\n    return sum(points)",
  );
  await page.screenshot({
    path: "../docs/classroom/fix-stage.png",
    fullPage: true,
  });
  await editor.focus();
  await page.keyboard.press("Tab");
  await expect(editor).not.toBeFocused();
  await page.getByRole("button", { name: "Reset exercise" }).click();
  await page.getByRole("button", { name: "Clear and reset" }).click();
  await page.getByRole("button", { name: /03\s*Fix/ }).click();
  await expect(editor).toHaveValue(records[0].fix.buggyCode);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Teacher password")).toBeVisible();
  await page.goto("/classroom/exercises/python-loop-accumulator");
  await expect(page.getByLabel("Teacher password")).toBeVisible();
});

test("student workflow, responsive widths and unavailable execution stay usable", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/exercises/python-loop-accumulator");
    await expect(
      page.getByRole("heading", { name: "Follow the running total" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reveal guide" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../docs/classroom/student-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /03\s*Fix/ }).click();
    await page
      .getByRole("textbox", { name: /totals.py/ })
      .fill("my explanation as code");
    await expect(page.getByText(/Execution is unavailable/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Run code", exact: true }),
    ).toHaveCount(0);
  }
  expect(
    requests.some(
      (url) =>
        url.includes("/api/guide/") ||
        url.includes("stackspeak-runner") ||
        url.includes("onrender.com"),
    ),
  ).toBe(false);
});

test("library filters, private draft and empty results", async ({ page }) => {
  await signIn(page);
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("C#");
  await page
    .getByRole("combobox", { name: "Topic", exact: true })
    .selectOption("LINQ");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("searchbox").fill("no matching exercise");
  await expect(
    page.getByRole("heading", { name: "No exercises match yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).last().click();
  await page
    .getByRole("link", { name: "Open Wait for the work, not the thread" })
    .click();
  await expect(
    page.getByText("Private draft · sharing unavailable"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy student link" }),
  ).toHaveCount(0);
});

for (const slug of ["csharp-linq-deferred", "csharp-await-task"]) {
  test(`C# lesson workflow: ${slug}`, async ({ page, browser }) => {
    await signIn(page);
    await page
      .getByRole("combobox", { name: "Language", exact: true })
      .selectOption("C#");
    const link = page.locator(`a[href="/classroom/exercises/${slug}"]`);
    await link.click();
    await expect(page.getByLabel("Lesson code")).toBeVisible();
    await page.getByRole("button", { name: "Reveal guide" }).click();
    await expect(
      page.getByRole("heading", { name: "Common misunderstandings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Follow-up discussion" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /03\s*Fix/ }).click();
    const editor = page.getByRole("textbox", { name: /\.cs/ });
    await editor.fill("// Student C# draft");
    await page.getByRole("button", { name: "Reset exercise" }).click();
    await page.getByRole("button", { name: "Clear and reset" }).click();
    await page.getByRole("button", { name: /03\s*Fix/ }).click();
    expect(await editor.inputValue()).toBe(
      records.find((e: { slug: string }) => e.slug === slug).fix.buggyCode,
    );
    const studentContext = await browser.newContext();
    const response = await studentContext.request.get(
      `http://localhost:3001/exercises/${slug}`,
    );
    const html = await response.text();
    expect(html).not.toContain("spokenExample");
    if (slug === "csharp-await-task")
      expect(html).not.toContain("Wait for the work, not the thread");
    else expect(html).toContain("When does this query run?");
    expect(
      (
        await studentContext.request.get(
          `http://localhost:3001/classroom/api/guide/${slug}`,
        )
      ).status(),
    ).toBe(401);
    await studentContext.close();
  });
}

test("vocabulary focus, font controls and presentation at laptop/projector resolutions", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("link", { name: "Open Follow the running total" })
    .click();
  await page
    .getByRole("button", { name: "Highlight accumulator in Read code" })
    .click();
  await expect(page.locator('[data-code-line="2"]')).toHaveClass(
    /classroom-line-focused/,
  );
  await expect(page.locator('[data-code-line="4"]')).toHaveClass(
    /classroom-line-focused/,
  );
  await page.getByRole("button", { name: "Increase code size" }).click();
  await expect(page.getByLabel("Code font size")).toHaveText("18 px");
  await page.getByRole("button", { name: "Reveal guide" }).click();
  await expect(page.getByRole("button", { name: "Hide guide" })).toBeVisible();
  await page.getByRole("button", { name: "Present lesson" }).click();
  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("button", { name: "Hide guide" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("heading", { name: "Common misunderstandings" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../docs/classroom/presentation-${width}x${height}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Exit presentation" }).click();
  await expect(page.getByLabel("Code font size")).toHaveText("18 px");
  await expect(
    page.getByRole("button", { name: "Reveal guide" }),
  ).toBeVisible();
});
