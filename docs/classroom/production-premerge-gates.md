# AUD-53 — Approved pre-merge gate evidence

Recorded 2026-10-20 for [PR #10](https://github.com/404Yeti/stackspeak/pull/10).
Application/test commit: `9771e5bed619dd9c986b72cf14740f53fc926204`.
**No main merge or Production application deployment has been performed. Final
owner merge/release approval is still required.** This record supersedes the
pending-approval configuration status in the earlier
[readiness audit](production-readiness.md); that document retains the detailed
authentication audit, release procedure and rollback plan.

## Source and content

- Sanitized branch pushed normally; no force-push. Main remains unchanged.
- Targeted scan: 44 known private-value checks, 253 source files, 621 generated
  Next artifacts and 78 outgoing Git blobs across three commits: no findings.
  Old commits containing private guides are not ancestors. This is a targeted
  scan, not a guarantee against every possible secret pattern.
- Both C# seeds contain student-facing code, vocabulary, questions and hints,
  without private guide fields, credentials, confidential company examples or
  identifiable copied third-party exercise content. They were authored for this
  MVP; the review does not independently establish universal copyright provenance.
- The owner accepted the public-source async draft subject to this review.
  Its source remains public. It is still draft/private in the catalog, denied by
  student routes and excluded from public exercise listings. Do not use public
  source storage for future confidential student exercises.
- Private teacher guides remain outside Git, loaded only after server-side
  authorization from runtime configuration. No real guide or secret values are
  included in this record, CI fixtures or browser artifacts.

## CI and application boundaries

[CI run 39400292786](https://github.com/404Yeti/stackspeak/actions/runs/39400292786)
passed frontend, backend, e2e and runner jobs on 9771e5b. Vercel Preview passed.

| Check | Evidence |
| --- | --- |
| Frontend | Lint, build, typecheck, unit tests passed |
| Backend | Ruff, mypy, pytest passed; no backend changes |
| Daily Challenge browser suite | 25 passed |
| Classroom browser workflow | 7 Chromium cases passed; additional Chromium/Firefox coverage was run locally during readiness |
| Production-mode local HTTPS Classroom security | 6 passed: Chromium, Firefox and WebKit browser/API cases |
| Existing Run Code UI regression suite | 17 passed; test-only execution flags do not affect Production |
| Unchanged runner browser suite | 88 passed, 2 expected Chromium-specific skips in other browsers |
| Live existing Production | Read → Explain → Fix passed; Run Code OFF, no runner iframe/requests |

The HTTPS suite verifies Secure/HttpOnly/SameSite cookies, teacher authorization,
CSRF rejection, private guide reveal/no-store, presentation hiding, Fix editing
and reset, logout, fresh anonymous access to all three published student
exercises, guide 401 and denial of the draft. It uses synthetic private content.
This establishes application behavior, not post-release live acceptance.

Main has no configured branch protection or repository ruleset. All listed
checks are mandatory gates for this agent's release process; GitHub does not
enforce them against an independent manual merge. No repository policy was
changed. Require successful checks on the final PR head before owner approval.

## Production configuration applied with approval

Existing project: `stackspeak`, team `robert-leybas-projects`, root `frontend`.
Four new sensitive variables have target **Production only**, no branch scope:

- `CLASSROOM_PASSWORD_HASH`: fresh, independently generated owner credential.
- `CLASSROOM_SESSION_SECRET`: fresh independent signing secret.
- `CLASSROOM_ORIGIN`: verified canonical origin `https://stackspeak.vercel.app`.
- `CLASSROOM_GUIDES_JSON`: approved private lesson content, separate Production
  variable; no public/source fallback.

Production authentication credentials differ from Preview. All pre-existing
environment entries and their scopes/IDs remain unchanged. No Production runner
flags exist. Changing project variables did not deploy or alter the existing
Production runtime snapshot. The future main deployment must build with these
Production values; do not promote a Preview deployment.

Deployment Protection remains `all_except_custom_domains`, with zero bypass
tokens. Anonymous teacher, guide and student Preview requests still receive
Vercel SSO redirects. The existing public Production alias permits anonymous
student sharing after release without relaxing Preview protection.

## Production WAF proof

Active configuration version **3**, existing rule
`rule_aud_53_classroom_preview_login_V55MbI`, matches the reviewed
[policy](production-firewall-rule.proposed.json). The Preview condition group and
10 requests / 60 seconds / IP action are unchanged. Only explicit Production
POST login route/path groups were added. Other firewall settings are unchanged.
Vercel's direct PATCH applied the update immediately, rather than staging a
draft; the helper stopped on that assumption mismatch. A complete readback
verified exactly the authorized active policy and no unrelated differences.
No subsequent publish or other configuration write was necessary.

A bounded 21-request empty-form burst to the currently unused Production
`/classroom/session` path took **5.54 seconds**, all in `hkg1`:

- First 10 requests: existing application **404**.
- Next 11 requests: edge **429**.
- Rule/host/path-filtered Vercel firewall telemetry: exactly **11 rate-limit**
  events, matching the observed 429 count.
- A single request **194.76 seconds** after the last burst request returned 404
  again in the same region, proving recovery after the window.
- Control GET `/classroom/session`: 404; GET `/` and `/daily-challenge`: 200.

No account passwords, cookies, bypass tokens, spoofed IPs or real user login
attempts were used. The current app has no Classroom handler, so its process
counter cannot explain these 429s. Native WAF counters are distributed across
instances per region, not globally; Preview and Production share this one
rule's quota for the same IP/region. See
[Vercel's rate-limiting documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

## Unchanged Production and remaining release gate

Readback confirms existing app deployment
`dpl_CJNgnpvTZ5kBmckYAe6zR7iivVNm` and runner deployment
`dpl_51wxJkYvLxdPDNXDUdPuarRJXDin` still own their Production aliases. Production
Run Code remains OFF. AUD-60, runner/CSP/canary/sandbox, Render configuration and
Daily Challenge source were not changed by this gate pass.

After final explicit approval, merge through main's existing workflow and run
the documented live acceptance tests: actual owner login, guide access, public
student links in a separate anonymous context, draft denial, Read → Explain →
Fix, logout, normalized login variants, existing routes and Run Code OFF.
Those live Classroom checks cannot be claimed before deployment.

Rollback remains the baseline app deployment above and an ordinary reviewed
revert of the merge. Retain the login limiter unless it caused the incident;
if necessary, restore only its saved Preview-only rule, preserving unrelated
protections. No database migration, runner rollback or Render/CORS change is
required. Secret revocation requires runtime deployment/cutover, not only env
metadata editing. Do not perform rollback operations without the applicable
release/incident authorization.
