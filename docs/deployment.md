# Deployment — StackSpeak v0.1 Public Preview

**Status as of 2026-10-15: LIVE.** Both services deployed, integrated, and verified end-to-end in a real browser — nav, responsiveness, backend connectivity, and CORS all confirmed working. One open item: the homepage's visible "Sprint 01 — Application Foundation" badge doesn't match the required "StackSpeak v0.1 Public Preview" label (see "Outstanding").

## Live URLs

- **Frontend:** https://stackspeak.vercel.app/
- **Backend:** https://stack-speak.onrender.com
- **Health check:** https://stack-speak.onrender.com/api/health
- **GitHub:** https://github.com/404Yeti/stackspeak (branch `main`)

## GitHub

- Default branch: `main`
- Latest verified commit: `5e4480b` (also the commit Render reports running)
- History: `2020956` (bootstrap) → `963e3d8` (owner review) → `7f316e6` (brand approval) → `cbfd603`/`4062fb8` (deployment docs) → `3644afd` (commit-SHA health field) → `8b5695b` → `5e4480b` (deployment docs)

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

## Outstanding

- **Labeling gap:** the brief (two turns prior) required the deployed app be clearly labeled "StackSpeak v0.1 Public Preview." The homepage currently shows "Sprint 01 — Application Foundation" instead (`frontend/src/app/page.tsx`, hero badge) — accurate for the sprint, but not the public-facing label that was specified. Not changed as part of this verification pass, since this request was scoped to verification only ("report failures," not "fix them") — flagging for an explicit go-ahead before touching it.
- No persistence, auth, or code-execution sandbox — unchanged from Sprint 01, intentional.
- `npm audit` dev-only `braces` advisory — unchanged, documented in `docs/development.md`.
