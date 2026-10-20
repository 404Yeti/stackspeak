# AUD-53 — Production readiness and gated release plan

**Subsequent approved gate pass:** see
[Production pre-merge evidence](production-premerge-gates.md) for applied
configuration, successful CI and live WAF proof. The status below records the
earlier readiness pass; main merge and Production app deployment still require
final owner approval.

Status: **local checks pass; Production configuration and live throttle proof are
pending explicit owner approval. No push, merge, deployment or remote
configuration change was made during this readiness pass.** Product-owner UX
approval applies to Preview application commit 1d78336; application code remains
identical to it. Changes here are security tests, test integration, proposed
infrastructure policy and documentation.

## Repository / existing production

Fetched origin/main is `21754efd4c1c8f12dd5bfd2af9d9ac99ace18508`, an ancestor of
the feature branch. Git merge-tree simulation succeeds with no conflicts. No
backend, Daily Challenge, Python runner, CSP/canary/sandbox or runner-client
source changes. Local release documentation commit 7115e89 had not been pushed.
Do not push readiness commits yet: a feature push triggers a protected Preview;
a main merge triggers the existing production workflow.

Existing frontend project: stackspeak / prj_BlU64KE3PavF6PiLRnMCyyfc5UVL,
team robert-leybas-projects, root frontend, production branch main.
Production deployment: `dpl_CJNgnpvTZ5kBmckYAe6zR7iivVNm`.
Production runner: `dpl_51wxJkYvLxdPDNXDUdPuarRJXDin` (not Git-connected).

Existing protection `all_except_custom_domains` remains intact. The existing
production domain is already public (verified by live browser access), while
Preview/deployment URLs remain protected. **No protection relaxation or bypass
is needed for anonymous Production student links.** App authorization protects
teacher routes independently of Vercel protection. Do not use an immutable
protected deployment URL as the student share origin.

## Authentication / private-data audit

| Area | Finding |
| --- | --- |
| Owner password | Server-only scrypt N=65536/r=8/p=2; random salt; timing-safe comparison; two concurrent checks per instance; bounded form and password sizes |
| Sessions | Signed HMAC-SHA256, random 24-byte nonce, eight-hour lifetime; rejects tampering, future/expired tokens; bound to origin, hash and signing secret |
| Cookies | Host-only, HttpOnly, Secure on HTTPS, SameSite Strict, path /classroom; student routes do not receive this cookie |
| CSRF / redirects | Login and logout require POST and exact configured Origin; no forwarded-host trust or arbitrary return URL; invalid methods/origins rejected |
| Production origin | Explicit bare HTTPS CLASSROOM_ORIGIN required. Preview branch-metadata fallback never applies to Production. /classroom/ normalizes to /classroom; the environment origin has no path/trailing slash |
| Authorization | Teacher data functions authorize on the server; guide API checks auth before lookup, returns anonymous 401; no client-only privilege check |
| Guides | Request-time authorized loading, no source fallback; validated allowlist, private/no-store API; no guide hydration, public source or client-bundle payload |
| Students | Only published AND public exercises; nested DTO allowlist; fresh anonymous HTTPS contexts can access all three published exercises without an app/Vercel account and cannot read guides or the draft through application routes |
| Logout / rotation | Logout deletes this browser cookie. Copied stateless tokens remain valid until expiry/rotation. On Vercel, rotation requires a new deployment/cutover; changing project env metadata alone does not change existing deployment snapshots |
| Shared throttling | Existing process counter is local only. Current active WAF rule is Preview-only; Production protection must be configured and proved before merge |

No database/auth provider is needed for the approved single-owner release. No
student accounts, synchronization, grading or execution is introduced.

### Source confidentiality decision

Actual Classroom teacher guides were excluded from sanitized pushed history.
Existing Daily Challenge reference answers were already intentionally public;
this work does not make those old public examples private.

The seeded unpublished C# async exercise **itself** (not its separate guide) is
already in public commit 1d78336. Its student route is denied and it is absent
from anonymous rendered payloads, but GitHub source remains readable. The owner
must either accept this seed as public-source/non-shareable, or require a private
runtime catalog for future confidential drafts. Moving it now cannot retract the
old public copy. Do not claim repository confidentiality for this seed. That
question was raised explicitly; no silent publication or new catalog feature was
implemented during the audit.

## Required Production configuration — not applied

All four variables are currently absent from Production. Configure only the
Production target on the existing app project, without a feature-branch scope:

| Name | Proposed value/source |
| --- | --- |
| CLASSROOM_PASSWORD_HASH | Fresh independently generated owner password hash, different from Preview |
| CLASSROOM_SESSION_SECRET | Fresh independently generated random signing secret, different from Preview |
| CLASSROOM_ORIGIN | https://stackspeak.vercel.app (bare origin) |
| CLASSROOM_GUIDES_JSON | Copy the approved canonical private lesson guides into a separate sensitive Production variable, with owner approval |

A local **unconfigured candidate** is retained outside Git at
`/tmp/stackspeak-classroom-private/production-credentials.proposed.json` (0600 in a
0700 directory). Its authentication credentials are verified distinct from
Preview. Guide content is the same approved canonical lesson content, 5,761 bytes;
copying it into Production is explicitly part of the requested approval, not
reuse of Preview authentication credentials. No values were printed or put in
shell arguments. The application caps guide JSON at 48 KiB; current proposed
configuration is well below Vercel's documented total environment budget.

Store hash, signing secret and guide payload as sensitive values, never
NEXT_PUBLIC. Do not set CLASSROOM_GUIDES_FILE on Vercel. Project variables are
available during build and runtime; application code reads guides only at
authorized request time. A build with actual candidate private values present
was scanned for embedding. Vercel project operators remain trusted.

Do not set production Run Code variables, reuse Preview credentials, modify
NEXT_PUBLIC_API_URL, alter existing AUD-60 scopes, or change Render configuration.

## Shared WAF proposal — not applied

[Reviewed proposed rule](production-firewall-rule.proposed.json) updates the
existing Classroom rule ID `rule_aud_53_classroom_preview_login_V55MbI`, preserving
its original Preview condition group. It adds two Production-only OR groups:

1. Production + POST + resolved /classroom/session route (normalized-route coverage).
2. Production + POST + exact /classroom/session path, optional trailing slash
   (canonical coverage even before the new handler exists).

All groups are explicitly environment/method/login scoped. No student, guide,
logout, Daily Challenge or other route is matched. The action stays a fixed
window, ten requests per sixty seconds per IP, default 429. No bypass, challenge,
global managed-rule or other project policy change is proposed. Preserve all
existing protections and unrelated rules; edit this rule rather than replacing
or reinitializing the complete project firewall configuration.

The existing Hobby plan supports one rate-limit rule; updating that same rule
avoids a paid service/second rule. Native counters are shared across application
instances **per region**, not globally. A single rule means Preview and Production
requests with the same IP/region share this quota. Separate quotas would require
a different approved plan/design. Per-IP throttling does not defeat IP rotation;
the fresh high-entropy owner password and local scrypt bounds remain necessary.

The canonical path group permits a decisive **pre-merge Production test** after
configuration approval: the old app has no Classroom login handler, so an
observed rule-attributed edge 429 cannot be its local process counter. Use a
bounded burst within one/two windows (21 requests in under 45 seconds), record
region and server request IDs, verify rule-specific firewall evidence, then
verify next-window recovery and that GET/non-login routes are unaffected.
Network failures or generic 429s without attribution are inconclusive. Stop if
enforcement cannot be established; do not merge and hope it works.

After deployment, additionally test accepted/canonicalized route variants and
correct owner login after the throttle window resets. Variants that reach the
handler must not bypass the limit. If a bypass is found, roll back and investigate.

[Official WAF quotas and regional counters](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting),
[condition fields](https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration).

## Verification during this readiness pass

| Check | Result |
| --- | --- |
| ESLint / typecheck / Next production build | Passed |
| Vitest | 177 passed / 34 files |
| Existing Classroom Chrome / Firefox | 14 passed; Python and C#, share/copy, Fix edit/reset, presentation, anonymous isolation |
| New hosted-Production-mode HTTPS suite | 4 passed (Chromium/Firefox browser and API cases); real Secure cookies, CSRF, private reveal, Read/Explain/Fix, warm-teacher then fresh-student isolation, logout |
| Existing Daily Challenge Chromium | 25 passed, including all six stages, drafts, other routes and Run Code OFF |
| Backend | 21 pytest; Ruff clean; mypy clean (11 files) |
| Runtime dependency audit | Zero vulnerabilities reported by npm audit --omit=dev |
| Current live production browser | Read → Explain → Fix passed; Run Code OFF; no runner iframe or requests |
| WebKit browser | Launch attempted; missing GTK4/GStreamer/libsoup and other host libraries. A request-client-only case passed, but that is not browser validation |
| Production distributed throttling | NOT verified live; current policy excludes Production and modification awaits approval |
| Public Production Classroom URLs | Not deployed yet; app behavior proved locally over HTTPS without Vercel SSO. Live acceptance is a release gate |

New HTTPS tests use synthetic guide content only, not private owner answers.
Playwright can capture failed-page text even with trace off; do not upload failure
artifacts from real-guide/live sessions. The test TLS proxy binds fixed loopback
ports and is never used in production. Its temporary certificates are local.

Test-runner integration was repaired: Vitest excludes the new Playwright suite;
ESLint ignores generated test-results folders to avoid a deletion race during
browser startup. No application-source changes were necessary. The existing frontend CI job is
prepared to install Chromium/Firefox/WebKit and run all three HTTPS projects on
Ubuntu once the approved feature push/PR occurs; this has not run remotely yet.

The secret scan covers candidate source/untracked files, all generated Next
artifacts including server files, and outgoing Git blobs, using known guide prose,
full payload/credential values and common key/token patterns. Public origin URLs
are deliberately not treated as secrets. Exact counts are recorded in the local
handoff. No leaked guide/credential match was found. This is targeted verification.

## Gated release after explicit owner approval

1. Confirm the source-confidentiality decision above and scope of approval. Re-read
   current project/env/WAF state and save a private rollback snapshot; stop on
   unrelated unexpected changes. Confirm production app/runner aliases and Run
   Code OFF. Keep existing deployment protection unchanged.
2. Push reviewed readiness commits to the feature branch (may auto-deploy another
   protected Preview); open the PR against current main and wait for all required
   CI jobs. Do not rewrite published history or force-push.
3. Create the four Production variables through a private API body/stdin, inspect
   target metadata, and preserve all existing entries/Preview secrets.
4. Stage only the proposed existing-rule update; review the full draft, publish,
   then prove the Production edge limit/recovery **before merging**. Failure or
   inconclusive attribution stops the release. No new paid resources.
5. Only if CI, security gates and explicit merge/deployment approval all hold,
   merge through the existing main workflow. Vercel will build and deploy
   Production. Do not promote an old Preview (it has Preview origin/secrets).
   Render may auto-deploy the unchanged backend on main under its existing Git
   workflow; monitor health without altering its configuration. Runner is not
   Git-connected and must remain unchanged.
6. Verify the actual Production alias points to the expected merge, while generated
   deployment URLs retain protection. In a normal unauthenticated context, all
   three published /exercises/slug URLs must work without Vercel; the draft must
   reveal no content and the guide API must return 401.
7. Use the new owner password privately for a full Production Read → Explain → Fix
   teaching session, guide reveal/no-store validation, vocabulary, reset and
   presentation. Test a separate anonymous student context after warming teacher
   responses. Verify logout, cookie protections and throttling/variant behavior.
   Record booleans/statuses, not guide values, cookies or screenshots of answers.
8. Rerun the existing Daily Challenge and other production route smoke checks,
   verify no runner requests/iframe/Run Code, and confirm runner alias/source and
   AUD-60 configuration unchanged. Do not announce completed launch until these
   live checks pass.

## Rollback

Baseline frontend deployment: `dpl_CJNgnpvTZ5kBmckYAe6zR7iivVNm`. On a failed
live security/functional gate, stop release/testing and restore that deployment
on the existing frontend project using the approved production rollback path.
Verify production alias, existing routes, backend health and Run Code OFF.
Do not promote Preview, change Render/CORS, or roll back the runner.

Revert the main merge through an ordinary reviewed revert/PR as needed so a later
build cannot silently reintroduce the failed release; no force-push. There are no
database migrations or persisted Classroom student edits to reverse. Existing
Daily Challenge sessionStorage format/source are unchanged.

For a suspected leak, rotate only the new Production auth credentials and deploy
the replacement/cutover; project-variable edits alone do not revoke an old
running deployment. Remove an affected deployment rather than merely supersede
it. Preserve canonical private guides securely and coordinate content remediation
with the owner. Keep secrets out of artifacts/logs.

Retain the targeted login limiter while rolling back app code unless the limiter
itself caused the incident. If policy rollback is necessary, restore only this
rule's saved Preview-only baseline, preserving other current WAF/protection
settings. Do not disable the firewall, remove unrelated variables, delete the
Preview, or perform AUD-60 cleanup as part of this release.
