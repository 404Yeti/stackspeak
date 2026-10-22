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

## Successful reconnection — read-only verification (2026-10-22)

This section supersedes the access-blocked result above. Project lookup and SQL
now succeed. Project `stackspeak`, ref `hljdwcwvtbozzpplssxw`, belongs to
`Stackspeak` (`wvldylznneaykkaomxxf`), plan Free (`tier_free`). Status is
ACTIVE_HEALTHY, Postgres 17.11 (platform 17.11.0.003). Actual region is Seoul,
`ap-northeast-2`, **not** the proposed Singapore `ap-southeast-1`. No region change
or new resources are proposed without approval; owner acceptance of this
architecture difference is pending.

Catalog inspection found standard Supabase schemas (auth/storage/realtime/vault/
extensions/graphql/public), no application relations, no classroom schema and no
classroom_reader/writer roles. Project migration history is empty. This establishes
no detected application-schema conflict; built-in schemas contain platform
objects/migration records and their user data was not read. The database is not
literally empty, and catalog row estimates are not proof that all platform tables
contain zero records.

The inspection connection is postgres/session postgres, reports CREATEROLE=true
and database CREATE=true. These are suitable prerequisite privileges for the
reviewed schema/role migration; no DDL permission was exercised and hosted DDL
success is not yet proven. Runtime credential/login availability remains untested.
Existing postgres default grants apply to public/storage, not globally or to the
new classroom schema. The migration's private-schema revokes and FORCE RLS remain
compatible. No changes to public/storage defaults are included or needed for this
private schema.

Data API enablement/exposed-schema management configuration is **still unknown**:
this connector has no settings-read tool and SQL returned no pgrst role settings.
No-key REST probe returned 401 No API key found. Read-only probes using the
connector-returned public key metadata returned 401 (Secret API key required /
Invalid API key). None establishes disabled Data API. Key values were not printed,
committed, configured or created; no secret/service-role keys were requested.
Owner should inspect the target project's Data API integration overview and
settings and confirm Enable Data API is OFF and classroom is not exposed. Do not
change it under this read-only authorization.

**Readiness:** schema-compatible candidate with required operator privileges;
first remote migration remains gated on region acceptance, Data API configuration
confirmation, and explicit approval of the two exact migration files listed
above. Credential enablement, Preview secrets, import and deployment remain
separate approvals. Existing lessons stay source-backed. The independent cloud
recovery adapter remains required before hosted publishing/database cutover.
No remote mutations or local application changes were made in this inspection.

## Migration readiness review — region accepted, Data API confirmation pending

The owner accepted the existing Seoul region. Do not create a replacement project.
Enable Data API OFF is still awaiting owner confirmation; no setting was changed.
The two migration files were reread in full and their SHA-256 values recomputed;
both exactly match the previously reviewed hashes. This is a static review, not
remote execution or a new permission test.

Apply order and expected final objects (only after explicit approval):

1. `20261022064757_classroom_studio.sql`: creates two restricted NOLOGIN roles,
   private schema `classroom`, four tables (exercises, vocabulary, teacher_guides,
   published_exercises), four security-invoker functions (keys_allowed,
   safe_student, protect_exercise, check_publication), three triggers
   (exercise_identity, exercise_publication, snapshot_publication), five RLS
   policies (writer on each table, published_reader on snapshots), one explicit
   library index, and implicit primary/unique indexes. Adds UUID/default/timestamp,
   identity, payload-size/key, language/difficulty, slug, ordering, foreign-key,
   uniqueness and publication-consistency constraints. Applies explicit schema/
   table/function grants and revokes, default privilege restrictions, ENABLE and
   FORCE RLS on all four tables. No SECURITY DEFINER functions or public RPC.
2. `20261022073257_classroom_studio_incomplete_vocabulary.sql`: drops the original
   generated `vocabulary_entry_check3` minimum-term-length constraint and adds
   named `vocabulary_term_length` limiting terms to 120 characters. The original
   draft field-key checks remain; complete vocabulary is enforced by server
   publication validation. Adds no tables, roles or data.

This matches the approved separate draft/student snapshot model, server-only
private guide model, stable published identity and existing authentication.
Database checks are defense in depth; detailed JSON validation, teacher session/
CSRF authorization and publish completeness remain application responsibilities.
No migration imports content, enables LOGIN, sets passwords, configures Data API,
changes public/storage grants, selects student delivery mode or deploys code.

Run each recorded migration transactionally. Immediately before execution recheck
the target ref and collisions/history to account for drift. Verify expected
objects, FORCE RLS, role memberships and effective denial for API roles/reader
against drafts and guides after execution, without exposing private content.
Do not connect Preview before the separate runtime credential/secrets approval.

Rollback: if a migration fails inside its transaction, abort it and verify no
partial objects/history were committed. If the first migration succeeded and the
second fails, retain the first (the stricter draft constraint is safe), stop and
review; do not reset/reapply blindly. After successful schema creation, keep the
schema/data and leave the application source-backed while preparing a reviewed
forward correction. Do not execute `supabase/tests/rollback.sql` remotely: it
CASCADE-drops the schema and roles and exists solely for disposable local tests.
Any later teardown would require a separate approved object inventory, backup,
dependency check and explicit destructive authorization. No cloud recovery adapter
is required merely to install an unused private schema; that adapter must be
complete and tested before hosted publishing or database-backed student cutover.

Pending approvals are distinct: owner confirmation Data API OFF; explicit apply
approval for these two exact files on hljdwcwvtbozzpplssxw; later runtime role login/
credentials and branch-scoped Preview secrets; later protected Preview deployment.
Production, WAF, runner and source-backed published lessons remain unchanged.
