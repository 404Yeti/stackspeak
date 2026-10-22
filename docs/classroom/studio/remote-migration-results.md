# AUD-78 — Remote migration execution, 2026-10-22

Target: `hljdwcwvtbozzpplssxw`, project stackspeak, Stackspeak organization,
Seoul ap-northeast-2. Owner explicitly approved both exact file hashes and
confirmed Data API OFF. Preflight verified identity/healthy Postgres17, empty
migration history, no schema/role collisions, operator CREATE/CREATEROLE, no
conflicting global default grants, and unchanged SHA-256 values. The connector
cannot read the Data API dashboard toggle; owner confirmation is the configuration
evidence. Fresh HTTP probes returned authentication errors and were not treated
as independent proof of the toggle.

Applied through the migration service, sequentially, with each unchanged file
body enclosed in explicit BEGIN/COMMIT. Both returned success.

| Approved local file | SHA-256 | Recorded remote version/name |
| --- | --- | --- |
| 20261022064757_classroom_studio.sql | b0052bac872c5d22884239494072833b185f1bb0416c81364ecf51bbf8e013f9 | 20261022084453 / classroom_studio |
| 20261022073257_classroom_studio_incomplete_vocabulary.sql | 77f1c1bd4c6c41311ba47351f3e31ab07489aaf8638e7b681b1c1be20eaa1add | 20261022084502 / classroom_studio_incomplete_vocabulary |

The management migration service generates execution-time versions. History
contains exactly these two entries, in order, and recorded SQL contains the
corresponding approved operations. Local filenames/checksums remain unchanged.
**Do not run a blind CLI db push**: reconcile this documented filename/version
mapping through a separately reviewed history/baseline procedure first, or it
could try to reapply CREATE ROLE/SCHEMA. No history repair was performed.

## Verification

- Private classroom schema, four expected tables, four security-invoker functions
  with pg_catalog search_path and no PUBLIC EXECUTE, three enabled triggers
  (two initially deferred publication constraints), five expected policies.
- All four tables ENABLE/FORCE RLS; all 39 catalog constraints validated; ten
  expected explicit/implicit indexes. Vocabulary max-term constraint present,
  old minimum-term constraint absent; key/size/order checks preserved.
- Reader/writer NOLOGIN, NOINHERIT, no superuser/CREATEDB/CREATEROLE/BYPASSRLS.
  Only postgres holds administrative memberships; inherit/set options are false.
  No runtime memberships for API roles. Neither runtime role can CREATE in schema
  or TRUNCATE tables. Writer can execute the four internal functions; reader and
  all API roles cannot.
- Effective privilege matrix: API roles anon/authenticated/service_role/
  authenticator have no schema usage or table SELECT/INSERT/UPDATE/DELETE/TRUNCATE.
  Reader has schema usage and SELECT only on published_exercises, no private-table
  access. Writer has intended SELECT/INSERT/UPDATE/DELETE on the four tables.
- Read-only transaction executed 16 actual SELECT denial probes under the four
  API roles across all four tables: all denied, including drafts and guides.
- A broader read-only probe stopped when SET ROLE classroom_reader was denied:
  managed postgres membership has SET=false. Its transaction performed no writes.
  No privileges were broadened to work around it. Runtime reader/writer connection
  smoke tests remain pending approved login/password configuration; their current
  restrictions were verified through effective ACLs and RLS catalogs.
- All four tables contain zero rows. No lessons/private guides imported.
- Supabase database security advisor: `lints: []` (zero findings).

No destructive rollback, credential creation, Preview secrets, pushes, deployment,
Production/WAF/runner changes or delivery cutover. Source-backed lessons unchanged.

## Next separate approval

Approve enabling the existing classroom_reader/classroom_writer roles as logins
with distinct privately generated passwords and configuring branch-scoped protected
Vercel Preview credentials/auth for feat/classroom-studio only, using this exact
project and verified custom-role pooler host/TLS. Keep CLASSROOM_CONTENT_SOURCE=seed.
Never store migration/admin/service-role credentials in app runtime. Verify actual
reader/writer login, grant enforcement and password handling before Preview use.
No deployment or import is included in that approval.

The currently proposed Preview env plan is in existing-project-review.md. Hosted
publishing remains blocked until an independently durable cloud publication adapter
is completed/tested and its configuration separately approved. Do not configure a
local filesystem recovery directory on Vercel. Full hosted workflow acceptance,
lesson import, protected deployment and Production cutover remain later gates.

## Approved runtime configuration phase — blocked before mutation

The owner approved restricted runtime LOGIN/password setup and branch-only
Preview DB secrets. Preflight on 2026-10-22 confirmed both existing roles remain
NOLOGIN with no superuser/CREATEDB/CREATEROLE/BYPASSRLS. No grant changes needed.
Postgres supports secure random generation and public-key encryption; SCRAM-SHA-256
is configured. Password provisioning must keep plaintext out of tool arguments,
outputs and logs (DDL statement logging is enabled); use a reviewed secure channel,
not literal passwords in SQL tool requests or shell arguments.

Vercel has no currently connected plugin. Existing local CLI authentication was
checked without printing its value and returns 403 forbidden / Not authorized for
user, teams, and project listing, including the previously linked team. The
original checkout's local project link names stackspeak-runner, so it was not used
as a destination and was not modified. Correct frontend project identity and
branch-scope capabilities cannot yet be verified. Connect Vercel or renew CLI
login for the frontend owner/team, then resume the already authorized phase.
Do not paste Vercel or database tokens into chat.

No passwords were generated, no role LOGIN flags were changed and no secrets were
configured. No runtime authenticated connection/permission tests can be claimed.
Effective grants and prior API-role denial results above remain valid, but actual
runtime login tests are pending. No push, deployment, lesson import, Production,
WAF, runner or AUD-60 changes occurred. Deployment approval will be requested only
after credential configuration and the protected Preview plan are reviewable.
