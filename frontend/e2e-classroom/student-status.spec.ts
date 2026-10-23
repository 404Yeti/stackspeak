import { expect, test } from "@playwright/test";
test("student routes return genuine status codes before streaming in source mode", async ({ request }) => {
  for (const slug of ["python-loop-accumulator", "python-default-argument", "csharp-linq-deferred"]) {
    expect((await request.get(`/exercises/${slug}`)).status()).toBe(200);
  }
  for (const path of ["/exercises/csharp-await-task", "/exercises/not-found", "/exercises/%63sharp-await-task", "/exercises/csharp-await-task/"]) {
    const response = await request.get(path, { headers: { "x-stackspeak-publication": "FORGED" } });
    expect(response.status()).toBe(404);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.text()).not.toContain("readCode");
  }
  expect((await request.head("/exercises/csharp-await-task")).status()).toBe(404);
  expect((await request.get("/exercises/not-found?_rsc=test", { headers: { RSC: "1" } })).status()).toBe(404);
});
