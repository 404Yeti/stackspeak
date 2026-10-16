# ADR 0003: Run student Python in a hardened worker on a dedicated cross-site origin

**Status:** Accepted for PR 1 (AUD-60). The student-facing Run UI (PR 2) and production enablement are NOT part of this decision.
**Date:** 2026-10-16
**Issue:** AUD-60

## Context

`docs/architecture.md` forbids executing untrusted student code on the application server and says executable challenges stay off until a sandboxed mechanism is "implemented and reviewed". Students edit Python in the Fix stage but cannot run it. We want real CPython output (stdout, stderr, exceptions) without sending code to FastAPI.

## Decision

Run Python **in the student's own browser** with self-hosted Pyodide 314.0.7 (CPython 3.14.2), inside a **module Web Worker with its own strict CSP**, hosted by a **separate static runner deployment on a different site** and embedded in a hidden iframe. A Web Worker is not treated as a sandbox; the boundary is the layered set below.

| Layer | What it does | Verified by |
|---|---|---|
| Cross-site origin (`*.vercel.app` is a public suffix, so two projects are different sites) | no shared cookies, storage, IndexedDB, Cache API, BroadcastChannel with the app; own process under Site Isolation | `runner/e2e/security.spec.mjs` |
| Worker CSP header (`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'; …`) | blocks egress, nested workers, eval, importScripts | same, plus `scripts/verify-deployment.mjs` against the deployed headers |
| Fail-closed canary | the worker proves the browser enforces its CSP (a blocked request must raise `securitypolicyviolation`) or Run refuses to start, for the whole page load | security + lifecycle specs |
| Private `MessagePort` protocol, strict schema validation, approved-origin handshake | student code cannot spoof results; only approved parents can drive the runner | `protocol.test.mjs` (shared fixtures with the TS client), security spec |
| One worker per run, terminated afterwards; fresh interpreter from a memory snapshot (cold-start fallback). The snapshot-building worker never runs student code | no state leaks between runs; every run takes the same path; timeouts/output caps enforced by the bridge | lifecycle spec, harness tests on real CPython |
| In-worker hardening (network/storage/messaging globals removed) | defence in depth only | security spec (production build) |
| Supply chain: exact pin, committed SHA-256 manifest verified at build and against the deployed files, self-hosted | no CDN at runtime | `build.test.mjs`, `verify-deployment.mjs` |

## The iframe configuration decision (opaque sandbox vs dedicated origin)

Measured in Chromium 156 and Firefox 157 on 2026-10-16:

| | Opaque (`sandbox="allow-scripts"`) | **Dedicated origin (`allow-scripts allow-same-origin`) — chosen** |
|---|---|---|
| Worker from a real URL | ❌ SecurityError (Chromium) / error (Firefox) | ✅ |
| Blob module worker | ❌ Chromium, ✅ Firefox | ✅ |
| `data:` module worker | ✅ boots Pyodide in both | ✅ |
| Worker CSP | none of its own: a `data:` worker **inherits the frame document's CSP**, which must allow `worker-src data:`, so student code can spawn nested workers and `worker-src 'none'` is impossible | its own header, including `worker-src 'none'` |
| Parent→iframe validation | `event.origin === "null"`, `postMessage(…, "*")` | exact `targetOrigin`, `event.origin`, `event.source` |
| Storage reachable by student code | none | own-origin IndexedDB/Cache only (nothing of ours; removed again in the worker) |

The dedicated origin is the least-privileged configuration that works, is verifiable, and allows the tight worker CSP. Sandbox flags are limited to `allow-scripts allow-same-origin` (no forms, popups, modals, navigation, downloads, pointer lock), `allow=""`, `referrerpolicy="no-referrer"`. `allow-same-origin` only keeps the runner's **own** origin; because the runner is cross-site from the app it grants no access to the app.

## Alternatives rejected

- **Execute on FastAPI/Render:** shares process, secrets, filesystem and egress; forbidden by AGENTS.md.
- **Remote sandbox service (microVM/gVisor):** anonymous compute abuse with no auth, code leaves the browser, new infrastructure.
- **Same-origin worker + path-scoped CSP:** measured to leave BroadcastChannel/IndexedDB/Cache writes into the app's origin.
- **Run the first program on the snapshot-building interpreter:** after `makeMemorySnapshot()` its JS interop is unreliable (`js.navigator`, `js.indexedDB`, `js.location` threw "Illegal invocation" in a real browser; simple prints looked fine). Found by the e2e suite; fixed by never running student code on the builder.
- **Reuse one interpreter and restore state:** left `math.pi`, seeded `random`, and replaced `sys.modules` entries tampered; the set of mutable state is open-ended.
- **Fresh interpreter inside the same worker:** memory grew to 2 GB after 8 runs (old interpreters wait for GC).
- **Classic blob worker in an opaque iframe:** works only because the CSP happens to block Pyodide's classic-worker probe (`importScripts("data:…")`); unsupported by Pyodide 314.

## Consequences and limits (read before enabling)

- **Memory cannot be capped.** A loop grabbed 2 GB inside the 5 s window and a worker held 3 GB without `MemoryError`. A memory bomb can crash the runner process or the student's tab; mitigations are process isolation, saving drafts before each run (PR 2), crash detection, and `terminate()` after every run (measured: 3.3 GB → 0.36 GB). It remains possible.
- **Results are not tamper-proof.** Output and status come from the same worker that runs student code; a student can make their own output say anything. Never use runner output as grading evidence.
- Pyodide's snapshot API is private (`@private`/`@ignore`). It is an optimisation with a supported cold-start fallback; if neither works, Run is disabled with a clear message.
- Browser behaviour verified: Chromium, Firefox, and WebKit **in CI** (see docs/python-runner.md for the current status of each). Real iOS/Android devices are a release requirement, not yet done.
- Pyodide is MPL-2.0; it is redistributed unmodified from the `pyodide` npm package; its license file ships with the runtime files.
- The app can only enable this by explicit flag (`NEXT_PUBLIC_PYTHON_RUNNER_ENABLED=true` and a valid `NEXT_PUBLIC_PYTHON_RUNNER_URL`); production stays off until the release gates in docs/python-runner.md pass.

## Supersedes / amends

Amends `docs/architecture.md` → "Security boundary": the rule against executing untrusted code **on the application server** is unchanged; browser-side execution in the isolated runner is now an approved, separately-reviewed mechanism.
