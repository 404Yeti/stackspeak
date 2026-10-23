# AUD-78 — Local Studio implementation

**Current status:** see [hosted acceptance and final approval plan](hosted-acceptance.md).
The earlier assessment/results below are historical; Studio now has a configured
protected Preview using the approved streamlined release mode.

The teacher library and editor are implemented on `feat/classroom-studio`.
Existing student lessons remain source-backed by default. Nothing in this
increment enables production database delivery or code execution.

## Teacher workflow

`/classroom/studio` uses the existing owner session and redirects unauthorized
visitors before loading exercise data. The library supports search, filters,
pagination, create, edit, duplicate, preview, publish and unpublish. The editor
provides Content, Vocabulary, Teacher Guide and Preview tabs. Code editing uses
the existing syntax highlighting and numbered CodeInput without execution.
Vocabulary references retain non-contiguous, one-based code lines.

Draft and guide saves debounce for one second, serialize optimistic versions,
and acknowledge only successful persistence. Explicit save flushes pending edits.
Version conflicts stop saves; navigation/unload warns about dirty work. A lost
session can be retried after signing back in. Private content never enters browser
storage. Guide loading uses its authorized endpoint separately from exercise data;
preview receives an explicit public projection and renders the real student
Read → Explain → Fix component without the teacher guide.

Publication validates required content and vocabulary. Editing a published
exercise changes its draft only; publishing replaces the immutable student
snapshot. Duplication creates a new ID/slug and a private draft. Student link
copying is available after publication; default source mode clearly explains
that new student links are not enabled yet.

## Local database and recovery

Use the existing [setup](setup.md) for restricted database credentials and
migrations. Add a private, absolute `CLASSROOM_RECOVERY_DIR` outside the repository.
Leave `CLASSROOM_CONTENT_SOURCE` unset (source) for the ordinary teaching library.
For isolated database-backed acceptance set it to `database`, import the lessons,
and retain the recovery directory independently of Postgres. No environment
variable for database credentials is public.

The reference recovery adapter uses private local files, atomic rename/fsync,
SHA-256 validated public-only snapshots, a serialized publication lock and a
write-ahead deny registry. Publish/unpublish persists a deny before SQL changes;
after successful publication commit it activates the immutable snapshot. Failure
or interruption leaves a deny. A DB outage serves only a validated snapshot
matching the independent registry; it never falls back to old seeds. Missing or
corrupt metadata fails closed. A stale lock requires operator inspection; do not
blindly delete it while another publisher may be running.

After database delivery begins, a durable fence prevents changing back to source
mode, which could revive unpublished lessons. Use `CLASSROOM_CONTENT_SOURCE=recovery`
for read-only recovery from the same independent store. Studio writes are disabled
in recovery mode. Preserve the directory, registry, tombstones and environment
configuration during rollback. Removing that configuration or rolling back to code
that predates the fence is unsafe. Restore the independent store before reopening
service if it is lost; do not reconstruct approvals from seeds or stale SQL.

The route proxy makes publication decisions before rendering, so nonexistent,
draft, unpublished and malformed student URLs return actual HTTP 404 (including
HEAD/RSC). It replaces caller-supplied publication headers. Database rendering
uses a short-lived signed pin to the already-authorized immutable snapshot so a
publication race cannot create a streamed soft-404.

**Hosted delivery remains blocked:** this local filesystem adapter explicitly
rejects Vercel. Before any hosted database cutover or publishing, implement and
review an independently durable cloud publication registry/snapshot adapter with
atomic conditional writes, then repeat outage, concurrency, crash and rollback
acceptance. Do not use Vercel ephemeral storage. Supabase provisioning alone does
not resolve this gate. Existing source-backed lessons require neither DB nor
recovery storage and remain available.

## Import and rollback

From `frontend`, run `npm run studio:import` for a dry run. The command accepts
`--guide-file /absolute/private/guides.json` and writes only with `--apply`.
It accepts loopback databases only and refuses Vercel/remote hosts. There is no
HTTP import endpoint. Existing runtime guide configuration remains supported.
No actual private guides are checked in or required for synthetic acceptance.

The importer preserves source IDs/slugs/content/vocabulary and optional guides,
records provenance/checksums, preflights the complete batch and inserts only.
Repeat imports skip originals even after teacher edits or unpublication; source
changes, collisions or unsafe late guide imports fail without overwrite. Back up
both SQL and the independent publication store before an approved real import.
Keep source seeds until migration parity and recovery have been accepted.

For a never-cut-over preview, leave source delivery enabled while rolling back
application changes. For an already-cut-over environment use read-only recovery
as above. Do not apply the destructive schema rollback to a populated database;
export and review data first. The disposable test harness proves rollback/reapply
only on synthetic data.

## Verification and preview artifacts

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
`npm run test:studio:db` creates a fresh disposable PostgreSQL cluster with synthetic
roles, checks grants/RLS, persistence, projections, import, outage and rollback.
Set `STACKSPEAK_TEST_PG_BIN` if Postgres executables are outside PATH.
`npm run test:studio:browser` also invokes the real import CLI and exercises the
full UI/API workflow in Chromium and Firefox. It never accepts a remote DB URL.
The Classroom and production-mode HTTPS Playwright configurations check source
URLs, hard 404s and existing cookie/CSRF protections. Daily Challenge remains a
separate regression suite with Run Code off.

Screenshots under `artifacts/` contain synthetic lesson content only. Safari and
hosted Supabase/Data API denial checks remain acceptance gates. No cloud project,
remote migration, secret configuration, push or deployment is part of this work.
