# ADR 0001: Build Sprint 01 UI from component tokens, not screen mockups

**Status:** Accepted
**Date:** 2026-10-15

## Context

The Sprint 01 brief instructs using Figma as the visual source of truth and references a homepage, student dashboard, and challenge workspace screens, plus a Pip mascot asset at a specific node ID (`node-id=12-25`).

Inspecting the actual Figma file (`n7YeKpNgstVlKSoq46VSjj`) via the MCP `get_metadata` tool with no `nodeId` (its "list top-level pages" mode) showed only two pages: **Cover & Flow** (a planning diagram) and **Components** (a real, variable-backed component library). Based on that, the original Sprint 01 pass concluded the "Desktop Screens"/"Tablet & Mobile" pages referenced in the file's own cover text, and the Pip mascot/brand-assets node, did not exist.

**Correction (owner-requested review, same day):** this was wrong for the mascot/brand-assets node. Directly querying `get_metadata`/`get_design_context` with `nodeId: "12:25"` — the exact ID from the brief's URL — resolves to a real, fully-populated third page, **Brand Assets (for approval)**: logo icon/horizontal lockups, app icon, favicon, a 10-expression Pip mascot component set, and two annotated brand-sheet reference frames. The no-`nodeId` top-level listing simply doesn't enumerate this page, even though it's directly reachable — a tooling gap, not a content gap. The root cause of the original miss: the first pass trusted that listing instead of independently querying the specific node ID it had already been given. See `docs/design-system.md` for the corrected findings and the tooling caveat now documented for future agents.

The "Desktop Screens"/"Tablet & Mobile" pages remain **unconfirmed, not disproven** — given the listing is known to be unreliable, their absence from it doesn't prove they don't exist, but no node ID for them has been found or supplied to check directly either.

## Decision

Build the Sprint 01 homepage, navigation, and Daily Challenge placeholder directly from the confirmed Components-page tokens and component specs (Button, Badge, Card, Nav Item), rather than inventing a competing layout to stand in for a screen that was never actually inspected. No mascot UI is implemented — even though the Pip assets turned out to be accessible, the brand sheet's own text marks them "for approval... not yet applied to any product screen. Approve before integration," so they stay out of the UI regardless, per the brief's instruction to treat unapproved brand assets as design candidates only. Only a reserved, empty asset directory is scaffolded.

## Consequences

- Sprint 01 UI layout (hero, section ordering, card placement) is original composition against real design tokens, not a 1:1 implementation of an inspected mockup — because no screen mockup is accessible (this part of the original finding held up).
- When real screen designs are added to the Figma file (or an existing node ID for them is supplied), the homepage and Daily Challenge page should be revisited and reconciled against them.
- When the Pip/brand assets are approved by the design owner, mascot integration is a separate, explicitly-scoped follow-up — not automatic from this ADR.
- Process takeaway: when a specific Figma node ID is in hand, query it directly rather than trusting a broader listing call to surface it. This repo's `docs/design-system.md` now carries that caveat for this file specifically.
