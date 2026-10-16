// Run lifecycle against the real built runner using the real frontend client: lazy loading, snapshot and
// cold modes, timeouts, output limits, stop, single-flight, per-run freshness, cleanup, and failure modes.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, openApp, connect, runCode, waitReady, deployed } from "./support.mjs";

const STARTER_BUG = "def get_average(nums):\n    total = 0\n    for n in nums:\n        total += n\n    return total / len(nums)\n\nprint(get_average([]))";
const perf = { coldStartupMs: null, restoreStartupMs: [], runDurationMs: [] };

test.afterAll(({}, testInfo) => {
  const dir = join(testInfo.config.rootDir, "..", "test-results");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `performance-${testInfo.project.name}${deployed ? "-deployed" : ""}.json`), JSON.stringify({ browser: testInfo.project.name, deployed, ...perf }, null, 2));
});

test.describe("lifecycle (production build)", () => {
  test.describe.configure({ mode: "serial" });
  let app;

  test.beforeAll(async ({ browser, prodRunner }) => {
    app = await openApp(browser, prodRunner.parent);
  });
  test.afterAll(async () => {
    await app?.context.close().catch(() => {});
  });

  test("nothing from the runtime downloads until the first Run; connecting loads only the tiny bridge", async ({ prodRunner }) => {
    const fresh = await openApp(app.context.browser(), prodRunner.parent);
    try {
      await connect(fresh.page, prodRunner.url);
      expect((await waitReady(fresh.page)).ok.limits).toMatchObject({ runTimeoutMs: 5000, initTimeoutMs: 30000, outputLimitBytes: 65536 });
      const early = fresh.log.requests.filter((r) => r.url.includes("/pyodide/"));
      expect(early, "runtime requested before any Run").toEqual([]);
      expect(fresh.log.requests.some((r) => /bridge\.[a-f0-9]{12}\.mjs/.test(r.url))).toBe(true);
      await runCode(fresh.page, "print(1)");
      expect(fresh.log.requests.filter((r) => r.url.includes("/pyodide/")).length).toBeGreaterThan(0);
    } finally {
      await fresh.context.close();
    }
  });

  test("first run: a builder worker makes the snapshot, but the student's code runs on a fresh restored interpreter; every worker is gone afterwards", async ({ prodRunner }) => {
    await connect(app.page, prodRunner.url);
    const r = await runCode(app.page, "def get_average(nums):\n    return sum(nums) / len(nums)\nprint(get_average([10, 20, 30]))");
    expect(r.error, JSON.stringify(r.error)).toBeUndefined();
    // The build worker is never used for student code, so even the FIRST run is a "restore" run.
    expect(r.ok).toMatchObject({ status: "ok", stdout: "20.0\n", stderr: "", mode: "restore", snapshot: "ready", truncated: false });
    perf.coldStartupMs = Math.round(r.ok.startupMs);
    perf.runDurationMs.push(Math.round(r.ok.durationMs * 10) / 10);
    await expect.poll(() => app.page.workers().length).toBe(0);
  });

  test("later runs restore from the snapshot (fresh worker each time) and are much faster to start", async () => {
    for (let i = 0; i < 4; i++) {
      const r = await runCode(app.page, `print(${i} * 2)`);
      expect(r.ok, JSON.stringify(r)).toMatchObject({ status: "ok", stdout: `${i * 2}\n`, mode: "restore", snapshot: "ready" });
      perf.restoreStartupMs.push(Math.round(r.ok.startupMs));
      perf.runDurationMs.push(Math.round(r.ok.durationMs * 10) / 10);
      await expect.poll(() => app.page.workers().length).toBe(0);
    }
    expect(Math.min(...perf.restoreStartupMs)).toBeLessThan(perf.coldStartupMs);
  });

  test("the starter code's real bug shows a real traceback (main.py frames only) — never a pass/fail claim", async () => {
    const r = await runCode(app.page, STARTER_BUG);
    expect(r.ok.status).toBe("exception");
    expect(r.ok.exception).toBe("ZeroDivisionError");
    expect(r.ok.traceback).toBe('Traceback (most recent call last):\n  File "main.py", line 7, in <module>\n  File "main.py", line 5, in get_average\nZeroDivisionError: division by zero\n');
    expect(JSON.stringify(r.ok)).not.toMatch(/passed|failed|correct/i);
  });

  test("syntax errors, input(), unicode, and stderr are all real", async () => {
    const syntax = await runCode(app.page, "def f(:\n    pass");
    expect(syntax.ok).toMatchObject({ status: "syntax-error", exception: "SyntaxError" });
    expect(syntax.ok.traceback).toContain('File "main.py", line 1');
    const eof = await runCode(app.page, "input('?')");
    expect(eof.ok).toMatchObject({ status: "exception", exception: "EOFError" });
    const mixed = await runCode(app.page, "import sys\nprint('héllo ✓ 🐍')\nprint('to err', file=sys.stderr)");
    expect(mixed.ok).toMatchObject({ status: "ok", stdout: "héllo ✓ 🐍\n", stderr: "to err\n" });
  });

  test("every run starts from a pristine interpreter", async () => {
    await runCode(app.page, "import math, builtins, sys\nmath.pi = 3\nbuiltins.len = lambda x: 42\nsys.leak = 1\nopen('/tmp/leftover.txt', 'w').write('x')");
    const r = await runCode(app.page, "import math, sys, os\nprint(math.pi, len([1, 2, 3]), hasattr(sys, 'leak'), os.path.exists('/tmp/leftover.txt'))");
    expect(r.ok.stdout).toBe("3.141592653589793 3 False False\n");
  });

  test("an infinite loop is stopped at the 5 s timeout; the worker is terminated and the next run works", async () => {
    const t0 = Date.now();
    const r = await runCode(app.page, "while True:\n    pass");
    const wall = Date.now() - t0;
    expect(r.ok.status).toBe("timeout");
    expect(wall, "timeout should land near 5 s plus start-up").toBeGreaterThan(4500);
    expect(wall).toBeLessThan(12000);
    await expect.poll(() => app.page.workers().length).toBe(0);
    const after = await runCode(app.page, "print('recovered')");
    expect(after.ok).toMatchObject({ status: "ok", stdout: "recovered\n", mode: "restore" });
  });

  test("a print flood stops at the output cap, quickly, with a truncation flag", async () => {
    const t0 = Date.now();
    const r = await runCode(app.page, "while True:\n    print('x' * 1000)");
    expect(Date.now() - t0).toBeLessThan(8000);
    expect(r.ok.status).toBe("output-limit");
    expect(r.ok.stdout.length).toBeLessThanOrEqual(65536);
    expect(r.ok.stdout.length).toBeGreaterThan(60000);
    await expect.poll(() => app.page.workers().length).toBe(0);
  });

  test("stop() cancels a running program", async () => {
    await app.page.evaluate(() => {
      window.__statuses = [];
      window.__pendingRun = window.__session
        .run("while True:\n    pass", { onStatus: (phase) => window.__statuses.push(phase) })
        .then((ok) => ({ ok }), (error) => ({ error: { kind: error.kind } }));
    });
    await app.page.waitForFunction(() => window.__statuses.includes("running"));
    await app.page.evaluate(() => window.__session.stop());
    const r = await app.page.evaluate(() => window.__pendingRun);
    expect(r.ok.status).toBe("stopped");
    await expect.poll(() => app.page.workers().length).toBe(0);
  });

  test("only one run at a time; an oversized program is refused before it reaches the runner", async () => {
    const outcome = await app.page.evaluate(async () => {
      const first = window.__session.run("import time\ntime.sleep(1)\nprint('first')");
      const second = await window.__session.run("print('second')").then(() => "ran", (e) => e.kind);
      const firstResult = await first;
      const big = await window.__session.run("x".repeat(50001)).then(() => "ran", (e) => e.kind);
      return { second, first: firstResult.stdout, big };
    });
    expect(outcome).toEqual({ second: "busy", first: "first\n", big: "rejected" });
  });

  test("dispose() removes the iframe, leaves no workers, and later runs are refused", async ({ prodRunner }) => {
    await app.page.evaluate(() => window.__client.dispose());
    expect(await app.page.evaluate(() => document.querySelectorAll("iframe").length)).toBe(0);
    await expect.poll(() => app.page.workers().length).toBe(0);
    const r = await runCode(app.page, "print(1)");
    expect(r.error.kind).toBe("disposed");
    // and a brand-new client works again
    await connect(app.page, prodRunner.url);
    expect((await runCode(app.page, "print('again')")).ok.stdout).toBe("again\n");
  });
});

test.describe("failure modes (each in its own page)", () => {
  test("a missing runtime file (404) fails FAST with a clear, retryable error, then recovers", async ({ appPage, prodRunner }) => {
    const { page, context } = await appPage(prodRunner.parent);
    await context.route("**/pyodide/**/pyodide.asm.wasm", (route) => route.fulfill({ status: 404, body: "gone" }));
    await connect(page, prodRunner.url);
    const t0 = Date.now();
    const bad = await runCode(page, "print(1)");
    expect(Date.now() - t0, "must not wait for the 30 s init timeout").toBeLessThan(15000);
    expect(bad.error).toMatchObject({ kind: "fatal", reason: "init-failed", retryable: true });
    expect(bad.error.message).toMatch(/404|runtime/i);
    await context.unroute("**/pyodide/**/pyodide.asm.wasm");
    const good = await runCode(page, "print('recovered')");
    expect(good.ok).toMatchObject({ status: "ok", stdout: "recovered\n" });
  });

  test("a corrupted runtime file fails with init-failed, not a hang or a crash", async ({ appPage, prodRunner }) => {
    const { page, context } = await appPage(prodRunner.parent);
    await context.route("**/pyodide/**/python_stdlib.zip", (route) => route.fulfill({ status: 200, contentType: "application/zip", body: "this is not a zip" }));
    await connect(page, prodRunner.url);
    const r = await runCode(page, "print(1)");
    expect(r.error).toMatchObject({ kind: "fatal", reason: "init-failed", retryable: true });
    expect(r.error.message).not.toContain("[object Object]");
  });

  test("offline on a cold cache fails with init-failed and recovers when the network returns", async ({ appPage, prodRunner }) => {
    const { page, context } = await appPage(prodRunner.parent);
    await connect(page, prodRunner.url);
    expect((await waitReady(page)).ok).toBeTruthy(); // the bridge itself is loaded
    await context.setOffline(true);
    const off = await runCode(page, "print(1)");
    expect(off.error).toMatchObject({ kind: "fatal", retryable: true });
    expect(["init-failed", "init-timeout"]).toContain(off.error.reason);
    await context.setOffline(false);
    const on = await runCode(page, "print('back online')");
    expect(on.ok).toMatchObject({ status: "ok", stdout: "back online\n" });
  });

  test("a stalled download hits the 30 s init timeout and leaves no worker behind", async ({ appPage, prodRunner }) => {
    test.setTimeout(120_000);
    const { page, context } = await appPage(prodRunner.parent);
    await context.route("**/pyodide/**/pyodide.asm.wasm", () => { /* never answered: a stalled connection */ });
    await connect(page, prodRunner.url);
    const t0 = Date.now();
    const r = await runCode(page, "print(1)");
    const wall = Date.now() - t0;
    expect(r.error).toMatchObject({ kind: "fatal", reason: "init-timeout", retryable: true });
    expect(wall).toBeGreaterThan(29000);
    expect(wall).toBeLessThan(40000);
    await expect.poll(() => page.workers().length).toBe(0);
  });
});

test.describe("snapshot fallback (test build hooks)", () => {
  test.skip(deployed, "uses the test build, which is never deployed");

  test("forceCold: every run is a supported cold start and still correct", async ({ appPage, testRunner }) => {
    const { page } = await appPage(testRunner.parent);
    await connect(page, testRunner.url, { hooks: { forceCold: true } });
    for (let i = 0; i < 2; i++) {
      const r = await runCode(page, `print(${i} + 1)`);
      expect(r.ok, JSON.stringify(r)).toMatchObject({ status: "ok", stdout: `${i + 1}\n`, mode: "cold", snapshot: "unavailable" });
    }
  });

  test("a snapshot that fails to restore is marked bad and the run transparently retries as a cold start (and stays cold)", async ({ appPage, testRunner }) => {
    const { page } = await appPage(testRunner.parent);
    await connect(page, testRunner.url, { hooks: { failRestore: true } });
    // The very first run builds a snapshot, fails to restore it (injected), and transparently retries cold.
    const first = await runCode(page, "print('built then retried')");
    expect(first.ok, JSON.stringify(first)).toMatchObject({ status: "ok", stdout: "built then retried\n", mode: "cold", snapshot: "bad" });
    const second = await runCode(page, "print('retried')");
    expect(second.ok, JSON.stringify(second)).toMatchObject({ status: "ok", stdout: "retried\n", mode: "cold", snapshot: "bad" });
    const third = await runCode(page, "print('still cold')");
    expect(third.ok).toMatchObject({ status: "ok", mode: "cold", snapshot: "bad" });
  });
});
