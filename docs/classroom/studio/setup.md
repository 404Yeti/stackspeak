# Classroom Studio local foundation — AUD-78

This is the database/API foundation on `feat/classroom-studio`, not a finished
Studio UI or a deployed feature. No remote Supabase project is connected.

## Infrastructure proposal for approval

| Setting | Proposed value |
| --- | --- |
| Project name | `stackspeak-classroom-studio` (new dedicated project; never the unidentified existing project) |
| Region | Singapore, exact AWS `ap-southeast-1` |
| Database | Standard Supabase Postgres 17, Micro compute on Pro for eventual Production |
| Data API | Disabled; `classroom` never added to exposed schemas; automatic new-table exposure disabled |
| Access | Server-only Postgres reader/writer roles, TLS certificate verification, small pools, prepared statements disabled for transaction pooling |
| Credentials | New private, distinct migration/reader/writer credentials; no browser key or service-role credentials used |
| Backups | Pro daily backups (7-day retention), private export before import/cutover; restore rehearsal before Production |
| Other products | No Supabase Auth integration, Storage, Realtime, Edge Functions or paid add-ons needed |
| Preview isolation | Local disposable DB now. Proposed later separate project `stackspeak-classroom-studio-preview` with synthetic data and distinct credentials; no preview writer ever connects to Production |
| App region | Evaluate future Vercel Classroom server placement near Singapore before deployment; no current Vercel region/configuration change |

Singapore is a nearby available region for Vietnam; that is a geographic
recommendation, not a measured latency claim. The request path is browser →
Next.js server → Postgres, so the app server's location matters too. Validate
pooler/custom-role support and latency in protected Preview. Primary data would
be stored in Singapore, not Vietnam.
[Official available regions](https://supabase.com/docs/guides/platform/regions).

Pricing checked 2026-10-22: Free is US$0/month (500 MB database, pauses after a
week of inactivity), suitable for disposable acceptance rather than availability
requirements. Pro starts at US$25/month for the organization, with US$10 compute
credit covering one Micro project. A second full-time Micro project adds about
US$10/month, so a dedicated Pro organization with Production + Preview Micro is
about **US$35/month**, before taxes/overages. If an existing Pro organization's
compute credit is already used, each new Micro adds roughly US$10/month to that
organization's existing subscription. Confirm the intended organization and
current bill before provisioning. Use Pro spend cap where available; compute
charges are still payable. No PITR, IPv4 add-on, custom domain or branching charge
is included. Supabase database pricing does not include existing Vercel/Render.
[Official pricing and compute credits](https://supabase.com/pricing).

Recommended **next provision only**: a new dedicated `stackspeak-classroom-studio-preview`
project in Singapore, Pro Micro, approximately US$25/month total in a new Pro
organization (or roughly US$10 incremental if existing Pro credit is consumed).
Do not create the eventual Production project `stackspeak-classroom-studio` yet.
Both names refer to new dedicated StackSpeak resources; neither reuses the
unidentified project. This is a concrete proposal awaiting approval.

Exact next approvals needed, none implied by this document:

1. Choose the Supabase organization/billing owner and approve the new dedicated
   project name, Singapore region and plan/budget. Recommended eventual baseline:
   Pro Micro; choose whether the **first provisioned project** is an isolated
   Preview project (recommended) or reserve Production and approve a second one.
2. Approve the reviewed migration file `supabase/migrations/20261022064757_classroom_studio.sql`
   against the **identified new project only**, plus enabling only the two runtime
   logins with privately generated credentials. Configure disabled Data API and
   verify exposed schemas/grants/RLS/role memberships. No existing database reuse.
3. Approve Preview-only sensitive reader/writer URLs and existing teacher auth
   configuration for the exact protected feature-branch scope. No Production
   secrets, credential reuse, bypass tokens or weaker deployment protection.
4. Approve protected Preview deployment and synthetic import/acceptance. Real
   lesson/guide import requires a reviewed dry-run and separate approval; never
   overwrite conflicts. Production migration, secrets, cutover, merge and deploy
   remain separate later approvals after recovery/status/browser gates pass.

No provisioning is necessary to continue local Studio UI and import-tool work.

## Local setup and tests

```bash
cd frontend
npm ci
npx next typegen
npm run lint
npm run typecheck
npm test -- --maxWorkers=2
npm run build
# Uses installed Postgres server tools; creates a fresh loopback-only cluster.
# If not under /usr/lib/postgresql/17/bin, set STACKSPEAK_TEST_PG_BIN.
npm run test:studio:db
# Optional: same disposable DB plus real browser login/HTTP API acceptance.
npm run test:studio:browser
```

The DB script creates and stops its own temporary cluster on 127.0.0.1:55479;
there is no remote URL option. It creates synthetic Supabase API roles, applies
migrations in transactions, enables local trust-auth runtime logins, runs the
repository integration suite, drops the disposable schema/roles and reapplies
migrations. Its local trust authentication must never be used on a hosted project.
`supabase/tests/rollback.sql` is destructive and for that disposable test only.
Routine Production rollback retains data and uses the architecture recovery plan.
The local test runner reports an error if the fixed test port is occupied.

For manual local API development, initialize a **new local** database using the
migration and activate classroom_reader/classroom_writer as local logins. Set
only in gitignored `frontend/.env.local`:

```dotenv
# Local examples, no real credentials. Remote connections must use verified TLS.
CLASSROOM_DATABASE_READER_URL=postgres://classroom_reader@127.0.0.1:55478/postgres
CLASSROOM_DATABASE_WRITER_URL=postgres://classroom_writer@127.0.0.1:55478/postgres
```

Keep existing local teacher auth configuration (see the Classroom README).
Do not use runtime administrator credentials. Connection code rejects usernames
other than classroom_reader/classroom_writer (including supported pooler suffix),
requires a password remotely, strips URL query overrides and verifies remote TLS.
The private-schema tests check privileges even for a synthetic BYPASSRLS role.
No Supabase SDK/API key is required. CLI is pinned as a dev dependency; migration
files were created with `supabase migration new`. Local config disables API/auth/
storage/realtime and does not modify hosted settings. Docker is unavailable in
this environment, so the tests use real local Postgres 17 server binaries rather
than a full Supabase/PostgREST stack. Hosted HTTP denial checks remain pending.

## API contract

Teacher endpoints under `/classroom/api/studio/exercises`:

- GET: search/language/difficulty/topic/status/offset/limit query parameters.
- POST: `{ "language": "Python", "title": "Optional title" }` → new draft, 201.
- `[id]` GET: authoring DTO (draft, metadata, lockVersion), excludes private guide.
- `[id]` PATCH: `{ expectedVersion, draft: { content, vocabulary } }`.
- `[id]` DELETE: `{ expectedVersion }`, only after unpublishing.
- `[id]/guide` GET/PUT: separate guide DTO; PUT `{ expectedVersion, guide }`.
- `[id]/preview` GET: student-safe draft projection.
- `[id]/duplicate`, `[id]/publish`, `[id]/unpublish` POST: `{ expectedVersion }`.

Private handlers authorize before parsing/lookup; mutations require the exact
configured Origin, application/json and <=256 KiB actual streamed body. No GET
mutation. Responses are private/no-store/nosniff. Standard errors: 401 session,
403 Origin, 404 absent, 409 stale version/state, 413 size, 415 media type, 422
validation, 503 storage/configuration. No SQL error values or private bodies logged.

Public GET `/api/classroom/exercises/[slug]` uses **only** reader credentials and
strictly validated snapshots; returns 404 for draft/unpublished/missing and 503
for storage failure. It never reads teacher tables or falls back to seeds. This
new API is separate from existing source-backed student pages during this phase.

All new fields and bounds are in `src/lib/classroom/studio/validation.ts`.
Incompletely authored drafts are legal. Publish requires title/description/topic,
objectives, Read instructions/code, explanation questions, a Fix task/starter and
completed vocabulary. Private guides are optional; missing answers are never
invented. Noncontiguous one-based vocabulary references stay tied to Read code.
Public snapshots use version 1 on first publish and increment on republish;
lockVersion covers all mutations, including guide changes. Title changes never
change slugs. Draft edits do not change live snapshots; unpublish removes them
transactionally. No private guide is part of preview, snapshot or library DTOs.

## Verification record

See AUD-78's local implementation comment for final results. The local permission
suite covers API-role rejection, reader/writer privileges and FORCE RLS; CRUD,
reconnection persistence, vocabulary order/lines, stale-save rejection, guides,
preview/public isolation, duplication and snapshot publish/unpublish; SQL identity,
public-field and publication-consistency constraints; destructive local rollback
and reapply. HTTP unit tests cover authentication-before-lookup, CSRF, payload
limits, validation, no-store and generic errors. Existing tests remain required.

Still deferred: Studio UI/autosave, source import tooling and parity cutover,
publication-safe recovery artifact, hard status for existing HTML exercise pages,
physical/mobile acceptance and any hosted configuration/deployment. No local
unit test is evidence that a hosted project's Data API has been disabled.

## Local results — 2026-10-22

| Check | Result |
| --- | --- |
| Frontend lint / typecheck / build | Passed; final build includes all new dynamic API routes |
| Full Vitest | 188 passed; 4 DB tests skipped in default run and passed separately |
| Final security/projection tests after authorization-module cleanup | 11 passed |
| Real Postgres 17 integration | 4 passed, including SQL grants/RLS, persistence, guide isolation, publication and constraints |
| Disposable local migration rollback/reapply | Passed |
| Browser login + real HTTP Studio API acceptance | 1 passed (Chromium), final build; actual public API 404s verified |
| Local Production-mode HTTPS security suite | 4 passed (Chromium/Firefox); Secure cookies, private reveal, CSRF/method/redirect protection and anonymous isolation |
| Existing Classroom, Chromium + Firefox | 16 passed, including both Python/C# lessons and unavailable-storage preservation of existing public URLs |
| WebKit Classroom | 1 request-only check passed; 7 browser scenarios could not launch due missing host libraries (GTK4/GStreamer/libsoup and others); Safari browser acceptance remains pending |
| Existing Daily Challenge browser regression | 25 passed at 320–1440px, including no Run Code/runner requests |
| Backend pytest / Ruff / mypy | 21 passed / clean / clean (11 files) |
| Runtime dependency audit | Zero vulnerabilities; existing development ESLint/fast-glob dependency tree reports five high-severity audit entries, left outside this change |

A Windows-mounted full unit run was superseded because of slow filesystem access;
one Classroom server startup also timed out there. Final verification ran from
`/tmp/stackspeak-studio-verify`, with 156 source/test/config files byte-compared
to the feature worktree. No real private guides or credentials were used. The
isolated PostgreSQL test cluster stops and removes its disposable data afterward.
No physical iOS/Safari or hosted Supabase acceptance is claimed.
