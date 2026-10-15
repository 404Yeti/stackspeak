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
