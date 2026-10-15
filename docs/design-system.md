# Design system

## Figma reference

**File:** https://www.figma.com/design/n7YeKpNgstVlKSoq46VSjj — this is the visual source of truth for StackSpeak.

As inspected during Sprint 01 (via the Figma MCP `get_metadata`/`get_design_context`/`get_variable_defs` tools), the file contains exactly two pages:

- **Cover & Flow** (`0:1`) — a planning document: brand title, tagline, a student-challenge-flow diagram, and screen-status/scope panels. Not implementable UI.
- **Components** (`2:3`) — the real component library, backed by Figma variables: Button, Chip, Badge, Nav Item, Progress Bar, Step Item, Card, Mic Button, Waveform, Test Result Row, Code Editor, Terminal Panel, Stage Stepper.

The cover page's own text references "Desktop Screens" and "Tablet & Mobile" pages that **do not exist in this file** — there are no landing page, dashboard, or challenge-workspace mockups to inspect yet. The Pip mascot / brand-assets node referenced in early planning (`node-id=12-25`) also does not exist in the file's node tree. See `docs/decisions/0001-figma-screens-unavailable.md` for how Sprint 01 handled this gap. Don't claim either exists in future work without re-checking the file.

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

Pip's brand assets are marked for approval in the product brief and are not present in the Figma file as of Sprint 01 (see above). No mascot UI, image, or animation is implemented. The only Sprint 01 scaffolding is a reserved `frontend/public/mascot/` directory for assets once they're approved and exported — nothing references it yet.
