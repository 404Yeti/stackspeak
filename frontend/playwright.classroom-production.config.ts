import { defineConfig, devices } from "@playwright/test";
import { randomBytes, scryptSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeTestGuides } from "./src/test/classroomFixtures";
import { parseExercises } from "./src/lib/classroom/schema";
import catalog from "./content/classroom/exercises.json";

// Local HTTPS exercises real Secure cookies and the hosted Production guards.
// It never contacts Vercel or proves WAF behavior. Use synthetic guides only:
// Playwright failure context can contain page text even when traces are off.
process.env.CLASSROOM_HTTPS_TEST_PASSWORD ||=
  randomBytes(32).toString("base64url");
process.env.CLASSROOM_HTTPS_TEST_MARKER ||= randomBytes(24).toString("hex");
const salt = randomBytes(16).toString("hex");
const digest = scryptSync(process.env.CLASSROOM_HTTPS_TEST_PASSWORD, salt, 64, {
  N: 65536,
  r: 8,
  p: 2,
  maxmem: 128 * 1024 * 1024,
}).toString("hex");
const tls = mkdtempSync(join(tmpdir(), "stackspeak-classroom-https-"));
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-sha256",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
    "-keyout",
    join(tls, "key.pem"),
    "-out",
    join(tls, "cert.pem"),
  ],
  { stdio: "ignore" },
);
process.on("exit", () => rmSync(tls, { recursive: true, force: true }));

export default defineConfig({
  testDir: "./e2e-classroom-production",
  outputDir: "./test-results-classroom-production",
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL: "https://127.0.0.1:3443",
    ignoreHTTPSErrors: true, // Self-signed certificate on the local test proxy only.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "npx next start -H 127.0.0.1 -p 3002",
      url: "http://127.0.0.1:3002/classroom/login",
      reuseExistingServer: false,
      env: {
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_TARGET_ENV: "production",
        CLASSROOM_ORIGIN: "https://127.0.0.1:3443",
        CLASSROOM_PASSWORD_HASH: `${salt}:${digest}`,
        CLASSROOM_SESSION_SECRET: randomBytes(48).toString("hex"),
        CLASSROOM_GUIDES_JSON: JSON.stringify(
          makeTestGuides(
            parseExercises(catalog),
            process.env.CLASSROOM_HTTPS_TEST_MARKER,
          ),
        ),
      },
    },
    {
      command: "node scripts/classroom-https-proxy.mjs",
      url: "https://127.0.0.1:3443/classroom/login",
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      env: {
        CLASSROOM_TEST_TLS_KEY: join(tls, "key.pem"),
        CLASSROOM_TEST_TLS_CERT: join(tls, "cert.pem"),
      },
    },
  ],
});
