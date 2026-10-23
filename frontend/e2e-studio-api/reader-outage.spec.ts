import { expect, test } from "@playwright/test";

test("reader connection refusal fails closed while fixed source lessons retain their publication state", async ({ request }) => {
  test.skip(process.env.CLASSROOM_TEST_READER_OUTAGE !== "1", "Requires the isolated loopback connection-failure server");
  for (const path of ["/exercises/cold-reader-missing", "/api/classroom/exercises/cold-reader-missing"]) {
    const response = await request.get(path, { headers: { "x-stackspeak-publication": "FORGED_OLD_SNAPSHOT" } });
    expect(response.status()).toBe(503);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.text()).not.toMatch(/PRIVATE_CANARY|postgres:\/\/|CLASSROOM_DATABASE/);
  }
  for (const slug of ["python-loop-accumulator", "python-default-argument", "csharp-linq-deferred"]) {
    expect((await request.get(`/exercises/${slug}`)).status()).toBe(200);
    expect((await request.get(`/api/classroom/exercises/${slug}`)).status()).toBe(200);
  }
  expect((await request.get("/exercises/csharp-await-task")).status()).toBe(404);
  expect((await request.get("/api/classroom/exercises/csharp-await-task")).status()).toBe(404);
  expect((await request.get("/classroom/api/studio/exercises")).status()).toBe(401);
});
