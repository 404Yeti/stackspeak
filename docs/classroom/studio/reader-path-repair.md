# AUD-78 — Student reader repair (2026-10-23)

## Confirmed cause

The application reader failed before sending its published-snapshot SELECT. The
new asynchronous database factory was used directly as a SQL template tag:

```ts
const rows = await (await database("reader"))`select ...`;
```

The optimized Next16.4.1/Turbopack build emitted the equivalent of:

```js
rows = await await database("reader")`select ...`;
```

The template invocation therefore targeted the Promise rather than the resolved
Postgres SQL function. Temporary **local-only** bounded diagnostics recorded
`TypeError: c7(...) is not a function` in the proxy bundle and
`TypeError: (0, l.f)(...) is not a function` in the public API bundle. No PostgreSQL
SQLSTATE was present. A JavaScript reproduction returned42 with the original
parentheses and threw TypeError with the emitted grouping. Direct TypeScript DB
integration tests did not exercise this production compilation transformation.

Request trace: `/exercises/:slug` proxy → `currentStudentSnapshot` → reader factory
→ incorrectly grouped tag call → caught TypeError → HTTP503 before streaming.
The public `/api/classroom/exercises/:slug` route called `publishedExercise` →
`currentStudentSnapshot` and caught the same error as503. Authentication/role
initialization could start, but the snapshot query was not executed. Writer calls
use the pool's `.begin()` method and were unaffected. This was application logic
in the built bundle, not credentials, TLS, connection failure, query grants or RLS.

The fixed source URL allowlist bypasses that reader operation; its three published
lessons remain200 and private source lesson404 in Studio mode. New DB-backed
published, draft/missing and revoked slugs all hit the defective tag operation and
returned503. The generic fail-closed response correctly hid the exception.

## Minimal repair

Await the reader into a local `sql` variable, then invoke its SQL template. The
new optimized artifact contains `let sql = await database("reader"); ... await sql\`select ...\``.
Apply this at both reader sites: `publicationSnapshot.ts` (Studio authority) and
`repository.ts` (existing local database/recovery mode). No database factory,
identity checks, grants, RLS, snapshot projection, pinning, fallback policy or
teacher authorization changed. No diagnostic logging was added to shipped code.

## Regression and verification

- `e2e-studio-api/reader-path.spec.ts`: a cold first reader request, draft HTML/API404,
  authorized publication, public HTML/API200 without private guide canaries,
  anonymous guide401 and repeated revocation404 against the optimized Next server.
  This exact new test failed on a2498e6 with503 at its first assertion, then passed
  with the two-statement repair.
- `e2e-studio-api/reader-outage.spec.ts`: a separate isolated server whose reader
  connects to loopback port1. Studio HTML/API503 with forged old snapshot input,
  no secret leakage, all three source lessons and APIs200, private source404 and
  teacher API401. `playwright.studio-api.config.ts` and the disposable DB harness
  enable this test-only scenario; no cloud credentials/settings are altered.
- Local lint/typecheck/build passed,225 unit tests passed,8 disposable Postgres
  tests passed separately,4 normal Chromium Studio UI/API tests passed and the
  separate outage test passed. Disposable migration rollback/reapply passed.
- Verification uses a native-filesystem copy to avoid known WSL worker startup
  timeouts. Temporary diagnostics were confined to that copy, then replaced with
  the clean worktree files before the passing run.

Hosted acceptance and final revision are recorded in AUD-78 and PR11 after the
protected Preview tests. Keep PR11 draft until the reader issue is resolved; do
not merge or deploy Production under this repair approval. Credentials, teacher
password, WAF, runner, AUD-60, CORS and cloud recovery infrastructure are unchanged.
