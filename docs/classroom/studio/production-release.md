# AUD-78 — Production release runbook

Owner approved two separate Production LOGIN identities and release of PR11.
The teacher password has already been rotated and is not rotated again.

## Database identity and configuration

`classroom_reader_production` and `classroom_writer_production` inherit only the
corresponding reviewed `classroom_reader` / `classroom_writer` capability role.
All new identities are NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/
NOBYPASSRLS. Membership explicitly grants INHERIT TRUE, SET FALSE, ADMIN FALSE.
There are no new object grants or policy changes. The capability roles own no
application objects. FORCE RLS remains on all four tables; Data API remains
owner-confirmed OFF. No public/schema exposure changes.

Migration `20261022223403_classroom_studio_production_roles.sql` creates the new
identities initially NOLOGIN; credential activation is separate. Remote history
version is20261022223924 (service-generated). Do not blindly run db push: the first
reviewed migrations also have different service-generated remote timestamps.
Destructive rollback SQL is only for disposable local clusters and was not run
remotely. No lessons are imported.

New independent passwords are generated with secure randomness, encrypted for
transfer, privately checked against stored SCRAM verifiers, and placed in the
Windows user's credential vault for controlled release automation. No password,
verifier or connection string enters source, chat, command arguments or logs.
Production reader and writer each authenticated twice over verified TLS with
current_user/session_user and restricted flags verified. Both succeeded immediately
in this run; the earlier synchronization issue was not reproduced. Retry policy
remains bounded to expected28P01, using the same password, with stop on other errors.

Remote actual capability matrices match the existing roles. Reader private draft,
vocabulary and guide SELECT and snapshot DELETE are denied. Both roles cannot
SET ROLE postgres/the capability role, create roles/objects, become SUPERUSER,
TRUNCATE or disable/bypass RLS. Writer draft/vocabulary/guide CRUD and publication/
revocation passed in a rolled-back synthetic transaction. Advisor: zero findings.
Sanitized evidence: [runtime](artifacts/production-runtime-results.json).

Four variables added exclusively to Vercel Production on frontend project
`robert-leybas-projects/stackspeak` (root frontend): sensitive reader/writer URLs,
encrypted CA and plain `CLASSROOM_CONTENT_SOURCE=studio`. All pre-existing variable
metadata matched baseline, including teacher password hash/session/origin/guides
and every Preview variable. [Scope proof](artifacts/production-variable-scopes.json).
No database NEXT_PUBLIC variable or service-role connection is used.

The server validates the exact environment-specific username, then queries
current_user/session_user and privilege flags before returning a database pool.
TLS certificate and hostname checks remain required. Connection pools retain
max2, prepare=false and bounded timeouts. Subsequent connections use the same
verified server/login configuration. Preview retains its exact original identities
and credentials. Preview and Production share this dedicated authoring database;
their owner-authorized writers can access the same lessons. Preview remains
protected by Vercel and the separate teacher session; this is credential separation,
not a separate dataset or database project.

## Release sequence and acceptance

Run local lint/typecheck/tests/build, disposable Postgres tests and targeted browser
workflow. Push the focused identity-validation changes plus sanitized documentation
on feat/classroom-studio. Wait for all CI checks. Keep Preview protected and verify
its unchanged teacher/database credentials still work. Merge PR11 via the repository
workflow, then verify the Production deployment's merge SHA and existing aliases.
Do not modify WAF, backend CORS, runner, AUD-60 or the rotated teacher password.

Use the existing Windows Credential Manager teacher entry for the actual Production
browser workflow: clearly labeled disposable lesson, save/edit/autosave and refresh,
vocabulary highlights, private guide, public-only draft preview, publish and open
from an anonymous context, edit snapshot isolation, republish, unpublish and genuine
HTML/API404, duplicate private draft, cleanup. Scan public responses/client assets
for actual credential and synthetic private-guide canaries. Verify the three reserved
source lessons200, private/unknown404 and Daily Challenge with Run Code OFF. Do not
pretend Preview's accepted Daily Challenge CORS limitation passed.

If a critical test fails, stop rollout and preserve sanitized evidence. The retained
password-only Production deployment `dpl_EcPQjoayATtdRCTUVwcasSkf6YWX` at stable
main15ca578 is the immediate rollback target. Instant Rollback restores that build's
runtime environment and current teacher password. Do not execute SQL rollback,
restore stale snapshots or import seeds. Authoring data stays available for a
forward fix; new links become unavailable rather than resurrecting revoked content.
The project's new DB variables remain configured but the old build does not use them.

Durable cloud recovery and extended enterprise monitoring/device matrices remain
follow-ups. New Studio links intentionally503 on DB failure; no stale/source recovery
fallback. Reserved existing source links stay available. The6KiB compressed public
snapshot limit and Free-plan availability remain MVP limitations.

Final deployment and Production acceptance evidence are recorded in AUD-78 and PR11
when the workflow completes; this runbook does not claim those pending steps passed.
