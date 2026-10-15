# Deployment — StackSpeak v0.1 Public Preview

**Status as of 2026-10-15: GitHub done. Render deployment reportedly configured by the owner in "robert's workspace," unverified pending a URL (no Render connector/API access from this agent). Vercel not started.** See "Outstanding" below.

**Commit verification without dashboard access:** `/api/health` now returns a `commit` field, read from Render's auto-injected `RENDER_GIT_COMMIT` env var (null outside Render). Once a URL is available: `curl <render-url>/api/health | jq -r .commit` should equal `git rev-parse main`. This requires Render's "Auto-Deploy" to be on for the service, or a manual redeploy after this change (`3644afd`) reaches `main`.

## Labeling

The deployed app must be clearly labeled **"StackSpeak v0.1 Public Preview"** (e.g. in the homepage badge/metadata) so visitors don't mistake it for a finished product. Sprint 01's existing "Sprint 01 — Application Foundation" badge on the homepage should be reviewed against this requirement before/at deploy time.

## GitHub

- **Repo:** https://github.com/404Yeti/stackspeak (public)
- **Default branch:** `main`
- Pushed commits: `2020956` (bootstrap), `963e3d8` (owner review fixes), `7f316e6` (brand approval docs)

## Backend → Render (planned, not yet executed)

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `pip install .` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/api/health` |
| Env vars | `STACKSPEAK_ENVIRONMENT=production`, `STACKSPEAK_CORS_ORIGINS=["https://<vercel-domain>"]` (JSON-array string — pydantic-settings parses list env vars as JSON) |
| Database | **None provisioned.** Nothing reads `STACKSPEAK_DATABASE_URL` yet — don't add Postgres until a sprint actually needs persistence. |
| Live URL | _pending_ |

## Frontend → Vercel (planned, not yet executed)

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build/install | defaults (`next build`) |
| Env var | `NEXT_PUBLIC_API_URL=https://<render-backend-domain>` — baked in at build time, so the backend must be deployed first |
| Live URL | _pending_ |

## Deploy order (backend must go first)

1. Deploy backend to Render with a placeholder/permissive CORS origin, confirm `/api/health` returns 200 publicly.
2. Deploy frontend to Vercel with `NEXT_PUBLIC_API_URL` pointed at the Render URL from step 1.
3. Update `STACKSPEAK_CORS_ORIGINS` on Render to the real Vercel URL from step 2; redeploy backend.
4. Smoke test the live site: `/api/health` → 200, homepage shows backend "Online," nav/responsive/console checks at the same breakpoints used in the Sprint 01 review (1440/768/390/320px).

## Outstanding

**Re-checked 2026-10-15 after the owner reported connecting Render/Vercel to ChatGPT.** Confirmed via three independent checks in this Claude Code environment:
1. Searched this session's full tool catalog (the same mechanism that surfaces the Figma and Linear tools used elsewhere in this project) for any Render/Vercel connector — none found.
2. Scanned environment variables for `VERCEL_*`/`RENDER_*` — none found.
3. Checked for `vercel`/`render` CLI binaries and `~/.vercel`/`~/.render` config directories — none found.

**Conclusion:** Render and Vercel are not integrated as connectors in this Claude Code environment at all — this is a product/environment boundary, not a broken or misconfigured connection, and not something a ChatGPT-side connection affects (separate products, separate connector ecosystems). The agent cannot create or configure services on either platform without one of:

- An API token (`VERCEL_TOKEN`, `RENDER_API_KEY`) made available to this environment through a supported mechanism (not pasted inline in chat), so the CLIs can run non-interactively, or
- The project owner performing the dashboard setup directly in **"robert's workspace"** on Render (free tier) and the equivalent on Vercel, using the exact settings tables above, then sharing the resulting URLs back so the agent can run the CORS-update step and smoke tests.

This file will be updated with real URLs, final verification results, and any configuration changes once deployment actually completes.
