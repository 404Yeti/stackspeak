import { test } from "node:test";
import assert from "node:assert/strict";
import { createOutputSink } from "../src/output-sink.mjs";

const bytes = (s) => [...new TextEncoder().encode(s)];
function feed(handler, s) { for (const b of bytes(s)) handler(b); }

test("captures bytes exactly, per stream, in order", () => {
  const chunks = [];
  const sink = createOutputSink({ limitBytes: 1000, onChunk: (stream, text) => chunks.push([stream, text]) });
  feed(sink.stdout, "out1\n");
  feed(sink.stderr, "err1\n");
  feed(sink.stdout, "out2");
  sink.flushAll();
  assert.deepEqual(chunks, [["stdout", "out1\n"], ["stderr", "err1\n"], ["stdout", "out2"]]);
  assert.equal(sink.limitHit, false);
});

test("partial lines without a trailing newline are delivered on flush", () => {
  const chunks = [];
  const sink = createOutputSink({ limitBytes: 100, onChunk: (s, t) => chunks.push(t) });
  feed(sink.stdout, "no newline");
  sink.flushAll();
  assert.deepEqual(chunks, ["no newline"]);
});

test("multi-byte characters survive being split across flushes", () => {
  const chunks = [];
  const sink = createOutputSink({ limitBytes: 100, flushAt: 1, onChunk: (s, t) => chunks.push(t) });
  feed(sink.stdout, "héllo — ✓ 🐍");
  sink.flushAll();
  assert.equal(chunks.join(""), "héllo — ✓ 🐍");
});

test("throws once the cap is reached, forwards exactly the cap, and keeps throwing", () => {
  const chunks = [];
  const sink = createOutputSink({ limitBytes: 10, onChunk: (s, t) => chunks.push(t) });
  assert.throws(() => feed(sink.stdout, "0123456789ABCDEF"), /output limit/);
  assert.equal(chunks.join(""), "0123456789");
  assert.equal(sink.limitHit, true);
  assert.throws(() => sink.stderr(65), /output limit/);
});
