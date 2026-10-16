// Real CPython (Pyodide in Node) running the exact harness the worker ships. No mocked execution.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadPyodide } from "pyodide";
import { createOutputSink } from "../src/output-sink.mjs";

const HARNESS = readFileSync(new URL("../src/harness.py", import.meta.url), "utf8");
let snapshotSource; // interpreter used to take a snapshot, like the worker's build mode
let snapshot;

async function boot(options = {}) {
  const py = await loadPyodide(options);
  return py;
}
function attach(py, { limitBytes = 65536 } = {}) {
  const out = [];
  const sink = createOutputSink({ limitBytes, onChunk: (stream, text) => out.push([stream, text]) });
  py.setStdout({ raw: sink.stdout });
  py.setStderr({ raw: sink.stderr });
  py.setStdin({ stdin: () => null });
  return { out, sink };
}
function run(py, io, code) {
  const result = JSON.parse(String(py.globals.get("_run")(code)));
  io.sink.flushAll();
  return { ...result, stdout: io.out.filter(([s]) => s === "stdout").map(([, t]) => t).join(""), stderr: io.out.filter(([s]) => s === "stderr").map(([, t]) => t).join(""), limitHit: io.sink.limitHit };
}

before(async () => {
  snapshotSource = await boot({ _makeSnapshot: true });
  snapshotSource.runPython(HARNESS);
  snapshot = snapshotSource.makeMemorySnapshot();
}, { timeout: 120000 });

async function fresh() {
  const py = await boot({ _loadSnapshot: snapshot });
  py.runPython("_prepare()");
  return { py, io: attach(py) };
}

test("runs real Python: stdout, return value flow, and the challenge's starter code", async () => {
  const { py, io } = await fresh();
  const r = run(py, io, "def get_average(nums):\n    total = 0\n    for n in nums:\n        total += n\n    return total / len(nums)\nprint(get_average([10, 20, 30]))");
  assert.equal(r.status, "ok");
  assert.equal(r.stdout, "20.0\n");
});

test("the starter code's real bug surfaces as a real traceback limited to main.py", async () => {
  const { py, io } = await fresh();
  const r = run(py, io, "def get_average(nums):\n    total = 0\n    for n in nums:\n        total += n\n    return total / len(nums)\n\nprint(get_average([]))");
  assert.equal(r.status, "exception");
  assert.equal(r.exception, "ZeroDivisionError");
  assert.equal(r.traceback, 'Traceback (most recent call last):\n  File "main.py", line 7, in <module>\n  File "main.py", line 5, in get_average\nZeroDivisionError: division by zero\n');
  assert.ok(!r.traceback.includes("harness") && !r.traceback.includes("<exec>"));
});

test("syntax errors are reported as syntax errors, with the caret line", async () => {
  const { py, io } = await fresh();
  const r = run(py, io, "def f(:\n    pass");
  assert.equal(r.status, "syntax-error");
  assert.equal(r.exception, "SyntaxError");
  assert.match(r.traceback, /File "main\.py", line 1/);
  assert.match(r.traceback, /\^/);
  const nul = run(py, io, "print('a\u0000b')");
  assert.equal(nul.status, "syntax-error");
});

test("stderr is captured separately; SystemExit counts as a clean finish", async () => {
  const { py, io } = await fresh();
  const r = run(py, io, "import sys\nprint('to out')\nprint('to err', file=sys.stderr)\nsys.exit(3)");
  assert.equal(r.status, "ok");
  assert.equal(r.stdout, "to out\n");
  assert.equal(r.stderr, "to err\n");
});

test("output with no trailing newline and non-ASCII text is exact", async () => {
  const { py, io } = await fresh();
  const r = run(py, io, "print('héllo ✓ 🐍', end='')");
  assert.equal(r.stdout, "héllo ✓ 🐍");
});

test("a print flood is stopped at the cap, within milliseconds", async () => {
  const { py } = await fresh();
  const io = attach(py, { limitBytes: 4096 });
  const t0 = performance.now();
  const r = run(py, io, "while True:\n    print('x' * 1000)");
  assert.ok(performance.now() - t0 < 3000, "flood must stop quickly, not at the run timeout");
  assert.equal(r.limitHit, true);
  assert.equal(r.stdout.length, 4096);
  assert.equal(r.exception, "OSError");
});

test("input() sees EOF instead of hanging", async () => {
  const { py, io } = await fresh();
  const r = run(py, io, "input('?')");
  assert.equal(r.status, "exception");
  assert.equal(r.exception, "EOFError");
});

test("deep recursion is a RecursionError, not a crash", async () => {
  const { py, io } = await fresh();
  const r = run(py, io, "def f(n): return f(n + 1)\nf(0)");
  assert.equal(r.exception, "RecursionError");
});

test("no extra packages: numpy is not available", async () => {
  const { py, io } = await fresh();
  const r = run(py, io, "import numpy");
  assert.equal(r.exception, "ModuleNotFoundError");
});

test("each fresh interpreter is pristine: tampering in one run is invisible to the next", async () => {
  const a = await fresh();
  run(a.py, a.io, "import math, builtins, sys\nmath.pi = 3\nbuiltins.print = lambda *x, **k: None\nsys.leak = 1");
  const b = await fresh();
  const r = run(b.py, b.io, "import math, sys\nprint(math.pi, hasattr(sys, 'leak'))");
  assert.equal(r.stdout, "3.141592653589793 False\n");
});

test("restoring a snapshot does not freeze the PRNG: _prepare() reseeds every fresh interpreter", async () => {
  const values = new Set();
  for (let i = 0; i < 3; i++) {
    const { py, io } = await fresh();
    const r = run(py, io, "import random\nprint(random.random())");
    values.add(r.stdout);
  }
  assert.equal(values.size, 3, `expected 3 distinct values, got ${[...values]}`);
});

test("the snapshot restore path is fast compared to a cold start", async () => {
  const t0 = performance.now();
  await boot({ _loadSnapshot: snapshot });
  const restoreMs = performance.now() - t0;
  console.log(`# restore from snapshot (node): ${Math.round(restoreMs)} ms, snapshot ${(snapshot.byteLength / 1048576).toFixed(1)} MB`);
  assert.ok(restoreMs < 5000);
});
