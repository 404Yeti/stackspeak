# Design system

## Figma reference

**File:** https://www.figma.com/design/n7YeKpNgstVlKSoq46VSjj — this is the visual source of truth for StackSpeak.

As inspected during Sprint 01 (via the Figma MCP `get_metadata`/`get_design_context`/`get_variable_defs` tools), the file contains at least four pages:

- **Cover & Flow** (`0:1`) — a planning document: brand title, tagline, a student-challenge-flow diagram, and screen-status/scope panels. Not implementable UI.
- **Components** (`2:3`) — the real component library, backed by Figma variables: Button, Chip, Badge, Nav Item, Progress Bar, Step Item, Card, Mic Button, Waveform, Test Result Row, Code Editor, Terminal Panel, Stage Stepper.
- **Brand Assets (for approval)** (`12:25`) — logo lockups, app icon, favicon, and the Pip mascot (10 expression variants), plus two annotated "Brand Sheet" reference frames. See [Mascot: Pip](#mascot-pip) below — **correction from an earlier Sprint 01 pass, which wrongly reported this page as nonexistent.**
- **Desktop Screens** (`2:4`) — contains `9:487`, "01 Marketing Landing Page": the single, complete approved homepage frame (Product Navigation → Hero → How It Works → Course Previews → Benefits → Final CTA → Footer), confirmed 2026-10-15 and implemented in [AUD-54](https://linear.app/failed-training/issue/AUD-54). Same discoverability gap as Brand Assets below — this page wasn't found via the no-`nodeId` listing either, only once the owner supplied node `9:487` directly.

**Tooling caveat (important for future agents):** `get_metadata` called with no `nodeId` — the "list top-level pages" mode — only returned `0:1` and `2:3` for this file; it silently omitted `12:25` (Brand Assets) in Sprint 01, and `2:4` (Desktop Screens) remained unconfirmed until AUD-54 supplied node `9:487` directly. Both pages are real, populated, and directly reachable by ID. **Don't trust the no-`nodeId` page listing as exhaustive for this file — if you have a specific node ID (from a URL, from the brief, from the user), query it directly with `get_metadata`/`get_design_context` rather than relying on it appearing in the top-level listing, and never infer a frame's existence or location from component instance counts alone.** See `docs/decisions/0001-figma-screens-unavailable.md` for the full history of this gap.

## Design tokens

Pulled from the Components page via `get_design_context` (not hand-copied from the fallback table in the sprint brief — confirmed against the real Figma variables). Defined as CSS custom properties in `frontend/src/app/globals.css` and exposed as Tailwind v4 utilities through `@theme inline`.

| Token | Value | Tailwind utility | Figma source |
|---|---|---|---|
| Background | `#0b1020` | `bg-background` | matches sprint-brief fallback (page canvas, not an explicit component variable) |
| Surface | `#131b2e` | `bg-surface` | `--color-bg-surface` (Card/Flat) |
| Elevated surface | `#1c2740` | `bg-elevated` | `--color-bg-elevated` (Card/Elevated, Button/Secondary) |
| Border (subtle) | `#2a3756` | `border-border-subtle` | `--color-border-subtle` (Card, Button/Secondary, Nav Item icon) |
| Accent / primary purple | `#8b5cf6` | `bg-accent` / `text-accent` | `--color-bg-accent` (Button/Primary), `--color-border-accent` |
| Accent (soft) | `#a78bfa` | `text-accent-soft` | `--color-text-accent` (Button/Ghost, Badge/Accent) |
| Success | `#34d399` | `text-success` | `--color-text-success` (Badge/Success) |
| Info / accent blue | `#60a5fa` | `text-info` | `--color-text-info` (Badge/Info) |
| Error | `#f87171` | `text-error` | `--color-text-error` (Badge/Error) |
| Text primary | `#f8fafc` | `text-text-primary` | `--color-text-primary` |
| Text muted | `#94a3b8` | `text-text-muted` | `--color-text-muted` |
| Text on accent | `#ffffff` | `text-text-on-accent` | Button/Primary label color |
| Icon muted | `#64748b` | `text-icon-muted` | Nav Item default icon stroke |
| Radius sm/md/lg/full | `6px / 10px / 14px / 999px` | `rounded-sm/md/lg/full` | `--radius-md`, `--radius-lg`, `--radius-full` |
| Spacing xs–xl | `4 / 8 / 12 / 16 / 24px` | Tailwind default scale | `--space-xs…--space-xl` |

The Brand Sheet (`12:25` → `13:936`/`14:237`) independently confirms the product-UI palette above (Brand Purple `#8B5CF6`, Brand Blue `#60A5FA`, Emerald/Speak `#34D399`, Ink/Canvas `#0B1020`, Surface `#131B2E`, Text `#F8FAFC`, Muted `#94A3B8`) and adds two **Pip-only** accent colors, not used anywhere in the current product UI and not wired into Tailwind tokens yet:

| Token | Value | Scope |
|---|---|---|
| Error (Pip only) | `#F87171` | matches the existing `text-error` token — reused, not new |
| Idea (Pip only) | `#FBBF24` (amber) | **new** — only appears on Pip's "Idea" expression; no product-UI usage yet, not added to `globals.css` |

Icon border treatment: a `#8B5CF6 → #60A5FA` gradient, used on the logo icon — not currently used in product UI.

## Typography

- **Interface:** Inter (`next/font/google`, variable `--font-inter`), loaded in `frontend/src/lib/fonts.ts`.
- **Code:** JetBrains Mono (`--font-jetbrains-mono`), reserved for the future code-editor/terminal components — not yet rendered anywhere in Sprint 01 since no code surface exists yet.

Confirmed type scale from Figma: label/md = Inter Medium 14/20, label/sm = Inter Medium 12/16 (tracking 0.2px), heading/h3 = Inter SemiBold 18/26, body/md = Inter Regular 14/22.

## Component conventions

Figma components become React components under `frontend/src/components/ui/`, matching the Figma component name and prop shape (variant/size/tone) 1:1 where practical:

- `Button` — `variant: primary | secondary | ghost`, `size: md | lg`. Renders a `<Link>` when `href` is passed, a native `<button>` otherwise (same visual component, correct semantics). As of AUD-54, `disabled` gets visible styling (`disabled:cursor-not-allowed disabled:opacity-50`) — used for the homepage's `Log in`/`Sign up`, which have no backing auth system yet (see `MicButton` for the same "no fake controls" precedent).
- `Badge` — `tone: neutral | success | info | error | accent`.
- `Card` — `elevation: flat | elevated`. As of AUD-54: `highlighted?: boolean` swaps the border to `border-accent`, used for the flagship course card on the homepage.
- `ComingSoon` — not a Figma component; a Sprint 01 composition of `Badge` + `Card` for routes with no implemented functionality yet.

### AUD-50 additions (workspace/app-shell components)

All built against the real Figma specs for their respective nodes, pulled fresh during AUD-50 planning:

- `Chip` — `selected: boolean`.
- `ProgressBar` — **deviates from the Figma enum on purpose** (approved by the project owner): takes a continuous `value: number` (0–100, clamped) instead of Figma's `25 | 50 | 75 | 100` steps. Same visual output at each of those four checkpoints; `role="progressbar"` with `aria-valuenow/min/max`.
- `StepItem` / `StageStepper` — `StageStepper` fixes the six stages (Read→Feedback) and derives each `StepItem`'s `done | active | upcoming` state from a single `stage` prop. `StepItem` renders a plain `<span>`, not an `<li>`, so it stays valid when `StageStepper` (which does own the `<li>`s) wraps it — using it bare elsewhere won't produce invalid list nesting.
- `MicButton` — **always rendered `disabled`**, regardless of `state`. There is no audio capture anywhere in the app, so nothing here is a working control; the accessible label says "preview only" / "not yet available" for every state.
- `Waveform` — static bar heights matching the approved spec exactly; never animates, since there's no real audio to visualize.
- `CodeEditor` — **read-only only.** Figma's spec includes an "Editable" visual mode, but it isn't implemented: an "Editing" badge over text nobody can actually edit would itself be a fake control. Revisit this once a real edit/save/run path exists.
- `TerminalPanel` / `TestResultRow` — presentational only; whoever composes them is responsible for clearly labeling the data as sample output, since the components themselves don't know whether their data is real.
- `Logo` — the real downloaded icon asset (`frontend/public/brand/logo-icon.svg`) plus the wordmark as live text matching the approved colors exactly (Stack in primary text, Speak in emerald/`text-success`) rather than an image, so it stays crisp and accessible. Used only in `SiteHeader`, per the approved scope — not introduced anywhere else.
- `PipMascot` — wraps the 10 downloaded expression PNGs (`frontend/public/mascot/`). Static images only; no animation, no implied awareness of what the student is doing.

### AUD-54 additions (homepage sections + marketing nav)

Built against the real Figma spec for node `9:487` (see above). All homepage-only sections live under `frontend/src/features/home/`:

- `Logo` — gained `size?: "sm" | "lg"` (default `"sm"`, unchanged). `"lg"` is the marketing lockup and uses a **dedicated asset** (`frontend/public/brand/logo-icon-sm.svg`, despite the filename — it's Figma's own "Small" size variant), not a CSS-scaled copy of the default icon: diffing the two exported SVGs showed Figma deliberately draws a thicker relative stroke at the smaller size for legibility, so scaling the existing asset would have been visually wrong.
- `MarketingNav` (`frontend/src/components/layout/MarketingNav.tsx`) — a new homepage-only nav, rendered by `SiteHeader` when `pathname === "/"` (every other route keeps the existing in-app nav, untouched). Links: Courses, Daily Challenge, Interview Practice, How it works (`#how-it-works` anchor); `Log in`/`Sign up` as disabled `Button`s (see Button above). **Responsive deviation from Figma (which only specifies 1440px):** the inline nav doesn't appear until the `lg` breakpoint (1024px), not Tailwind's default `md` (768px) — found via Playwright QA, where the full link row + auth buttons visibly wrapped/overlapped the logo at 768px. A `lg:px-10` gutter narrower than the Figma-exact `xl:px-[120px]` buys extra room in the 1024–1279px range.
- `Hero`, `CoursePreviews`, `Benefits` — straightforward compositions of existing components (`CodeEditor`, `MicButton`, `Waveform`, `Card`, `Badge`) against the Figma copy and layout; no new primitives needed.
- `FinalCta` — deliberately **not** built on `Card`: its shape (centered content, asymmetric padding, accent border, no shadow) didn't fit Card's existing API without special-casing it for a one-off section.
- `LearningSequence` — rewritten for AUD-54 to match Figma's 4-step "How It Works" section (was 6 steps pre-AUD-54) and to compose `Card` instead of duplicating its border/background styling.
- `SiteFooter` — updated to the Figma-exact tagline (`StackSpeak — Read it. Explain it. Fix it. Defend it.`, no copyright line) and 5 links (Courses, Practice Lab, Interview Practice, Privacy, Terms). `Interview Practice`, `Privacy`, and `Terms` didn't have routes before AUD-54 — see below.
- Three new `ComingSoon`-backed stub routes: `/interview-practice`, `/privacy`, `/terms` — same pattern as the pre-existing `/courses` and `/practice-lab`, added so the new nav/footer links go somewhere real instead of a dead link or a non-clickable pseudo-link.
- `BackendStatus` (the Sprint-01 "System status" widget on the old homepage) — **deleted**. It was a dev diagnostic, never part of any approved design; backend connectivity is verified directly against the API in QA instead of via a homepage widget.

### Why PNG for Pip but SVG for the logo

Figma's SVG export for Pip returns 15–20 tiny fragment files per expression (eyes, headphones, antenna, etc. as separate vector layers), not one clean file — not something worth hand-reassembling. The single rasterized PNG export per expression is the pragmatic, faithful choice. The logo icon, by contrast, exported as one clean 942-byte SVG, so that's what's used — vector where it's clean, raster where it isn't.

## Responsive behavior

- In-app nav (`SiteHeader`, every route except `/`) collapses to a hamburger-triggered menu below Tailwind's `md` (768px) breakpoint; verified at common mobile (375px) and desktop (1280px+) widths.
- Homepage marketing nav (`MarketingNav`, `/` only) collapses to a hamburger below `lg` (1024px) instead — see "AUD-54 additions" above for why 768px doesn't fit.
- Page content uses `max-w-*` containers with horizontal padding rather than fixed widths, so it reflows rather than overflowing at intermediate widths.
- As of AUD-50: verified with real browser screenshots (Playwright) at 320, 390, 768, and 1440px on both `/` and `/daily-challenge` — zero horizontal overflow at any width, `CodeEditor`'s code block scrolls internally rather than pushing the page wider.
- As of AUD-54: re-verified at the same four widths on the rebuilt homepage plus all other routes — zero horizontal overflow, zero console errors, functional nav/CTAs/hamburger at every width. Figma specifies only the 1440px desktop frame for the homepage; the 768px nav-overlap bug above was caught by this QA pass, not by diffing against an inspected mobile mockup — none exists for this frame either.

## Mascot: Pip

**✅ Brand assets approved — 2026-10-15, by project owner (Robert Leyba).** The StackSpeak logo, full brand identity/design system, and the Pip mascot (all 10 expressions) on the **Brand Assets** page (`12:25`) are officially approved as the visual source of truth. This supersedes the "(for approval)" status in the Figma page name and brand-sheet text below — treat the approval recorded here as current, not the stale in-file label. **This is an approval of the assets' design, not authorization to implement them** — integration is tracked separately in [AUD-50](https://linear.app/failed-training/issue/AUD-50/implement-responsive-stackspeak-design-system-and-app-shell), which has not been started.

**Do not redesign the approved logo, colors, typography, or Pip mascot without requesting new approval.** Treat them as fixed inputs; implementation work should faithfully translate them, not reinterpret them.

They live on the **Brand Assets** page (`12:25`), in a component set at `13:293` named "Pip Mascot" with a 10-value `Expression` property: `Idle`, `Listening`, `Thinking`, `Explaining`, `Success`, `Confused`, `Error`, `Idea`, `Coding`, `Celebrating`. Also on that page: a "Logo Icon" set (`12:66`, Theme × Size variants), "Logo Horizontal" set (`12:135`, Theme × Layout), "App Icon" set (`12:808`, 4 styles), and a "Favicon" set (`12:824`, 3 sizes). Two large annotated frames (`13:936` "Brand Sheet — StackSpeak" and `14:237` "Brand Sheet — Pip, Color & Type") document usage rules, clear space, minimum sizes, and the color/type reference above.

**Not yet integrated into the product — correctly, pending AUD-50:** approval of the design is not the same as scheduling the work. No mascot UI, updated logo usage, or new brand-asset exports have been added to the frontend as part of this approval — that's explicitly AUD-50's job, not something to pull in incidentally. The reserved, empty `frontend/public/mascot/` directory remains the only scaffolding. (History: see `docs/decisions/0001-figma-screens-unavailable.md` for how this page was initially — incorrectly — reported as missing, and the tooling caveat above for why.)

Usage rules to carry into AUD-50 implementation: logo is always the brand signature, Pip never replaces it (never in headers/favicons/app icons); Pip appears at smaller visual weight alongside the logo, in onboarding/empty/celebration states; clear space equal to half the icon height on all sides; minimum sizes of 16px (icon, small weight ≤32px), 140px (compact lockup), 240px (full lockup with tagline).
