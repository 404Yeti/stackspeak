# Deployment — StackSpeak v0.1 Public Preview

**Status as of 2026-10-15: GitHub done. Render backend live and independently verified. Vercel not started — blocked, see "Outstanding."**

**Commit verification without dashboard access:** `/api/health` returns a `commit` field, read from Render's auto-injected `RENDER_GIT_COMMIT` env var (null outside Render) — `curl https://stack-speak.onrender.com/api/health | jq -r .commit` should equal `git rev-parse main`. Confirmed working below.

## Labeling

The deployed app must be clearly labeled **"StackSpeak v0.1 Public Preview"** (e.g. in the homepage badge/metadata) so visitors don't mistake it for a finished product. Sprint 01's existing "Sprint 01 — Application Foundation" badge on the homepage should be reviewed against this requirement before/at deploy time.

## GitHub

- **Repo:** https://github.com/404Yeti/stackspeak (public)
- **Default branch:** `main`
- Pushed commits: `2020956` (bootstrap) → `963e3d8` (owner review fixes) → `7f316e6` (brand approval docs) → `cbfd603`/`4062fb8` (deployment docs) → `3644afd` (commit-SHA health field) → `8b5695b` (docs)

## Backend → Render ✅ Live

| Setting | Value |
|---|---|
| Workspace | robert's workspace |
| Service | Stack Speak |
| Live URL | **https://stack-speak.onrender.com** |
| Health check | **https://stack-speak.onrender.com/api/health** |
| Plan | Free tier |
| Auto-deploy | Enabled |
| Database | **None provisioned** (as required) |

**Verified 2026-10-15** (independently, via direct `curl` to the public URL — no Render dashboard/API access used):
- `GET /api/health` → `HTTP 200`, body `{"status":"ok","service":"stackspeak-api","commit":"3644afd35096599bc7e8f132b016a06f6602c82a"}`
- Deployed commit `3644afd35096599bc7e8f132b016a06f6602c82a` matches `git rev-parse 3644afd` exactly (full 40-char SHA, byte-for-byte).
- At verification time `main` was one commit ahead (`8b5695b`, docs-only — `docs/deployment.md`, no application code) — not a functional gap; the running app is identical to current `main` in behavior. Auto-deploy is enabled, so Render should pick up the newer commit on its own; not forcing a redeploy for a docs-only diff.
- `STACKSPEAK_CORS_ORIGINS` still needs updating to the real Vercel origin once it exists (currently whatever was set during initial Render configuration — not yet changed by this agent).

## Frontend → Vercel — not yet created

See "Outstanding" below for the exact settings and what's blocking it.

## Remaining steps once Vercel exists

1. Update `STACKSPEAK_CORS_ORIGINS` on Render to the real Vercel origin; Render redeploys automatically.
2. Smoke test the live site: `/api/health` → 200, homepage shows backend "Online," nav/responsive/console checks at the same breakpoints used in the Sprint 01 review (1440/768/390/320px).

## Outstanding — Vercel only

Render's live status was verifiable with zero platform access — a public `curl` to `/api/health` was enough, since Render doesn't gate that endpoint. **Vercel is different: there's no equivalent public check, because the project doesn't exist yet.** Creating it and setting `NEXT_PUBLIC_API_URL` requires either dashboard access or an API token — a read-only workaround like the commit-SHA trick isn't available for a creation step.

Re-checked (multiple times across this deployment, most recently 2026-10-15): no Vercel connector, `VERCEL_*` env var, CLI binary, or `~/.vercel` config exists in this Claude Code environment. Same conclusion as for Render before its URL was shared: a product/environment boundary, not a broken connection, not affected by a ChatGPT-side connection to Vercel (separate products, separate connector ecosystems).

**To unblock, same pattern that worked for Render:** the owner creates the Vercel project (via its own connector/dashboard, same way the Render service was set up) with the settings below, then shares the resulting frontend URL. This agent then updates Render's CORS origin to match and runs the full smoke-test suite.

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build/install | defaults (`next build`) |
| Env var | `NEXT_PUBLIC_API_URL=https://stack-speak.onrender.com` |
| Plan | Free (Hobby) tier |
