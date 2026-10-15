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

As of Sprint 01, this file contains a **Cover & Flow** page (planning diagram, not implementable screens) and a **Components** page (the real, variable-backed component library — Button, Badge, Card, Nav Item, Chip, Progress Bar, Step Item, Mic Button, Waveform, Test Result Row, Code Editor, Terminal Panel, Stage Stepper). It does **not** currently contain the "Desktop Screens" / "Tablet & Mobile" pages referenced in its own cover text, and the brand-assets/Pip mascot node referenced in early planning does not exist in the file. Don't assume either exists — check `get_metadata` on the file before relying on a screen or asset that isn't confirmed present.

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

- **Sprint:** 01 — Application Foundation
- **Active issue:** AUD-49 (in progress)
- **Implemented:** Next.js + FastAPI foundation, dark-themed homepage, working nav (Home/Daily Challenge live, Courses/Practice Lab/Progress as labeled coming-soon placeholders), `/api/health` backend endpoint, reusable UI components (Button, Badge, Card, ComingSoon) sourced from real Figma tokens, frontend (Vitest) and backend (pytest) test suites, CI workflow, environment templates.
- **Known limitations:** no persistence/database wired up yet; no auth; no code execution sandbox; Figma screens beyond the Components page are not accessible (see §4); Pip mascot has no approved assets — only directory structure is reserved, no mascot UI exists.
- **Next approved task:** none beyond AUD-49 — do not begin follow-on work without explicit approval, even if you identify it during this sprint.
