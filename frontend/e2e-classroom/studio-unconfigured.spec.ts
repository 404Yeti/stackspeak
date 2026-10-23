import { expect, test } from "@playwright/test";
// Existing Classroom config deliberately supplies no Studio database credentials.
// A failed/unconfigured integration cannot interrupt the established lessons.
test("Studio storage unavailable keeps existing published lessons available", async ({ request }) => {
  const response = await request.get("/api/classroom/exercises/python-loop-accumulator");
  expect(response.status()).toBe(503);
  expect(await response.text()).not.toContain("CLASSROOM_DATABASE");
  for (const slug of ["python-loop-accumulator", "python-default-argument", "csharp-linq-deferred"]) {
    const existing = await request.get(`/exercises/${slug}`);
    expect(existing.status()).toBe(200);
    expect(await existing.text()).toContain("Read");
  }
});
