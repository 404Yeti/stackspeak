# AUD-78 — Release stopped on critical reader failure

**Repair update:** the cause is confirmed and a focused repair is under test;
see [reader-path repair](reader-path-repair.md). The stop evidence below is historical.

Revision: `a2498e64870598f1152471aa9bd42ee3a99027c5`, PR11 remains draft/unmerged.

The newly added authenticated-role guard passed225 unit tests and8 disposable
Postgres integration tests. Local lint/typecheck/build passed. Actual Supabase
reader/writer authentication passed twice each, with exact identities, TLS,
capability matrices, FORCE RLS and privilege-denial tests verified. Advisor zero
findings. The Production role migration and four Production-only variables are
configured; Preview identities/passwords and teacher authentication were untouched.

**Critical application checks failed; do not merge or deploy this revision.**

- Disposable Chromium teacher workflow could create/save/publish, but the anonymous
  student HTML link returned503 instead of200.
- Separate HTTP workflow got503 instead of404 for an unpublished student API URL.
- Protected hosted Preview at the same revision confirmed the issue: original
  teacher password/login and writer-backed library returned success, while
  `/api/classroom/exercises/nonexistent-aud78-preview-check` returned503 instead
  of404. Vercel outer protection remains enabled.

This is an application reader-path regression despite passing direct database
connection tests. No private-data exposure was observed: the application fails
closed. Root cause is not yet established; do not blame pooler synchronization or
rotate credentials without evidence. The username/identity/pool initialization
change and its proxy/student API context need focused diagnosis. No fix or further
rollout was applied after confirming the failure.

Production remains verified password-only deployment
`dpl_EcPQjoayATtdRCTUVwcasSkf6YWX`, main15ca578, not Studio. Its existing domains,
rotated teacher password, WAF and runner remain unchanged. No disposable Production
exercise has been created. The local browser fixtures were synthetic and discarded
with their disposable cluster. Remote capability checks used a rolled-back
transaction. No source lessons were imported.

GitHub frontend/backend/e2e checks passed; runner was still running at the stop.
These broad checks do not cover the failing database-backed hosted reader path.
The authenticated Preview library check confirms its original credentials remain
valid; its newly deployed application reader path is currently degraded.

Resume only after reporting this critical failure to the owner and approval for
a focused reader-path fix/retest. Keep the configured restricted Production roles
and scoped secrets unchanged while diagnosing; retain the current Production
rollback deployment. Do not merge PR11 based solely on otherwise green CI.
