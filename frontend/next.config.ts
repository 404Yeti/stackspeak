import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only the Run Code e2e (npm run build:run) sets this, so its flag-ON build can sit beside the normal one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The repo has one authoritative AGENTS.md at the root; don't let `next dev`
  // regenerate a conflicting one here.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
