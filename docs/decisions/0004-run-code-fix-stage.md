# ADR 0004 — Run Code in the Fix stage (AUD-60 PR 2)

**Status:** Accepted for PR 2. The feature ships **disabled by default**; production enablement is gated by the release blockers in `docs/python-runner.md` and needs separate owner approval.

## Decision

The Fix stage gains an optional **Run code** control that executes the student's Python in the dedicated, cross-site runner built in PR 1 (`runner/`, ADR 0003) — and nowhere else. The student's code travels only over a private `MessageChannel` to the runner iframe; it is never sent to Next.js, FastAPI or any other server (asserted by an e2e test that inspects every network request).

* **Flag:** `NEXT_PUBLIC_PYTHON_RUNNER_ENABLED=true` **and** a valid `NEXT_PUBLIC_PYTHON_RUNNER_URL`. Anything else (unset, malformed URL, a runner on the app's own origin/host) leaves the stage exactly as before — no Run button, no iframe, no runner request. These are build-time values; each environment sets its own, explicitly.
* **Lifecycle:** `useCodeRunner` (`frontend/src/features/challenge/runCode/`) creates one `PythonRunnerClient` when the Fix stage mounts (this loads only the tiny bridge page; the 13 MB runtime downloads on the first Run) and disposes it on unmount, which removes the iframe and terminates any worker. One run at a time; Stop; reconnect after a lost session.
* **Drafts:** the draft is written to `sessionStorage` immediately before each run (the debounced save otherwise lags 250 ms), so a browser that is taken down by a runaway program still has the code.
* **Honesty:** the panel reports what happened ("Your program finished running.", the real stdout/stderr/traceback, duration) and never calls anything correct, passed or graded. Run results come from the browser the student controls and are **display data, never grading evidence** (ADR 0003).

## Figma adaptations (file `n7YeKpNgstVlKSoq46VSjj`, frame `05 Fix and Run`, node `7:306`)

| Figma | Built | Why |
|---|---|---|
| "Run tests" button, a Terminal showing `pytest test_average.py` and per-test pass/fail rows, "3 passed, 1 failed" | **"Run code"** and an **Output** terminal with the program's real stdout/stderr, traceback and timing | There is no test runner and no automated grading in scope; pass/fail rows or a pytest command would be fabricated. The terminal chrome (header bar, mono text, error colours) is reused. |
| Run controls in the right-hand panel | Run / Stop / status / Output **beneath the editor** (main column) | Owner request for PR 2; also keeps the output next to the code at every width. "Reset code" stays in the existing side card (with its confirm step). |
| Hint card keyed to the error | Existing optional hints card, unchanged | Hints must not depend on a run result (no answer-key coupling). |
| "Continue to Reflection" / separate "Run" stepper step | Existing six-stage journey (READ → EXPLAIN → FIX → TRACE → DEFEND → FEEDBACK) | Running is part of Fix, not a stage; Trace stays prediction-first. |

## Consequences / limitations

* Cold first run ≈ 6 s, later runs ≈ 1.4 s start-up (measured locally; real-device numbers are a release gate). The status line says so while starting.
* Browser memory exhaustion cannot be capped (ADR 0003). The client reports `crashed` when the runner goes silent; the draft is already saved.
* Output and tracebacks are not persisted across stage navigation or reload (only the code is).
* WebKit/Safari and real phones are covered only by the runner's CI and the pending device gate.
* If the app ever gets a Content-Security-Policy, `frame-src` must include the runner origin.
