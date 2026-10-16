import type { Dispatch } from "react";
import type { ChallengeLoad } from "@/lib/api";
import type { FlowAction, FlowState } from "./challengeReducer";

export type StageProps = {
  challenge: ChallengeLoad;
  state: FlowState;
  dispatch: Dispatch<FlowAction>;
  /** True once the student has moved between stages — gates focus management. */
  focusHeading: boolean;
  onBack?: () => void;
  onNext?: () => void;
  /** Why Continue is disabled, or null. */
  blockedReason: string | null;
  /** Saves the student's draft to sessionStorage immediately (used right before code runs). */
  flushDraft?: () => void;
};
