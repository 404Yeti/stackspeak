import { defineConfig } from "@playwright/test";
import classroom from "./playwright.classroom.config";
const server = classroom.webServer as {
  command: string;
  url: string;
  reuseExistingServer: boolean;
  env: Record<string, string>;
};
export default defineConfig({
  ...classroom,
  webServer: {
    ...server,
    env: {
      ...server.env,
      CLASSROOM_CONTENT_SOURCE: process.env.CLASSROOM_TEST_STUDIO_MODE === "studio" ? "studio" : "database",
      CLASSROOM_RECOVERY_DIR: process.env.CLASSROOM_RECOVERY_DIR!,
      CLASSROOM_DATABASE_READER_URL: process.env.CLASSROOM_TEST_READER_OUTAGE === "1"
        ? "postgres://classroom_reader@127.0.0.1:1/postgres"
        : process.env.CLASSROOM_DATABASE_READER_URL!,
      CLASSROOM_DATABASE_WRITER_URL: process.env.CLASSROOM_DATABASE_WRITER_URL!,
    },
  },
  testDir: "./e2e-studio-api",
  outputDir: "./test-results-studio-api",
  timeout: 60_000,
  use: { ...classroom.use, trace: "off", screenshot: "off", video: "off" },
});
