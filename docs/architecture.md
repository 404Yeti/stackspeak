# Architecture

## System overview

StackSpeak is two independently deployable applications sharing one repository:

- **`frontend/`** — Next.js (App Router) + TypeScript + Tailwind CSS. Renders the student-facing UI and talks to the backend only over HTTP, via `NEXT_PUBLIC_API_URL`.
- **`backend/`** — FastAPI + Pydantic. Owns all business logic, data access, and any eventual integration with speech providers, AI evaluation, and code execution. Nothing here is reachable by the frontend except through its HTTP API.

There is no shared code between the two apps in Sprint 01 — no shared package, no monorepo tooling (Turborepo/Nx) — because nothing yet needs to be shared. Add a shared package only when a second consumer of the same logic actually exists.

## Major boundaries

- **Frontend ⇄ Backend:** HTTP/JSON only, over `NEXT_PUBLIC_API_URL`. The frontend never talks to Postgres, never holds a database credential, and never holds a provider API key.
- **Backend ⇄ Postgres:** reserved for Sprint 02+ once courses/challenges/attempts/profiles need persistence. `STACKSPEAK_DATABASE_URL` exists as a config slot (see `.env.example`) but nothing reads it yet in Sprint 01 — there's no ORM, no migrations, no schema. Don't add one speculatively.
- **Backend ⇄ untrusted code execution (future):** see [Security boundary](#security-boundary) below. Not implemented in Sprint 01.

## Technology choices

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js (App Router) | Server components let the homepage check backend health without client-side JS; file-based routing matches the nav structure directly; Vercel deploy target assumes it. |
| Styling | Tailwind CSS v4 | Design tokens map 1:1 from Figma CSS variables to `@theme inline` tokens — see `docs/design-system.md`. |
| Backend framework | FastAPI | Async-first, Pydantic request/response validation out of the box, auto-generated OpenAPI docs for a future Monaco/editor integration to consume. |
| Validation | Pydantic v2 / pydantic-settings | Typed settings from env vars with no hand-rolled parsing; typed request/response models. |
| Frontend tests | Vitest + Testing Library | Fast, Vite-native, works well with the App Router's React Server/Client Component split. |
| Backend tests | pytest + FastAPI `TestClient` | Standard, no extra ceremony. |

No database, ORM, or auth library is introduced yet — none is needed for the Sprint 01 scope (a homepage, static nav, and a health check).

## Planned integration points

These are architectural placeholders — do not implement the full systems without an approved issue:

- **Courses → Lessons → Challenges** data model, multi-language challenge support. **Partially implemented (AUD-51):** individual challenges have a typed, validated schema and a read-only API (`backend/app/models/challenge.py`, `backend/app/api/challenges.py` — see `docs/challenge-schema.md`), with a `language` field designed to extend beyond Python. **Not yet built:** course/lesson grouping above individual challenges, and any way to add a challenge other than editing `backend/app/data/challenges.py` directly.
- **Challenge attempts & progression** per student — still not built; needs auth and a database, neither introduced yet. AUD-51 explicitly deferred "stage persistence" (which stage a student is on) for this reason — see `docs/challenge-schema.md`.
- **User accounts & student profiles**, separate from instructor accounts.
- **Audio recording & transcription** — a speech-to-text provider abstraction (interface in `backend/app/`, concrete provider behind it, swappable).
- **Text-to-speech** — same provider-abstraction pattern, for Pip's spoken responses.
- **Technical vs. spoken-English scoring** — two independent assessment pipelines reported separately, never averaged into one number.
- **AI-generated feedback** — must be grounded in the student's actual submitted code/speech, never templated or fabricated.
- **Isolated code execution** — see below; browser-side runner infrastructure exists (AUD-60), a server-side sandbox does not.
- **Instructor tools** — assignments, class-level progress views.

Avoid building speculative abstractions for any of these before a sprint actually requires them.

## Security boundary

**Untrusted student code must never execute on the application server.** The backend process that serves `/api/*` must never `exec`, `eval`, or otherwise run code a student submitted.

Until a sandboxed execution service (e.g. a container-per-run model with resource/network limits, reviewed separately) is implemented, any route that would execute student code stays disabled or returns a clear "not yet available" response — never a simulated/fake result. The Daily Challenge placeholder in Sprint 01 does not execute anything.

**Browser-side execution (AUD-60, infrastructure only — not enabled).** The rule above is about the *application server* and is unchanged: StackSpeak's servers never run, and never receive, student code. AUD-60 adds a separately-reviewed way to run Python **in the student's own browser**, in a hardened worker hosted on a *different site* (`runner/`, deployed as its own Vercel project): see [`docs/python-runner.md`](./python-runner.md) and [ADR 0003](./decisions/0003-python-runner.md). It is feature-flagged **off** in production until its release gates pass, and a Web Worker is never treated as a sandbox by itself — the boundary is the cross-site origin plus a worker-specific CSP that the worker proves is enforced before it runs anything.

**Stage gating is UX-only.** The challenge API splits content by learning stage (`docs/challenge-schema.md`) so the interface doesn't spoil exercises, but with no auth and no server-side attempt state it is not an access-control or anti-cheating boundary — any stage endpoint can be called directly. Only genuinely private data (`instructor_notes`, `evaluation_guidance`, hidden tests) is protected, by never being part of any response model.

Secrets (API keys, database credentials, provider tokens) live only in backend environment variables, never in a `NEXT_PUBLIC_*` var, never committed, never returned in an API response body.
