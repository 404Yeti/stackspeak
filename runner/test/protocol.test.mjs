import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MessageChannel } from "node:worker_threads";
import { parseBridgeMessage, parseInit, parseParentMessage, parseWorkerMessage, parseStart, parseRunRequest } from "../src/protocol.mjs";

const fx = JSON.parse(readFileSync(new URL("./fixtures/protocol-messages.json", import.meta.url), "utf8"));

test("bridge -> parent: accepts every valid fixture and rejects every invalid one", () => {
  for (const m of fx.bridgeToParent.valid) assert.ok(parseBridgeMessage(m), `should accept ${JSON.stringify(m)}`);
  for (const m of fx.bridgeToParent.invalid) assert.equal(parseBridgeMessage(m), null, `should reject ${JSON.stringify(m)}`);
});

test("parent -> bridge: accepts every valid fixture and rejects every invalid one", () => {
  for (const m of fx.parentToBridge.valid) assert.ok(parseParentMessage(m, 50000), `should accept ${JSON.stringify(m)}`);
  for (const m of fx.parentToBridge.invalid) assert.equal(parseParentMessage(m, 50000), null, `should reject ${JSON.stringify(m)}`);
});

test("init: accepts every valid fixture and rejects every invalid one", () => {
  for (const m of fx.init.valid) assert.ok(parseInit(m), `should accept ${JSON.stringify(m)}`);
  for (const m of fx.init.invalid) assert.equal(parseInit(m), null, `should reject ${JSON.stringify(m)}`);
});

test("parent run messages over the size limit are flagged, not executed", () => {
  const parsed = parseParentMessage({ t: "run", id: 1, code: "x".repeat(101) }, 100);
  assert.equal(parsed.tooLarge, true);
  assert.equal(parseParentMessage({ t: "run", id: 1, code: "x".repeat(100) }, 100).tooLarge, false);
});

test("hooks are parsed only as booleans (and only honoured by test builds)", () => {
  const init = parseInit({ type: "stackspeak-runner/init", protocol: 1, nonce: "0123456789abcdef0123456789abcdef", hooks: { forceCold: "yes", failRestore: true, skipCanary: 1, evil: 1 } });
  assert.deepEqual(init.hooks, { forceCold: false, failRestore: true, skipCanary: false });
});

test("worker -> bridge: validates shape, bounds, and ArrayBuffer snapshots", () => {
  assert.ok(parseWorkerMessage({ t: "ready", initMs: 12, mode: "build" }));
  assert.ok(parseWorkerMessage({ t: "done", status: "ok", durationMs: 1 }));
  assert.ok(parseWorkerMessage({ t: "snapshot", buffer: new ArrayBuffer(8) }));
  assert.equal(parseWorkerMessage({ t: "snapshot", buffer: new ArrayBuffer(0) }), null);
  assert.equal(parseWorkerMessage({ t: "snapshot", buffer: "not a buffer" }), null);
  assert.equal(parseWorkerMessage({ t: "done", status: "passed", durationMs: 1 }), null); // never a "passed" status
  assert.equal(parseWorkerMessage({ t: "done", status: "timeout", durationMs: 1 }), null); // only the bridge decides timeouts
  assert.equal(parseWorkerMessage({ t: "out", stream: "stdout", text: "x".repeat(70001) }), null);
  assert.equal(parseWorkerMessage({ t: "ready", initMs: Infinity, mode: "build" }), null);
  assert.equal(parseWorkerMessage(undefined), null);
});

test("start/run requests: require a real MessagePort and matching snapshot", () => {
  const { port1 } = new MessageChannel();
  // node:worker_threads MessagePort is not the global MessagePort class used in browsers, so only the
  // shape checks that do not need `instanceof MessagePort` are meaningful here; the browser e2e covers the rest.
  assert.equal(parseStart({ t: "start", mode: "restore", port: {} }), null);
  assert.equal(parseStart({ t: "start", mode: "bogus", port: port1 }), null);
  assert.equal(parseRunRequest({ t: "run", code: "x".repeat(11) }, 10), null);
  assert.deepEqual(parseRunRequest({ t: "run", code: "x" }, 10), { t: "run", code: "x" });
  port1.close();
});
