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

As of this review, the file has at least four pages: **Cover & Flow** (`0:1`, planning diagram, not implementable screens), **Components** (`2:3`, the real variable-backed component library — Button, Badge, Card, Nav Item, Chip, Progress Bar, Step Item, Mic Button, Waveform, Test Result Row, Code Editor, Terminal Panel, Stage Stepper), **Brand Assets** (`12:25`, logo/app-icon/favicon variants plus the 10-expression Pip mascot and an annotated brand sheet), and **Desktop Screens** (`2:4`, previously hidden/unconfirmed — contains the approved homepage frame, see below).

**Homepage frame confirmed 2026-10-15:** `9:487` ("01 Marketing Landing Page", on the Desktop Screens page `2:4`) is the complete, single-frame approved homepage — Product Navigation, Hero, How It Works, Course Previews, Benefits, Final CTA, Footer. Implemented in [AUD-54](https://linear.app/failed-training/issue/AUD-54). This resolves the "unconfirmed" status this section used to carry — the frame existed, it just wasn't discoverable via the unreliable no-`nodeId` listing (see the tooling caveat below) until the owner supplied the exact node ID directly.

**✅ Brand assets approved 2026-10-15** (project owner, Robert Leyba): the logo, full brand identity, and Pip mascot (all 10 expressions) are the approved visual source of truth — this supersedes the in-Figma "(for approval)" page label. **Approval of the design is not authorization to implement it without a scoped issue** — [AUD-50](https://linear.app/failed-training/issue/AUD-50/implement-responsive-stackspeak-design-system-and-app-shell) did that implementation and is now released (see §7). Do not redesign the approved logo, colors, typography, or Pip without requesting new approval — treat them as fixed inputs to translate faithfully, not reinterpret. See `docs/design-system.md` → "Mascot: Pip" for full detail.

**Critical tooling caveat:** `get_metadata` with no `nodeId` (the "list top-level pages" mode) is **not reliable for this file** — it omitted `12:25` (Brand Assets) in Sprint 01, and omitted `2:4` (Desktop Screens) until AUD-54 supplied node `9:487` directly, even though both are real and directly reachable by ID. **If you have a specific node ID — from a URL, a brief, or the user — query it directly** (`get_metadata`/`get_design_context` with that `nodeId`) rather than trusting whether it shows up in the top-level listing, and never infer a frame's existence or location from component instance counts alone. See `docs/design-system.md` and `docs/decisions/0001-figma-screens-unavailable.md` for the full history.

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
- **AUD-50 (design system / app shell):** **approved, merged, and released** (PR [#1](https://github.com/404Yeti/stackspeak/pull/1), merge commit `beef0ae6`, 2026-10-15). Adds `Chip`, `ProgressBar`, `StepItem`, `StageStepper`, `MicButton`, `Waveform`, `CodeEditor`, `TerminalPanel`, `TestResultRow`, `Logo`, `PipMascot` under `frontend/src/components/ui/`; wires the real logo into `SiteHeader`; extends `/daily-challenge` with a clearly-labeled, noninteractive workspace preview (sample code, sample test output, disabled mic button, idle Pip). No execution, recording, or evaluation is real anywhere in this. Live in production, verified. See `docs/design-system.md` → "AUD-50 additions" for the deviations the owner approved (continuous `ProgressBar` value, read-only-only `CodeEditor`), and `docs/deployment.md` → "AUD-50 release" for full merge/CI/production-verification evidence.
- **Implemented (Sprint 01 baseline):** Next.js + FastAPI foundation, dark-themed homepage, working nav (Home/Daily Challenge live, Courses/Practice Lab/Progress as labeled coming-soon placeholders), `/api/health` backend endpoint, reusable UI components (Button, Badge, Card, ComingSoon) sourced from real Figma tokens, frontend (Vitest) and backend (pytest) test suites, CI workflow, environment templates, a skip-navigation link.
- **Brand assets:** logo, brand identity, and Pip mascot (10 expressions) **approved 2026-10-15**, now partially implemented (logo in header, Pip on Daily Challenge) via AUD-50. Do not redesign without new approval.
- **AUD-51 (challenge schema):** **approved, merged, and released** (PR [#2](https://github.com/404Yeti/stackspeak/pull/2), merge commit `4b5e7f0`, 2026-10-15). Typed Pydantic challenge schema with a strict internal/public split (`backend/app/models/challenge.py`) — public API responses are built from an explicit allow-list, so `corrected_solution`/`instructor_notes`/`evaluation_guidance`/hidden test cases cannot leak by accident, enforced by tests and re-verified live in production (parsed the actual JSON response, zero leakage). One seeded beginner Python challenge (`average-of-list`), read-only `GET /api/challenges` + `GET /api/challenges/{id}`. No execution, no auth, no DB, no frontend changes. See `docs/challenge-schema.md` and `docs/deployment.md` → "AUD-51 release".
- **AUD-54 (homepage Figma alignment):** **approved, merged, and released** (PR [#3](https://github.com/404Yeti/stackspeak/pull/3), merge commit `a65f7f4`, 2026-10-15). Rebuilt the public homepage (`frontend/src/app/page.tsx`) to match the approved `9:487` frame: new `Hero`, `CoursePreviews`, `Benefits`, `FinalCta` sections under `frontend/src/features/home/`; `LearningSequence` rewritten to 4 steps composing `Card` instead of duplicating its styling; `MarketingNav` (`frontend/src/components/layout/MarketingNav.tsx`) is a new homepage-only nav that `SiteHeader` renders when `pathname === "/"`, keeping the existing in-app nav untouched everywhere else; `SiteFooter` updated with the Figma-exact tagline and 5 footer links; `Logo` gained a `size="lg"` marketing variant (uses Figma's genuine small-icon asset, not a CSS-scaled copy — `frontend/public/brand/logo-icon-sm.svg`); `Card` gained a `highlighted` prop for the flagship course card; `Button` gained visible `disabled:` styling, used for `Log in`/`Sign up` (no auth system exists yet — kept genuinely non-functional rather than faking a login flow, consistent with `MicButton`). Three new `ComingSoon`-backed stub routes (`/interview-practice`, `/privacy`, `/terms`) so the new nav/footer links aren't dead. Deleted `BackendStatus.tsx` (a Sprint-01 dev diagnostic, not part of the approved design). **Responsive decision not in the Figma file:** the nav's full link row + auth buttons don't fit next to the logo until `lg` (1024px) — found via Playwright QA, where it visibly wrapped/overlapped at Tailwind's default `md` (768px); fixed by moving the inline-nav breakpoint to `lg` with a `lg:px-10` gutter before the Figma-exact `xl:px-[120px]` kicks in. Live in production, re-verified at 320/390/768/1024/1440px against `https://stackspeak.vercel.app`. See `docs/deployment.md` → "AUD-54 release" for full merge/CI/production-verification evidence.
- **AUD-52 (interactive challenge flow):** **approved, merged, and released** in two PRs (2026-10-16). PR A ([#4](https://github.com/404Yeti/stackspeak/pull/4), merge `97d3161`, backend): stage-aware public API — spoiler-free `GET /api/challenges/{id}` plus `/trace`, `/defend`, `/review` (explicit allow-list models, `no-store`); challenge `version` 2; **breaking change** to the old single public payload. PR B ([#5](https://github.com/404Yeti/stackspeak/pull/5), merge `22d09ed`, frontend): `/daily-challenge` is now a working **READ → EXPLAIN → FIX → TRACE → DEFEND → FEEDBACK** flow (`frontend/src/features/challenge/`) with the approved workspace top bar (Exit, compact stepper below 1024px), a reducer with per-stage guards + `sessionStorage` drafts, new `TextArea`/`CodeInput` components, and a Playwright smoke suite (`frontend/e2e/`, CI job `e2e`). **Honest by design:** Trace is predict → reveal → self-mark (never a run); Feedback is a self-review with separate Technical and Communication checklists and one labeled reference implementation — no code execution, voice, AI scoring, auth, or database; nothing the student writes leaves the browser. **Stage gating is UX-only, not a security or anti-cheating boundary** (no auth/server state; any stage endpoint can be called directly). Live in production, verified with Playwright at 320/390/768/1024/1440px (12/12). See `docs/decisions/0002-aud-52-interactive-flow.md` (Figma adaptations, unlocated "13 Mobile challenge" node, limitations), `docs/challenge-schema.md`, and `docs/deployment.md` → "AUD-52 PR A release" / "AUD-52 PR B release".
- **AUD-57 (Trace UX polish):** **approved, merged, and released** (PR [#6](https://github.com/404Yeti/stackspeak/pull/6), merge `2e55f69`, 2026-10-16). UI-only follow-up to AUD-52 (which stays Done): Trace now shows ONE empty-list prediction exercise (stacked, full-width; the student's code labeled "Your current code" or "Starter code") instead of four stacked cards, and the case description/contract no longer appear before the reveal. No backend/API change (all public cases are still served by `/trace`). Verified in production with Playwright (13/13, 320–1440px). See `docs/deployment.md` → "AUD-57 release" and ADR 0002's addendum.
- **Known limitations:** no persistence/database wired up yet (challenge drafts live only in the browser tab's `sessionStorage`); no auth (so `Log in`/`Sign up` on the homepage are intentionally disabled); no code execution sandbox, so nothing is ever run or auto-graded; no voice recording or AI feedback; real stage gating and progression need auth + DB (see `docs/challenge-schema.md`).
- **Next approved task:** none — AUD-52 and AUD-57 are released (see above). Candidate follow-ups (code execution sandbox, voice, grounded AI feedback, auth/persistence) are unscoped and unapproved; do not begin any without explicit approval.
