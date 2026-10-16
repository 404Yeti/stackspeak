# ADR 0002: First interactive challenge flow — self-review, not evaluation

**Status:** Accepted (owner approval 2026-10-16)
**Issue:** AUD-52

## Context

AUD-52 builds the first interactive Daily Challenge. Figma has approved screens for the Explain workspace (`5:2`/`5:121`), AI explanation feedback (`7:190`) and Fix & Run (`7:306`/`7:437`), but those designs assume capabilities StackSpeak does not have: a live microphone, AI assessment of a transcript, and a real `pytest` run. Defend (06) and Results (07) have no design ("To do" on the Figma cover), and "13 Mobile challenge" is marked Done on the cover but **no node for it was reachable** from the Desktop Screens page (`2:4`) or the file's top-level listing (which is known to be unreliable — see `AGENTS.md` §4). Its node ID is unrecorded; if the owner supplies it, the responsive adaptations below should be checked against it.

## Decisions

1. **Evaluation is structured self-assessment plus reference-based feedback.** No AI scoring, no code execution (server or browser), no static "analysis" presented as test results. Anything that looks like a result would be fabricated.
2. **Flow: READ → EXPLAIN → FIX → TRACE → DEFEND → FEEDBACK.** "Run" became **Trace** until real execution exists: students predict what their fixed code returns/raises for each public case, *then* reveal the expected outcome and mark how it compared (matched / didn't / not sure). The Trace UI uses neutral styling — never `TestResultRow`/`TerminalPanel` pass/fail visuals — and says plainly "StackSpeak did not run your code."
3. **Stage-aware content.** The initial load carries no bug description, contract, tests, prompts that name the bug, or solution; each later stage fetches its own endpoint (`docs/challenge-schema.md`). **Stage gating is UX-only, not a security or anti-cheating boundary** — with no auth or server state any endpoint can be called directly.
4. **The reference solution appears at Feedback**, labeled "one reference implementation, not the only valid answer", beside the student's own code.
5. **Technical and Communication self-review checklists are separate** columns with no combined score and no counts. Figma 04's "Speaking & English" is "Communication" because there is no speech.
6. **State is a reducer plus `sessionStorage` drafts.** Nothing the student writes leaves the browser. No auth, database, or URL-per-stage. The reducer's stage guards are a UX aid, not an access control.

## Figma adaptations (all owner-approved)

| Figma | Implementation | Why |
|---|---|---|
| Mic + waveform + "Click to start speaking" (03) | Text answer; the existing disabled `MicButton` stays as a labeled "voice coming soon" seam | No recording/transcription yet |
| Transcript + AI assessment badges (04) | "Review your work": your answers, bug description, two self-review checklists, code comparison | No AI evaluation exists |
| Run tests + terminal with pass/fail (05) | Trace stage (predict → reveal → self-mark) | No execution |
| "Save & exit" | "Exit" | Nothing is saved server-side (drafts live in the tab) |
| Static "Editing" code editor | New `CodeInput` (plain `<textarea>`, synced line numbers, no dependency) | Fix needs editable code; `CodeEditor` stays read-only |
| 656px stepper in the top bar | Full stepper from `lg` (1024px); below that, "Step n of 6 · Stage" + `ProgressBar` | The stepper doesn't fit narrow widths (not in Figma) |
| Two-column workspace | Two columns from `lg`; stacked below, code first | Responsive assumption (not in Figma) |
| 06 Defend / 07 Results (no design) | Defend and Feedback composed from the 03/04 patterns (`Card`, side-panel + text area, two-column assessments) | No frame exists; no new visual language invented |

The workspace top bar (Figma `5:3`) renders on `/daily-challenge` only; `SiteHeader` returns nothing on that route and every other route keeps its existing navigation.

## Addendum (AUD-57): Trace is one focused exercise

Released Trace showed all four public test cases as stacked cards in a narrow side column, which read like a testing dashboard — and its "Case 4" description and "contract" card showed the expected outcome *before* the student predicted anything. AUD-57 changed the Trace UI only (no API/backend change, other public cases still served by `/trace`):

- **One exercise**, the empty-list edge case (`pickTraceFocusIndex` in `traceFocus.ts`: empty-list input → first edge case → first case). Draft state stays keyed by the case's index, so existing drafts remain valid; Continue now requires the focus exercise to be compared.
- **Stacked, full-width layout:** the student's code above (labeled "Your current code", or "Starter code" if unedited), a prominent prediction card below. Reuses `Card`, `TextArea`, `Button`, `Badge`, `CodeEditor`; Figma has no Trace frame.
- **Nothing is given away before the reveal:** the case description and the `expected_behavior` contract text appear only after "Reveal expected outcome", framed as "what the challenge expects — not a result from running your code".

## Known limitations

- JSON can't distinguish `20.0` from `20`, so whole-number floats in expected outcomes display without `.0` (display only).
- Tab is not captured in the code field (that would trap keyboard focus), so students indent with spaces.
- Browser Back leaves the workspace (stage isn't in the URL); drafts survive in the tab.
- Backend CORS allows only the production origin and localhost, so Vercel preview deployments can't load the challenge (a preview limitation, not a production one).
- "Daily" currently means the first challenge the API lists; date rotation is deferred.

## Follow-ups (not in AUD-52)

Real code execution (evaluate Pyodide in a Web Worker vs. an isolated runner service — reviewed separately per `docs/architecture.md`), voice (speech-to-text provider abstraction), grounded AI feedback, authenticated persistence and real stage gating.
