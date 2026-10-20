# StackSpeak Classroom — AUD-53

Classroom is a local, working teacher tool on `feat/aud-53-classroom-mvp` in
`/tmp/stackspeak-classroom`, based on main `21754ef`. Nothing has been pushed,
merged or deployed. The original AUD-60 checkout and runner are unchanged.

## Design and teaching workflow

Editable proposals, refined in the existing StackSpeak file:

- [Exercise Library](https://www.figma.com/design/n7YeKpNgstVlKSoq46VSjj?node-id=40-717)
- [Teacher Workspace](https://www.figma.com/design/n7YeKpNgstVlKSoq46VSjj?node-id=40-718)
- [Student Exercise — Fix state](https://www.figma.com/design/n7YeKpNgstVlKSoq46VSjj?node-id=40-719)

Frames retain existing components, bound tokens, Inter and JetBrains Mono.
Editable text/components/vectors were checked; no complete-UI raster is used.
The implementation retains approved Logo/Pip assets and existing design tokens.

The library searches across title, language, topics and description and combines
language/topic/level filters. Only populated languages appear. Topic badges and
clear empty-state recovery support fast lesson navigation.

The workspace prioritizes the code surface, with vocabulary/questions/hints on
the right. Read → Explain → Fix navigation moves focus to the stage heading.
Code size is adjustable from 14–28 px, with independent normal/presentation sizes.
Vocabulary links highlight explicitly referenced Read-code lines; they return to
Read rather than guessing line locations in an edited Fix draft. Drafts survive
these stage changes. Line focus is named in a live status and can be cleared.

Private guide content includes spoken explanations, key concepts,
misunderstandings, follow-up questions, corrections and teaching notes. It is
closed by default, fetched only on reveal, and removed/aborted on presentation.
Presentation hides private controls, reduces chrome, enlarges code and keeps a
scrollable support panel. Fix supports syntax coloring, native textarea editing,
line numbers, reset confirmation and Tab-to-next-control. No code is executed.

Four curated lessons remain: Python loop accumulator (20 minutes), Python
mutable defaults (25), C# LINQ deferred execution (25), and a C# async draft (30).
The draft is teacher-accessible but has no public student route. C# examples state
their import/context assumptions and are discussion snippets, not runnable projects.

## Architecture and private-content boundary

The baseline had no auth/database. Classroom reuses existing Next.js server
capabilities and components without new FastAPI routes, database, auth provider,
AI, analytics, synchronization, or execution infrastructure.

`frontend/content/classroom/exercises.json` now holds only exercise/student
material and publication metadata. It contains **no teacher guides**. Versioned
Read examples and hints are deliberately public educational content. Private
answer guides must come from separate runtime configuration:

| Variable | Purpose |
| --- | --- |
| `CLASSROOM_PASSWORD_HASH` | Owner scrypt hash; generated locally, never NEXT_PUBLIC |
| `CLASSROOM_SESSION_SECRET` | Cryptographically random session-signing secret |
| `CLASSROOM_ORIGIN` | Exact HTTPS origin; optional only on Vercel Preview, where trusted `VERCEL_BRANCH_URL` supplies it. Loopback HTTP for local use |
| `CLASSROOM_GUIDES_JSON` | Owner-managed private guide JSON, runtime-only, max 48 KiB |
| `CLASSROOM_GUIDES_FILE` | Absolute external file path for local use only; ignored on Vercel |

No actual values belong in Git, Figma, issue comments, screenshots, command-line
arguments or build logs. `guides.ts` authorizes first, reads only at request time,
validates questions/fields and explicitly projects the response. Missing, invalid
or oversized guides return a no-store 503 with a truthful non-blocking UI state;
there is no source-controlled fallback. The current local guide file is outside
the repo at `/tmp/stackspeak-classroom-private/guides.json`, mode 0600, inside a
0700 directory. It is temporary: the owner should retain a secure copy before
host cleanup. This file is not a deployed resource.

Test fixtures contain deliberately synthetic, non-instructional responses. CI
uses those fixtures and ephemeral auth secrets; it does not require private
teaching material. Classroom browser traces are disabled so private responses
and auth cookies are not automatically captured in trace archives. Screenshots
are taken only with guides closed or removed.

| Route | Boundary |
| --- | --- |
| `/classroom/login` | Owner login or unconfigured state |
| `/classroom` | Server-authorized library |
| `/classroom/exercises/[slug]` | Server-authorized workspace, including drafts |
| `/classroom/api/guide/[slug]` | Teacher authentication before lookup, no-store; anonymous 401 |
| `/exercises/[slug]` | Published/public student DTO only, no teacher payload |
| `/classroom/session`, `/classroom/logout` | Exact-origin POST only |

All student projections use nested allowlists. Teacher page hydration excludes
guides too. Student code and explanation notes stay in component state and are
not sent to any server. Reload/navigation/reset clears them; Daily Challenge
sessionStorage drafts are unaffected. No automatic correctness claim is made.

## Local setup

```bash
cd /tmp/stackspeak-classroom/frontend
npm ci
read -rs -p 'Unique teacher password (16+ characters): ' classroom_password
printf '%s\n' "$classroom_password" | node scripts/classroom-credentials.mjs > .env.local
unset classroom_password
chmod 600 .env.local
# Add CLASSROOM_GUIDES_FILE with the external private path to .env.local.
npm run dev
```

Open `http://localhost:3000/classroom`. This configures local files only.
No production configuration is implied. The single-owner architecture is retained
as requested; multi-account recovery/MFA is outside this scope.

## Verification — security remediation, 2026-10-20

| Check | Result |
| --- | --- |
| Lint, typecheck, production build | Passed |
| Vitest | 173 passed / 33 files |
| Classroom Chromium | 7 synthetic + 7 external real-guide scenarios passed |
| Classroom Firefox | 7 scenarios passed using synthetic private-response fixtures |
| Existing Daily Challenge Chromium | 25 passed, including drafts and Run Code OFF |
| Backend pytest / Ruff / mypy | 21 passed / clean / clean (11 files) |
| Classroom WebKit | Launch failed due missing host libraries; no scenario ran |

The full teacher workflow includes login, Python search, vocabulary, explanation
questions, guide reveal, Fix editing/reset, copy link, and a separately created
unauthenticated student browser context. Student guide access is rejected. Both
C# lessons are exercised, including the private draft's public rejection. Student
HTML and built client JS are checked for private guide values. Unit tests cover
runtime guide validation/failure, data authorization, nested projections, expired
or tampered sessions, CSRF origin checks, local throttling, concurrent password
memory limits, typography, vocabulary references and delayed guide responses.

Presentation screenshots at 1280×720, 1366×768 and 1920×1080 were inspected.
Student layouts are checked at 390/768/1440px. Desktop browser emulation is not a
physical Safari/iPhone test. WebKit needs GTK4, GStreamer, libsoup and other host
packages; no host packages were installed or Safari pass claimed.

Run checks from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run e2e:classroom
node node_modules/@playwright/test/cli.js test -c playwright.classroom.config.ts --project=firefox
npm run e2e
```

The normal Classroom CI script selects Chromium, matching installed CI browsers.
Firefox/WebKit are available as explicit projects for suitably equipped hosts.
Remote CI has not run because the branch has not been pushed.

Screenshots: [Library](library.png), [Teacher](teacher-workspace.png),
[Fix](fix-stage.png), [Student](student-1440.png), [Mobile](student-390.png),
[720p presentation](presentation-1280x720.png),
[Laptop presentation](presentation-1366x768.png),
[1080p presentation](presentation-1920x1080.png).

## Preview readiness

**Not approved for deployment yet.** The implementation is tested locally; the
history cleanup is complete. Remaining gates are activation of the project’s
first WAF configuration with the reviewed preview-only rule, and creation of
branch-scoped secrets once Vercel recognizes the unpublished branch. Existing
deployment protection is retained; effective URL checks require a deployment.
See [security findings and the concrete preview/rollback plan](preview-security-review.md).
No production/runner configuration changed. No provider or database was added.
