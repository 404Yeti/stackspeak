// Generates runner/vercel.json from config/runner.config.json. The generated file is COMMITTED so the
// header change is reviewable in the PR diff; CI runs `--check` to fail on any drift.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { headerRules, toVercelJson, validateOrigins } from "./lib/headers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "config/runner.config.json"), "utf8"));
validateOrigins(config.approvedParentOrigins); // https only, no wildcards, explicit

const generated = JSON.stringify(toVercelJson(headerRules(config)), null, 2) + "\n";
const target = join(root, "vercel.json");

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(target, "utf8"); } catch { /* missing */ }
  if (current !== generated) {
    console.error("runner/vercel.json is out of date with config/runner.config.json — run `npm run generate` in runner/ and commit the result.");
    process.exit(1);
  }
  console.log("runner/vercel.json is up to date");
} else {
  writeFileSync(target, generated);
  console.log("wrote runner/vercel.json");
}
