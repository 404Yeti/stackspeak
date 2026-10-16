import type { Stage } from "@/components/ui/StageStepper";

/** READ → EXPLAIN → FIX → TRACE → DEFEND → FEEDBACK. Trace is a prediction/self-check, not a run. */
export const STAGE_ORDER = ["read", "explain", "fix", "trace", "defend", "feedback"] as const;
export type StageId = (typeof STAGE_ORDER)[number];

export const STAGE_LABELS: Record<StageId, Stage> = {
  read: "Read",
  explain: "Explain",
  fix: "Fix",
  trace: "Trace",
  defend: "Defend",
  feedback: "Feedback",
};

export type Mark = "matches" | "differs" | "unsure";

export type FlowState = {
  stage: StageId;
  explanation: string;
  diagnosis: string;
  code: string;
  /** Per trace case index. */
  predictions: Record<number, string>;
  revealed: Record<number, boolean>;
  marks: Record<number, Mark>;
  defense: string;
  /** Self-review checklist ticks, kept as two separate axes. */
  technical: Record<number, boolean>;
  communication: Record<number, boolean>;
};

export type FlowAction =
  | { type: "next"; traceFocusIndex: number | null }
  | { type: "back" }
  | { type: "setExplanation"; value: string }
  | { type: "setDiagnosis"; value: string }
  | { type: "setCode"; value: string }
  | { type: "resetCode"; starterCode: string }
  | { type: "setPrediction"; index: number; value: string }
  | { type: "reveal"; index: number }
  | { type: "mark"; index: number; mark: Mark }
  | { type: "setDefense"; value: string }
  | { type: "toggleTechnical"; index: number }
  | { type: "toggleCommunication"; index: number };

/** Minimum non-whitespace characters for a free-text answer to count. */
export const MIN_ANSWER_CHARS = 10;
export const MAX_ANSWER_CHARS = 2000;
export const MAX_CODE_CHARS = 5000;

export function isSubstantive(text: string): boolean {
  return text.replace(/\s/g, "").length >= MIN_ANSWER_CHARS;
}

export function initialState(starterCode: string): FlowState {
  return {
    stage: "read",
    explanation: "",
    diagnosis: "",
    code: starterCode,
    predictions: {},
    revealed: {},
    marks: {},
    defense: "",
    technical: {},
    communication: {},
  };
}

/** Why the student can't continue yet, or null when they can. UX guard only — not a security control. */
export function blockedReason(state: FlowState, traceFocusIndex: number | null): string | null {
  switch (state.stage) {
    case "explain":
      return isSubstantive(state.explanation)
        ? null
        : `Write at least ${MIN_ANSWER_CHARS} characters explaining what the code does.`;
    case "fix":
      return isSubstantive(state.diagnosis)
        ? null
        : `Write at least ${MIN_ANSWER_CHARS} characters about where the bug is and why.`;
    case "trace":
      if (traceFocusIndex === null) return "The trace exercise hasn't loaded yet.";
      return state.marks[traceFocusIndex] === undefined
        ? "Make your prediction, reveal the expected outcome, then say how it compared."
        : null;
    case "defend":
      return isSubstantive(state.defense)
        ? null
        : `Write at least ${MIN_ANSWER_CHARS} characters defending your fix.`;
    case "read":
      return null;
    case "feedback":
      return "This is the last stage.";
  }
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "next": {
      const index = STAGE_ORDER.indexOf(state.stage);
      if (index >= STAGE_ORDER.length - 1) return state;
      if (blockedReason(state, action.traceFocusIndex) !== null) return state;
      return { ...state, stage: STAGE_ORDER[index + 1] };
    }
    case "back": {
      const index = STAGE_ORDER.indexOf(state.stage);
      return index === 0 ? state : { ...state, stage: STAGE_ORDER[index - 1] };
    }
    case "setExplanation":
      return { ...state, explanation: action.value.slice(0, MAX_ANSWER_CHARS) };
    case "setDiagnosis":
      return { ...state, diagnosis: action.value.slice(0, MAX_ANSWER_CHARS) };
    case "setCode":
      return { ...state, code: action.value.slice(0, MAX_CODE_CHARS) };
    case "resetCode":
      return { ...state, code: action.starterCode };
    case "setPrediction":
      return {
        ...state,
        predictions: { ...state.predictions, [action.index]: action.value.slice(0, 200) },
      };
    case "reveal":
      // Revealing needs a prediction first; changing a prediction after the
      // reveal is allowed but doesn't un-reveal (the reasoning already happened).
      if ((state.predictions[action.index] ?? "").trim() === "") return state;
      return { ...state, revealed: { ...state.revealed, [action.index]: true } };
    case "mark":
      if (!state.revealed[action.index]) return state;
      return { ...state, marks: { ...state.marks, [action.index]: action.mark } };
    case "setDefense":
      return { ...state, defense: action.value.slice(0, MAX_ANSWER_CHARS) };
    case "toggleTechnical":
      return {
        ...state,
        technical: { ...state.technical, [action.index]: !state.technical[action.index] },
      };
    case "toggleCommunication":
      return {
        ...state,
        communication: {
          ...state.communication,
          [action.index]: !state.communication[action.index],
        },
      };
  }
}
