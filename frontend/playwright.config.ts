import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

// Smoke suite for the Daily Challenge flow. Runs against the REAL FastAPI
// backend (so the public/private boundary is exercised for real) and a
// production Next.js build. Failure paths are simulated per-test with
// page.route(). Locally: build once (`npm run build`), then `npm run e2e`.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: isCI ? 2 : 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: isCI
        ? "python -m uvicorn app.main:app --port 8000"
        : ".venv/bin/python -m uvicorn app.main:app --port 8000",
      cwd: "../backend",
      url: "http://localhost:8000/api/health",
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    {
      command: "npx next start -p 3000",
      url: "http://localhost:3000",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
