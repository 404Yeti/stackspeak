# AUD-78 — Protected Preview acceptance, 2026-10-22

**Current release:** the separate Production identities are approved and configured;
see [Production runbook](production-release.md). Earlier pending-decision text is historical.

Studio acceptance passed on code commit `abe81847b7a4a488d78c401f519ba4074d12dc79`.
**Release awaits owner approval.** A deeper Daily Challenge browser test is blocked
on Preview by its pre-existing backend CORS policy; this is not a Studio code
regression. Do not claim the entire Preview regression matrix passed.

## Deployment and scope

- PR [11](https://github.com/404Yeti/stackspeak/pull/11), still draft and unmerged.
- [Protected branch Preview](https://stackspeak-git-feat-classroom-studio-robert-leybas-projects.vercel.app).
- Current restored deployment `dpl_77h3TJib57vfTFwQaVoE5oBqjLhK`:
  https://stackspeak-mxj4n45ii-robert-leybas-projects.vercel.app
- Initial configured acceptance: `dpl_75H6EqfaDW2mfBRzZbLjPoPrCgPA`.
- Reader connection-failure simulation: `dpl_6wf3dka6dbg9tRN5jYh5nZiEhcuA`.
- All target Preview, same code. Vercel authentication protection unchanged;
  unauthenticated external requests go to Vercel login. App-level anonymous tests
  pass through that outer gate with short-lived same-project OIDC, with no teacher
  session. No static bypass secret or protection changes were used.
- Production remains `dpl_6MEB4U75WxBzXYYTSHgdiYFcUDaZ`, main `15ca578a39ffcb8b2ba69f037448a2348507a738`.

Seven variables exist only for Preview branch `feat/classroom-studio`:
`CLASSROOM_DATABASE_READER_URL`, `CLASSROOM_DATABASE_WRITER_URL`,
`CLASSROOM_DATABASE_CA_CERT`, `CLASSROOM_CONTENT_SOURCE` (`studio`),
`CLASSROOM_PASSWORD_HASH`, `CLASSROOM_SESSION_SECRET`, `CLASSROOM_ORIGIN`.
Reader/writer URLs, password hash and session secret are sensitive values. CA and
origin are encrypted. All original environment metadata (including Production
and other Preview branches) matched the baseline. No DB `NEXT_PUBLIC_` variable.
The independent Preview teacher password is in the owner's private local
credential file, not this repository or report; Production authentication is unchanged.

## Runtime permissions

Fresh independent reader/writer passwords were privately checked against their
SCRAM verifiers. Reader authenticated immediately and again after21.3 seconds.
Writer returned expected `28P01` at0, authenticated at20 seconds, and confirmed at41.6
seconds with the same password. Neither role was rotated between retries.
Verified TLS uses the official Supabase CA plus hostname verification; pooler
`aws-0-ap-northeast-2.pooler.supabase.com:6543`, database `postgres`, usernames
`<restricted-role>.hljdwcwvtbozzpplssxw`, prepared statements disabled.

Both roles retain NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/
NOBYPASSRLS. Reader SELECT is limited to `published_exercises`; exercises,
vocabulary, guides, writes and escalation attempts are denied. Writer can perform
reviewed CRUD, including synthetic publish/unpublish inside a rolled-back test;
SET ROLE postgres, privilege escalation, DDL, TRUNCATE and disabling/bypassing RLS
are denied. All four tables retain FORCE RLS. No grants changed. The security
advisor returned zero findings. Data API remains owner-confirmed OFF; it was not
changed and its dashboard toggle is not exposed by the connected tools.

## Hosted results

| Acceptance | Result |
| --- | --- |
| Owner login, secure HttpOnly Strict cookie, unauthorized API and CSRF rejection | Passed |
| Library, create/edit, debounced autosave and refresh persistence | Passed |
| Vocabulary and noncontiguous code-line highlighting | Passed |
| Separately saved private guides; public-only actual student preview | Passed |
| Draft HTML/API404 and private endpoints401 | Passed |
| Publish, public snapshot access without teacher session, draft edit isolation, republish | Passed |
| Unpublish: genuine HTML/API404 | Passed |
| Duplicate preserves private guide and remains draft | Passed |
| Python and C# published rendering | Passed |
| Desktop1440 and mobile390 usability/no horizontal overflow | Passed |
| Existing three source-backed student lessons; source private/unknown404 | Passed |
| Reader connection unavailable: live/revoked HTML and API503, source lessons200 | Passed |
| Restored connection: live200, revoked404, no resurrection | Passed |
| Preview Daily Challenge full browser flow | Blocked by existing backend CORS policy |

The fault simulation changed only this branch's reader URL to an unreachable
local endpoint, deployed, tested, restored the verified pooler URL with the same
password, and deployed again. It did not stop the database or modify roles,
Production, or other branches. No stale source/recovery snapshot rescued a Studio
slug. Both synthetic lessons and their guides were deleted after restored checks.
No existing lessons were imported. No real private guide was used in testing.

The backend returned200 for `/api/challenges` under both Origin headers, but sent
`Access-Control-Allow-Origin` only for `https://stackspeak.vercel.app`, not the
branch Preview. The browser therefore rejected the Preview response. This exact
limitation was already documented in `docs/deployment.md` (AUD-52). Production
passed the complete Read → Explain → Fix → Trace → Defend → Feedback browser
flow with Run Code OFF, no runner requests/iframe and browser-local answers only.
No backend/CORS configuration was changed.

Tracked files, branch history patch and locally built client assets were scanned
against actual temporary runtime passwords, verifiers and Preview teacher password;
no matches. Client assets contain no reader/writer connection configuration names.
No secret values, cookies, tokens or real guide data appear in these artifacts.

Screenshots: [library](artifacts/hosted-library.png),
[mobile editor](artifacts/hosted-editor-mobile.png),
[student](artifacts/hosted-student.png). Sanitized machine-readable checks are
alongside them. Local checks: lint/typecheck/build,217 unit tests,7 disposable
Postgres integration tests including rollback/reapply,3 Chromium Studio-mode
UI/API tests. Existing broader Daily Challenge regression:25 local tests.

## Final approval proposed — no Production action taken

1. Accept the existing Preview-only Daily Challenge CORS limitation, or separately
   authorize adding only the branch origin to the backend before a repeat test.
   No wildcard CORS or WAF changes are proposed.
2. Approve Production configuration, merging PR11 and Production deployment as one
   controlled release. Preserve current Production teacher hash/session/origin and
   private source guides, Run Code OFF, WAF and the runner.
3. Use the existing dedicated database and the same restricted-role model, with
   fresh Production passwords privately verified twice through the pooler after
   its synchronization delay. Retire the Preview DB credentials/configuration;
   do not leave a Preview writer authorized to author Production lessons. Rotate
   passwords to invalidate earlier Preview builds and verify old credentials are
   rejected after synchronization before exposing Production authoring.
4. Add Production-scoped reader/writer URLs, verified CA and `CLASSROOM_CONTENT_SOURCE=studio`.
   No new migrations/resources/spending or source-lesson import. Retain the
   three reserved source URLs; only newly created Studio links use Postgres.
5. Recheck auth/publication/isolation and the real Daily Challenge after release.
   Retain the previous Production deployment and use the rollback below on failure.

[Rollback](streamlined-release.md#straightforward-rollback): restore the previous
Production deployment and source delivery configuration, retain database data,
never restore a stale snapshot. Old lessons continue; new Studio URLs become
unavailable rather than resurrecting revoked content. Free-plan availability,
new-link503 during database outages, and the6KiB compressed public snapshot limit
are accepted MVP limitations to call out at final approval. Durable cloud recovery
and the extended device matrix remain separate follow-ups. No critical Studio
privacy/publication failure was found; full Preview Daily Challenge acceptance
still needs the explicit exception or narrow configuration approval above.
