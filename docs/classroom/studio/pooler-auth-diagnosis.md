# AUD-78 — Read-only pooler authentication investigation

Date: 2026-10-22. Target hljdwcwvtbozzpplssxw. No LOGIN/password changes,
Vercel configuration, deployment, push, grants or resource creation in this review.
PR11 remains open/draft at49b86fc. Local documentation commits after that head have
not been pushed because they would trigger another deployment.

## Strongest supported diagnosis

**A Supavisor credential/cache mismatch following rotation is the leading
explanation, not a proven root cause.** Current official documentation explicitly
supports custom LOGIN roles on the shared Supavisor pooler, including SCRAM, and
describes transient28P01 after changing a role's password. It recommends direct
verification and bounded reconnects without repeated rotations. This matches the
observed sequence, but the failed credential was cleared before a direct comparison
or delayed retry. Historical plaintext passwords/verifiers cannot be reconstructed.

References checked:

- [Custom LOGIN role support and28P01](https://supabase.com/docs/guides/troubleshooting/fatal-password-authentication-failed)
- [Shared-pooler rotation/cache behavior](https://supabase.com/docs/guides/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation)
- [Connection endpoints and transaction-mode constraints](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Role model](https://supabase.com/docs/guides/database/postgres/roles)

Do not confuse the Storage/API custom-JWT-role instructions with database login
configuration: no grant to authenticator or anon is needed or permitted here.

## Exact non-secret connection review

| Setting | Successful and failed tests |
| --- | --- |
| Host | aws-0-ap-northeast-2.pooler.supabase.com, owner-verified Connect dialog |
| Port/mode |6543, shared transaction pooler |
| User | classroom_reader.hljdwcwvtbozzpplssxw; writer analogous |
| Database |postgres |
| Transport |TLS with rejectUnauthorized=true, normal hostname checking and Supabase Root2021 CA |
| Credential storage |SCRAM-SHA-256, independent server-generated32-byte random passwords encoded as64 hex characters |
| Client |Same postgres3.4.9 test script, max1, prepare=false, fresh client |
| Known difference |New credential generation after NOLOGIN/PASSWORD NULL cleanup; same role identities |

The earlier system-trust certificate failure was resolved before the successful
runs. The later28P01 occurred after TLS, so it is not that certificate failure.
The runtime script used WHATWG URL field assignment; the Vercel builder manually
constructed the URI with an encoded username. A synthetic-only equivalence and
password/user/database/port round-trip test passed. Generated passwords contain
only ASCII hex: no URI-reserved characters, encoding ambiguity or Unicode
normalization. Encrypted transfer and JSON parsing preserved the values; the
configuration code also validated64 hex characters. No construction error is
supported by the reviewed paths. This is not proof that an unavailable historical
password matched its then-current stored verifier.

## Sanitized log evidence

Read-only unified logs were queried for09:15–10:00UTC (and narrower subwindows),
not polled. SQL query bodies/verifiers/passwords were not selected. Messages were
bounded and sanitized. One attempted core field name was unsupported; event_message
is the actual message field. Metadata-only queries discovered the available keys.

| UTC | Evidence |
| --- | --- |
|09:29:36.092667 |Supavisor handle_auth_success/2, classroom_reader, postgres, transaction |
|09:29:40.399878 |Same success for classroom_writer |
|09:29:36–09:29:48 |Postgres42501 permission denials under those roles, consistent with the deliberately denied runtime operations |
|09:32:35.116239 /09:32:36.200608 |Supavisor authenticated reader/writer in the application-module test |
|09:33:05.906 |Recorded cleanup of runtime credentials |
|09:47:58.524250 |ClientHandler: Connection authenticated, reader, transaction |
|09:47:58.536581 |DbHandler: Backend authenticated |
|09:47:58.550087 |ClientHandler exchange error: password authentication failed for reader |
|09:47:59.051497 /09:47:59.051641 |DbHandler auth error28P01 and checkout failure |
|09:49:11.249 |Recorded cleanup after the stop |

The failed route reached the correct project/role/database and progressed past an
initial authentication stage before exchange/backend failure. This is stronger
evidence against a simple misspelled tenant/user than against stale SCRAM/password
state in the pooler. No raw Postgres FATAL row was exported for the failure window;
that log absence does not disprove the Supavisor backend error. Logs do not expose
the cached verifier, so they cannot establish which cache entry was stale or its
TTL. No circuit-breaker error was observed in this window.

## Current verified safety state

Both roles: NOLOGIN, password NULL, no SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS.
Zero runtime sessions. FORCE RLS remains enabled across all4 classroom tables.
Vercel has zero feat/classroom-studio variables and no CLASSROOM_DATABASE_* entry
in any scope. Other existing authentication environments were not read/decrypted
or changed. Preview authentication protection remains all_except_custom_domains.
No credential/authentication attempts were made in this investigation.

## Recommended fix and isolated test — approval required

Keep the restricted-role architecture and verified TLS. Do not switch to the
postgres/admin user, service-role API, grant API memberships, weaken TLS, repeatedly
rotate passwords, restart the database or enable public access to work around28P01.
Shared session mode5432 still uses Supavisor caching and is not an independent
control for this diagnosis.

Proposed **reader-only** experiment, requiring explicit approval before execution:

1. Recheck target, NOLOGIN/password-NULL state, original grants/RLS and empty
   Vercel Studio configuration. Generate one fresh256-bit random reader password;
   temporarily enable only existing classroom_reader LOGIN. No writer change,
   schema mutation, new role, environment variable or deployment.
2. Use encrypted transfer only. Compare the supplied password with the reader's
   stored SCRAM verifier locally in memory (PBKDF2/HMAC verification, boolean
   output only; verifier itself encrypted in transit and never printed/persisted
   in plaintext). This provides a credential-consistency check even if WSL cannot
   reach the direct IPv6 endpoint. It is not a substitute for direct network auth.
3. If direct endpoint TCP connectivity is available, make one verified-TLS login
   with the same reader password and direct username classroom_reader, database
   postgres. Otherwise mark direct authentication unavailable; do not provision
   networking/add-ons or substitute the shared session pooler as a direct test.
4. Attempt fresh-client verified-TLS transaction connections with that SAME
   credential at elapsed0,20,60,180seconds, stopping after first success. At most
   four attempts; if successful, one additional fresh-client confirmation20seconds
   later (at most five pooler attempts total). Only SELECT current_user,
   session_user/current_database and permitted snapshot count. No data writes.
   This requires explicit approval for bounded expected28P01 retries as part of
   the experiment, rather than the earlier deployment stop-on-first-failure rule.
   Stop immediately for TLS failure, unexpected identity/permissions, circuit
   breaker, non28P01 errors or exhausted attempt budget. No password rerotation.
5. Correlate role-specific sanitized logs and elapsed times. A matching SCRAM
   verifier plus a delayed same-password success supports transient pooler state;
   direct success with persistent pooler failure supports escalation to Supabase
   support. Do not label custom roles unsupported based on one failure.
6. Close test clients; restore reader NOLOGIN/PASSWORD NULL, verify zero sessions,
   remove temporary encrypted material/keys. Writer and all Vercel scopes remain
   unchanged. Report evidence before any production or Preview credential rollout.

If the test succeeds, a subsequent approved rollout should generate once, allow
bounded pooler propagation, verify both roles first, and only then configure branch
variables/deploy. The earlier sequencing mistake must not recur: operations depend
on inspected success, not simply on starting an asynchronous tool call.

If persistent incompatibility is demonstrated, use the SAME restricted roles over
a direct verified-TLS connection from an existing IPv6-capable environment, or
review a paid direct IPv4/dedicated-pooler option with separate cost approval.
Direct/dedicated endpoints avoid the documented shared-pooler credential-cache
behavior. Do not assume the endpoint/network exists or provision it now. No
architecture replacement is currently justified by the evidence.
