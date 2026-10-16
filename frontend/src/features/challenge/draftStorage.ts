import { STAGE_ORDER, type FlowState, type Mark } from "./challengeReducer";

// Drafts live in sessionStorage only: per-tab, never sent anywhere, gone when
// the tab closes. Every access is wrapped — storage can be blocked or full,
// and the flow must work identically without it.

const SCHEMA = 1;
const MARKS: readonly Mark[] = ["matches", "differs", "unsure"];

export const draftKey = (challengeId: string, version: number) =>
  `stackspeak:daily:${challengeId}:v${version}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordOf<T>(value: unknown, ok: (v: unknown) => v is T): Record<number, T> | null {
  if (!isRecord(value)) return null;
  const out: Record<number, T> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^\d+$/.test(key) || !ok(item)) return null;
    out[Number(key)] = item;
  }
  return out;
}

const isString = (v: unknown): v is string => typeof v === "string";
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";
const isMark = (v: unknown): v is Mark => MARKS.includes(v as Mark);

/** Returns a validated FlowState, or null if the stored value is missing/corrupt. */
export function parseDraft(raw: string | null): FlowState | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.schema !== SCHEMA) return null;

  const predictions = recordOf(value.predictions, isString);
  const revealed = recordOf(value.revealed, isBoolean);
  const marks = recordOf(value.marks, isMark);
  const technical = recordOf(value.technical, isBoolean);
  const communication = recordOf(value.communication, isBoolean);

  if (
    !STAGE_ORDER.includes(value.stage as FlowState["stage"]) ||
    !isString(value.explanation) ||
    !isString(value.diagnosis) ||
    !isString(value.code) ||
    !isString(value.defense) ||
    !predictions ||
    !revealed ||
    !marks ||
    !technical ||
    !communication
  ) {
    return null;
  }

  return {
    stage: value.stage as FlowState["stage"],
    explanation: value.explanation,
    diagnosis: value.diagnosis,
    code: value.code,
    predictions,
    revealed,
    marks,
    defense: value.defense,
    technical,
    communication,
  };
}

export function loadDraft(key: string): FlowState | null {
  try {
    return parseDraft(window.sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

export function saveDraft(key: string, state: FlowState): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ schema: SCHEMA, ...state }));
  } catch {
    // Storage blocked or full — drafts just won't survive a refresh.
  }
}

export function clearDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
