# ADR 0001: Build Sprint 01 UI from component tokens, not screen mockups

**Status:** Accepted
**Date:** 2026-10-15

## Context

The Sprint 01 brief instructs using Figma as the visual source of truth and references a homepage, student dashboard, and challenge workspace screens, plus a Pip mascot asset at a specific node ID.

Inspecting the actual Figma file (`n7YeKpNgstVlKSoq46VSjj`) via the MCP `get_metadata` tool showed it contains only two pages: **Cover & Flow** (a planning diagram) and **Components** (a real, variable-backed component library). The "Desktop Screens" and "Tablet & Mobile" pages referenced in the file's own cover text do not exist. The Pip mascot/brand-assets node does not exist in the file's node tree either.

## Decision

Build the Sprint 01 homepage, navigation, and Daily Challenge placeholder directly from the confirmed Components-page tokens and component specs (Button, Badge, Card, Nav Item), rather than inventing a competing layout to stand in for a screen that was never actually inspected. No mascot UI is implemented; only a reserved, empty asset directory is scaffolded.

## Consequences

- Sprint 01 UI layout (hero, section ordering, card placement) is original composition against real design tokens, not a 1:1 implementation of an inspected mockup — because no such mockup is accessible.
- When real screen designs are added to the Figma file, the homepage and Daily Challenge page should be revisited and reconciled against them.
- This should be flagged to the design owner: either the screens need to be added to this file, or the brief should be corrected to point at wherever they actually live.
