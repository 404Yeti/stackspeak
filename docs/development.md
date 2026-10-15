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
- **Vitest CJS/ESM config warning:** `vitest.config.ts` logs a warning about native config loading and CommonJS; it's cosmetic (Vitest still runs), not an error.
- **`npm audit` shows a `braces` high-severity advisory:** it's a transitive dev-only dependency of `eslint-config-next` (nested `fast-glob` → `micromatch` → `braces`), not a runtime dependency. Fixing it via `npm audit fix --force` currently forces a major downgrade of `eslint-config-next` that breaks Next.js 16 compatibility — left as-is and tracked, not silently ignored.
- **Backend `ModuleNotFoundError` after creating the venv:** re-run `.venv/bin/pip install -e ".[dev]"` — a partial/interrupted install can leave transitive deps (e.g. `uvicorn`) present without the top-level packages (`fastapi`, `pydantic-settings`) they depend on.
- **`next dev` not picking up source changes on WSL (`/mnt/c/...`):** file-watching is unreliable on the 9p-mounted Windows drive — Next.js itself warns about this ("Slow filesystem detected"). If an edit doesn't show up after a save, don't assume the code is wrong: `rm -rf frontend/.next` and restart `next dev`. Seen concretely during the Sprint 01 review: a layout edit silently didn't recompile until the `.next` Turbopack cache was cleared.

## Browser QA (ad hoc)

Playwright + Chromium are installed as a `frontend` devDependency (`@playwright/test`) and were used during the Sprint 01 review to verify real rendering at 1440/768/390/320px — nav behavior, overflow, keyboard focus, and backend-health integration — since no project E2E suite exists yet. This is not wired into `npm test` or CI; it's a manual verification tool. To repeat it:

```bash
cd frontend
npx playwright install chromium   # one-time; first run needs network access
node your-check-script.mjs        # script must live under frontend/ so `playwright` resolves
```

If a project needs recurring browser QA, formalize this into a real E2E suite (and a project-level `run` skill) as a separate, scoped decision — not something to grow ad hoc.
