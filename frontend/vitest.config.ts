import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Playwright specs live in e2e/ and run via `npm run e2e`, not Vitest.
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      "e2e-run/**",
      "e2e-classroom/**",
      "e2e-classroom-production/**",
    ],
    // WSL/9p-mounted filesystems can be too slow to fork test workers in time
    // with the default "forks" pool; threads avoids the fork+exec overhead.
    //
    // Known flakiness on this filesystem (see docs/development.md): Vitest's
    // internal worker-boot handshake has a hardcoded 60s timeout not exposed
    // via config, and Vitest's own diagnostics measured ~53.6s worker
    // spawn+environment setup per file here — right at that ceiling, so a
    // file occasionally tips over it under load, surfacing as "Timeout
    // waiting for worker to respond" for an otherwise-passing file.
    // `isolate: false` (reusing workers instead of one per file) was tried
    // and rejected — it crashed a worker outright, likely next/image's
    // module-level state not tolerating being shared across files in one
    // worker. Left at safe defaults; every test file has been individually
    // confirmed passing (see PR notes) even on runs where the full-suite
    // invocation hit this timeout for an unrelated file.
    pool: "threads",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
