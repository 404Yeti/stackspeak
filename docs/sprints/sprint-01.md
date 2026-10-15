# Sprint 01 — Application Foundation

**Linear issue:** [AUD-49](https://linear.app/failed-training/issue/AUD-49/bootstrap-stackspeak-repository-and-application-foundation)
**Objective:** bootstrap an independent StackSpeak repository with a minimal working frontend + backend foundation that future sprints can extend without a rewrite.

## Implementation summary

**Repository:** new, independent git repo at the StackSpeak project root. No Audli/Failed Training files touched.

**Frontend** (`frontend/`): Next.js 16 (App Router, Turbopack) + TypeScript (strict) + Tailwind CSS v4.
- Dark-themed homepage: hero with tagline, the six-stage learning sequence (Read → Explain → Fix → Run → Defend → Feedback), and a live backend-health status card.
- Navigation (`SiteHeader`): Home and Daily Challenge are real routes; Courses, Practice Lab, and Progress are explicitly labeled "Soon" badges, both on desktop and in the collapsible mobile menu.
- `/daily-challenge`: labeled placeholder showing the intended challenge flow — no code execution, no fake AI feedback, no simulated results.
- `/courses`, `/practice-lab`, `/progress`: shared `ComingSoon` component, each with a route-specific, honest description of what's deferred.
- Reusable UI components (`src/components/ui/`): `Button`, `Badge`, `Card`, `ComingSoon` — built from real Figma component tokens, not the sprint brief's fallback table (see `docs/design-system.md`).
- `src/lib/api.ts`: typed fetch wrapper that calls the backend health endpoint and degrades to "Offline" rather than throwing or faking a result.

**Backend** (`backend/`): FastAPI + Pydantic v2 + pydantic-settings.
- `GET /api/health` → `{"status": "ok", "service": "stackspeak-api"}`.
- `app/core/config.py`: typed, env-driven settings (`STACKSPEAK_*` prefix), no hardcoded secrets, CORS restricted to the configured frontend origin.
- No database/ORM wired up yet — `STACKSPEAK_DATABASE_URL` exists as a config slot for a future sprint only.

**Docs & agent instructions:** `AGENTS.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/design-system.md`, `docs/development.md`, `docs/decisions/0001-figma-screens-unavailable.md`.

**CI:** `.github/workflows/ci.yml` — separate frontend and backend jobs, each running lint, typecheck, tests, and (frontend) production build.

## Design alignment

Figma file `n7YeKpNgstVlKSoq46VSjj` was inspected directly (not assumed). It contains a Cover & Flow page (planning only) and a Components page (real, variable-backed library). It does **not** contain the Desktop Screens/Tablet & Mobile pages or the Pip mascot/brand-assets node referenced in the sprint brief — see `docs/decisions/0001-figma-screens-unavailable.md`. Sprint 01 UI was built from the confirmed Components-page tokens (Button, Badge, Card, Nav Item) rather than from an inspected screen, since no such screen exists in the file yet. Colors, radii, spacing, and type confirmed against real Figma variables — documented with provenance in `docs/design-system.md`.

## Verification

Run from a clean environment (`frontend/` and `backend/` installed per `docs/development.md`):

| Check | Command | Result |
|---|---|---|
| Backend tests | `pytest` | 1 passed |
| Backend lint | `ruff check app tests` | clean |
| Backend types | `mypy app` (strict) | no issues |
| Frontend lint | `npm run lint` | clean |
| Frontend types | `npm run typecheck` | clean |
| Frontend tests | `npm test` (Vitest) | 4 passed (2 files) |
| Frontend build | `npm run build` | succeeds, all 5 routes prerendered/generated |
| Backend health (live) | `curl localhost:8000/api/health` | `200 {"status":"ok","service":"stackspeak-api"}` |
| Frontend routes (live) | `curl` `/`, `/daily-challenge`, `/courses`, `/practice-lab`, `/progress` | all `200` |
| Nav + backend integration (SSR HTML) | inspected rendered output | nav links correct with active state, "Soon" badges on the three deferred routes, homepage status card renders "Online — Connected to stackspeak-api" when the backend is running |
| Responsive markup | inspected rendered output | desktop nav uses `hidden … md:flex`, mobile toggle uses `md:hidden` — confirmed in compiled HTML, not just source |

**Limitation:** no headless-browser/visual screenshot tool (e.g. chromium-cli, Playwright) was available in this environment, so responsive layout and real click interaction were verified via server-rendered HTML and compiled Tailwind classes, not a rendered screenshot at each breakpoint. This should be re-verified in a browser (or the `/run-skill-generator` flow used to add a project run-skill) before relying on it further.

## Known limitations

- No persistence layer (Postgres unused), no auth, no user accounts.
- No code execution sandbox — Daily Challenge is a non-interactive placeholder by design, per the security boundary in `AGENTS.md`/`docs/architecture.md`.
- No Pip mascot UI — only a reserved, empty `frontend/public/mascot/` directory; brand assets are unapproved and inaccessible in Figma as of this sprint.
- Figma file lacks the actual screen mockups referenced in the sprint brief; Sprint 01 UI is an original composition against confirmed component tokens, not a 1:1 screen implementation.
- `npm audit` flags one transitive dev-only advisory (`braces`, via `eslint-config-next`) — not fixed, since the available fix forces an incompatible downgrade; tracked in `docs/development.md`.
- No real browser/visual verification performed (see Verification table above).

## Next steps (not started — require separate approval)

- Add the actual screen designs to Figma (or correct the brief) so the homepage/dashboard/challenge workspace can be implemented against a real mockup instead of original composition.
- Pip mascot asset approval and integration.
- AUD-50 (or whatever the next sprint issue is) — not begun.
