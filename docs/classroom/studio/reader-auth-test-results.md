# AUD-78 — Approved isolated reader-only authentication test

Date:2026-10-22. Project hljdwcwvtbozzpplssxw. Executed only the separately
approved experiment; no Preview configuration, deployments or pushes.

## Result and interpretation

**Same-password delayed success reproduced.** The first transaction-pooler
connection returned28P01; the connection started20seconds later succeeded;
a further fresh-client confirmation also succeeded. No password, endpoint,
username, database, TLS or role-grant changes occurred between those attempts.
This is evidence consistent with delayed pooler credential synchronization after
rotation. It does not identify the exact internal cache entry or establish its TTL.
No architecture/grant change is justified by this result.

The supplied password matched both stored SCRAM keys (StoredKey and ServerKey)
using in-memory PBKDF2/HMAC verification. Neither the password nor verifier was
printed or stored in plaintext. Transfer used a temporary public encryption key;
its private key and encrypted payload were removed after cleanup. A leakage scan
across320 tracked files found neither sensitive value. No application code was
modified by the experiment.

## Sanitized timeline (UTC)

Elapsed times below are relative to the transaction-pooler phase beginning after
the direct-connectivity probe, not to password assignment. One reader password
was assigned at12:30:36.754061UTC. Private SCRAM verification passed at12:30:44.081243.

| Start UTC | Elapsed | Endpoint/operation | SQLSTATE/result |
| --- | --- | --- | --- |
|12:30:44.163 |Before pooler phase |Direct TCP probe,4second maximum |Endpoint unreachable; direct TLS/authentication skipped |
|12:30:44.372 |0seconds |Transaction pooler |28P01, completed12:30:46.011 |
|12:31:04.382 |20seconds |Transaction pooler, same credential |00000/success, completed12:31:05.671 |
|12:31:25.782 |41.4seconds |One confirmation with same credential |00000/success, completed12:31:27.192 |

The60/180second retries were not made because success stops the retry schedule.
Total: three pooler client attempts, no direct database authentication attempt.
No unexpected client error, rate-limit or circuit-breaker signal. Each successful
connection verified current_user/session_user=classroom_reader and database=postgres,
then SELECTed only the authorized published snapshot count (zero). Each used a fresh
postgres3.4.9 client, max1, prepare=false, certificate/hostname verification enabled,
Supabase CA and5second connection timeout. No data mutation or private guide read.

[Machine-readable sanitized events](artifacts/reader-auth-results.json) preserve
start/completion times and durations without credentials, verifier or full URI.

## Sanitized provider log correlation

A bounded12:30–12:33UTC Supavisor log query selected derived event labels, role,
function and mode; no credential-bearing statement or raw verifier was fetched.
At12:30:45 the first attempt recorded initial client/backend authentication then
exchange/backend28P01. At12:31:05 and12:31:26 the new client attempts authenticated
successfully, matching the application's successful SELECTs. Subsequent internal
pooler errors after12:31:36 followed deliberate cleanup/termination, not an
additional scheduled test client or password rerotation.

## Cleanup and preserved boundaries

Immediately after successful confirmation, reader restored to NOLOGIN/PASSWORD
NULL and its temporary backend sessions terminated. Verified reader sessions=0,
writer sessions=0, both roles NOLOGIN/passwordNULL, tables still empty.

The writer's catalog fingerprint and schema/table ACL/RLS/policy/function/
membership fingerprint exactly matched before, during and after the test. No
writer ALTER, grants or privilege broadening. All four tables retain FORCE RLS.
Temporary encrypted password/verifier and GPG key material removed. No Vercel
variables created: Studio branch has none, no CLASSROOM_DATABASE_* variable exists
in any scope, Preview protection remains unchanged. No Production/WAF/runner/AUD-60
change, lesson import, routing cutover or infrastructure spending. PR11 remains
open/draft, remote head49b86fc; this evidence is local only until a later authorized
push. No full frontend suite rerun is claimed for a documentation-only change.

## Next phase — separately approved, not executed

If authorized, generate each runtime password once, verify credentials privately,
allow the same bounded expected28P01 propagation retries, confirm both restricted
identities/permissions before creating any branch-scoped secrets, then configure
only feat/classroom-studio Preview. Never launch configuration ahead of inspected
authentication success. Stop on unexpected errors/circuit breakers; do not rotate
repeatedly to chase a transient error. Protected redeployment and hosted acceptance
also require the requested next approval. Cloud publication recovery remains a
separate, unimplemented infrastructure workstream; no storage is provisioned here.
