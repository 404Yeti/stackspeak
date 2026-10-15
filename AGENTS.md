# AGENTS.md — StackSpeak

Persistent instruction manual for AI coding agents working on StackSpeak. Read this file before starting any work in this repository.

## 1. Project identity

**StackSpeak** is a voice-first coding comprehension and technical English learning platform.

**Tagline:** Read it. Explain it. Fix it. Defend it.

**Audience:** developers learning to read, explain, and discuss code they didn't write — students preparing for technical interviews, bootcamp grads, engineers leveling up spoken technical communication.

**Core learning sequence:** READ → EXPLAIN → FIX → RUN → DEFEND → FEEDBACK. Not every challenge contains broken code; the sequence must also support comprehension, refactoring, security review, and architecture reasoning challenge types.

**Technical vs. spoken-English assessment:** these are two separate axes of evaluation and must never be collapsed into one score. A correct fix with a weak verbal explanation, and a strong explanation of an incorrect fix, are both partial outcomes and should be reported as such wherever assessment is implemented.

**Product principle:** StackSpeak develops independent engineering judgment. Never build a feature that encourages a student to accept AI output without reasoning about it themselves.

## 2. Architecture

```
stackspeak/
├── frontend/   Next.js (App Router) + TypeScript + Tailwind
├── backend/    FastAPI + Pydantic
└── docs/       architecture, design-system, development, decisions, sprint notes
```

**Stack:** Next.js/TypeScript/Tailwind frontend, FastAPI/Pydantic backend, Postgres (persistence introduced when a sprint needs it — not present yet). See `docs/architecture.md` for the full rationale and planned integration points (Monaco, speech-to-text/text-to-speech provider abstractions, AI evaluation, isolated code execution).

**Configuration:** environment-based, via `.env` files gitignored and templated by root `.env.example`. Backend settings load through `pydantic-settings` with a `STACKSPEAK_` prefix (`backend/app/core/config.py`). Frontend config is limited to `NEXT_PUBLIC_*` vars — anything not prefixed `NEXT_PUBLIC_` never reaches the client bundle.

**Security boundary:** never execute untrusted student code on the application server. Executable challenges stay disabled until a sandboxed execution mechanism is implemented and reviewed — see `docs/architecture.md#security-boundary`. Never expose API keys, database credentials, or other secrets to the frontend.

**Testing conventions:** pytest for backend (`backend/tests/`), Vitest + Testing Library for frontend (co-located `*.test.tsx`/`*.test.ts`). Every new route or component ships with at least a render/behavior smoke test. Run `npm run lint && npm run typecheck && npm test && npm run build` (frontend) and `pytest && ruff check && mypy app` (backend) before claiming a task done.

## 3. Engineering principles

- Clean, maintainable code over clever code. Small, focused modules.
- Strong typing throughout (TypeScript strict mode, Python type hints + mypy).
- Accessible by default: semantic HTML, keyboard navigation, visible focus states, `aria-*` where native semantics fall short.
- Small incremental changes over large speculative ones. No premature abstractions, no unused flexibility for hypothetical future requirements.
- Verify before reporting done: run the actual checks, don't assume.
- Never execute untrusted code on the host, ever — not even "just for testing."

## 4. Design reference

**Figma is the visual source of truth:** https://www.figma.com/design/n7YeKpNgstVlKSoq46VSjj

As of this review, the file has at least three pages: **Cover & Flow** (`0:1`, planning diagram, not implementable screens), **Components** (`2:3`, the real variable-backed component library — Button, Badge, Card, Nav Item, Chip, Progress Bar, Step Item, Mic Button, Waveform, Test Result Row, Code Editor, Terminal Panel, Stage Stepper), and **Brand Assets** (`12:25`, logo/app-icon/favicon variants plus the 10-expression Pip mascot and an annotated brand sheet).

**✅ Brand assets approved 2026-10-15** (project owner, Robert Leyba): the logo, full brand identity, and Pip mascot (all 10 expressions) are the approved visual source of truth — this supersedes the in-Figma "(for approval)" page label. **Approval of the design is not authorization to implement it** — do not build mascot UI or rework branding outside an approved, scoped issue ([AUD-50](https://linear.app/failed-training/issue/AUD-50/implement-responsive-stackspeak-design-system-and-app-shell) tracks this; it has not been started). Do not redesign the approved logo, colors, typography, or Pip without requesting new approval — treat them as fixed inputs to translate faithfully, not reinterpret. See `docs/design-system.md` → "Mascot: Pip" for full detail.

**Critical tooling caveat:** `get_metadata` with no `nodeId` (the "list top-level pages" mode) is **not reliable for this file** — it only returned `0:1` and `2:3`, silently omitting `12:25` even though it's real and directly reachable by ID. An earlier pass trusted that listing and wrongly concluded the brand-assets page didn't exist. **If you have a specific node ID — from a URL, a brief, or the user — query it directly** (`get_metadata`/`get_design_context` with that `nodeId`) rather than trusting whether it shows up in the top-level listing. The "Desktop Screens"/"Tablet & Mobile" pages referenced in the Cover & Flow text remain unconfirmed either way — not found via the (known-unreliable) listing, but not disprovable without a specific node ID to check. See `docs/design-system.md` and `docs/decisions/0001-figma-screens-unavailable.md` for the full history.

**How to translate design → code:** pull real values with the Figma MCP tools (`get_design_context`, `get_variable_defs`) rather than eyeballing the screenshot. Figma CSS variables map directly to the Tailwind v4 `@theme inline` tokens in `frontend/src/app/globals.css` (e.g. Figma `--color-bg-accent` → our `--color-accent` → Tailwind utility `bg-accent`). Reusable Figma components (Button, Badge, Card, Nav Item, etc.) become reusable components under `frontend/src/components/ui/`. If a screen or asset isn't accessible in Figma, say so in your plan and build from the confirmed component tokens instead of inventing a layout — document the deviation in `docs/decisions/`.

## 5. Linear workflow

Project: https://linear.app/failed-training/project/stackspeak-mvp-30a1afc07d6f (team-prefixed `AUD-*` for historical reasons — this is StackSpeak work, not Audli work; never touch the Audli or Failed Training codebases from this repo).

- Search existing issues before creating a new one; reuse what fits.
- Move an issue to **In Progress** when implementation actually begins.
- Record the issue identifier in branch name / commit message where practical.
- Don't create issues for trivial fixes found mid-task; do create a new issue for substantial work that should be scoped separately, without silently expanding current sprint scope.
- When finishing: run verification, then leave one concise comment on the issue — what changed, key files, tests run, known limitations, follow-ups, commit/PR reference.
- Only move an issue to **Done** once implementation and verification are actually complete, not merely written.

## 6. Agent working procedure

1. Read this file.
2. Inspect the repository and the files relevant to the task.
3. Identify the active Linear issue (or confirm one needs to be created).
4. For UI work, review the relevant Figma screens/components first.
5. Write a concise plan before touching code.
6. Implement within the approved scope — no unapproved scope expansion.
7. Run the verification checks listed in §2 (and anything else the task needs).
8. Update documentation (`docs/`) and Linear if durable state changed.
9. Report results plainly, including what's still missing or deferred.

## 7. Current project state

- **Sprint:** 01 — Application Foundation — **approved and Done** (AUD-49, 2026-10-15). v0.1 public-preview is **live**: https://stackspeak.vercel.app/ (frontend), https://stack-speak.onrender.com (backend) — see `docs/deployment.md`.
- **AUD-50 (design system / app shell):** **in progress** on branch `aud-50-design-system-app-shell`, PR open, not merged. Adds `Chip`, `ProgressBar`, `StepItem`, `StageStepper`, `MicButton`, `Waveform`, `CodeEditor`, `TerminalPanel`, `TestResultRow`, `Logo`, `PipMascot` under `frontend/src/components/ui/`; wires the real logo into `SiteHeader`; extends `/daily-challenge` with a clearly-labeled, noninteractive workspace preview (sample code, sample test output, disabled mic button, idle Pip). No execution, recording, or evaluation is real anywhere in this change. See `docs/design-system.md` → "AUD-50 additions" for the deviations the owner approved (continuous `ProgressBar` value, read-only-only `CodeEditor`).
- **Implemented (Sprint 01 baseline):** Next.js + FastAPI foundation, dark-themed homepage, working nav (Home/Daily Challenge live, Courses/Practice Lab/Progress as labeled coming-soon placeholders), `/api/health` backend endpoint, reusable UI components (Button, Badge, Card, ComingSoon) sourced from real Figma tokens, frontend (Vitest) and backend (pytest) test suites, CI workflow, environment templates, a skip-navigation link.
- **Brand assets:** logo, brand identity, and Pip mascot (10 expressions) **approved 2026-10-15**, now partially implemented (logo in header, Pip on Daily Challenge) via AUD-50. Do not redesign without new approval.
- **Known limitations:** no persistence/database wired up yet; no auth; no code execution sandbox; Figma screens beyond Cover & Flow / Components / Brand Assets remain unconfirmed either way (see §4's tooling caveat).
- **Next approved task:** none beyond AUD-50 (in progress, see above) — do not begin AUD-51 or any further work without explicit approval. AUD-50's PR must not be merged or deployed without the owner's explicit approval.
