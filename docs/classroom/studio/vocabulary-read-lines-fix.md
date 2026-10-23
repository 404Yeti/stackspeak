# Vocabulary Read-line validation repair

Local follow-up to AUD-78 on `fix/studio-vocabulary-read-lines`. No remote data,
credentials, migrations, permissions, publishing settings or deployments changed.

## Investigation

The old VocabularyTab converted every comma token with `Number(token.trim())` and
passed the result into the shared numeric draft even when its local validation
failed. A nonnumeric token became NaN. The autosave queue serialized the draft
before validating it; JSON converts NaN to null. This explains the client-side
`received NaN` versus server-side `draft.…received null` errors. A trailing comma
also produced 0 from an empty token. Clearing the field emitted undefined, whereas
the draft schema rejected an explicit empty array.

`vocabulary.2.readLines.0` means vocabulary entry 3, reference 1: schema and database
positions are zero based; visible numbering is one based. One invalid entry blocks
the entire draft, even if a different entry contains a valid 1. The literal input
`1` alone does not generate NaN in the old parser; we do not claim otherwise.

Both manual save and debounce already shared one queue. However, raw line text
lived only inside the mounted field. Switching tabs discarded it; validation had
already pushed invalid numbers into the shared draft. Database draft loading also
strictly parsed stored vocabulary before displaying it, so a legacy null prevented
opening the editor. Current server validation rejects null; this investigation
does not establish how any existing malformed database value was originally stored.

## Repair

- Parse trimmed nonempty comma tokens as positive whole decimal integers. Bound to
  the actual Read code, 500 unique references and safe integer range. Empty input
  and empty trailing tokens produce [], never null, NaN or 0.
- Keep editable text separately from numeric draft values. Invalid input has an
  accessible field error and blocks the common save queue. Keep vocabulary fields
  mounted across tab changes so invalid text cannot disappear and silently save
  a different value. Move/delete text with its entry; numbering remains 1 based.
- Validate the numeric draft before JSON serialization. Manual and debounced saves
  use the same validated payload and version queue. Local errors clear when the
  input returns to its saved value, without requiring an unnecessary write.
- Allow [] for draft references. Public snapshots keep the existing optional,
  nonempty-array contract; projection omits empty references. No public loading or
  publication authorization changes.
- Only authorized teacher draft loading recovers unusable stored references,
  retaining valid references, all vocabulary text/optional fields, order and all
  other content. Return one-based affected entry numbers with a teacher notice.
  Loading itself does not write. The editor marks recovery dirty so ordinary
  autosave/manual save can persist the correction, using the existing lock version.
  Strict request and public snapshot validation still reject null/NaN. Publication
  still reads the strict persisted draft and requires a valid save first.

## Verification

Regression tests cover `"1"`, `"1,2"`, empty, trailing commas, invalid text, zero/negative/
fractional/exponent/duplicate/out-of-range values; null recovery; pre-serialization
validation; manual/autosave agreement; third-entry indexing; reorder/delete and
retained invalid text across tabs. Disposable Postgres tests inject a legacy null,
verify read-only recovery, save and reconnect, and compare the published snapshot
before and after draft corrections. No Production database is accessed.

A real Chromium workflow fills multiple rows, autosaves and manually saves, refreshes,
checks the persisted arrays and vocabulary content, rejects invalid text without
sending a PATCH, and verifies reference/term pairing after reordering. Existing
teacher/student publication/isolation and reader-outage browser regressions remain
in the same suite. Full frontend and backend verification results are recorded in
the AUD-78 follow-up comment after completion.

This fix awaits review. It has not been pushed, merged or deployed.

## Files and final local results

- `frontend/src/features/classroom/studio/`: `VocabularyTab.tsx`, `Fields.tsx`,
  `StudioEditor.tsx`, `useAutosave.ts`, `client.ts`;
  component and queue regressions in `Studio.test.tsx`, `useAutosave.test.tsx`.
- `frontend/src/lib/classroom/studio/`: `readLines.ts`, `validation.ts`,
  `repository.ts`; parser/schema and real persistence regressions in
  `readLines.test.ts`, `repository.integration.test.ts`.
- `frontend/e2e-studio-api/vocabulary-lines.spec.ts` and this investigation note.

All passed on the final code: frontend lint, typecheck, 247 unit tests and production
build; 9 disposable PostgreSQL integration tests with rollback/reapply; 6 Chromium
browser tests including the separate reader-outage run; backend 21 pytest tests,
Ruff and mypy. The 9 database tests are intentionally skipped by the ordinary unit
command and were run separately by the isolated database harness. Tests used a
native Linux copy of the frontend for reliable execution speed, with source bytes
copied directly from the worktree. No backend application changes were required.
