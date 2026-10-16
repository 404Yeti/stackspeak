# StackSpeak Python runner

Static, separately-deployed host for running student Python in the browser (Pyodide in a hardened module Web Worker). Deployed as its **own Vercel project on a different site** from the app.

Start with [`docs/python-runner.md`](../docs/python-runner.md) (architecture, exact headers, deployment, threat model, release gates) and [`docs/decisions/0003-python-runner.md`](../docs/decisions/0003-python-runner.md).

```bash
npm ci && npm run build && npm test
```

`vercel.json` is **generated** (`npm run generate`) from `config/runner.config.json` and committed; CI fails on drift. Approved parent origins change only through a reviewed edit to that config.
