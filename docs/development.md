# Development

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- (Future sprints) Postgres 15+ — not required for Sprint 01

## First-time setup

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

## Environment variables

Copy `.env.example` → `.env` at the repo root, then split values into:

- `frontend/.env.local` — `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000` if unset)
- `backend/.env` — all `STACKSPEAK_*` settings (see `backend/app/core/config.py`)

Never commit a real `.env` file. Nothing in `backend/.env` should ever be duplicated into a `NEXT_PUBLIC_*` frontend variable.

## Running locally

```bash
# Terminal 1 — backend (http://localhost:8000)
cd backend
.venv/bin/uvicorn app.main:app --reload

# Terminal 2 — frontend (http://localhost:3000)
cd frontend
npm run dev
```

Visit `http://localhost:3000`. The homepage's "System status" section calls the backend's `/api/health` endpoint directly — if it shows "Offline," the backend isn't running or `NEXT_PUBLIC_API_URL` is wrong.

## Commands

| | Frontend (`frontend/`) | Backend (`backend/`) |
|---|---|---|
| Dev server | `npm run dev` | `.venv/bin/uvicorn app.main:app --reload` |
| Lint | `npm run lint` | `.venv/bin/ruff check app tests` |
| Type check | `npm run typecheck` | `.venv/bin/mypy app` |
| Tests | `npm test` | `.venv/bin/pytest` |
| Production build | `npm run build` | n/a (ASGI app, no build step) |

## Troubleshooting

- **Vitest worker timeout on WSL (`/mnt/c/...` paths):** the default `forks` test pool can time out spawning workers on a 9p-mounted Windows drive. `vitest.config.ts` already sets `pool: "threads"` to avoid this — if you hit it again, that's the first thing to check.
- **`npm test` intermittently reports "Timeout waiting for worker to respond" / "Failed to start threads worker" for a few files, not a consistent set (AUD-50):** this is a hardcoded 60s worker-boot handshake timeout inside Vitest's bundled code (`node_modules/vitest/dist/chunks/index.*.js`: `START_TIMEOUT = 6e4`) — **not exposed via any config option**, confirmed by reading that source directly. On this sandbox, Vitest's own diagnostics measured ~53.6s worker spawn+environment setup per file — right at that ceiling — and this sandbox also runs other unrelated concurrent agent sessions competing for CPU, which is enough to tip some files over 60s. Every test file passes reliably when run alone or in a small 2–3 file batch (`npx vitest run path/to/a.test.tsx path/to/b.test.tsx`); it's specifically the full ~13-file suite in one invocation that's unreliable here. **Do not set `isolate: false`** as a fix — it was tried and caused an outright worker crash (`Worker exited unexpectedly`), most likely `next/image`'s module-level state not tolerating being shared across files in one worker. This is very unlikely to reproduce in CI (a dedicated Linux runner, not a shared WSL/9p sandbox) — if it does, re-investigate rather than assuming this note still applies verbatim.
- **Vitest CJS/ESM config warning:** `vitest.config.ts` logs a warning about native config loading and CommonJS; it's cosmetic (Vitest still runs), not an error.
- **`npm audit` shows a `braces` high-severity advisory:** it's a transitive dev-only dependency of `eslint-config-next` (nested `fast-glob` → `micromatch` → `braces`), not a runtime dependency. Fixing it via `npm audit fix --force` currently forces a major downgrade of `eslint-config-next` that breaks Next.js 16 compatibility — left as-is and tracked, not silently ignored.
- **Backend `ModuleNotFoundError` after creating the venv:** re-run `.venv/bin/pip install -e ".[dev]"` — a partial/interrupted install can leave transitive deps (e.g. `uvicorn`) present without the top-level packages (`fastapi`, `pydantic-settings`) they depend on.
- **`next dev` not picking up source changes on WSL (`/mnt/c/...`):** file-watching is unreliable on the 9p-mounted Windows drive — Next.js itself warns about this ("Slow filesystem detected"). If an edit doesn't show up after a save, don't assume the code is wrong: `rm -rf frontend/.next` and restart `next dev`. Seen concretely during the Sprint 01 review: a layout edit silently didn't recompile until the `.next` Turbopack cache was cleared.

## Browser tests (Playwright smoke suite)

`frontend/e2e/` holds a small Playwright suite for the Daily Challenge flow (AUD-52): the full journey at 320/390/768/1024/1440px, loading/error/retry states, refresh and blocked-`sessionStorage` behavior, and the public/private boundary (stage content is only requested when its stage is reached; the reference solution never appears in the DOM before Feedback or in the built bundle; nothing the student writes is sent anywhere). It runs against the **real FastAPI backend** and a **production Next.js build**; failures are simulated per-test with `page.route()`.

```bash
cd frontend
npx playwright install chromium   # one-time
npm run build
npm run e2e                       # starts uvicorn (:8000, needs backend/.venv) and `next start` (:3000)
```

It runs in CI as the `e2e` job. It is not part of `npm test` (Vitest excludes `e2e/`). For ad-hoc one-off checks, a script under `frontend/` that imports `playwright` still works.
