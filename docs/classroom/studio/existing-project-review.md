# AUD-78 — Existing project review and conditional Preview plan

Target supplied by owner: `hljdwcwvtbozzpplssxw`.
Date: 2026-10-22. No remote changes authorized or performed.
This supersedes all earlier proposals to create a project or use Audli.
Do not create another organization/project or reuse `fopyknjekizcgrazisnq`.

## Inspection result: access blocked

The connected Supabase integration returned `You do not have permission to
perform this action` for both `get_project` and this read-only query:

```sql
select current_user, session_user, current_database(),
       current_setting('server_version') as server_version;
```

`list_organizations` still returns only Audli; `list_projects` returns only its
older project. The new project's name, organization, region, plan, contents,
Data API configuration and database privileges are therefore **unverified**.
This is an integration authorization mismatch, not evidence that the project is
missing or unsuitable. Reconnect/authorize Supabase for the new organization or
project with metadata/configuration read and database read-only inspection access.
No passwords, API keys or service-role credentials should be pasted into chat.

## Comparison and inspection pending

| Architecture requirement | Existing-project evidence |
| --- | --- |
| Dedicated StackSpeak project | Owner supplied exact ref; integration cannot inspect it |
| Singapore `ap-southeast-1`, Free suitable for disposable Preview | Region/plan unknown; no new cost quote or upgrade authorized |
| No conflicting application data/schema/roles | Unknown; never infer an empty database from a newly created project |
| Data API disabled, classroom unexposed | Unknown; SQL settings alone cannot prove gateway disabled |
| Restricted runtime roles, no API-role membership | Unknown; verify catalogs and effective grants |
| Migration operator can create schema/roles/functions/policies | Current integration cannot execute even SELECT; DB operator privileges unknown |
| Independent durable public recovery store | Not provided by project selection; separate cloud adapter gate remains |

After access is corrected, inspect project/organization metadata and billing plan;
list non-system relations, migration history, routines and role names/memberships.
Use catalog metadata/row estimates first, not lesson content or Auth records. If
application relations exist, report schema/count evidence without reading rows,
and obtain an explicit reviewed coexistence decision before migrations. Check
`classroom` and `classroom_reader`/`classroom_writer` collisions, effective default
privileges, inherited API-role grants, RLS, and operator CREATE/CREATEROLE ability.
Read the management Data API enablement/exposed-schema configuration; if unavailable
through the connector, ask for owner confirmation of that exact dashboard setting.
An unauthenticated REST 401 alone does not establish whether Data API is enabled.

## Exact migration proposal — pending inspection and approval

Apply only these committed files, in order, to **hljdwcwvtbozzpplssxw only**:

1. `supabase/migrations/20261022064757_classroom_studio.sql`
   SHA-256 `b0052bac872c5d22884239494072833b185f1bb0416c81364ecf51bbf8e013f9`
2. `supabase/migrations/20261022073257_classroom_studio_incomplete_vocabulary.sql`
   SHA-256 `77f1c1bd4c6c41311ba47351f3e31ab07489aaf8638e7b681b1c1be20eaa1add`

The first adds private `classroom` schema, exercises/vocabulary/teacher_guides/
published_exercises, constraints, indexes, security-invoker functions/triggers,
reader/writer NOLOGIN roles, FORCE RLS and explicit grants/revokes. It intentionally
fails on role/schema collisions. The second permits incomplete draft vocabulary;
publication validation remains strict. No seed import or deletion is included.
Review any operator-specific inherited default grants before applying; verify
actual effective permissions afterward rather than relying solely on migrations.

Record a pre-change schema/migration inventory and private backup if any data
exists. Use individually transactional, recorded migrations; stop on any conflict,
never reset the remote database. No destructive rollback script remotely. On
failure roll back the transaction; after success preserve data and disable Studio
integration pending a reviewed forward correction. Source-backed student delivery
is independent and remains active.

Separate approval is needed to enable the existing NOLOGIN runtime roles as logins
with independently generated private passwords (SCRAM), and to disable Data API if
currently enabled. Do not grant either role to authenticator/anon/authenticated/
service_role. Reader accesses only published snapshots; writer handles authorized
teacher operations. Migration/admin credentials never enter app runtime. Validate
custom-role pooler login and verified TLS before storing runtime URLs. A read-only
connector is not proof of migration permission; do not probe by creating objects.

## Exact Preview environment plan — pending separate approval

Scope: protected Vercel **Preview**, feature branch `feat/classroom-studio` only.
No Production or other branch scope. Use the existing project only after verifying
its intended Preview isolation; the project has not yet been approved for live
content or Production use.

| Variable | Proposed value/source |
| --- | --- |
| `CLASSROOM_DATABASE_READER_URL` | Secret Postgres URL with `classroom_reader.hljdwcwvtbozzpplssxw` custom-role pooler username, unique reader password, dashboard-verified pooler host, port 6543 and database postgres |
| `CLASSROOM_DATABASE_WRITER_URL` | Same verified host/project, distinct `classroom_writer.hljdwcwvtbozzpplssxw` username/password |
| `CLASSROOM_CONTENT_SOURCE` | `seed` — retain all existing published lessons source-backed |
| `CLASSROOM_PASSWORD_HASH` | Existing auth format; separately generated Preview-only owner password hash |
| `CLASSROOM_SESSION_SECRET` | New random Preview-only session secret, never Production reuse |
| `CLASSROOM_ORIGIN` | Exact approved protected Preview origin; otherwise existing trusted Vercel branch-origin handling, no wildcard |
| `CLASSROOM_RECOVERY_DIR` | Unset in hosted Preview; local files are explicitly unsupported on Vercel |
| Runner flags | Remain OFF; do not change runner configuration |

The hostname is deliberately not guessed from an unverified region. Remote TLS
certificate verification stays enabled; transaction pooling uses prepare=false and
max two connections per runtime role/process. No NEXT_PUBLIC database values,
Supabase browser clients, anon/publishable/service-role keys, admin URLs or real
guide JSON are introduced by this plan. Existing source guide configuration is
kept separate; migration does not import its values.

**Current hosted limitation:** draft CRUD could be enabled with approved DB
credentials, but publish/unpublish/import require durable publication storage and
will return unavailable on Vercel. Do not represent that as full hosted acceptance.
Complete and test a cloud adapter using an independent durable registry and
immutable public-only snapshots, conditional concurrent writes, deny tombstones,
freshness checks and rollback fence before hosted publication/student DB delivery.
Its provider/resources/credentials require a separate concrete plan and approval;
no guessed environment variables or resources are part of this proposal. The
current importer is loopback-only; real remote import also needs a reviewed path
and separate approval, with dry-run/parity evidence and no overwrites.

After approved migrations/configuration, verify role-level denial of draft/guide
reads for reader/API roles, expected writer behavior, Data API HTTP denial,
protected teacher login/CSRF, and source-backed student URL availability. Full
hosted workflow acceptance waits for the cloud recovery adapter; Production
cutover, merge, deployment and live data import remain separate gates.

Reference: [Supabase Data API grants, RLS and disabling the API](https://supabase.com/docs/guides/api/securing-your-api).
