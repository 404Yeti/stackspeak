// Creates ONLY a new, disposable loopback Postgres cluster. No remote URL input.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(import.meta.dirname, "../..");
const bin = process.env.STACKSPEAK_TEST_PG_BIN || "/usr/lib/postgresql/17/bin";
const dir = mkdtempSync(join(tmpdir(), "stackspeak-studio-db-"));
const port = "55479";
function run(cmd, args, env = process.env, input) {
  const p = spawnSync(cmd, args, { cwd: resolve(root, "frontend"), env, input, encoding: "utf8", stdio: input ? ["pipe", "pipe", "pipe"] : "pipe" });
  if (p.status !== 0) throw new Error(`${cmd} failed: ${p.error?.message || ""}\n${p.stdout || ""}\n${p.stderr || ""}`);
  return p.stdout;
}
const admin = `postgres://studio_test_admin@127.0.0.1:${port}/postgres`;
function query(input) { return run("psql", ["-X", admin, "-v", "ON_ERROR_STOP=1", "-1", "-f", "-"], process.env, input); }
let started = false;
try {
  run(join(bin, "initdb"), ["-D", join(dir, "data"), "-U", "studio_test_admin", "-A", "trust", "--no-locale", "-E", "UTF8"]);
  run(join(bin, "pg_ctl"), ["-D", join(dir, "data"), "-l", join(dir, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${dir}`, "start"]);
  started = true;
  // Synthetic stand-ins for Supabase API roles, including a BYPASSRLS service role.
  query("create role anon; create role authenticated; create role service_role bypassrls; create role authenticator; ");
  const files = readdirSync(join(root, "supabase/migrations")).filter((n) => n.endsWith(".sql")).sort();
  const apply = () => files.forEach((f) => query(readFileSync(join(root, "supabase/migrations", f), "utf8")));
  apply();
  query("alter role classroom_reader login; alter role classroom_writer login; alter role classroom_reader_production login; alter role classroom_writer_production login;");
  const suffix = process.env.CLASSROOM_TEST_PRODUCTION_ROLES === "1" ? "_production" : "";
  const testEnv = {
    ...process.env, CLASSROOM_TEST_DATABASE_URL: admin,
    CLASSROOM_RECOVERY_DIR: join(dir, "publications"),
    CLASSROOM_CONTENT_SOURCE: "database",
    CLASSROOM_DATABASE_READER_URL: `postgres://classroom_reader${suffix}@127.0.0.1:${port}/postgres`,
    CLASSROOM_DATABASE_WRITER_URL: `postgres://classroom_writer${suffix}@127.0.0.1:${port}/postgres`,
  };
  run(resolve(root, "frontend/node_modules/.bin/vitest"), ["run", "src/lib/classroom/studio/repository.integration.test.ts"], testEnv);
  console.log("Studio database integration tests passed.");
  if (process.argv.includes("--browser")) {
    // Fresh disposable browser fixtures after destructive/failure-path integration cases.
    query(readFileSync(join(root, "supabase/tests/rollback.sql"), "utf8"));
    apply();
    query("alter role classroom_reader login; alter role classroom_writer login; alter role classroom_reader_production login; alter role classroom_writer_production login;");
    testEnv.CLASSROOM_RECOVERY_DIR = join(dir, "browser-publications");
    const cliArgs = ["--conditions=react-server", "--import", "tsx", "scripts/studio/import.ts"];
    const dry = JSON.parse(run(process.execPath, cliArgs, testEnv));
    if (dry.mode !== "dry-run" || dry.exercises.some((e) => e.action !== "insert")) throw new Error("Import dry-run failed");
    const imported = JSON.parse(run(process.execPath, [...cliArgs, "--apply"], testEnv));
    if (imported.exercises.length !== 4) throw new Error("Expected four legacy exercises");
    const repeated = JSON.parse(run(process.execPath, [...cliArgs, "--apply"], testEnv));
    if (repeated.exercises.some((e) => e.action !== "skip")) throw new Error("Import idempotency failed");
    console.log(run(resolve(root, "frontend/node_modules/.bin/playwright"), ["test", "-c", "playwright.studio-api.config.ts", "--project=chromium", ...(process.env.CLASSROOM_TEST_STUDIO_MODE === "studio" ? [] : ["--project=firefox"])], testEnv));
  }
  query(readFileSync(join(root, "supabase/tests/rollback.sql"), "utf8"));
  apply();
  console.log("Disposable local rollback/reapply passed. No remote database accessed.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) spawnSync(join(bin, "pg_ctl"), ["-D", join(dir, "data"), "-m", "immediate", "stop"], { stdio: "ignore" });
  rmSync(dir, { recursive: true, force: true });
}
