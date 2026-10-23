import { readFile, stat } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { importCatalog } from "../../src/lib/classroom/studio/importer";
import { closeDatabases } from "../../src/lib/classroom/studio/database";
const args = process.argv.slice(2);
async function main() {
try {
  if (args.some((a, i) => a !== "--apply" && a !== "--guide-file" && args[i - 1] !== "--guide-file"))
    throw new Error("Usage: npm run studio:import -- [--apply] [--guide-file /private/path.json]");
  const catalog = JSON.parse(await readFile(resolve("content/classroom/exercises.json"), "utf8"));
  const index = args.indexOf("--guide-file");
  let guides;
  if (index >= 0) {
    const file = args[index + 1];
    if (!file || !isAbsolute(file)) throw new Error("Use an absolute private guide file path");
    if ((await stat(file)).size > 48 * 1024) throw new Error("Private guide file exceeds 48 KiB");
    const input = await readFile(file);
    if (input.byteLength > 48 * 1024) throw new Error("Private guide file exceeds 48 KiB");
    guides = JSON.parse(input.toString("utf8"));
  }
  console.log(JSON.stringify(await importCatalog(catalog, guides, args.includes("--apply")), null, 2));
} catch {
  // No parser excerpts, private paths, guide content or connection errors in CLI logs.
  console.error("Import failed validation or found a conflict. Nothing was overwritten. Check the local configuration and input; run tests for details.");
  process.exitCode = 1;
} finally { await closeDatabases(); }

}
void main();
