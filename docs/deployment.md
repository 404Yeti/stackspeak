# Deployment — StackSpeak v0.1 Public Preview

**Status as of 2026-10-15: RELEASED.** Both services deployed, integrated, and verified end-to-end in a real browser — nav, responsiveness, backend connectivity, and CORS all confirmed working. The homepage hero badge reads "StackSpeak v0.1 Public Preview." AUD-50 (design system/app shell) and AUD-51 (challenge schema + read-only API) are both merged and live, verified in production. **StackSpeak v0.1 Public Preview is considered released.**

## Live URLs

- **Frontend:** https://stackspeak.vercel.app/
- **Backend:** https://stack-speak.onrender.com
- **Health check:** https://stack-speak.onrender.com/api/health
- **GitHub:** https://github.com/404Yeti/stackspeak (branch `main`)

## GitHub

- Default branch: `main`
- Latest verified commit: `4b5e7f0` (also the commit Render reports running — see "AUD-51 release" below)
- History: `2020956` (bootstrap) → `963e3d8` (owner review) → `7f316e6` (brand approval) → `cbfd603`/`4062fb8` (deployment docs) → `3644afd` (commit-SHA health field) → `8b5695b` → `5e4480b` (deployment docs) → `a3b24dd`/`8db5c67`/`bc8fd3e` (v0.1 preview release) → PR #1 `beef0ae6` (AUD-50) → `291f539`/`652fb8c` (docs) → PR #2 `4b5e7f0` (AUD-51)

## Backend → Render ✅ Live

| Setting | Value |
|---|---|
| Workspace | robert's workspace |
| Service | Stack Speak |
| URL | https://stack-speak.onrender.com |
| Plan | Free tier |
| Auto-deploy | Enabled |
| Database | None provisioned (as required) |
| `STACKSPEAK_CORS_ORIGINS` | `["https://stackspeak.vercel.app"]` |

## Frontend → Vercel ✅ Live

| Setting | Value |
|---|---|
| URL | https://stackspeak.vercel.app/ |
| Plan | Free (Hobby) tier |
| `NEXT_PUBLIC_API_URL` | `https://stack-speak.onrender.com` (inferred from verified behavior below — platform dashboard not directly inspected) |

## Production verification (2026-10-15)

All checks run independently against the live URLs — no Render/Vercel dashboard or API access used, only public HTTP and a real headless-Chromium session (Playwright).

| Check | Result |
|---|---|
| `GET /api/health` → 200 | ✅ `{"status":"ok","service":"stackspeak-api","commit":"5e4480b91f9ed4e2317e7189252f6d963a8681d9"}` |
| Deployed commit == `git rev-parse main` | ✅ exact match, full 40-char SHA |
| Frontend loads | ✅ `GET /` → 200, correct title/content |
| Backend indicator shows "Online" | ✅ "Connected to stackspeak-api" — confirmed via screenshot, all 4 breakpoints |
| `NEXT_PUBLIC_API_URL` correct | ✅ **inferred, not directly read** — see note below |
| Nav (desktop row / mobile hamburger) | ✅ correct at all 4 breakpoints |
| Responsive, no horizontal overflow | ✅ 1440 / 768 / 390 / 320px, `scrollWidth === clientWidth` at each |
| Skip-to-content link (keyboard a11y) | ✅ first Tab stop at all 4 breakpoints |
| Daily Challenge / Courses routes | ✅ render real content |
| Browser console/page errors | ✅ none, any breakpoint |
| Failed network requests | ✅ none |
| **Browser-side CORS** (`fetch` from a script running on `stackspeak.vercel.app` to `stack-speak.onrender.com`) | ✅ **200, no CORS error** — executed via `page.evaluate(() => fetch(...))` in an actual browser context on the live origin, not simulated |

**Note on `NEXT_PUBLIC_API_URL`:** this agent has no Vercel dashboard/API access, so the env var's configured value was never read directly — it's inferred from behavior: the homepage shows "Online" with the right service name, and a direct browser-side fetch to the Render URl succeeds with no CORS error, which would only work if the deployed frontend is actually configured to call `https://stack-speak.onrender.com`. This is strong but indirect evidence, not a literal read of the Vercel project setting.

**Why no client-side `/api/health` request appears in the network log above:** `BackendStatus` (`frontend/src/features/home/BackendStatus.tsx`) is a React Server Component — its fetch runs on Vercel's server at request time (server-to-server, Vercel → Render), not in the visitor's browser. That's expected and correct, and it's *why* a separate, explicit browser-side CORS probe (the `page.evaluate` fetch above) was run — the homepage itself doesn't exercise the browser→backend CORS path at all, so "Online" alone wouldn't have proven CORS was configured correctly.

## Labeling fix (2026-10-15, post-release)

The homepage hero badge was changed from "Sprint 01 — Application Foundation" to **"StackSpeak v0.1 Public Preview"** (`frontend/src/app/page.tsx`, single-line change — footer text intentionally left as-is, out of scope). Verified:

- `npm run lint` / `typecheck` / `test` (4/4) / `build` — all clean
- Pushed as `8db5c67`; Vercel auto-deployed within ~20 seconds of the push
- Confirmed live via `curl` (new text present) and a Playwright screenshot of the production homepage
- Backend untouched and unaffected — still `5e4480b`, no redeploy needed for a frontend-only text change

## AUD-50 release (2026-10-15)

**PR [#1](https://github.com/404Yeti/stackspeak/pull/1) merged** → `main` @ merge commit `beef0ae64ec2f1f5e0db311e5e3dd9b9e3d60965` (fast-forward from `df7f884` + a CI fix at `7219b6c`).

**CI finding, fixed before merge:** `npm run typecheck` was failing in CI with `Cannot find name 'LayoutProps'` — a Next.js-generated ambient type (`.next/types/`) that only exists after a build/dev run, so `tsc --noEmit` fails on a genuinely clean checkout when run before `npm run build`. This had been silently failing on every push to `main` since CI was first configured (confirmed via `gh run list` history) — nobody had actually looked at a green/red check before this PR. Not a code defect: the application has zero real type errors. Fixed by reordering `.github/workflows/ci.yml` (`build` before `typecheck`), not by weakening the check. After the fix, both `frontend` and `backend` CI jobs passed in full on the actual PR head commit, including the **complete Vitest suite running together** in 53s with zero flakiness — confirming the intermittent timeout seen in local dev (see `docs/development.md`) is specific to this project's shared dev sandbox, not the code or CI.

**Deployment evidence (not inferred from appearance):** GitHub's commit-status API shows a Vercel `"Deployment has completed"` status directly attached to merge commit `beef0ae6...` (`gh api repos/404Yeti/stackspeak/commits/beef0ae.../status`), confirming Vercel built and deployed that exact commit to production.

**Post-merge production verification** (Playwright, 320/390/768/1440px, against the live site):

| Check | Result |
|---|---|
| Homepage badge reads "StackSpeak v0.1 Public Preview" | ✅ all 4 widths |
| Approved logo renders (`/brand/logo-icon.svg`) | ✅ all 4 widths |
| "Speak" renders in approved emerald | ✅ computed style `rgb(52, 211, 153)` = exactly `#34D399`, checked programmatically via `getComputedStyle`, not eyeballed |
| Pip mascot renders (idle expression) | ✅ all 4 widths, resolves to `/mascot/idle.png` |
| Workspace preview (stepper, code editor, terminal, mic, waveform) displays | ✅ all 4 widths |
| Labeled "Noninteractive preview" | ✅ |
| Mic button(s) genuinely disabled | ✅ `.isDisabled()` true for every button found, every width |
| Code editor read-only | ✅ ("Read-only" badge present; no "Editable" mode shipped at all) |
| No horizontal overflow | ✅ `scrollWidth === clientWidth` at all 4 widths, home and Daily Challenge |
| No console/page errors, no failed requests | ✅ zero at any width |
| Skip-to-content link still works | ✅ first Tab stop, all 4 widths |
| Backend connectivity | ✅ "Online — Connected to stackspeak-api" |

## AUD-51 release (2026-10-15)

**PR [#2](https://github.com/404Yeti/stackspeak/pull/2) merged** → `main` @ merge commit `4b5e7f00cde78db421ad2730e39854bba559c908`. Backend-only change (typed challenge schema, seed, read-only API — see `docs/challenge-schema.md`); frontend untouched.

**CI:** both `frontend` and `backend` jobs green on the PR head commit (`416fa1f`) before merge, and again on the `main` push after merge — no new findings, the AUD-50 CI-ordering fix held.

**Deployment verification (all against the live production URLs, not inferred):**

| Check | Result |
|---|---|
| `GET /api/health` → 200 | ✅ |
| Deployed commit == merge commit | ✅ `{"commit":"4b5e7f00cde78db421ad2730e39854bba559c908"}` — exact match, confirmed within ~15s of merge (Render auto-deploy) |
| `GET /api/challenges` → 200 | ✅ returns the one seeded `ChallengeSummary` |
| `GET /api/challenges/average-of-list` → 200 | ✅ full public detail |
| `GET /api/challenges/nonexistent` → 404 | ✅ |
| Private fields excluded from both endpoints | ✅ checked **programmatically** (parsed JSON, diffed keys against `{corrected_solution, instructor_notes, evaluation_guidance, hidden}`) — zero leakage, top level and inside every test case |
| Hidden test case (`input=[42]`) excluded | ✅ 4 of 5 test cases returned, exactly as designed |
| Frontend backend-connectivity still "Online" | ✅ unaffected, as expected for a backend-only change |

## AUD-54 release (2026-10-15)

**PR [#3](https://github.com/404Yeti/stackspeak/pull/3) merged** → `main` @ merge commit `a65f7f4283f9d63fad32c3e5f31de719123ddac8`. Frontend-only change (public homepage rebuilt to match the approved Figma frame `9:487` — see `docs/design-system.md` → "AUD-54 additions"); backend untouched.

**CI:** both `frontend` and `backend` jobs green on the PR head commit (`95cfc5b`) before merge, and again on the `main` push after merge (run [38715026905](https://github.com/404Yeti/stackspeak/actions/runs/38715026905)).

**Deployment evidence:** GitHub's commit-status API shows `Vercel: success` directly attached to merge commit `a65f7f4...`. `https://stackspeak.vercel.app/` serves the new copy (hero "Level up your coding and your English.", footer "StackSpeak — Read it. Explain it. Fix it. Defend it.") — confirms the merged revision is live, not a stale cached build.

**Post-merge production verification** (Playwright, 320/390/768/1024/1440px, against the live site):

| Check | Result |
|---|---|
| No horizontal overflow at any width | ✅ `scrollWidth === clientWidth`, all 5 widths |
| No console errors / failed requests | ✅ zero at any width |
| Hamburger nav (below 1024px) opens correctly | ✅ 320/390/768px |
| Inline nav (1024px+) renders correctly, including right at the 1024px boundary | ✅ — this is the exact breakpoint the pre-merge QA bug (nav overlapping the logo at 768px) was fixed to | 
| Hero CTA present | ✅ all 5 widths |
| `Log in`/`Sign up` genuinely disabled | ✅ `.isDisabled()` true, all 5 widths |
| Footer links (Courses/Practice Lab/Interview Practice/Privacy/Terms) present, correctly targeted | ✅ all 5 widths |
| Skip-to-content link still first tab stop | ✅ verified on a clean page load at 320px and 768px |
| All 8 routes (`/`, `/daily-challenge`, `/courses`, `/practice-lab`, `/interview-practice`, `/privacy`, `/terms`, `/progress`) return 200, zero console errors | ✅ |
| `/daily-challenge` unaffected | ✅ noninteractive preview, sample code, heading all present |
| Backend unaffected | ✅ `/api/health` still reports commit `4b5e7f0` (AUD-51), as expected for a frontend-only change; `/api/challenges` still serves correctly |
| Screenshots match Figma `9:487` | ✅ section ordering, copy, branding confirmed at all 5 widths |

## AUD-52 PR A release (stage-aware challenge API)

PR [#4](https://github.com/404Yeti/stackspeak/pull/4), reviewed head `542df98`, merge commit `97d3161` (2026-10-16). **AUD-52 is still In Progress** — this is the backend half; the interactive frontend (PR B) is not released.

**Pre-merge:** head `542df98` verified; checks `backend`, `frontend`, `Vercel`, `Vercel Preview Comments` all green; mergeable/clean; diff limited to the 7 approved files (`backend/app/{api/challenges,data/challenges,models/challenge}.py`, two test files, `docs/architecture.md`, `docs/challenge-schema.md`); merged with a merge commit (same as PRs #1–#3). Local: pytest 21 passed, ruff and mypy clean.

**Post-merge production verification** (public HTTP against `https://stack-speak.onrender.com`):

| Check | Result |
|---|---|
| `/api/health` commit | ✅ `97d31615269880988c0934554ab5998b2b010361` — exactly the merge commit (was `4b5e7f0` before) |
| `GET /api/challenges/average-of-list` | ✅ 200; keys exactly `id, version, title, language, difficulty, topic, learning_objectives, starter_code, explain_prompts, fix_prompts`; `version` 2 |
| `/trace`, `/defend`, `/review` | ✅ 200 each; key sets exactly as the contract in `docs/challenge-schema.md` |
| Initial load has no answer-revealing content | ✅ none of `bug_description`, `expected_behavior`, `test_cases`, `explanation_prompts`, `defend_prompts`, `corrected_solution`; none of `zerodivision`, `valueerror`, `empty`, `raise ` in the text |
| Hidden test / instructor-only data | ✅ `[42]` case absent (`/trace` returns the 4 public cases, none with a `hidden` key); `instructor_notes`, `evaluation_guidance`, and instructor text fragments absent from all four responses |
| Reference solution only in `/review` | ✅ present in `/review`, absent from load, `/trace`, `/defend` |
| `Cache-Control: no-store` | ✅ on `/trace`, `/defend`, `/review` (not on the load response, by design) |
| Unknown challenge | ✅ 404 on all four paths |
| Browser CORS | ✅ `access-control-allow-origin: https://stackspeak.vercel.app` on load and `/review` |
| Frontend healthy | ✅ `/`, `/daily-challenge`, `/courses` return 200; homepage tagline present; `/daily-challenge` is still the AUD-50 static preview (the frontend never called the changed endpoint) |

**Compatibility note:** this release removed five fields from `GET /api/challenges/{id}` (breaking for any external consumer; none exist in this repo).

## AUD-52 PR B release (interactive Daily Challenge flow)

PR [#5](https://github.com/404Yeti/stackspeak/pull/5), reviewed head `90167b1`, merge commit `22d09ed` (2026-10-16). Together with PR A (above) this completes AUD-52: the Daily Challenge is a working **READ → EXPLAIN → FIX → TRACE → DEFEND → FEEDBACK** flow on the real `average-of-list` challenge. Text input only; no code execution, voice, AI scoring, auth, or database.

**Pre-merge:** head `90167b1` verified; checks `frontend`, `backend`, `e2e` (Playwright, real backend + production build), `Vercel`, `Vercel Preview Comments` all green; mergeable/clean; 41 approved files (frontend feature code and tests, the Playwright suite + CI job, docs, ADR 0002); **zero backend files and zero dependency changes** (only an `e2e` npm script); a scan of the added code found no `eval`/`exec`/subprocess, Pyodide, database/ORM, auth library, `MediaRecorder`/`getUserMedia`, or AI-provider usage. Merged with a merge commit.

**Deployment evidence:**

| Check | Result |
|---|---|
| Vercel production deployment of the exact merge commit | ✅ GitHub deployment `7108290231`, environment `Production`, sha `22d09ed`, state `success` ("Deployment has completed"), `https://stackspeak-okito3nma-robert-leybas-projects.vercel.app` |
| Live site serves the new build | ✅ `/daily-challenge` HTML contains the new loading state (no "Coming soon"/"Noninteractive preview") |
| Render backend | ✅ `/api/health` commit `97d31615269880988c0934554ab5998b2b010361` — still the PR A revision; PR B changed no backend code |
| Frontend → production challenge API | ✅ browser-origin request from `https://stackspeak.vercel.app` returns 200 with `access-control-allow-origin: https://stackspeak.vercel.app`; the flow's own requests to `stack-speak.onrender.com` succeed (below) |

**Production acceptance** — Playwright (headless Chromium) against `https://stackspeak.vercel.app` + `https://stack-speak.onrender.com`, **12/12 passed**:

| Check | Result |
|---|---|
| Full journey Read → Explain → Fix → Trace → Defend → Feedback, then Start over | ✅ at each of **320, 390, 768, 1024, 1440px** |
| Progress indicator | ✅ full stepper at ≥1024px, compact "Step n of 6 · Stage" below; global nav absent on this route |
| Trace requires a prediction first | ✅ Reveal disabled until a prediction is typed; no `Expected:` text before reveal |
| No fabricated execution or AI results | ✅ "StackSpeak did not run your code" shown; no pass/fail/pytest/terminal/score/AI text anywhere on Trace; Feedback says "has not evaluated your answers" |
| Drafts survive refresh | ✅ Fix-stage diagnosis restored after reload |
| Restart | ✅ requires the "Yes, start over" confirmation; answers cleared and still empty after a reload |
| Blocked `sessionStorage` | ✅ full flow completes, no errors |
| Error states + retry | ✅ aborted challenge load → alert → "Try again" recovers; failed `/review` → alert "Your answers so far are safe" → "Try again" recovers with answers intact |
| Keyboard + focus | ✅ Enter/Tab/Space-only path through Explain → Fix → Trace; focus lands on each new stage heading; `aria-current="step"` on the current stage |
| No horizontal overflow | ✅ every stage, all 5 widths |
| No console/page/request errors | ✅ zero across all journeys and the 8-route health check |
| No student content transmitted | ✅ every request in every journey was a GET to `stackspeak.vercel.app` or `stack-speak.onrender.com`; no request URL/body contained any typed answer |
| Stage content requested only when reached | ✅ after Read: exactly `GET /api/challenges` + `GET /api/challenges/average-of-list`; no `/trace` before Fix is done, no `/defend` before Trace, no `/review` until Feedback |
| Reference solution not in the production bundle | ✅ every `_next/static` JS/CSS asset the whole flow loads was fetched and searched — no solution text, no `instructor_notes` |
| Initial API response spoiler-free | ✅ no `bug_description`, `expected_behavior`, `test_cases`, `corrected_solution`, prompts that name the bug, `ZeroDivisionError`/`ValueError`, or the solution text |
| Public responses | ✅ none of the 4 endpoints contain `instructor_notes`, `evaluation_guidance`, `hidden`, the hidden `[42]` case, or instructor text; the solution appears only in `/review`; `Cache-Control: no-store` on stage endpoints; 404 for unknown ids on all four paths |
| Homepage + existing routes | ✅ `/`, `/daily-challenge`, `/courses`, `/practice-lab`, `/interview-practice`, `/privacy`, `/terms`, `/progress` all 200, no overflow, no console errors; homepage tagline present; existing nav intact on `/courses` |

(The acceptance spec was a one-off run, not committed; the committed CI suite is `frontend/e2e/`.)

**Known limitations:** see `docs/decisions/0002-aud-52-interactive-flow.md` — "13 Mobile challenge" Figma node unlocated (responsive layout uses the desktop patterns); whole-number floats display without `.0`; Tab is not captured in the code field (indent with spaces); browser Back leaves the workspace (stage isn't in the URL); Vercel *preview* deployments can't load the challenge (CORS allows only production + localhost); "daily" = the first challenge the API lists; stage gating is UX-only, not a security boundary; the removed fields in `GET /api/challenges/{id}` (PR A) remain a breaking change for any external consumer.

## AUD-57 release (Trace stage: one focused prediction exercise)

PR [#6](https://github.com/404Yeti/stackspeak/pull/6), reviewed head `6e4b49f`, merge commit `2e55f69` (2026-10-16). A UI-only follow-up to AUD-52 (which stays Done): Trace shows **one** empty-list prediction exercise in a stacked, full-width layout instead of four stacked cards. See `docs/decisions/0002-aud-52-interactive-flow.md` → "Addendum (AUD-57)".

**Pre-merge:** head `6e4b49f` verified; checks `frontend`, `backend`, `e2e`, `Vercel`, `Vercel Preview Comments` all green; mergeable/clean; diff limited to 10 files (Trace/reducer/workspace code, unit + Playwright tests, ADR addendum) — **no backend, dependency, CI, shared-component, or other-stage files**. Merged with a merge commit. CI on `main` for `2e55f69`: success.

**Deployment evidence:**

| Check | Result |
|---|---|
| Vercel production deployment of the exact merge commit | ✅ GitHub deployment `7109024042`, environment `Production`, sha `2e55f69`, state `success` ("Deployment has completed"), `https://stackspeak-da4u3teft-robert-leybas-projects.vercel.app` |
| Render backend | ✅ `/api/health` commit `97d31615269880988c0934554ab5998b2b010361` — unchanged (PR A revision); no backend deployment was required or made |

**Production acceptance** — Playwright (headless Chromium) against `https://stackspeak.vercel.app` + `https://stack-speak.onrender.com`, **13/13 passed**:

| Check | Result |
|---|---|
| Full six-stage journey + restart | ✅ at each of **320, 390, 768, 1024, 1440px** (stepper variant correct per width) |
| Trace shows exactly one exercise | ✅ one "Predict: what happens with an empty list?" region, one Reveal button, no "Case N" groups, call shown as `get_average([])` |
| Student's edited code shown | ✅ heading "Your current code"; the edited lines (`raise ValueError('empty')`, `sum(nums) / len(nums)`) present in the code panel |
| Starter-code label when unedited | ✅ heading "Starter code", "…this is the starter code", starter lines shown, no "Your current code" heading |
| Nothing answer-revealing before the reveal | ✅ page text contains no `Raises ValueError`, `ZeroDivisionError`, `Expected outcome`, or contract text until after "Reveal expected outcome" |
| Order enforced | ✅ Reveal disabled until a prediction exists; Continue disabled until the reveal **and** a comparison choice; Defend/review content not requested before Trace is completed |
| No fabricated results | ✅ "StackSpeak did not run your code" shown; no pass/fail/pytest/terminal/score/AI text |
| Drafts, navigation, restart | ✅ Trace prediction + edited code survive a reload; Back to Fix keeps the code and forward keeps the prediction; Start over (with confirmation) clears everything, still empty after a reload |
| Blocked `sessionStorage` | ✅ full flow completes, no errors |
| Error + retry | ✅ challenge load, `/trace` (500 → "Your answers so far are safe" → Try again), and `/review` failures all recover with answers intact |
| Keyboard | ✅ Enter/Tab/Space-only path through Fix → Trace → Defend; focus lands on each new stage heading; `aria-current="step"` on Trace |
| Overflow / errors | ✅ no horizontal overflow at any stage or width; zero console, page, or request errors; only GETs to `stackspeak.vercel.app` / `stack-speak.onrender.com`; no typed answer in any request |
| API unchanged | ✅ initial load spoiler-free; no `instructor_notes`/`evaluation_guidance`/hidden/`[42]` in any response; solution only in `/review`; `/trace` still serves all 4 public cases (the UI shows one); `no-store` on stage endpoints |
| Reference solution | ✅ absent from every `_next/static` asset; `/review` not requested before Feedback |
| Other stages + homepage | ✅ Read/Explain/Fix/Defend/Feedback behave as before inside the full journey; `/`, `/daily-challenge`, `/courses`, `/practice-lab`, `/interview-practice`, `/privacy`, `/terms`, `/progress` all 200, no overflow, no console errors; existing nav intact |

(One-off acceptance spec, not committed; it first reported 12/13 because of a stray click on a disabled button in the *test script*, not an app defect — the corrected test passed.)

**Known limitations:** unchanged from AUD-52, plus — Trace has no per-case navigation by design (the other three public cases are served by the API but not shown); the pre-existing draft marks for other cases are ignored (only the focus exercise gates Continue); the exercise keeps the challenge's generic `trace_prompts` wording ("…for each input"), which is backend content and was deliberately not changed.

## Outstanding

No release blockers remain. For future sprints, not this one:
- No persistence, auth, or code-execution sandbox — unchanged from Sprint 01, intentional. Challenge attempts/progression and stage persistence are explicitly deferred (see `docs/challenge-schema.md`). Homepage `Log in`/`Sign up` are intentionally disabled until auth is scoped.
- `npm audit` dev-only `braces` advisory — unchanged, documented in `docs/development.md`.
- Feature branches `aud-50-design-system-app-shell`, `aud-51-challenge-schema`, and `aud-54-homepage-figma-alignment` still exist on GitHub (not auto-deleted — repo's `deleteBranchOnMerge` is off); safe to delete, not done automatically.
- AUD-52 is fully released (PR A backend + PR B frontend, above). Follow-ups are in `docs/decisions/0002-aud-52-interactive-flow.md` — none are scheduled or approved.
