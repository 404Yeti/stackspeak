import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { makeTestGuides } from "./src/test/classroomFixtures";
import { parseExercises } from "./src/lib/classroom/schema";
import catalog from "./content/classroom/exercises.json";
import { randomBytes, scryptSync } from "node:crypto";

// Ephemeral test credentials, injected into the local server only. Never a login bypass.
process.env.CLASSROOM_E2E_PASSWORD ||= randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(process.env.CLASSROOM_E2E_PASSWORD, salt, 64, {
  N: 65536,
  r: 8,
  p: 2,
  maxmem: 128 * 1024 * 1024,
}).toString("hex");
const guides = process.env.CLASSROOM_TEST_GUIDES
  ? JSON.parse(process.env.CLASSROOM_TEST_GUIDES)
  : process.env.CLASSROOM_E2E_GUIDES_FILE
    ? JSON.parse(readFileSync(process.env.CLASSROOM_E2E_GUIDES_FILE, "utf8"))
    : makeTestGuides(parseExercises(catalog), randomBytes(24).toString("hex"));
process.env.CLASSROOM_TEST_GUIDES = JSON.stringify(guides);
export default defineConfig({
  testDir: "./e2e-classroom",
  outputDir: "./test-results-classroom",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: { baseURL: "http://localhost:3001", trace: "off" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npx next start -p 3001",
    url: "http://localhost:3001/classroom/login",
    reuseExistingServer: false,
    env: {
      CLASSROOM_PASSWORD_HASH: `${salt}:${hash}`,
      CLASSROOM_SESSION_SECRET: randomBytes(48).toString("hex"),
      CLASSROOM_ORIGIN: "http://localhost:3001",
      CLASSROOM_GUIDES_JSON: JSON.stringify(guides),
      CLASSROOM_DATABASE_READER_URL: "",
      CLASSROOM_DATABASE_WRITER_URL: "",
    },
  },
});
