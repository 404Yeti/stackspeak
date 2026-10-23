import { expect, test } from "@playwright/test";
import { publishableDraft } from "../src/test/studioFixtures";

test("multiple vocabulary rows parse, save, recover from invalid input and retain indexing", async ({ page }) => {
  await page.goto("/classroom/login");
  await page.getByLabel("Teacher password").fill(process.env.CLASSROOM_E2E_PASSWORD!);
  await page.getByRole("button", { name: "Open Classroom" }).click();
  const api = page.context().request;
  const headers = { origin: "http://localhost:3001" };
  const created = await api.post("/classroom/api/studio/exercises", { headers, data: { language: "Python" } });
  expect(created.status()).toBe(201);
  const record = await created.json();
  const path = `/classroom/api/studio/exercises/${record.id}`;
  const draft = publishableDraft();
  draft.vocabulary.forEach((entry) => { entry.readLines = [1]; });
  const saved = await api.patch(path, { headers, data: { expectedVersion: record.lockVersion, draft } });
  expect(saved.status()).toBe(200);
  await page.goto(`/classroom/studio/${record.id}`);
  await page.getByRole("tab", { name: /Vocabulary/ }).click();
  const field = page.getByLabel("Read code lines (comma separated)").nth(2);
  const payloads: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().endsWith(path)) payloads.push(request.postDataJSON());
  });
  for (const [text, lines] of [["1,2", [1, 2]], ["1", [1]], ["", []], ["1, ", [1]]] as const) {
    await field.fill(text);
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    expect((await (await api.get(path)).json()).draft.vocabulary[2].readLines).toEqual(lines);
  }
  const count = payloads.length;
  await field.fill("invalid");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: /^Use unique whole/ })).toContainText("whole line numbers");
  await page.getByRole("tab", { name: /Content/ }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Not saved");
  expect(payloads).toHaveLength(count);
  await page.getByRole("tab", { name: /Vocabulary/ }).click();
  await expect(field).toHaveValue("invalid");
  await field.fill("");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /Vocabulary/ }).click();
  await expect(field).toHaveValue("");
  const current = await (await api.get(path)).json();
  expect(current.draft.vocabulary).toEqual(draft.vocabulary.map((entry, i) => i === 2 ? { ...entry, readLines: [] } : entry));
  expect(JSON.stringify(payloads)).not.toContain("null");
  await expect(page.getByLabel("Technical term 3")).toHaveValue(draft.vocabulary[2].term);
  await page.getByRole("button", { name: "Move vocabulary 3 up" }).click();
  await expect(page.getByLabel("Technical term 2")).toHaveValue(draft.vocabulary[2].term);
  await expect(page.getByLabel("Read code lines (comma separated)").nth(1)).toHaveValue("");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  const final = await (await api.get(path)).json();
  expect((await api.delete(path, { headers, data: { expectedVersion: final.lockVersion } })).status()).toBe(200);
});
