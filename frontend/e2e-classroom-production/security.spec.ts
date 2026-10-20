import { expect, test } from "@playwright/test";

const origin = "https://127.0.0.1:3443";
const publicSlugs = [
  "python-loop-accumulator",
  "python-default-argument",
  "csharp-linq-deferred",
];
const guidePath = "/classroom/api/guide/python-loop-accumulator";

test("Production-mode HTTPS login, private reveal, teaching workflow, fresh student isolation and logout", async ({
  page,
  context,
  browser,
}) => {
  await page.goto("/classroom/login");
  await page
    .getByLabel("Teacher password")
    .fill(process.env.CLASSROOM_HTTPS_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Open Classroom" }).click();
  await expect(
    page.getByRole("heading", { name: /Your next great lesson/ }),
  ).toBeVisible();
  const cookie = (await context.cookies()).find(
    (c) => c.name === "stackspeak_teacher",
  );
  expect(cookie).toBeDefined();
  expect(cookie!.secure).toBe(true);
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.sameSite).toBe("Strict");
  expect(cookie!.path).toBe("/classroom");
  expect(cookie!.domain).toBe("127.0.0.1");
  expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(7 * 3600);
  expect(cookie!.expires - Date.now() / 1000).toBeLessThanOrEqual(8 * 3600);

  await page.getByRole("searchbox").fill("Python loops");
  await page
    .getByRole("link", { name: "Open Follow the running total" })
    .click();
  await expect(
    page.getByRole("button", { name: "Reveal guide" }),
  ).toBeVisible();
  const teacherHtml = await context.request.get(
    "/classroom/exercises/python-loop-accumulator",
  );
  expect(
    (await teacherHtml.text()).includes(
      process.env.CLASSROOM_HTTPS_TEST_MARKER!,
    ),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Highlight accumulator in Read code" })
    .click();
  await page.getByRole("button", { name: "Reveal guide" }).click();
  await expect(
    page.getByText("Ideal spoken explanation:", { exact: false }).first(),
  ).toBeVisible();
  const guide = await context.request.get(guidePath);
  expect(guide.status()).toBe(200);
  expect(guide.headers()["cache-control"]).toBe("private, no-store");
  expect(
    (await guide.text()).includes(process.env.CLASSROOM_HTTPS_TEST_MARKER!),
  ).toBe(true);
  await page.getByRole("button", { name: "Present lesson" }).click();
  await expect(
    page.getByText("Ideal spoken explanation:", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Exit presentation" }).click();
  await page.getByRole("button", { name: /Continue to Explain/ }).click();
  await page
    .getByLabel(/What is the purpose/)
    .fill("The total starts at zero and grows with each point value.");
  await page.getByRole("button", { name: /Continue to Fix/ }).click();
  const editor = page.getByRole("textbox", { name: /totals.py/ });
  await editor.fill("def total_points(points):\n    return sum(points)");
  await page.getByRole("button", { name: "Reset exercise" }).click();
  await page.getByRole("button", { name: "Clear and reset" }).click();
  await page.getByRole("button", { name: /03\s*Fix/ }).click();
  expect(await editor.inputValue()).not.toBe(
    "def total_points(points):\n    return sum(points)",
  );

  // Warm teacher responses above must never authorize or populate a fresh client.
  const student = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  try {
    for (const slug of publicSlugs) {
      const response = await student.request.get(`/exercises/${slug}`);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html.includes(process.env.CLASSROOM_HTTPS_TEST_MARKER!)).toBe(
        false,
      );
      expect(html.includes("spokenExample")).toBe(false);
      expect(html.includes("Wait for the work, not the thread")).toBe(false);
    }
    const anonymousGuide = await student.request.get(guidePath);
    expect(anonymousGuide.status()).toBe(401);
    expect(anonymousGuide.headers()["cache-control"]).toBe("private, no-store");
    const draft = await student.request.get("/exercises/csharp-await-task");
    expect(
      (await draft.text()).includes("Wait for the work, not the thread"),
    ).toBe(false);
    const anonymousPage = await student.newPage();
    await anonymousPage.goto("/classroom/exercises/python-loop-accumulator");
    await expect(anonymousPage.getByLabel("Teacher password")).toBeVisible();
  } finally {
    await student.close();
  }
  await context.request.post("/classroom/logout", { headers: { origin } });
  expect((await context.request.get(guidePath)).status()).toBe(401);
});

test("Production-mode CSRF, method and redirect protections", async ({
  request,
}) => {
  const sources: Record<string, string>[] = [
    {},
    { origin: "https://attacker.invalid" },
    {
      origin: "https://attacker.invalid",
      "x-forwarded-host": "127.0.0.1:3443",
      "x-forwarded-proto": "https",
    },
  ];
  for (const headers of sources) {
    const response = await request.post("/classroom/session", {
      headers,
      form: { password: "wrong" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
  expect((await request.get("/classroom/session")).status()).toBe(405);
  expect((await request.get("/classroom/logout")).status()).toBe(405);
  const response = await request.post("/classroom/session", {
    headers: { origin, "x-forwarded-host": "attacker.invalid" },
    form: { password: "wrong" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe(
    `${origin}/classroom/login?error=credentials`,
  );
  expect(response.headers()["set-cookie"]).toBeUndefined();
});
