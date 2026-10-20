# Classroom preview security review — 2026-10-20

This is the pre-deployment review. See the [subsequent protected deployment
record](protected-preview-deployment.md) for approved actions and current status.

Status: local remediation verified; **not ready to deploy**. No push, deployment,
merge, remote secret creation, protection bypass, paid resource, or production
configuration change occurred. Two platform gates remain below.

## History and private content

The repository is public. Commit `6dd33c4` contained four private Classroom guides;
`27df7aa` removed them from the tree but retained them in ancestry. Neither commit
was found on fetched origin branches. GitHub previously returned no such commit.
This is evidence about current remote refs, not proof nobody ever copied content.

With owner approval, the unpublished Classroom branch was rebuilt directly from
unchanged main `21754efd4c1c8f12dd5bfd2af9d9ac99ace18508`, preserving its sanitized
working tree. The new outgoing history excludes both old Classroom commits and
their guide blobs. Other branches are preserved; no shared history is force-pushed.
Old local objects/reflogs can still retain the original commits for recovery; they
are not part of the outgoing branch. Do not push backup refs or old commits.

Current catalog JSON contains only student exercise material, metadata and hints.
Guides live externally at `/tmp/stackspeak-classroom-private/guides.json` (0600,
directory 0700). Newly generated, unconfigured preview credentials and the guide
payload are retained in `preview-credentials.json` in that same directory (0600).
Do not print, attach, upload as source, or commit either file. The owner needs a
secure retained copy before temporary-host cleanup. No hardcoded login exists.

The existing Daily Challenge answer/instructor source in public main is already
public; this cleanup does not retract it. Correct Read-code examples are also
intentionally public. The confidentiality boundary applies to separate teacher
guides, not to answers a student can independently infer from an exercise.

## Runtime boundary and authentication

- `guides.ts` authorizes before reading `CLASSROOM_GUIDES_JSON`, validates and
  allowlists the result, and has no source fallback. The local-file option is
  ignored on Vercel. Guides are read at request time, never during module loading,
  prerendering or hydration. Maximum payload: 48 KiB; present guides: 5,761 bytes.
- Guide API: anonymous 401 before lookup, private/no-store responses, missing 404,
  unavailable 503. Published AND public required for anonymous student routes;
  drafts stay inaccessible. No guide is included in teacher hydration either.
- Scrypt N=65536/r=8/p=2, timing-safe comparison, body/password size limits and two
  concurrent password checks per instance. The existing ten/minute local counter
  is defense in depth; **it is not a distributed limiter**.
- HMAC sessions: eight-hour expiry, random nonce, origin/password-hash binding;
  HttpOnly, Secure on HTTPS, SameSite Strict, host-only, /classroom cookie path.
  Secret/hash rotation revokes all sessions. Logout clears this browser cookie;
  copied stateless tokens remain valid until expiry or rotation.
- Login/logout POSTs require exact configured Origin. On Vercel Preview only, an
  absent explicit origin can use the platform-supplied `VERCEL_BRANCH_URL`, with
  strict bare *.vercel.app hostname validation. No request/forwarded-host trust.
  Production still requires explicit `CLASSROOM_ORIGIN`; loopback HTTP is local
  only. Open the eventual canonical branch URL, not an alternate deployment URL.
- Browser traces are disabled; screenshots retain closed/removed guides. Missing
  auth/guide configuration fails closed. No changes to runner/execution controls.

## Gate 1: shared login throttle

Prepared and unit-tested [native WAF rule](preview-firewall-rule.json):

- ALL conditions: platform environment `preview`, resolved route
  `/classroom/session`, method POST. Resolved route avoids relying on one raw URL
  spelling; normalization/encoded-path handling still needs deployed testing.
- Fixed window, ten requests/minute/IP, action `rate_limit` (429).
- Shared across function instances within a Vercel region; not a global counter.
  IP rotation and multiple regions can exceed that aggregate limit. Deployment
  Protection and the per-instance resource bound remain necessary layers.
- Production requests cannot satisfy the environment condition. Other preview
  routes, student content, Daily Challenge and runner are excluded.

Verified existing team plan: **Hobby**. Vercel documents one rate-limit rule and
one million allowed rate-limit requests/month included; no paid resource or new
provider is proposed. A plan/usage change requires review before activation.

**Not configured or activated.** The API returned `active: null`, `draft: null`,
empty versions; `/config/active` returned 404. This would be the project's first
WAF configuration. Creating and publishing it would initialize a project-wide
`firewallEnabled` setting, even with this preview-only rule. Because production
configuration changes are prohibited, approval is required for that exact
project-level operation. Do not silently enable managed rules, attack mode,
bypass paths or production-scoped policies.

After approval, re-read current config, add only this rule, review the full draft,
then publish through the existing project's Firewall controls. Preserve any newly
added unrelated rules. If the platform requires a paid service/upgrade, stop.
Do not use `@vercel/firewall` SDK for this preview: its documented preview setup
requires an automation bypass secret, which the owner expressly prohibited.

Live acceptance after an approved deployment: use a Vercel-authenticated browser
with no Classroom session, issue eleven POSTs inside a window, distinguish the
edge 429 from the application's local 429 through firewall request evidence,
check the next-window recovery and alternate/encoded route spellings, and verify
production requests do not match. Local policy tests cannot prove live counters
or that multiple application instances were exercised.

[Official WAF limits](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting),
[rule conditions](https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration),
[SDK preview requirements](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk).

## Gate 2: preview secrets and canonical URL

An attempt to create a sensitive variable with `target: [preview]` and
`gitBranch: feat/aud-53-classroom-mvp` returned HTTP 400, `BAD_REQUEST`, field
`gitBranch`: Vercel does not recognize this unpublished branch. **No variable was
created.** Scope was not widened and no branch was pushed to work around it.

After explicit push/deployment approval, configure only that branch's Preview:
`CLASSROOM_PASSWORD_HASH`, `CLASSROOM_SESSION_SECRET`, `CLASSROOM_GUIDES_JSON`.
Use the external owner handoff file through an authenticated API body/stdin, not
literal shell arguments. Store as sensitive, never NEXT_PUBLIC. Origin can come
from trusted Vercel branch metadata; verify that canonical URL before login.
Do not set any Classroom production variables or runner feature flags.

Vercel project variables are available to build and runtime; **our code reads
these at authorized runtime only**. A build with actual private values present
was scanned, including server artifacts: no known private values were embedded.
This is not a claim that Vercel project operators cannot access secrets. A
strict runtime-only deployment-variable approach can be reviewed separately if
needed; it must preserve protection and keep values out of argv/source/logs.

A Git push can trigger Vercel auto-deployment. Review that effect before approving
push: the initial deployment must remain protected, auth-unconfigured and without
guides until the approved perimeter/secrets are ready. Do not assume that pushing
and deploying are separate platform actions.

[System branch variables](https://vercel.com/docs/environment-variables/system-environment-variables),
[sensitive variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

## Existing project/protection and production verification

- Team `robert-leybas-projects`, ID `team_NiPR0mQIdJXiXOnCbNEqb09K`.
- Existing app **stackspeak**, ID `prj_BlU64KE3PavF6PiLRnMCyyfc5UVL`, root
  `frontend`; this checkout's ignored root `.vercel/project.json` now points here.
  Never reuse the original checkout's runner project link.
- Existing `ssoProtection.deploymentType = all_except_custom_domains` preserved;
  system environment variables already enabled. No protection bypass entries.
  Use only the protected generated preview domains; no custom-domain exemption,
  public share grant or automation bypass token was created.
- Whole-deployment protection must cover `/classroom`, `/classroom/api/guide/*`,
  `/exercises/*` and assets. Verify anonymous HTTP rejection on the exact new
  immutable AND branch URLs before any lesson. No new deployment exists to test.
  Students will still need approved Vercel access, distinct from teacher login.
- Production deployment remains `dpl_CJNgnpvTZ5kBmckYAe6zR7iivVNm`.
- Before/after environment IDs, keys, targets and branches match exactly. No
  Classroom production configuration exists. Production runner flags remain
  absent (Run Code OFF); existing runner variables remain preview-only on
  `test/aud60-device`. Firewall/protection metadata also matches before/after.
- AUD-60 worktree, backend, runner, canary, CSP, sandbox and origin-validation
  source are unchanged. No Render changes.

## Verification

- ESLint, typecheck and Next.js build: passed.
- Vitest: **173 passed / 33 files**, including preview origin/session/CSRF and
  production-exclusion policy checks.
- Classroom: **7 Chromium + 7 Firefox** passed with synthetic fixtures. A separate
  Chromium run with external actual guides: **7/7 passed**, including public
  HTML/client-bundle checks and unauthenticated guide rejection.
- Existing Daily Challenge Chromium: **25/25**; includes drafts and Run Code OFF.
- Backend: **21 pytest**, Ruff clean, mypy clean (11 files).
- WebKit: attempted again; launch fails for missing GTK4/GStreamer/libsoup and
  other host libraries. No scenario ran; no WebKit/Safari pass is claimed.
- Targeted scans compare actual private guide/credential values and common token/
  private-key patterns against tracked files, outgoing Git objects and generated
  output. This is bounded verification, not a universal secrets detector or
  independent security review. Screenshots contain no revealed guides.

## Deployment and rollback plan

Only after the two gates and separate deployment approval, recheck the existing
project link and sanitized history; candidate repo-root command:

```bash
vercel deploy --target=preview --scope robert-leybas-projects
```

Never `--prod`, `--public`, promote, or create a bypass token. Verify deployment
branch association and branch-specific secret scope. Recheck protection on both
URLs, shared edge 429, teacher/student workflows, private no-store headers, public
HTML/assets and production identity/Run Code OFF. Do not invite students before
those checks pass. This local verification is not live preview acceptance.

Rollback: stop testing, remove the exact Classroom preview deployment(s), rotate
only the preview session secret/hash and revoke preview access grants. Remove
only the Classroom branch secrets and Classroom limiter rule after approval;
check other project rules before editing. If this was the first WAF configuration,
restore its captured prior state only with approval rather than overwrite later
unrelated changes. Delete vulnerable previews rather than merely supersede them.
Confirm production identity/flags and AUD-60 remain unchanged. Retain the owner's
private content backup securely; coordinate any local-file deletion with them.
