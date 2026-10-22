# AUD-78 — Streamlined personal-use release

Owner steering supersedes the earlier requirement for an independent recovery
store before a safe authoring release. No new infrastructure/migrations/grants.

`CLASSROOM_CONTENT_SOURCE=studio` uses Postgres as the authority for new Studio
lessons. Publishing/unpublishing commits draft status and the public snapshot in
one transaction with the reviewed deferred constraints. New student requests read
only the restricted reader's published snapshot table. Missing/revoked lessons404;
connection/storage/validation failures503. No journal, stale SQL copy, filesystem
or source fallback is consulted for a Studio slug.

The existing three published source URLs remain reserved and source-backed; the
existing private source slug remains404. These URLs are resolved deliberately
before any DB query, so a DB outage does not interrupt them. Studio cannot publish/
unpublish imported records under those reserved slugs. Legacy import remains
unapproved and unnecessary for this release.

The proxy checks status before Next streams. A signed, compressed public-only
snapshot travels in the internal server request to render the already-approved
version, without a second database read or an unpublish race producing a soft404.
Client-supplied pins are replaced after a fresh DB decision. Pins expire in five
minutes, bind the slug and are never client props. Only requests authorized before
unpublish may finish their public snapshot; new requests after its commit cannot.
No snapshot or visibility decision is cached as an outage fallback.

A6KiB signed-request limit is checked before publishing to stay within platform
header budgets. Typical code lessons fit; unusually incompressible/large lessons
receive an inline publish error and must be shortened. Public DTO limits and strict
key validation remain; decompression is size-bounded. Teacher guides never enter
this transport. This is a small-MVP constraint, not a privacy compromise.

## Focused acceptance

Verify teacher login/CSRF, create/edit/autosave/refresh, vocabulary/highlights,
private guides, actual student preview, publication snapshot stability, duplicate,
anonymous application student access and revoked/draft404. Test reader outage503
with no resurrection and preserved source URLs. Platform Preview protection stays
separate from app anonymity. Check Daily Challenge with Run Code OFF, desktop/
mobile usability and private content/credential isolation. No extended device
matrix or extra cloud storage is required for this release.

Local checks passed: lint/typecheck/build,217 unit tests,7 disposable Postgres
integration tests plus rollback/reapply, and3 Chromium UI/API acceptance tests in
studio mode. No real lessons or production database are used for those tests.

## Straightforward rollback

Before a separately approved Production release, retain the current Production
build/main15ca578 and current environment metadata. If the new release fails,
restore that prior deployment (and source delivery configuration) without running
SQL rollback or deleting authoring data. Existing source lessons and Daily Challenge
continue; new Studio links become unavailable/404 rather than reviving an older
snapshot. Keep DB data for a forward fix. Do not restore old database snapshots or
seed copies to resurrect links. DB outages in the new build produce503 until the
connection returns; that availability tradeoff is intentional.

Independent cloud recovery is deferred as an availability improvement. It must
preserve these revocation semantics if added later, but no resource, IAM policy,
secret, storage charge or Production cutover is authorized by this document.

PR11 remains unmerged during Preview acceptance. One final owner approval must
cover Production configuration, merge and deployment. Preserve existing teacher
authentication, WAF and runner flags; do not import legacy lessons or enable Run Code.
