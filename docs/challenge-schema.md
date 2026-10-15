# Challenge schema

AUD-51 introduces a typed, validated schema for challenges and one seeded beginner Python challenge, served read-only. No code execution, no auth, no database — challenges are defined as static, in-memory Python data (`backend/app/data/challenges.py`), not persisted.

## Internal vs. public models

`backend/app/models/challenge.py` defines two layers deliberately:

- **`Challenge`** — the full internal record. Includes `corrected_solution`, `instructor_notes`, `evaluation_guidance`, and any `TestCase` marked `hidden`.
- **`ChallengePublic`** / **`ChallengeSummary`** — what the API actually returns. These models have **no fields** for the private data above — not "all fields minus a deny-list," but an explicit allow-list. A new private field added to `Challenge` later cannot leak through the public response by accident, because the public model simply has nowhere to put it.

`Challenge.to_public()` / `.to_summary()` build the public models field-by-field from the internal one, filtering out any `TestCase` where `hidden=True` in the process.

This is enforced by tests (`backend/tests/test_challenges_api.py`), not just by convention: `test_get_challenge_never_leaks_private_fields` parses the actual JSON response and asserts none of `corrected_solution` / `instructor_notes` / `evaluation_guidance` / `hidden` appear anywhere in it, at the top level or inside any test case.

## Fields

| Field | On | Purpose |
|---|---|---|
| `id`, `version`, `title` | both | stable slug, content version, display name |
| `language` | both | validated against `SUPPORTED_LANGUAGES` (currently `{"python"}`) — see below |
| `difficulty` | both | `beginner \| intermediate \| advanced` |
| `topic`, `learning_objectives` | both | what the challenge teaches |
| `starter_code` | both | the buggy code shown to the student |
| `expected_behavior` | both | plain-language contract the correct code must satisfy |
| `bug_description` | both | what's wrong, for the Explain/Fix stages |
| `test_cases` | both (filtered) | see below |
| `explanation_prompts`, `defend_prompts` | both | guide the Explain and Defend stages |
| `corrected_solution` | **internal only** | reference fix |
| `instructor_notes` | **internal only** | guidance for evaluators, including discussion of defensible alternative designs |
| `evaluation_guidance` | **internal only** | `technical_criteria` and `communication_criteria`, kept as two separate lists — see below |

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

Read-only, no auth, no persistence:

- `GET /api/challenges` → `list[ChallengeSummary]`
- `GET /api/challenges/{challenge_id}` → `ChallengePublic`, or `404` if the id is unknown

## Deliberately deferred (not in AUD-51)

- **Stage persistence** (tracking which stage — Read/Explain/Fix/Run/Defend/Feedback — a student is on) was in the original issue's acceptance criteria but is explicitly out of scope for this pass, since it would require auth and a database, neither of which AUD-51 introduces. Tracked as follow-up work, not silently dropped.
- Code execution against `test_cases` (needs the sandboxed-execution work described in `docs/architecture.md`'s security boundary).
- Wiring the frontend `/daily-challenge` page to fetch this real data instead of its current static AUD-50 preview — a natural next step, not bundled into this schema/seed/API change.
- Course/lesson grouping above individual challenges.
