import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { SOLUTION_MARKER } from "./helpers";

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

// The reference solution must live only on the backend — never in the
// shipped JavaScript. (Requires `next build` to have run.)
test("the reference solution is not in the built frontend bundle", () => {
  const staticDir = path.join(__dirname, "..", ".next", "static");
  let scanned = 0;
  for (const file of walk(staticDir)) {
    if (!/\.(js|css|json|html)$/.test(file)) continue;
    scanned += 1;
    expect(readFileSync(file, "utf8"), file).not.toContain(SOLUTION_MARKER);
  }
  expect(scanned).toBeGreaterThan(0);
});
