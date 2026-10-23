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

## Vercel authentication restored — pooler endpoint pending

The restored WSL Vercel credential authenticates as 404yeti and sees team
robert-leybas-projects (`team_NiPR0mQIdJXiXOnCbNEqb09K`). Verified frontend project
`stackspeak` (`prj_BlU64KE3PavF6PiLRnMCyyfc5UVL`), Next.js, root frontend,
404Yeti/stackspeak repository, main production branch. Existing deployment
protection is all_except_custom_domains and was not modified. No existing
feat/classroom-studio DB or authentication env variables were found. Existing
Production/other-branch metadata was snapshotted without values for later scope
comparison; no secrets were fetched/decrypted from those environments.

Supabase identity/restricted NOLOGIN flags and FORCE RLS were rechecked; the
Classroom tables remain empty. The direct db endpoint cannot be reached from this
WSL network. The connector provides no project pooler-configuration read method.
Owner has been asked for the non-secret Transaction pooler hostname from the
project's Connect dialog. Do not guess a regional pooler hostname or generate
passwords until the endpoint is verified. No new credentials/LOGIN flags/env
variables have been created yet.

Prepared private temporary encrypted-transport tooling and rollback-only runtime
permission probes (syntax checked). Runtime login and write tests have not run.
Existing approval remains valid; resume at endpoint verification when supplied.
No push/deploy/import/Production/WAF/runner/AUD-60 changes.

## Runtime connection acceptance — passed; Vercel branch gate prevents storage

Owner supplied exact transaction pooler host
`aws-0-ap-northeast-2.pooler.supabase.com`; TCP 6543 is reachable. Both existing
roles were enabled with independent 32-byte cryptographically random passwords,
stored by Postgres as SCRAM-SHA-256. Generation occurred server-side; plaintext
passwords were never SQL tool literals or tool output. Only public-key encrypted
transfer ciphertext left that boundary; local decryption passed values in memory
to the runtime client and HTTPS Vercel API. No administrator credentials entered
app runtime. Initial encryption-key compatibility failure rolled back before role
alterations; corrected transport succeeded.

The pooler uses Supabase's private CA, so default system trust correctly rejected
its chain. Downloaded the public Supabase Root 2021 CA over HTTPS from Supabase's
certificate distribution; SHA256 fingerprint
807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA.
Added optional server-only CLASSROOM_DATABASE_CA_CERT support to database.ts,
validating PEM/CA status and size while retaining rejectUnauthorized=true and
normal hostname checking. No verification bypass, host-check override, system
trust-store modification or database SSL-setting change. Documented reference:
https://supabase.com/docs/guides/platform/ssl-enforcement.

Actual authenticated runtime tests through the intended pooler passed:

- Both identities matched classroom_reader/classroom_writer; TLS chain/hostname
  verification enabled using the CA; restricted role flags and FORCE RLS checked.
- Reader SELECT on published snapshots passed. Draft, guide, vocabulary SELECT
  and snapshot DELETE were denied.
- Writer draft/vocabulary/guide create/read/update/delete plus snapshot publish/
  unpublish and deferred publication constraints passed within a synthetic
  transaction that was rolled back. No lesson import or persisted test content.
- Both denied SET ROLE postgres, CREATE ROLE, SUPERUSER escalation, disabling RLS,
  CREATE TABLE in classroom and TRUNCATE. row_security=off could not bypass RLS.
- The actual application's database.ts module also connected as both intended
  roles with verified TLS. Security advisor returned zero findings; all four
  Classroom tables remained empty after testing. No grants were changed.

Vercel configuration attempted exactly four variables on the verified frontend:
reader URL and writer URL as sensitive; CA certificate as encrypted; content source
as plain seed. All had target=[preview], gitBranch=feat/classroom-studio.
**Vercel rejected the request: Branch feat/classroom-studio not found in the
connected Git repository.** No variables were created. Sanitized diagnostic retry
confirmed that same prerequisite; complete env metadata comparison matches the
pre-change baseline, including Production, existing Preview branches and runner
flags. Deployment protection unchanged. No attempt to use global Preview scope
or another branch as a workaround.

Since push/deployment remain unauthorized, both roles were returned to NOLOGIN
and their newly generated passwords cleared (PASSWORD NULL); no grants changed.
Temporary encrypted credentials/key material are discarded after leakage checks.
Runtime acceptance above is proven, but **persistent Preview configuration is not
complete**. Once the branch exists through a separately approved remote-branch/
deployment sequence, regenerate fresh credentials under the existing approval,
re-run connection checks and create the four branch-only variables. Do not reuse
the discarded passwords. Do not push merely to bypass this gate: a Git push may
trigger an automatic deployment and requires the corresponding explicit approval.
Preview owner-auth configuration is also absent on this branch and needs its
approved setup before teacher access. Hosted publishing remains gated on the
independent durable cloud adapter. No push, deploy, import, Production/WAF/runner/
AUD-60 change was made.

Local CA-support verification: lint/typecheck/build passed; full Vitest rerun with
two workers passed 209 tests (6 DB tests skipped there and passed separately).
An initial unrestricted worker run timed out two existing scrypt tests and caused
one dependent busy-counter failure; the controlled-concurrency rerun passed with
no auth changes. Disposable Postgres integration and local rollback/reapply passed.
Actual runtime application-module connections passed before credentials were
cleared. Generated-password leakage scan passed across 316 tracked files, Git
history/diffs, and 38 built browser assets. No server-only DB configuration names
were found in browser assets. Temporary encrypted credentials and GPG private key
material were removed. Final catalog confirms no runtime sessions, original ACLs,
API denial and FORCE RLS preserved; both runtime passwords are NULL/NOLOGIN.
