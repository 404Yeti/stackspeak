// Byte-exact stdout/stderr capture with a hard cap. Inlined into worker.mjs by scripts/build.mjs
// (the `export` keywords are stripped) and unit-tested directly in Node.
//
// Used as Pyodide `setStdout({ raw })` / `setStderr({ raw })` handlers, which are called with one
// byte at a time. Once the cap is reached the handler THROWS: Pyodide surfaces that to Python as an
// OSError, which stops a print-flood within milliseconds (measured: 23 ms). A program that catches
// the OSError is still stopped by the run timeout.

export function createOutputSink({ limitBytes, onChunk, flushAt = 2048 }) {
  const pending = { stdout: [], stderr: [] };
  const decoders = { stdout: new TextDecoder("utf-8"), stderr: new TextDecoder("utf-8") };
  let total = 0;
  let limitHit = false;
  let last = null;

  function flush(stream) {
    const bytes = pending[stream];
    if (bytes.length === 0) return;
    pending[stream] = [];
    const text = decoders[stream].decode(new Uint8Array(bytes), { stream: true });
    if (text) onChunk(stream, text);
  }

  function handler(stream) {
    return (byte) => {
      if (limitHit) throw new Error("output limit");
      if (total >= limitBytes) {
        limitHit = true;
        flush("stdout");
        flush("stderr");
        throw new Error("output limit");
      }
      if (last !== null && last !== stream) flush(last); // keep stdout/stderr ordering
      last = stream;
      total += 1;
      pending[stream].push(byte & 255);
      if (pending[stream].length >= flushAt) flush(stream);
    };
  }

  return {
    stdout: handler("stdout"),
    stderr: handler("stderr"),
    flushAll() {
      flush("stdout");
      flush("stderr");
    },
    get limitHit() {
      return limitHit;
    },
    get totalBytes() {
      return total;
    },
  };
}
