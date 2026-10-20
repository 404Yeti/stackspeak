# AUD-53 protected Preview deployment — 2026-10-20

**Deployed and protected; authenticated live acceptance remains pending.** This
record supersedes the pre-deployment gates in preview-security-review.md. No
merge, application production deployment, production variable change, protection
bypass, paid service, Render change or runner change occurred.

## Deployment

- Approved/pushed application commit: `1d7833600c18166bee7698281e26c19d34e4441f`.
- Branch: `feat/aud-53-classroom-mvp`; GitHub comparison confirms exactly this
  one outgoing commit above unchanged main, no backend/runner changes.
- Existing frontend project: `prj_BlU64KE3PavF6PiLRnMCyyfc5UVL` (stackspeak),
  team robert-leybas-projects, root frontend.
- Vercel deployment: `dpl_DjquUp6YjxbCVDfRKX8Cik5Uysdq`, READY, source git,
  Preview target (API target null), public/source exposure false.
- Canonical teacher URL:
  <https://stackspeak-git-feat-aud-53-classroom-mvp-robert-leybas-projects.vercel.app/classroom>
- Immutable deployment:
  <https://stackspeak-7t109o9no-robert-leybas-projects.vercel.app>

Use the branch URL for teacher login: exact-origin CSRF/session binding uses
Vercel's trusted VERCEL_BRANCH_URL. Sign into Vercel normally first; teacher
login is a separate application boundary. The generated teacher password is in
`/tmp/stackspeak-classroom-private/preview-credentials.json` (0600, directory
0700), under the password field. Retrieve it privately on this host, never paste
it into chat, issues, source or screenshots. Retain an owner-controlled secure
copy before temporary-host cleanup. Students still need approved Vercel access
for this protected Preview; copying a student link does not bypass protection.

## Safe release sequence

1. Repeated the targeted history/source/build scan: 241 tracked blobs, 62 outgoing
   blobs, 624 build files, 41 known private/credential comparisons plus token/key
   patterns; zero matches. Old private-guide commit/blob excluded from outgoing
   ancestry. Existing local recovery objects/reflogs remain outside that ancestry.
2. Verified project protection and anonymous redirect to Vercel /sso-api for
   teacher, student, API and asset paths on an existing Preview. Git integration
   is enabled with production branch main and no build-ignore override.
3. Initialized the reviewed WAF rule. First-draft defaults included four global
   CRS log rules; none was published. Disabled those new defaults. Vercel's
   crs.disable operation initialized an empty active base; inspected that state
   (no custom rules, all CRS inactive) before publishing the reviewed rule.
4. Created the remote feature branch at unchanged main first. Any automatic
   deployment at this point contained no Classroom implementation or guides.
5. Created three sensitive variables, target Preview ONLY, gitBranch exactly
   feat/aud-53-classroom-mvp: CLASSROOM_PASSWORD_HASH, CLASSROOM_SESSION_SECRET,
   CLASSROOM_GUIDES_JSON. Verified all earlier environment entries unchanged.
   No values were printed or included in argv/source. No scope widening.
6. Fast-forwarded the branch to 1d78336 after secrets/protection/WAF were ready.
   Git integration automatically built the Preview; no CLI production deployment
   was run. No force-push. The runner project has no Git integration.
7. Verified both actual Preview URLs gate every checked path through normal
   Vercel SSO; neither bypass tokens nor public share grants were created.

## WAF evidence and limitation

Active configuration version 2, rule
`rule_aud_53_classroom_preview_login_V55MbI`:
ALL conditions: environment equals preview, resolved route equals
/classroom/session, method equals POST. Fixed window 60 seconds, limit 10,
key ip, action rate_limit (429). One active custom rule, all global CRS inactive,
no draft or bypass/IP rules. Every production request fails the Preview condition.
Counters are shared across application instances in a region, not globally.
No plan upgrade or new provider/resource was introduced.

The CLI's “published to production” wording means activation of the project WAF
configuration, not an application production deployment.

Eleven anonymous POSTs returned SSO redirects. A second bounded burst of 21 in
6.89 seconds, all in hkg1, also returned 302; no 429 was observed. These requests
never reached the authenticated application. **Configuration is active, but live
rate-limit enforcement has not been established.** Do not claim these probes
passed the throttle test. Normal Vercel-authenticated browser requests are still
needed to test ten/minute enforcement, next-window recovery and route variants.
Do not weaken SSO, add a bypass, or alter the reviewed rule merely to make these
anonymous probes pass.

## Acceptance evidence

| Check | Result |
| --- | --- |
| Vercel build / approved commit / branch | READY / exact match / exact match |
| Both URLs: teacher login/library, guide API, public student, draft student, assets | All 12 anonymous checks redirect to Vercel /sso-api; no guide fields |
| Preview secret association | Deployment runtime key metadata includes all three; branch-specific sensitive scope verified |
| Private source/bundle isolation before push | Targeted scan passed; no known guide/credential values |
| Local exact application commit | Lint/typecheck/build pass; 173 unit tests; 14 synthetic Classroom browser scenarios plus 7 with actual external guides; 25 Daily Challenge; backend 21/Ruff/mypy |
| Remote teacher login, guide reveal, student-with-Vercel-access isolation, Read → Explain → Fix | PENDING normal signed-in Vercel browser session; not reported as passing |
| Shared WAF live 429/recovery | Active by configuration; live acceptance PENDING (anonymous probes redirected) |
| WebKit | Host-library launch failure; no scenario ran |
| Remote GitHub CI | No run: workflow triggers main pushes and PRs; no PR created or merge performed |

No authenticated Vercel browser session is available to this workspace. A normal
session was requested from the owner; no passwords/cookies should be sent in
chat. Until live checks pass, describe this as a protected deployed candidate,
not a fully accepted classroom release. No public student access is enabled.

## Production verification

Before/after production deployment ID:
`dpl_CJNgnpvTZ5kBmckYAe6zR7iivVNm`. Existing environment IDs/types/targets/branches
and ssoProtection metadata unchanged. No Classroom production variables exist;
production Run Code flags remain absent. AUD-60 variables stay Preview-only on
its own branch. No bypass entries. The authorized project WAF initialization is
the only shared project setting change; its sole rule excludes production.

An initial production browser attempt timed out loading the challenge heading.
Read-only follow-up loaded the existing challenge, and the final full production
Read → Explain → Fix smoke PASSED: Run Code OFF, no runner iframe or requests.
No production code/configuration fix was made.

Production runner remains `dpl_51wxJkYvLxdPDNXDUdPuarRJXDin`; runner source and
settings were not modified. Exact alias mapping evidence is retained with the
local release artifacts.

## Rollback — only if requested/needed

1. Stop the mock lesson. Remove this exact Classroom Preview deployment
   dpl_DjquUp6YjxbCVDfRKX8Cik5Uysdq from the existing frontend project; verify
   both its immutable URL and branch alias no longer serve it. Inspect any newer
   deployment on this branch before deleting anything; do not touch production.
2. Rotate the Classroom branch's Preview session secret/hash to revoke sessions.
   Remove its three branch-scoped Classroom secrets when retiring the Preview.
   Remove/revoke only Classroom access grants; do not create bypass tokens.
3. Remove only rule rule_aud_53_classroom_preview_login_V55MbI and publish the
   reviewed remaining WAF configuration. Re-read current rules first; preserve
   unrelated changes. Do not disable project-wide firewall protection blindly.
4. Prevent an immediate Git-triggered recreation before deleting the branch or
   its variables: agree on the cleanup order and check ongoing builds. No branch
   deletion or other teardown is performed by this release record.
5. Reconfirm production app/runner alias IDs, production Run Code OFF and AUD-60
   configuration unchanged. Keep the owner's private guide/password backup
   securely; coordinate deletion of local external files with the owner.

Local evidence files under /tmp include classroom-approved-preview.json,
classroom-live-protection-report.json, classroom-throttle-probes.json and
classroom-alias-evidence.json. Private API snapshots and credential handoff files
must remain outside Git and public attachments.
