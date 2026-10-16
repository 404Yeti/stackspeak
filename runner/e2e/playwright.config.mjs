import { defineConfig, devices } from "@playwright/test";

// Security + lifecycle suite for the runner. Runs the REAL built runner (dist/ and dist-test/) on its
// own origin, a faked app origin, and an attacker origin, in Chromium, Firefox and WebKit.
// Set RUNNER_BASE_URL to run the deployable subset against a deployed runner instead (see docs/python-runner.md).
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.mjs",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1, // Pyodide start-up is CPU heavy; parallel runs distort the timing assertions
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]] : "list",
  outputDir: "../test-results",
  use: { trace: "retain-on-failure" },
  projects: [
    // Chromium's Local Network Access check blocks a "public" page (the faked app origin) from using a
    // loopback runner and would ALSO block the loopback attacker server — which would make "nothing
    // leaked" pass for the wrong reason. Production never has this shape (the runner is public https),
    // so the check is disabled here so that the CSP is the only thing standing between code and the attacker.
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--disable-features=LocalNetworkAccessChecks"] } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
