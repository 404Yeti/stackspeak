# AUD-78 — Production release preflight (2026-10-22)

**Current release:** the separate Production identities are approved and configured;
see [Production runbook](production-release.md). Earlier pending-decision text is historical.

**Update:** Vercel access and Production teacher authentication are resolved by
[the completed password rotation](production-teacher-rotation.md). The remaining
blocker is only the Production/Preview database-role credential decision below.
Earlier access/password prerequisites are historical and no longer required.

Owner approved Production configuration, merge and deployment, accepting the
existing Preview-only Daily Challenge CORS limitation. No Production mutation,
password rotation, merge or deployment has occurred in this release attempt.

## Verified

- PR11 remains draft/mergeable, head exactly `abe81847b7a4a488d78c401f519ba4074d12dc79`,
  base `15ca578a39ffcb8b2ba69f037448a2348507a738`.
- GitHub CI frontend/backend/e2e/runner and Vercel checks all successful.
- No subsequent frontend/backend/migration changes. Uncommitted changes are the
  prepared hosted acceptance documentation and sanitized synthetic artifacts.
- Supabase project `hljdwcwvtbozzpplssxw`, stackspeak, Seoul, ACTIVE_HEALTHY.
- Exactly two Classroom roles exist: classroom_reader and classroom_writer,
  both LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS. FORCE RLS remains enabled on all
  four tables. Only postgres has membership in those roles.

## Stop before configuration: conflicting credential requirements

The new instruction says fresh independent Production passwords for the existing
roles AND do not disable working Preview credentials. Each PostgreSQL role has
one password verifier. Rotating either existing role invalidates Preview's
existing connection secret, so these instructions cannot both be fulfilled using
only those two role identities. Old pooled sessions are not a safe second password.
Do not rotate or remove Preview configuration while awaiting this decision.

Proposed minimal adjustment for approval (no project, paid infrastructure or
application table changes): add `classroom_reader_production` and
`classroom_writer_production` as restricted LOGIN identities, with no elevated
role flags. Grant each only the corresponding existing role's privileges via
explicit inheritable membership, with ADMIN and SET membership options false.
Existing roles/passwords/grants/policies remain untouched. Existing FORCE RLS and
role-specific policies apply through this membership. The database URL username
allowlist in database.ts must accept the exact new identity for the matching
reader/writer connection; never accept arbitrary role names. Add focused tests
and rerun CI/Preview before merging the revised commit. Do not apply this proposal
without approving the two identities and the small implementation change.

Alternative requiring explicit acceptance of a brief Preview interruption:
coordinate rotation of existing reader/writer passwords, test each twice using
unchanged credentials with bounded28P01 retries, update branch Preview and
Production variables, then redeploy Preview and verify it. Previous immutable
Preview builds would lose DB authentication. This conflicts with the current
preserve-working-Preview instruction unless separately accepted.

For either approved path: privately verify SCRAM, two successful TLS connections
per identity, actual SELECT/CRUD/RLS/escalation tests, then create Production-only
reader/writer URL and CA variables and studio mode. Preserve current Production
teacher auth/session/origin/guides. Merge via repository workflow only after
checks pass, monitor Production deployment SHA, run the disposable smoke lesson,
unpublish and verify404. Roll back on critical failure as documented.

## Access prerequisites

Vercel's saved CLI token returned403/forbidden on user identity verification and
project access. No Vercel connector is available. Reauthenticate in WSL with
`npx --yes vercel@65.1.0 login`, using the account with access to
`robert-leybas-projects/stackspeak`. Do not paste tokens into chat.

Only the independent Preview teacher password is available locally. To test
Production login without changing existing authentication, place the existing
Production password in the private local file
`~/.local/share/stackspeak/classroom-production/teacher-password` (directory0700,
file0600), or provide a securely authenticated browser session when available.
Do not send the password in chat or commit it.

WAF, runner, AUD-60, Production and existing Preview credentials are unchanged.
