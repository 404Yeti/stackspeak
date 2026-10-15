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

---

## Owner review (2026-10-15) — Figma recheck, browser QA, findings addressed

Scope: a focused review requested by the project owner before approving the sprint. No feature/scope expansion; AUD-50 not started.

### 1. Figma recheck — Pip/brand assets correction

The original Sprint 01 pass incorrectly reported the Pip mascot/brand-assets node as nonexistent. **Root cause:** `get_metadata` called with no `nodeId` (its "list top-level pages" mode) only returns `0:1` (Cover & Flow) and `2:3` (Components) for this file — it silently omits a third, real page. Directly querying `nodeId: "12:25"` (the exact ID from the brief's URL) resolves to **Brand Assets (for approval)**: Logo Icon and Logo Horizontal sets (Theme × Size/Layout variants), App Icon (4 styles), Favicon (3 sizes), a Pip Mascot component set with 10 `Expression` variants (Idle, Listening, Thinking, Explaining, Success, Confused, Error, Idea, Coding, Celebrating), and two annotated brand-sheet frames with full usage rules and a color/type reference.

The lesson, now documented in `docs/design-system.md` and `AGENTS.md`: **when a specific Figma node ID is in hand, query it directly — don't trust the top-level page listing as exhaustive for this file.** The "Desktop Screens"/"Tablet & Mobile" pages referenced in the Cover & Flow text are therefore re-classified from "don't exist" to **unconfirmed** — not found via the known-unreliable listing, not disprovable without a node ID to check directly.

**No UI integration followed from this correction** — the brand sheet's own text reads *"Brand Assets v0.1 — for approval... Approve before integration,"* consistent with the brief's instruction to treat unapproved assets as design candidates only. `docs/design-system.md`, `AGENTS.md`, and `docs/decisions/0001-figma-screens-unavailable.md` were corrected; the Figma file itself was not touched; no mascot UI was implemented.

### 2. Browser QA

Playwright + Chromium were installed (network access was available) and used to drive the actual running app — not just inspect source. Verified at **1440px, 768px, 390px, 320px**, both with the dev server and against a production build:

| Check | Result |
|---|---|
| No horizontal overflow at any of the 4 widths | ✅ (`scrollWidth === clientWidth` at each) |
| Nav: desktop row visible ≥768px, hamburger menu <768px | ✅ |
| Mobile menu opens on click, link inside is keyboard-focusable | ✅ (390px, 320px) |
| Backend-health card shows "Online — Connected to stackspeak-api" | ✅ at all 4 widths, with the backend actually running |
| Daily Challenge / Courses routes render their real content | ✅ |
| Browser console/page errors | none at any width |
| Keyboard focus order from page load | **initially failed** — first Tab landed on the logo link, no way to skip the nav |

**Finding fixed:** no skip-navigation link existed. Added one to `frontend/src/app/layout.tsx` (visually hidden until focused, standard pattern) and gave `<main>` an `id="main-content"` target. Re-verified: first Tab at all 4 widths now lands on a visible "Skip to main content" link targeting `#main-content`. Screenshot confirms visible, high-contrast focus state.

**Incidental finding, not a defect:** screenshots showed a small black "N" badge — this is Next.js's own dev-mode build-activity indicator, not part of the app; it doesn't exist in `next build`/`next start` production output (confirmed by rebuilding).

**Environment gotcha hit and documented:** after editing `layout.tsx`, `next dev` didn't pick up the change — WSL's unreliable file-watching on the `/mnt/c` drive meant the Turbopack cache went stale instead of invalidating. Fixed by clearing `frontend/.next` and restarting; documented in `docs/development.md` so it isn't mistaken for a code bug next time.

### 3. Final verification (rerun after the skip-link fix)

- Frontend: `npm run lint` ✅ clean · `npm run typecheck` ✅ clean · `npm test` ✅ 4/4 passed · `npm run build` ✅ succeeds, all 5 routes generated
- Backend: `pytest` ✅ 1 passed · `ruff check` ✅ clean · `mypy app` ✅ clean (unchanged this round — no backend edits)
- Live: both dev servers started; browser QA above conducted against the running app at all 4 breakpoints plus a full production build

### Readiness

**AUD-49 is ready for final approval**, with these caveats carried forward rather than hidden:

- Browser QA now covers 4 real breakpoints with screenshots and an actual headless-Chromium session (not just compiled HTML) — the "no browser tool available" limitation from the first pass is resolved.
- The Figma documentation error (Pip reported missing) is corrected, with the root cause and a reusable caveat recorded so it doesn't recur.
- The "Desktop Screens"/"Tablet & Mobile" pages are honestly unconfirmed, not falsely claimed either way — still worth a direct answer from the design owner before any future screen-matching work.
- Pip/brand assets remain correctly unintegrated pending the owner's explicit approval, per the brand sheet's own instruction.
