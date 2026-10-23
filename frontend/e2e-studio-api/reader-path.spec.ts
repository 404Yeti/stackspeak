import { expect, test } from "@playwright/test";
import { publishableDraft, syntheticGuide } from "../src/test/studioFixtures";

// Must exercise the optimized Next production server: direct TS/Vitest DB tests
// do not reproduce the compiler's misgrouping of an awaited SQL template tag.
test("cold reader initialization serves missing, published and revoked snapshots", async ({ browser }) => {
  const anonymous = await browser.newContext({ baseURL: "http://localhost:3001" });
  const owner = await browser.newContext({ baseURL: "http://localhost:3001" });
  const origin = { Origin: "http://localhost:3001" };
  const collection = "/classroom/api/studio/exercises";
  try {
    // First reader request on a fresh built server failed503 before the repair.
    expect((await anonymous.request.get("/api/classroom/exercises/cold-reader-missing")).status()).toBe(404);
    expect((await anonymous.request.get("/exercises/cold-reader-missing")).status()).toBe(404);
    expect((await anonymous.request.get(`${collection}`)).status()).toBe(401);
    await owner.request.post("/classroom/session", { headers: origin, form: { password: process.env.CLASSROOM_E2E_PASSWORD! } });
    const created = await (await owner.request.post(collection, { headers: origin, data: { language: "Python", title: "Disposable cold-reader regression" } })).json();
    const path = `${collection}/${created.id}`;
    const publicApi = `/api/classroom/exercises/${created.slug}`;
    const publicPage = `/exercises/${created.slug}`;
    expect((await anonymous.request.get(publicApi)).status()).toBe(404);
    expect((await anonymous.request.get(publicPage)).status()).toBe(404);
    const draft = publishableDraft();
    draft.content.title = "Disposable cold-reader regression";
    const saved = await (await owner.request.patch(path, { headers: origin, data: { expectedVersion: created.lockVersion, draft } })).json();
    const guided = await (await owner.request.put(`${path}/guide`, { headers: origin, data: { expectedVersion: saved.lockVersion, guide: syntheticGuide() } })).json();
    const published = await owner.request.post(`${path}/publish`, { headers: origin, data: { expectedVersion: guided.lockVersion } });
    expect(published.status()).toBe(200);
    const live = await published.json();
    const response = await anonymous.request.get(publicApi);
    expect(response.status()).toBe(200);
    expect((await response.json()).title).toBe(draft.content.title);
    expect(await response.text()).not.toContain("PRIVATE_CANARY");
    const html = await anonymous.request.get(publicPage);
    expect(html.status()).toBe(200);
    expect(await html.text()).not.toContain("PRIVATE_CANARY");
    expect((await anonymous.request.get(`${path}/guide`)).status()).toBe(401);
    const revoked = await owner.request.post(`${path}/unpublish`, { headers: origin, data: { expectedVersion: live.lockVersion } });
    expect(revoked.status()).toBe(200);
    for (let i = 0; i < 2; i++) {
      expect((await anonymous.request.get(publicApi)).status()).toBe(404);
      expect((await anonymous.request.get(publicPage)).status()).toBe(404);
    }
    expect((await owner.request.delete(path, { headers: origin, data: { expectedVersion: (await revoked.json()).lockVersion } })).status()).toBe(200);
  } finally { await owner.close(); await anonymous.close(); }
});
