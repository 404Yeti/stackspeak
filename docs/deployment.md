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

## Outstanding

No release blockers remain. For future sprints, not this one:
- No persistence, auth, or code-execution sandbox — unchanged from Sprint 01, intentional. Challenge attempts/progression and stage persistence are explicitly deferred (see `docs/challenge-schema.md`).
- `npm audit` dev-only `braces` advisory — unchanged, documented in `docs/development.md`.
- Feature branches `aud-50-design-system-app-shell` and `aud-51-challenge-schema` still exist on GitHub (not auto-deleted — repo's `deleteBranchOnMerge` is off); safe to delete, not done automatically.
- AUD-54 (homepage Figma alignment) remains blocked pending the approved frame's Figma URL — not part of this release.
