# Classroom Studio — Phase A (AUD-78)

Status: Phase A proposal with approved local increments, 2026-10-22. The original
assessment below is historical; see the local UI/recovery update at the end and
[implementation runbook](local-studio.md) for current delivered behavior. No hosted
deployment is claimed. Branch `feat/classroom-studio` starts from
`origin/main` `15ca578a39ffcb8b2ba69f037448a2348507a738` (released AUD-53).
The isolated checkout is `/mnt/c/Users/Lenovo/projects/stackspeak-studio`;
the original checkout's AUD-60 diagnostic edits are untouched.

Tracking: [AUD-78](https://linear.app/failed-training/issue/AUD-78).

## Existing implementation and compatibility

| Area | Evidence / consequence |
| --- | --- |
| Catalog | `frontend/content/classroom/exercises.json`: four records, loaded and validated at module load in `src/lib/classroom/content.ts`; publication is currently a source edit plus deployment. |
| Public links | `/exercises/python-loop-accumulator`, `/exercises/python-default-argument`, `/exercises/csharp-linq-deferred` must remain unchanged. `csharp-await-task` is draft/private. All existing IDs equal their slugs; preserve them in import metadata and public DTOs. |
| Student boundary | `schema.ts` uses nested allowlists; `sharedExercise` requires published AND public. Keep both semantics during transition. |
| Teacher boundary | `/classroom`, `/classroom/exercises/[slug]` authorize at page and data access. `/classroom/api/guide/[slug]` checks session before lookup and returns private/no-store/nosniff. |
| Guides | `guides.ts` authorizes before reading runtime `CLASSROOM_GUIDES_JSON` or a local external file; 48 KiB cap; never imported from source. Owner-supplied guides are required for migration; do not read/print real values during design. |
| Authentication | `auth.ts`: scrypt owner password, origin/hash-bound HMAC session, eight-hour expiry; host-only HttpOnly cookie, Secure on HTTPS, SameSite Strict, path `/classroom`. Exact configured Origin for login/logout POST. No Supabase Auth or student accounts. |
| Workspace | `ClassroomWorkspace`, `SupportPanel`, `CodeLines`, `CodeInput`, `HighlightedCode`: Read → Explain → Fix, local answers/code, presentation, guide reveal, syntax preview. Reuse these. No execution or grading. |
| Schema gaps | Current difficulty supports Beginner/Intermediate; add Advanced consistently. Language type includes JavaScript/C++ but seeds use Python/C#; Studio creation initially offers only Python/C#. Preserve filenames, duration, topics/tags, question IDs, version, public Fix hints and private per-question answers. |
| Vocabulary | `readLines` is an explicit one-based array relative to Read code, including noncontiguous references; `speakingPrompt` is separate from new pronunciation notes. Preserve both. |
| HTTP status | Student page calls `notFound()` inside `/exercises/layout.tsx` Suspense. AUD-53 confirms streamed HTTP 200 for missing/draft links. Existing mocked route tests prove denial, not wire status. A real HTTP regression is required. |
| Infrastructure | Next.js 16.4.1/React 19.3, Cache Components and partial prefetching; FastAPI remains separate. No Supabase dependency/config/migrations or Classroom DB connection exists in tracked main. `STACKSPEAK_DATABASE_URL` is an unused backend placeholder, not evidence of Supabase integration. |
| Deployment security | AUD-53 release issue records Production login WAF v3 and separate protected Preview credentials. Older tracked readiness docs describe pre-release state. Do not infer current settings from those proposals or modify WAF. Re-read deployment metadata before any approved deployment. |

Supabase read-only discovery returned one healthy project named `supabase`, ref
`fopyknjekizcgrazisnq`, in `ap-northeast-1`. Its ownership/purpose is unconfirmed.
No tables, credentials or contents were inspected. Do not attach StackSpeak to it
without an explicit owner decision. Live Vercel secret values/settings were not
inspected in Phase A; there is no claim that the live environment lacks a DB.

Existing tests inspected: `auth.test.ts`, `content.test.ts`, `guides.test.ts`,
`Routes.test.tsx`, Classroom component tests, Classroom browser suite and hosted
HTTPS security suite. They cover login/session/CSRF, seeded filtering, guide
isolation, vocabulary focus, Python/C# workspace, presentation and anonymous
sharing. There are no persistence/CRUD/autosave/migration tests yet.

## Proposed architecture

Keep Classroom in Next.js Node server modules. Add a typed server-only repository
under `frontend/src/lib/classroom/studio/`, request validators and explicit DTO
builders. Existing content/guide entry points become adapters to the repository.
No new FastAPI hop, auth system, execution service or student submission storage.

Use Supabase **Postgres**, via a pinned server-only Postgres driver and a small
TLS pool through the transaction pooler for serverless requests. Disable prepared
statements if required by the selected pooler/driver. Use separate restricted
reader and teacher-writer database logins; never runtime `postgres`, service-role
keys, browser Supabase access or a migration-owner connection. Proposed private
env names: `CLASSROOM_DATABASE_READER_URL`, `CLASSROOM_DATABASE_WRITER_URL`, and
`CLASSROOM_CONTENT_SOURCE=seed|database`. These are new proposed variables only.
Migration credentials stay outside app runtime. No values in Git or logs.

Use a non-Data-API-exposed `classroom` schema, explicit grants, RLS on all tables,
and no grants to PUBLIC/anon/authenticated/service_role. Runtime roles cannot
create objects, alter schema, bypass RLS or inherit the migration owner. Reader
can SELECT only public release rows and metadata for published visibility; writer
can CRUD exercise content/guide rows through the authorized application boundary.
Policies target these dedicated roles, not `auth.uid()`: the current owner cookie
is not a Supabase JWT. Reader has zero guide privileges. Writer credentials are
available only inside server-only authorized data-access modules. The trusted
Next.js server enforces owner identity; RLS does not independently verify cookies.
No SECURITY DEFINER shortcuts or public RPC functions are needed.

## Logical schema and constraints

Drafts may be incomplete; publication requires the strict publish validator.
SQL constraints always enforce structural validity, limits and relationships.
Use `timestamptz`, database defaults/triggers for timestamps and UUID generation.

| Table | Columns / constraints |
| --- | --- |
| `classroom.exercises` | `id uuid PK default gen_random_uuid()`, `legacy_id text UNIQUE NULL`, `slug text UNIQUE NOT NULL` (lowercase hyphenated, 1–100 chars), `title text` (0–200), `description text` (0–4000), `language text CHECK IN ('Python','C#')`, `difficulty text CHECK IN ('Beginner','Intermediate','Advanced')`, `topic text` (0–100), `topics text[]`, `tags text[]`, `learning_objectives text[]`, `filename text` (1–120), `minutes int` (1–240), `starter_code text`, `student_instructions text`, `read_content text`, `read_code text`, `explain_questions jsonb`, `fix_task jsonb`, `publication text CHECK IN ('draft','published')`, `sharing text CHECK IN ('private','public')`, `version int > 0`, `lock_version bigint > 0`, `created_at`, `updated_at`, `published_at NULL`, `sort_order int NULL`, `import_source text UNIQUE NULL`, `import_checksum text NULL`. Code fields max 20,000 chars each. Questions retain stable IDs; Fix task retains instructions, buggyCode and public hints. Arrays/JSON checked for type and bounded count; strict nested shape in request/load validators. |
| `classroom.vocabulary` | `id uuid PK default gen_random_uuid()`, `exercise_id uuid FK exercises ON DELETE CASCADE`, `term text` (1–120), `definition text` (0–2000), `example text` (0–2000), `pronunciation text NULL` (0–500), `speaking_prompt text NULL` (0–1000), `read_lines int[] NULL` (positive, unique, max 500 entries), `position int >= 0`; UNIQUE(exercise_id,position) deferrable for reorder. Validate upper line bound against Read code in same transaction; reject stale references after code edits on publish. |
| `classroom.teacher_guides` | `exercise_id uuid PK/FK exercises ON DELETE CASCADE`, `ideal_explanation text`, `spoken_explanation text`, `expected_solution text`, `debugging_guidance text`, `teaching_hints text[]`, `follow_up_questions text[]`, `private_notes text`, `answers jsonb`, `misunderstandings text[]`, `updated_at`. Answers preserve questionId/spokenExample/listenFor; validate links against current questions. Code max 20,000 chars, prose max 8,000 per field, arrays max 50 entries each. Kept out of every public query/projection. |
| `classroom.published_exercises` | `exercise_id uuid PK/FK exercises ON DELETE CASCADE`, `slug text UNIQUE`, `student_payload jsonb NOT NULL`, `version int > 0`, `published_at timestamptz`. One immutable-until-republished student snapshot, created only from the explicit public DTO; strict validator rejects extra fields. No guide fields. Not a revision history. |

The one public snapshot is necessary so autosave never publishes unfinished
changes. No full revision history/tag join tables/collaboration records for MVP.
`publication=published` means a public snapshot exists; the editor can have newer
unpublished edits. Dashboard distinguishes Published / Published · unpublished
changes / Draft. A checksum of student content detects pending changes; guide-only
edits do not change public content. Retain current public payload `id` via
`legacy_id ?? id`, and original slugs/version on import.

Index unique slugs/import_source/legacy_id, vocabulary(exercise_id,position),
exercises(publication,updated_at DESC,id), and published_exercises(slug).
Use bounded parameterized ILIKE search plus language/difficulty/topic/status
filters and cursor pagination (50 maximum) initially; no search service. Query
plans on realistic fixtures determine whether further search indexes are needed.
No hard delete for published records: unpublish first. Draft deletion is explicit.

Publication transaction locks the exercise, checks expected lock_version, validates
all public content and references, atomically replaces the public snapshot and
sets published/public and published_at; database constraints/deferred trigger
enforce snapshot/publication consistency at commit. Autosave cannot set these
fields. Unpublish deletes the snapshot and marks draft/private atomically.
All saves increment lock_version and updated_at. Slugs freeze after first publish;
unpublishing must not allow changing them. Keep first-publication history via a
separate `first_published_at` field (never cleared); published_at records latest
publish and may remain as history after unpublishing. Add both in the migration.

## Endpoints and request boundaries

| Route | Behavior |
| --- | --- |
| `/classroom/studio` | Authorized library; reuse Classroom shell, search/filter controls and tokens. |
| `/classroom/studio/[id]` | Authorized editor with Content/Vocabulary/Teacher Guide/Preview tabs. |
| `/classroom/api/studio/exercises` GET/POST | Authorized paginated summaries / create incomplete draft with server UUID and generated unique slug. |
| `/classroom/api/studio/exercises/[id]` GET/PATCH/DELETE | Authorized authoring DTO excluding guide; validated atomic draft aggregate save; draft deletion. |
| `…/[id]/guide` GET/PUT | Authorized private guide DTO loaded only on guide-tab demand. Never hydrate guides in initial pages. |
| `…/[id]/duplicate` POST | Atomic copy with new IDs/slug; always draft/private, no snapshot or inherited publish dates. Copy guide only server-side; response omits it. |
| `…/[id]/preview` GET | Authorized draft student projection, private/no-store; no public preview token/route. |
| `…/[id]/publish`, `…/[id]/unpublish` POST | Validated, concurrency-checked transaction. Publish returns canonical student URL. |
| Existing `/classroom/api/guide/[slug]` | Preserve authenticated response shape; map DB guide fields into the existing guide DTO. |
| Existing `/exercises/[slug]` | Anonymous published snapshot only; no draft/guide query. Missing/unpublished = actual HTTP 404. |

Every Studio handler verifies session before lookup; mutations also require exact
`sameOrigin`, application/json and bounded streamed body (256 KiB aggregate,
including chunked requests). Reject unknown fields, arbitrary publication/ID/
timestamp changes, invalid line references, excess arrays and invalid JSON.
Return 401 anonymous APIs, 403 foreign/missing Origin, 404 missing resources,
409 stale version, 413 oversized body, 415 content type, 422 field errors, 503 DB
unavailable. No login redirects from JSON endpoints. Repeat authorization inside
repository writer/guide entry points. Parameterize every SQL value; allowlist sort
columns. Render prose as React text, never arbitrary HTML/MDX. No code executes.
Teacher responses/errors use private/no-store/nosniff and generic error text;
logs contain identifiers/operation outcomes only, never bodies/guide text/secrets.

Teacher Guide is intentionally visible to the authorized teacher editor after
fetching; “server-side” means private storage and authorized delivery, not an
impossible promise to edit it without sending it to its authorized browser.
Keep private guide state out of student preview props, browser persistence,
analytics, metadata, static generation, caching, console output and test artifacts.

## Studio behavior

Reuse existing brand/tokens, Classroom CSS and code editor overlay with line
numbers; no Monaco dependency needed for this MVP. Content includes existing
filename/duration/public hints and per-question IDs in addition to requested
fields. Keep Read code separate from Fix starter code. New Read prose/objectives
and pronunciation require small additive public DTO/render changes with smoke
tests. Existing `speakingPrompt` remains intact. Support accessible tabs, focus
management, inline errors and vocabulary move-up/down controls.

Debounce autosave by 1 second, one in-flight save per exercise, coalesce newer
edits, show Unsaved/Saving/Saved/Error with a live status. Keep edits in memory;
do not persist private guide content to localStorage/sessionStorage. Manual Save
flushes pending edits. Content/vocabulary aggregate and guide saves both use
expected lock_version; consume the returned version, never apply stale responses.
409 stops autosave with explicit reload/reconcile choice, including competing
tabs for this single owner. Expired session stops saves and preserves local form
until reauthentication. Warn on internal navigation and beforeunload while dirty;
never report Saved on failure. Publish waits for acknowledged saves and warns
about unsaved guide changes. Preview can render the current validated student
projection without publishing; key the workspace by preview content version to
reset its local state deliberately. No private-guide prop and `teacher=false`.

## Genuine HTTP 404 gate

Do not assume moving `notFound()` or removing one loading component fixes status
under Cache Components. First build a local spike using actual production-mode
HTTP requests, including chunked HTML and RSC navigation. Preferred approach is
a minimal Node `proxy.ts` visibility check for `/exercises/:slug` before any
streaming: query only the public repository; directly return a small accessible
404 response for absent/unpublished records and 503 for DB failure. Valid requests
continue to the existing page, which still checks publication. Validate this
against pinned Next.js runtime/support and deployment constraints before choosing
it. Publication can change between checks; test the race and ensure there is no
draft leakage. If the race prevents the strict status guarantee, use a blocking
route boundary/route handler design that resolves visibility and response status
once before streaming, with a narrowly scoped student rendering adaptation.
This spike is the first Phase B gate, not a promised fix. No async root layout
or auth overhaul; no pre-generated slug list that requires redeploying to publish.

## Migration, cutover and rollback

1. Prepare local migrations only after design approval: roles/grants/schema/tables,
   indexes, constraints/triggers and RLS; seed synthetic fixtures in a disposable
   local DB. Pin CLI/driver; generate migration filenames with CLI. No remote push.
2. Implement a server-side CLI importer defaulting to dry-run. Read the existing
   catalog and owner-supplied external guide file/runtime secret without logging
   either. Validate using compatibility adapters. Report counts/slugs/conflicts,
   never guide prose. Missing guides are explicit, not fabricated; students may
   retain published lessons while teacher guide reports unavailable.
3. Assign deterministic import_source keys (`aud53:<legacy-id>`) and canonical
   checksums. Insert exercise/vocabulary/guide/snapshot in one transaction per
   exercise. On rerun, same key+checksum = skip; differing data/slug collision =
   fail/report, never overwrite. Guide import has its own checksum/state so a
   missing guide can be supplied later without overwriting content or an edited
   guide. Unique constraints handle concurrent runs. No upsert-update defaults.
4. Compare all four records field-for-field and three public DTOs before/after;
   verify guide availability/isolation without printing answers. Keep original
   source catalog and runtime guide fallback intact until approved migration is
   verified. Existing private source draft was already accepted as public Git
   material under AUD-53; all newly authored drafts remain private in DB.
5. Deploy only to an approved protected Preview with isolated non-production DB
   and credentials. Import there only after remote-write approval. Prove full
   workflow, isolation, wire 404, restart persistence and rollback before asking
   for Production migration/cutover permission.
6. Cutover is global and explicit via CLASSROOM_CONTENT_SOURCE, never “try DB then
   seeds on missing row/error.” Database mode treats missing/unpublished as 404
   and outage as 503. Otherwise source fallback would resurrect unpublished seed
   lessons. No per-record fallback for DB-owned guides either.

Safe rollback is maintenance/read-only first: stop Studio mutations, retain DB
and export a private recovery backup, record publication state. Rolling back to
seeds can resurrect lessons intentionally unpublished since import and lose all
newly published URLs. Therefore do not flip to seed mode after authoring begins
without an approved publication-safe recovery manifest (public snapshots and
explicit suppression of unpublished legacy slugs) or a verified restored DB.
Prepare/test the manifest-backed read-only recovery adapter in Phase D, outside
public Git; no private guides in it. Prefer reverting app code while retaining
backward-compatible DB adapters. Do not drop schema on routine rollback. Local
down-migration destructive tests use disposable synthetic DBs only. No overwrite,
remote restore or destructive migration without specific approval.

## Implementation and acceptance sequence

| Phase | Scope / exit evidence |
| --- | --- |
| A (this change) | Assessment, design, Linear and branch. No executable migration, app changes, provision or deployment. |
| B | Prove hard-404 boundary; local migrations, least-privilege repository, validators, CRUD/guide/publish endpoints. DB transaction/permission/isolation tests; migrations apply cleanly and rollback/reapply on disposable DB. |
| C | Library + editor, syntax editing, vocabulary order/references, guide, actual student preview, autosave/conflicts/navigation warnings. Review existing Figma nodes 40:717/718/719 and component tokens before UI implementation; Studio-specific layout needs a documented adaptation/design review. |
| D | Dry-run/import tooling, seed parity and collision tests, explicit data-source switch, publication-safe rollback. Existing links and Python/C# behavior preserved. |
| E | Approval for protected preview deployment and remote test-DB migration/secrets; full acceptance. Separate explicit approval for Production migration, merge and deployment. |

Required automated tests: unauthorized page/API/data-access; valid/tampered/expired
session; same-origin/missing-origin/forwarded-host rejection; payload limits and
SQL/HTML inputs; CRUD and duplication; incomplete draft persistence after process
restart; autosave debounce/order/retry/409/session expiry; vocabulary CRUD/reorder/
noncontiguous lines/stale references; guide-only edits; publish validation,
atomic snapshot replacement, edits leaving live content unchanged, unpublish;
anonymous reads after warmed teacher responses; private-field canaries absent
from student DTO/HTML/RSC/JS/metadata/preview; genuine HTTP 404 for unknown/draft/
unpublished including former seed lessons; DB outage 503 without resurrection;
legacy DTO parity and links; Python/C#/Advanced rendering; import rerun/conflict/
partial failure and rollback publication behavior. No real guides in fixtures.

Run frontend lint, typecheck, Vitest, production build, relevant Classroom browser
suites (Chromium/Firefox/WebKit, desktop/mobile widths), full existing Daily
Challenge regression with Run Code OFF; backend pytest, Ruff, mypy as required
by AGENTS.md. No changes to runner/AUD-60 or flag-ON execution tests for Studio.
Use synthetic credentials/guides, traces off, no secret-bearing artifacts.

## Decisions needed before remote work

- Approve this architecture and draft-versus-live publishing behavior.
- Identify the intended Supabase organization/project: approve a separate
  StackSpeak project or explicitly authorize use of a verified existing one.
  Decide region, plan/budget, preview isolation and backup/restore expectations.
- After local implementation is reviewable, approve the exact remote migrations,
  roles, import dry-run result and private environment variable scopes. Supply
  canonical guides through a private channel/configuration, never chat/Git.
- Approve protected Preview deployment separately; Production remains a later
  explicit decision. Existing WAF/auth/deployment protection stay unchanged.

Remaining risks: hard-404 streaming boundary needs a verified spike; pooler/custom
role compatibility needs local then approved preview verification; owner cookies
provide no DB-native end-user identity; old copied tokens remain valid until
expiry/rotation; private guide editing necessarily reaches an authorized browser;
source-only rollback cannot preserve publication changes without a manifest.

Supabase references checked 2026-10-22:
[connection/pooling guidance](https://supabase.com/docs/guides/database/connecting-to-postgres),
[grants, RLS and non-exposed schemas](https://supabase.com/docs/guides/api/securing-your-api),
[changelog](https://supabase.com/changelog).
The current changelog flags November 10 HTTP API TLS cipher retirement; the
proposed Postgres path does not use those HTTP APIs. Recheck current docs when
implementing. No schema/driver compatibility has been asserted by a live query.

## Conditional approval and local implementation review — 2026-10-22

The owner approved the architectural direction and **a new dedicated Supabase
project**, while withholding provisioning, remote migration, secrets and deployment
approval. The unidentified existing project must not be reused. AUD-78 is now In
Progress. This section supersedes the earlier project-selection options above.

The full proposal was reviewed before implementation. Local Phase B implements:

- Strict bounded TypeScript/Zod authoring, guide and student DTO schemas.
- A private `classroom` schema, FORCE RLS, restricted NOLOGIN reader/writer roles,
  explicit table/function privileges and API-role revocations. Login activation
  and passwords are a later, separately approved private setup step.
- CRUD, aggregate vocabulary ordering, guide-only access, duplication, preview,
  optimistic concurrency and atomic publication/unpublication endpoints.
- Separate reader-only public API with real 404/503 responses; no seed fallback.
- Disposable Postgres integration tests and destructive local rollback/reapply.

Implementation refinements to the logical schema: exercise authorable fields are
stored in one bounded `content jsonb` document; vocabulary has relational identity,
parent/order and a bounded `entry jsonb`; guide fields are in a separate private
`content jsonb`. This avoids duplicate TypeScript/SQL column mapping for structured
questions and hints. Strict nested application schemas validate on write **and
read**; SQL enforces required content keys, language/difficulty, code size,
publication integrity and public snapshot field allowlists at each object level.
The logical starter-code field maps to `content.fix.buggyCode`; Read code remains
separate. There is no independent `sharing` column in the implementation:
publication plus the public snapshot is the only Studio publishing state. The
legacy import must still honor both original publication/sharing flags before
creating any snapshot.
Content search/filtering uses JSON field expressions with parameterized SQL and
bounded offset pagination (50 rows), rather than speculative indexes/cursors.
The first-publish version is 1 (`version` starts at 0 on a new draft). UUID-derived
public slugs are server-generated and do not change when titles change. Vocabulary
replacement preserves order and references but regenerates internal vocabulary
row IDs; the public DTO has never exposed those IDs.

Guide-only saves increment lockVersion without changing the published-content
checksum. Publication state and public snapshot consistency are enforced by
**deferred, security-invoker constraint triggers**. Published identities and first
publication timestamps cannot be changed. Runtime roles cannot alter schema,
TRUNCATE, or create objects. No SECURITY DEFINER functions, public RPC, browser DB
client, service-role key, Supabase Auth or student accounts are introduced.

**Data API conclusion:** the proposed migration grants neither schema USAGE nor
object privileges to anon/authenticated/service_role/authenticator. Classroom is
not in exposed schemas; the dedicated project should additionally have Data API
disabled. Even if someone accidentally exposes the schema, these roles still
cannot read drafts/guides. Local real Postgres permission tests include a
BYPASSRLS service_role: lack of object/schema grants still denies reads. Hosted
Data API configuration/readback and HTTP denial probes remain a provisioning
acceptance gate; no claim about a nonexistent hosted project's actual settings.
Migration-owner/dashboard administrators and the authorized application writer
remain trusted operators. Do not grant either runtime role to authenticator or
API roles. Keep role membership/grant audits in the deployment checklist.

**Availability:** existing source-backed student pages and teacher routes are
unchanged in this phase and never depend on the new DB. The new API returns 503
on DB failure; it never resurrects seed content. This is intentional staged
integration, not a completed database cutover. Current student HTML routes still
have the AUD-53 streaming soft-404 limitation; the new public API returns actual
404. The blocking-page spike and publication-safe recovery adapter remain Phase
D/cutover gates. Before switching existing URLs, prove an independently stored,
validated public recovery artifact plus explicit revoked-slug handling. Simply
falling back to seed JSON is prohibited. If recovery freshness cannot be assured,
serve an honest temporary error rather than exposing unpublished content. Do not
claim uninterrupted DB-backed availability until this recovery gate is proved.

No Studio UI/autosave, live import, old-loader replacement or browser rendering
change is included in this local API increment. Existing source fallback and
runtime guides remain intact. No cloud/remote writes or deployment were made.
See [setup, infrastructure proposal and verification](setup.md).

## Local UI and recovery increment (supersedes API-only status above)

The Studio UI, import CLI, pre-render HTTP 404 gate and local independent
publication recovery adapter are now implemented. Default published lesson
loading is still source-backed. See [local implementation and recovery runbook](local-studio.md)
for the precise state machine, import semantics, rollback fence and cloud adapter
gate. The local adapter is not suitable for Vercel and refuses hosted operation;
no database-backed hosted availability claim is made. The original access-control
schema and separate draft/published snapshot design remain unchanged. A second
migration allows incomplete vocabulary terms in drafts while publish validation
still requires complete terms, definitions and examples.
