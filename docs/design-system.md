# Design system

## Figma reference

**File:** https://www.figma.com/design/n7YeKpNgstVlKSoq46VSjj — this is the visual source of truth for StackSpeak.

As inspected during Sprint 01 (via the Figma MCP `get_metadata`/`get_design_context`/`get_variable_defs` tools), the file contains at least three pages:

- **Cover & Flow** (`0:1`) — a planning document: brand title, tagline, a student-challenge-flow diagram, and screen-status/scope panels. Not implementable UI.
- **Components** (`2:3`) — the real component library, backed by Figma variables: Button, Chip, Badge, Nav Item, Progress Bar, Step Item, Card, Mic Button, Waveform, Test Result Row, Code Editor, Terminal Panel, Stage Stepper.
- **Brand Assets (for approval)** (`12:25`) — logo lockups, app icon, favicon, and the Pip mascot (10 expression variants), plus two annotated "Brand Sheet" reference frames. See [Mascot: Pip](#mascot-pip) below — **correction from an earlier Sprint 01 pass, which wrongly reported this page as nonexistent.**

**Tooling caveat (important for future agents):** `get_metadata` called with no `nodeId` — the "list top-level pages" mode — only returned `0:1` and `2:3` for this file; it silently omitted `12:25` even though that page is real, populated, and directly reachable by ID. The first Sprint 01 pass trusted that listing instead of independently checking the `node-id=12-25` URL it had been given, and incorrectly concluded the brand-assets node didn't exist. **Don't trust the no-`nodeId` page listing as exhaustive for this file — if you have a specific node ID (from a URL, from the brief, from the user), query it directly with `get_metadata`/`get_design_context` rather than relying on it appearing in the top-level listing.**

Given that caveat, the Cover & Flow page's references to "Desktop Screens" and "Tablet & Mobile" pages should be treated as **unconfirmed, not disproven** — they weren't found via the (known-unreliable) top-level listing and no further node IDs for them are available to probe directly. Don't claim they exist, and don't claim they've been ruled out either — re-check directly (e.g. ask the design owner for the exact node IDs) before relying on their absence or presence. See `docs/decisions/0001-figma-screens-unavailable.md` for the full history of this gap.

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

- `Button` — `variant: primary | secondary | ghost`, `size: md | lg`. Renders a `<Link>` when `href` is passed, a native `<button>` otherwise (same visual component, correct semantics).
- `Badge` — `tone: neutral | success | info | error | accent`.
- `Card` — `elevation: flat | elevated`.
- `ComingSoon` — not a Figma component; a Sprint 01 composition of `Badge` + `Card` for routes with no implemented functionality yet.

Components not yet built (Mic Button, Waveform, Test Result Row, Code Editor, Terminal Panel, Stage Stepper, Chip, Progress Bar, Step Item) belong to the challenge workspace, which is out of Sprint 01 scope — build them when the Daily Challenge workspace itself is implemented, against the real Figma specs at that time.

## Responsive behavior

- Nav collapses to a hamburger-triggered menu below Tailwind's `md` breakpoint (`frontend/src/components/layout/SiteHeader.tsx`); verified at common mobile (375px) and desktop (1280px+) widths.
- Page content uses `max-w-*` containers with horizontal padding rather than fixed widths, so it reflows rather than overflowing at intermediate widths.
- No Figma tablet/mobile screens exist to diff against yet (see above) — current responsive behavior is a reasonable default, not a pixel match to an inspected mobile mockup.

## Mascot: Pip

**Correction (post-Sprint-01-review):** Pip's assets *are* accessible in Figma — see the tooling caveat above. They live on the **Brand Assets (for approval)** page (`12:25`), in a component set at `13:293` named "Pip Mascot" with a 10-value `Expression` property: `Idle`, `Listening`, `Thinking`, `Explaining`, `Success`, `Confused`, `Error`, `Idea`, `Coding`, `Celebrating`. Also on that page: a "Logo Icon" set (`12:66`, Theme × Size variants), "Logo Horizontal" set (`12:135`, Theme × Layout), "App Icon" set (`12:808`, 4 styles), and a "Favicon" set (`12:824`, 3 sizes). Two large annotated frames (`13:936` "Brand Sheet — StackSpeak" and `14:237` "Brand Sheet — Pip, Color & Type") document usage rules, clear space, minimum sizes, and the color/type reference above.

**Still not integrated, and that's correct, not a gap:** the brand sheet's own meta text reads *"Brand Assets v0.1 — for approval. Not yet applied to any product screen. Approve before integration."* — these are explicitly unapproved design candidates per the brief's own instruction (§3: "treat them as design candidates until the owner confirms final approval"). This review only corrected the documentation to reflect that the assets exist and are inspectable; it did **not** pull them into the Figma file, export them, or wire any mascot UI into the product — that would be scope expansion pending approval, and Sprint 01's own scope explicitly excludes an animated mascot system. The reserved, empty `frontend/public/mascot/` directory remains the only Sprint 01 scaffolding.

Usage rules worth preserving for whenever this is approved: logo is always the brand signature, Pip never replaces it (never in headers/favicons/app icons); Pip appears at smaller visual weight alongside the logo, in onboarding/empty/celebration states; clear space equal to half the icon height on all sides; minimum sizes of 16px (icon, small weight ≤32px), 140px (compact lockup), 240px (full lockup with tagline).
