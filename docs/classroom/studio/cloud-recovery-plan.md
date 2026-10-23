# AUD-78 — Durable cloud publication recovery implementation plan

This is a design/work plan, not authorization to provision storage, deploy,
configure secrets, migrate data or cut over students. Authentication diagnosis
is separate. The existing local adapter remains intentionally unavailable on
Vercel; hosted publish/unpublish currently fail closed.

## Gaps in the current reference adapter

`recovery.ts` uses private files, fsync/rename, an exclusive filesystem lock, a
public-only immutable snapshot store, registry tombstones and a cutover fence.
The repository persists a deny before public SQL mutation and activates after
commit. Proxy resolves visibility before streaming and pins the approved snapshot.
These security semantics should remain; filesystem operations and process-local
coordination cannot simply be copied to Vercel. A second database or a Supabase
Storage bucket whose control path depends on the same database is not evidence of
independence during a Supabase DB outage. Prove independence for any alternative.

## Proposed backend: independent private S3 Standard bucket

One separately approved, versioned general-purpose AWS S3 bucket, preferably Seoul
ap-northeast-2, independent of the Supabase database. No public bucket, public
snapshot URL or CDN cache for visibility decisions. Public-only means content
classification; access remains server-side. Use block-public-access, HTTPS,
server-side encryption, a narrowly scoped read identity and publication-write
identity. Prefer existing Vercel-to-AWS workload federation after reviewing exact
project/branch/environment claims; otherwise a separately approved secure scoped
credential setup. No AWS administrator credential in application runtime.

Reader: GetObject for manifest and immutable public snapshots only. Writer:
GetObject/conditional PutObject for those exact prefixes. Neither runtime needs
DeleteObject, version deletion, bucket administration or IAM capabilities. Deny
unconditional overwrites in bucket policy after provider behavior is tested. No
bucket-wide listing/garbage collection is needed for MVP. Migration/operator
backup/restore permissions are separate and trusted.

S3's documented strong read-after-write consistency and If-Match/If-None-Match
conditional PUTs are the required primitives. A CAS failure must reload/reject,
not retry an obsolete activation blindly. No TTL lock that can expire while an
old publisher still commits. Versioning is recovery evidence, not permission to
restore an old manifest that could revive an unpublished exercise.

References:
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html
- https://aws.amazon.com/s3/pricing/

Storage/requests/transfer are usage-priced. Before any provisioning, identify the
owner-controlled AWS account, provider quota, expected Preview workload, exact
region-specific estimate and acceptable budget, then request approval. No new
resource, IAM role, secret or charge is authorized by this plan; no Free assumption.

## Incremental implementation

1. Define a small server-only PublicationStore interface and retain the local
   adapter for disposable acceptance. Keep strict studentSchema projection before
   writes/after reads, SHA256 content-addressed snapshots and size bounds. Store
   only public payloads, operation identifiers and revocation/cutover metadata;
   never drafts, guides, expected solutions, auth/session/database credentials.
2. Implement private S3 manifest and immutable snapshot operations. Snapshot key
   is SHA256, PUT uses If-None-Match; an existing hash must validate identically.
   Treat ETags as opaque CAS tokens, not SHA256 content checksums. Bound object
   reads, deadlines and retry counts; preserve real HTTP404 vs503 distinctions.
3. Replace the filesystem global lock with a conditional manifest operation claim
   and monotonically advancing generation/operation ID. Single-owner MVP may
   serialize all publication actions. Persist pending deny/tombstone before SQL.
   Publish writes a validated immutable object and commits SQL before CAS
   activation of that exact operation/hash. Unpublish persists deny before SQL,
   and never needs snapshot activation. A failure leaves deny; ambiguous commit
   never restores old content. Stale activations must fail CAS after a newer
   generation/tombstone. A crashed pending operation requires an explicit
   reconciliation path; do not automatically unlock by wall-clock age. A stale
   SQL commit can leave SQL/journal disagreement, but must never authorize a new
   public read. Repair uses current lockVersion/public hash evidence and CAS.
4. Integrate proxy/student/API reads with authoritative fresh visibility metadata
   on every request. Cache only immutable bytes by verified hash, never an old
   active manifest across unpublish. Preserve signed pre-render snapshot pins,
   strip caller publication headers, bound their lifetime and ensure HTML/API
   policies agree. Missing/corrupt manifest or storage outage =>503, valid absent/
   denied slug =>404. SQL outage may serve a known active verified snapshot; no
   seed resurrection or private/raw SQL fallback. Define the existing in-flight
   request policy explicitly: a request authorized before unpublish may finish
   its pinned public snapshot; requests starting after durable deny cannot.
5. Keep existing source lessons unchanged. A future explicitly enabled Preview
   mode can resolve existing reserved source slugs through their current loader
   and new Studio slugs through the cloud journal, with collision checks. This
   enables testing new published student links without importing legacy lessons
   or switching Production routes. Do not expose database mode in Production by
   accident; validate Preview environment/project and refuse unknown modes.
   Production defaults remain source-backed until a separately approved cutover.
6. Implement read-only cloud recovery mode and durable cutover fence. Keep latest
   tombstones/generations during application rollback; do not restore an old
   manifest blindly, remove the fence, or fall back to seeds after a cutover.
   Cloud publication metadata must remain available independently of SQL. Missing
   authority fails closed. An operator reconciliation/export runbook covers
   partial publication, interrupted unpublish and database restore. It must
   preserve all later revocations and reject ambiguous old backup restoration.

## Acceptance before hosted publishing

Local deterministic adapter tests plus real disposable S3 integration after
resource approval, then protected Preview using synthetic lessons only:

- Competing publishers, overlapping unpublish, delayed stale activation and CAS
  precondition errors. At most one operation can activate its intended generation.
- Crash before/after deny, during SQL changes, after commit before activation,
  after activation before response; restart never revives denied content.
- DB outage serves allowed public snapshot; registry/object-store outage returns
  honest503. Corrupt/truncated/oversized/unknown-key payloads fail closed.
- Read/write IAM boundaries and denial of browser/direct object access; private
  guide canaries absent in objects, HTML, API, client assets and metadata.
- Anonymous application sessions behind platform Preview protection see only
  approved published new Studio lessons; draft/unpublished/malformed routes have
  actual404, including HEAD/RSC and races around unpublish.
- Python/C# preview, autosave and publication snapshot stability; source lesson
  URLs and Daily Challenge/runner-OFF regressions unchanged.
- Exercise lifecycle, read-only recovery, database restore/rollback and stale
  manifest restoration drill. No legacy import or Production cutover in acceptance.

Local code/interface implementation may proceed under authoring scope, but real
cloud resources, IAM/federation, environment configuration and hosted testing need
the concrete separate approvals above. Do not mark the current protected,
unconfigured Preview as publication-ready before these gates pass.
