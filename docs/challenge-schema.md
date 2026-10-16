# Challenge schema

AUD-51 introduces a typed, validated schema for challenges and one seeded beginner Python challenge, served read-only. No code execution, no auth, no database — challenges are defined as static, in-memory Python data (`backend/app/data/challenges.py`), not persisted.

## Internal vs. public models

`backend/app/models/challenge.py` defines two layers deliberately:

- **`Challenge`** — the full internal record. Includes `corrected_solution`, `instructor_notes`, `evaluation_guidance`, and any `TestCase` marked `hidden`.
- **Stage-aware public models** — what the API actually returns, one model per learning stage (see [Stage-aware API](#stage-aware-api-aud-52)). Each is an explicit allow-list: a new private field added to `Challenge` later cannot leak by accident, because no public model has anywhere to put it.

`Challenge.to_summary()` / `.to_public()` / `.to_trace()` / `.to_defend()` / `.to_review()` build each public model field-by-field from the internal one; `to_trace()` filters out any `TestCase` where `hidden=True`.

This is enforced by tests (`backend/tests/test_challenges_api.py`): exact key sets per endpoint, no instructor-only keys or text in any response, and spoiler strings absent from the initial load.

## Stage-aware API (AUD-52)

AUD-51 shipped a single `ChallengePublic` payload that included `bug_description`, `expected_behavior`, test cases, and prompts naming the bug — correct for privacy (no *private* fields) but a spoiler for a "find the bug" flow. AUD-52 split it by learning stage:

| Endpoint | Stage(s) | Fields |
|---|---|---|
| `GET /api/challenges` | — | `ChallengeSummary` (unchanged) |
| `GET /api/challenges/{id}` | Read / Explain / Fix | `id, version, title, language, difficulty, topic, learning_objectives, starter_code, explain_prompts, fix_prompts` |
| `GET /api/challenges/{id}/trace` | Trace | `id, version, expected_behavior, test_cases` (hidden excluded), `trace_prompts` |
| `GET /api/challenges/{id}/defend` | Defend | `id, version, defend_prompts` |
| `GET /api/challenges/{id}/review` | Feedback | `id, version, bug_description, corrected_solution, technical_checklist, communication_checklist, alternatives_note` |

All endpoints return `404` for an unknown id; the stage endpoints send `Cache-Control: no-store`.

**Breaking change to `GET /api/challenges/{id}`.** `expected_behavior`, `bug_description`, `test_cases`, `explanation_prompts`, and `defend_prompts` were removed from it. No code in this repository consumed that response (the frontend never called it), so nothing in-repo breaks; any external consumer of the v0.1 public preview would. The seed challenge's `version` was bumped `1 → 2` to mark the content shape change. Deploy the backend before the frontend flow that depends on the new endpoints.

**Stage gating is UX-only, not a security or anti-cheating boundary.** With no authentication and no server-side attempt state, the server cannot know which stage a student has reached, so every stage endpoint — including `/review`, which contains the reference solution — can be requested directly. The separation exists so the *interface* doesn't spoil the exercise by default, and so private data (`instructor_notes`, `evaluation_guidance`, hidden tests) never leaves the backend. Real gating would need identity and persisted attempts (deferred; see below).

## Fields

| Field | Exposed via | Purpose |
|---|---|---|
| `id`, `version`, `title`, `language`, `difficulty`, `topic` | load (`id`/`version` on every stage model) | stable slug, content version, display name; `language` validated against `SUPPORTED_LANGUAGES` (currently `{"python"}`) |
| `learning_objectives`, `starter_code` | load | what the challenge teaches; the buggy code shown to the student |
| `explain_prompts`, `fix_prompts` | load | neutral prompts for the Explain / Fix stages — must not name the bug |
| `expected_behavior`, `test_cases` (hidden filtered), `trace_prompts` | `/trace` | the contract and public cases a student reasons through by hand |
| `defend_prompts` | `/defend` | guide the Defend stage |
| `bug_description`, `corrected_solution` | `/review` | the diagnosis and one reference implementation (not the only valid answer) |
| `technical_checklist`, `communication_checklist`, `alternatives_note` | `/review` | student-facing self-review items, kept as two separate lists; discussion of defensible alternatives |
| `instructor_notes` | **internal only** | guidance for evaluators |
| `evaluation_guidance` | **internal only** | instructor rubric: `technical_criteria` and `communication_criteria`, kept separate |

### `TestCase`

Each test case describes a deterministic expected outcome as data — nothing here executes code. Exactly one of `expected_output` or `expected_exception` must be set (enforced by a Pydantic validator), so a test case unambiguously describes either "returns this value" or "raises this exception," never an incoherent mix of both or neither.

`hidden: bool` marks a test case as held out from students — present in the internal `Challenge` for future use (e.g. a future evaluation pass), excluded entirely from `ChallengePublic`.

### Extensible `language`

`language` is a plain validated `str` (via a Pydantic `AfterValidator`), not a `Literal`/enum. Adding a second language later is a one-line change to the `SUPPORTED_LANGUAGES` set in `backend/app/models/challenge.py` — no change to the field's type, and nothing downstream that references `language` needs to change.

### Why technical and communication criteria stay separate

`EvaluationGuidance` has two independent lists, `technical_criteria` and `communication_criteria`, never merged into one score. This directly implements the product principle in `AGENTS.md` §1: technical correctness and spoken-English performance must be assessed separately — a correct fix with a weak explanation and a well-explained incorrect fix are both partial outcomes, not interchangeable with a single number.

## Seed challenge: `average-of-list`

A function that computes the mean of a list of numbers, with a realistic bug: it doesn't handle an empty list, so it raises an unhandled `ZeroDivisionError` instead of a clear, intentional error.

**Chosen contract (applied consistently across `starter_code`, `expected_behavior`, `corrected_solution`, and `test_cases`):** an empty list raises `ValueError`, not a silent sentinel like `0.0`. `instructor_notes` explicitly discusses why `0.0` is a *defensible alternative* a student might reasonably choose and defend instead (e.g. a "no data = baseline zero" convention in some reporting contexts) — and why it's worth questioning if chosen without discussion, since it can silently mask an upstream bug. Evaluators are guided to credit sound reasoning for an alternative choice, not exact match to the reference solution, consistent with the product principle that StackSpeak develops independent engineering judgment rather than rewarding conformance.

One of the five test cases (`input=[42]`) is marked `hidden` specifically so the leak-prevention tests have something real to verify is excluded.

## API

Read-only, no auth, no persistence — see [Stage-aware API](#stage-aware-api-aud-52) above for the endpoint table.

## Deliberately deferred (not in AUD-51)

- **Stage persistence** (tracking which stage — Read/Explain/Fix/Run/Defend/Feedback — a student is on) was in the original issue's acceptance criteria but is explicitly out of scope for this pass, since it would require auth and a database, neither of which AUD-51 introduces. Tracked as follow-up work, not silently dropped.
- Code execution against `test_cases` (needs the sandboxed-execution work described in `docs/architecture.md`'s security boundary).
- Wiring the frontend `/daily-challenge` page to this API — AUD-52 PR B.
- Real stage gating (needs identity + server-side attempt state).
- Course/lesson grouping above individual challenges.
