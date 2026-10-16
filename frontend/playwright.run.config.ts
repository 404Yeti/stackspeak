import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

// Run Code e2e: REAL Python in the REAL isolated runner (test build served locally on its own origin), driven
// through a flag-ON production build of the app (`npm run build:run`). The normal suite (playwright.config.ts)
// builds with the flag OFF and only asserts that nothing runs. Prerequisites, in order:
//   (cd ../runner && npm ci --omit=dev && RUNNER_TEST_PARENTS=http://localhost:3000 npm run build:test)
//   npm run build:run && npm run e2e:run
// The runner's *test* build is used because only it can approve a localhost parent; its security properties
// (CSP, fail-closed canary, origin checks) are covered by runner/e2e against the production build.
export default defineConfig({
  testDir: "./e2e-run",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1, // Pyodide start-up is CPU heavy
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report-run" }]] : "list",
  outputDir: "test-results-run",
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: isCI ? "python -m uvicorn app.main:app --port 8000" : ".venv/bin/python -m uvicorn app.main:app --port 8000",
      cwd: "../backend",
      url: "http://localhost:8000/api/health",
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    {
      command: "node scripts/serve.mjs --dist dist-test --port 4310 --parents http://localhost:3000",
      cwd: "../runner",
      url: "http://127.0.0.1:4310/build-info.json",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "NEXT_DIST_DIR=.next-run npx next start -p 3000",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
