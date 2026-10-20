# ADR 0005 — Classroom content and teacher access

Status: local MVP implemented; single-owner access retained by owner instruction. Public deployment and production authentication are not approved.

## Context

AUD-53 now scopes the owner's Classroom MVP: search a small exercise library,
teach through Read → Explain → Fix, privately consult spoken examples and notes,
and share an anonymous student-safe view. Main 21754ef has no auth or database.
The existing public Daily Challenge review response intentionally exposes a
reference implementation and cannot be repurposed as a private guide endpoint.

## Decision

Use version-controlled student-safe JSON with runtime validation and explicit TypeScript DTOs. Teacher guides are separately supplied at authenticated runtime through CLASSROOM_GUIDES_JSON (hosted) or an external local file. There is no source-controlled guide fallback.
Load the content only through a `server-only` Next.js module. Teacher data access
functions require a verified teacher session before reading records; guide API
access additionally returns an explicit 401 to anonymous callers. Public sharing
requires both published and public status and projects an explicit nested
allowlist. Do not send internal records to client components, even for teachers.
Fetch private guides on deliberate reveal through a no-store endpoint.

This is a small scoped extension to the original architecture: static Classroom
content and owner sessions live in the existing Next.js server, with no new
FastAPI routes, network hop, database, provider, or infrastructure. Business logic
for the existing challenge flow remains in FastAPI. Reconsider placement if
Classroom gains authoring, multiple users, or persistence.

For the local prototype, use a single environment-configured owner password hash
and signed, expiring HttpOnly session cookie. No provider/database is introduced.
Scrypt parameters are N=65536/r=8/p=2; session signature binds the origin and
password hash, so rotating the secret/hash revokes all sessions. Cookie is Secure
on HTTPS, SameSite Strict, host-only and scoped to /classroom. Login/logout POSTs
require the exact configured Origin. Invalid/missing configuration fails closed.
Authentication runtime access uses `connection()` before reading cookies/time,
inside a Suspense boundary under the repo's existing Cache Components setting.
No authentication result or teacher payload uses `use cache`.

The process-local login attempt cap is defense in depth for local review, not a
shared production limiter. **Public exposure requires approved authentication
review and shared/platform brute-force protection.** Multi-teacher access would
instead justify a managed auth decision. Production configuration remains absent.

Reuse the existing brand, editors and native controls. Add an optional escaped
React-token slot to CodeEditor, not a parser/runtime dependency. Classroom's
editable code uses CodeInput with a decorative syntax overlay and explicit syntax
preview. Presentation unmounts guides and aborts/discards in-flight responses.
Code and notes stay in local component state and are never submitted or executed.

## Consequences

- Fast local teaching workflow without changes to AUD-60 or Daily Challenge.
- Public exercise URLs are deliberately shareable; they are not student identity
  or classroom/session tokens. Private drafts have no public route.
- The public GitHub source reveals committed guides. Current tracked guides have been removed; the owner-approved unpublished history was rebuilt from unchanged main, excluding 6dd33c4 and 27df7aa from outgoing ancestry. Existing public Daily Challenge source is not made private by this change.
- No persistent edits, accounts/recovery UI, per-user revocation, MFA, execution,
  grading, live collaboration, analytics, or deployment is claimed.
- The local auth choice and new three-screen Figma proposals remain reviewable
  recommendations; they do not authorize production rollout.

See [Classroom audit, designs, setup and preview plan](../classroom/README.md).
Authentication API patterns were checked against the official
[Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication),
[cookie API](https://nextjs.org/docs/app/api-reference/functions/cookies), and
[Node crypto API](https://nodejs.org/api/crypto.html).

## Polish/security addendum

Adjustable normal/presentation typography, vocabulary Read-line references,
stage-heading focus, common misunderstandings and follow-up questions are now
implemented. Private guide parsing validates and projects its own response shape
at request time; missing/invalid data returns unavailable. Test material is
explicitly synthetic and browser traces are off. Scrypt concurrency is capped
at two per instance; this does not solve shared throttling.

See the [current exposure audit and protected preview gates](../classroom/preview-security-review.md).
Vercel identity/protection/variable names were checked read-only; production
deployment and Run Code settings remained unchanged. No deployment is approved.

## Preview security remediation

The unpublished branch is sanitized. Trusted Vercel Preview branch metadata may
supply the exact canonical origin when explicit configuration is absent; this
fallback never applies to production and never trusts request headers. A reviewed
native preview-only WAF rule is prepared and tested, but not activated: the first
project WAF configuration needs approval for its project-level enablement. Vercel
rejected branch-scoped secret creation for the unpublished branch; scope was not
widened. Neither shared throttling nor hosted secrets are claimed operational.
Existing whole-preview protection and production configuration are unchanged.
