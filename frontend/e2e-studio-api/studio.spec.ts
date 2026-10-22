import { expect, test } from "@playwright/test";
import { publishableDraft, syntheticGuide } from "../src/test/studioFixtures";
const collection = "/classroom/api/studio/exercises";
const headers = { origin: "http://localhost:3001" };
test("owner login and real HTTP authoring/publishing with anonymous isolation", async ({ page, browser }) => {
  const student = await browser.newContext({ baseURL: "http://localhost:3001" });
  try {
    expect((await student.request.get(collection)).status()).toBe(401);
    await page.goto("/classroom/login");
    await page.getByLabel("Teacher password").fill(process.env.CLASSROOM_E2E_PASSWORD!);
    await page.getByRole("button", { name: "Open Classroom" }).click();
    await expect(page.getByRole("heading", { name: /Your next great lesson/ })).toBeVisible();
    const request = page.context().request;
    const created = await request.post(collection, { headers, data: { language: "C#", title: "API test" } });
    expect(created.status()).toBe(201);
    const exercise = await created.json();
    const path = `${collection}/${exercise.id}`;
    const publicPath = `/api/classroom/exercises/${exercise.slug}`;
    expect((await student.request.get(publicPath)).status()).toBe(404);
    expect((await student.request.get(`/exercises/${exercise.slug}`)).status()).toBe(404);
    const draft = publishableDraft();
    draft.content.language = "C#";
    draft.content.filename = "Lesson.cs";
    draft.content.difficulty = "Advanced";
    draft.content.readCode = "var items = new[] { 1, 2 };\nConsole.WriteLine(items.Length);\n// Explain the result";
    draft.vocabulary.forEach((v) => { v.readLines = [1, 3]; });
    let response = await request.patch(path, { headers, data: { expectedVersion: exercise.lockVersion, draft } });
    expect(response.status()).toBe(200);
    let version = (await response.json()).lockVersion;
    response = await request.put(`${path}/guide`, { headers, data: { expectedVersion: version, guide: syntheticGuide() } });
    expect(response.status()).toBe(200);
    version = (await response.json()).lockVersion;
    for (const suffix of ["", "/preview"]) {
      const preview = await request.get(path + suffix);
      expect(preview.status()).toBe(200);
      expect(await preview.text()).not.toContain("PRIVATE_CANARY");
    }
    expect((await student.request.get(`${path}/guide`)).status()).toBe(401);
    const guide = await request.get(`${path}/guide`);
    expect((await guide.json()).guide.privateNotes).toBe(syntheticGuide().privateNotes);
    expect(guide.headers()["cache-control"]).toBe("private, no-store");
    response = await request.post(`${path}/publish`, { headers, data: { expectedVersion: version } });
    expect(response.status()).toBe(200);
    version = (await response.json()).lockVersion;
    let publicResponse = await student.request.get(publicPath);
    expect(publicResponse.status()).toBe(200);
    const published = await publicResponse.json();
    const csharpPage = await student.newPage();
    expect((await csharpPage.goto(`/exercises/${exercise.slug}`))?.status()).toBe(200);
    await expect(csharpPage.getByRole("heading", { name: published.title, exact: true })).toBeVisible();
    await expect(csharpPage.getByText("C#", { exact: true })).toBeVisible();
    expect(await csharpPage.content()).not.toContain("PRIVATE_CANARY");
    expect(published.language).toBe("C#");
    expect(JSON.stringify(published)).not.toContain("PRIVATE_CANARY");
    draft.content.title = "Autosaved draft, not public yet";
    response = await request.patch(path, { headers, data: { expectedVersion: version, draft } });
    expect(response.status()).toBe(200);
    version = (await response.json()).lockVersion;
    publicResponse = await student.request.get(publicPath);
    expect((await publicResponse.json()).title).toBe(published.title);
    expect((await request.patch(path, { headers, data: { expectedVersion: 1, draft } })).status()).toBe(409);
    response = await request.post(`${path}/unpublish`, { headers, data: { expectedVersion: version } });
    expect(response.status()).toBe(200);
    expect((await student.request.get(publicPath)).status()).toBe(404);
    expect((await student.request.get("/api/classroom/exercises/not-found")).status()).toBe(404);
    expect((await request.post(`${path}/publish`, { headers: { origin: "https://foreign.invalid" }, data: { expectedVersion: version } })).status()).toBe(403);
    // Original anonymous student URLs still render independently of Studio storage.
    for (const slug of ["python-loop-accumulator", "python-default-argument", "csharp-linq-deferred"]) {
      const response = await student.request.get(`/exercises/${slug}`);
      expect(response.status()).toBe(200);
      expect(await response.text()).not.toContain("PRIVATE_CANARY");
    }
  } finally { await student.close(); }
});
