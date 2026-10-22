# AUD-78 — Controlled protected Preview sequence (2026-10-22)

Status: **stopped on fresh pooler authentication failure**. No configured Studio
redeployment or full hosted teacher acceptance is claimed.

## Publication and initial automatic deployment

- Branch: feat/classroom-studio, GitHub404Yeti/stackspeak.
- Draft PR: https://github.com/404Yeti/stackspeak/pull/11 (base main; do not merge).
- Published/deployed commit:49b86fcbc1ee2d6fa888ebd1e53a9ffb395d27e5.
- Deployment:dpl_GkrEFUhMR4AYdWzNZ5SpfvvokZfs, READY, Preview target.
- Immutable URL:https://stackspeak-8xpxgtb8m-robert-leybas-projects.vercel.app
- Branch URL:https://stackspeak-git-feat-classroom-studio-robert-leybas-projects.vercel.app

Pre-push compared against freshly fetched origin/main15ca578 and found only AUD-78
changes; no runner/AUD-60/WAF files differed. The changed-file/history patch scan
found no live credentials (the matching synthetic database unit-test URL was
reviewed explicitly).25 focused auth/API/TLS/proxy unit checks and2 unconfigured
storage/status browser checks passed. Prior full209-unit/build and6-DB results
remain recorded in remote-migration-results.md. No real private guide source data
is committed.

Verified Vercel project stackspeak/prj_BlU64KE3PavF6PiLRnMCyyfc5UVL under
robert-leybas-projects, root frontend, GitHub404Yeti/stackspeak, main Production
branch. Existing authentication protection remains all_except_custom_domains.
Production Run Code flag absent/OFF default; no shared Preview teacher secrets.
Push triggered exactly the initial automatic Preview. Anonymous external request
returned302 to vercel.com login. Short-lived same-project development OIDC through
Vercel CLI65.1.0 was accepted without static bypass or protection changes; token
remained in memory and was not printed/persisted.

Initial application checks behind platform authentication, without teacher session:

| Route/check | Result |
| --- | --- |
| /classroom/studio | Streamed200 redirects to login; Studio content absent |
| /classroom/api/studio/exercises |401 |
| /api/classroom/exercises/python-loop-accumulator |503 storage unavailable, sanitized |
| Three existing published Python/C# source-backed student URLs |200 each |
| Existing draft csharp-await-task student URL |404 |

An initial test expected an HTTP redirect for the teacher page; Next's existing
streamed redirect yields200 plus login redirect metadata. Diagnosis confirmed no
authoring content or teacher API access, so this was an assertion mismatch, not
authorization bypass. Student hard404 checks passed.

## Configuration attempt and stop

Fresh independent cryptographic passwords were provisioned only on the two
existing restricted roles using the same encrypted-transfer method. FORCE RLS,
API-role schema denial, no elevated role flags, and empty tables were rechecked.
The first real reader login through the verified TLS transaction pooler returned
**28P01: password authentication failed**. Root cause is unconfirmed; do not infer
that grant changes or weaker TLS are needed. This triggered the owner's explicit
stop condition. No retry intended to force acceptance or configured redeployment
was performed.

A sequencing mistake started the Vercel configuration request before inspecting
the failed login result. Seven variables were briefly created correctly scoped
only to target preview, gitBranch feat/classroom-studio:

- CLASSROOM_DATABASE_READER_URL / CLASSROOM_DATABASE_WRITER_URL: sensitive.
- CLASSROOM_DATABASE_CA_CERT: encrypted public CA certificate.
- CLASSROOM_CONTENT_SOURCE: plain seed.
- CLASSROOM_PASSWORD_HASH / CLASSROOM_SESSION_SECRET: sensitive, separate Preview
  owner credentials using existing auth (no Production credential reuse).
- CLASSROOM_ORIGIN: encrypted exact branch origin.

Corrective action removed exactly those seven newly created IDs after checking
scope. Full env metadata comparison restored the original baseline in every
scope, including Production and other Preview branches. Both roles returned to
NOLOGIN/PASSWORD NULL; catalog verification confirmed passwords cleared and no
elevated flags. Temporary transfer keys, encrypted credentials and unused local
Preview login password removed. Generated-password leakage scan across tracked
files and built browser assets passed. Credentials/token values were never chat,
GitHub, documentation or command output. No configured deployment was created.

## Current impact and acceptance limits

The only Preview is the protected **unconfigured**49b86fc deployment. Teacher
login remains locked; source-backed students remain available after Vercel platform
authentication. End-to-end teacher CRUD/autosave/vocabulary/guide/preview and hosted
Daily Challenge interaction were not run in this stop-limited attempt. Earlier
local browser/runtime results are not substituted for fresh hosted acceptance.
Hosted publishing remains independently blocked on the durable cloud publication
adapter; no unsafe file fallback or database student cutover was enabled.

Production deployment remains dpl_6MEB4U75WxBzXYYTSHgdiYFcUDaZ at main15ca578;
Production env metadata and protection unchanged. No merge, production deployment,
lesson import, WAF, runner or AUD-60 change. Draft PR remains open. Diagnosis of
fresh credential/pooler authentication is the next blocker; resume only after
addressing this stop condition. Existing approvals do not permit weakening TLS,
broadening database roles or exposing Preview publicly.
