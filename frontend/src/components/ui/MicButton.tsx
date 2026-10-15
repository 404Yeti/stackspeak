export type MicState = "idle" | "recording" | "processing" | "error";

export type MicButtonProps = {
  state: MicState;
  /** Accessible label describing what the control would do once implemented. */
  label?: string;
};

const STATE_STYLES: Record<MicState, string> = {
  idle: "border-2 border-accent bg-elevated",
  recording: "bg-accent shadow-[0_0_24px_rgba(139,92,246,0.35)]",
  processing: "border-2 border-info bg-elevated",
  error: "border-2 border-error bg-elevated",
};

function MicIcon({ state }: { state: MicState }) {
  if (state === "processing") {
    // Static, not animated — this preview never actually processes anything.
    return (
      <svg viewBox="0 0 28 28" fill="none" className="size-7 text-info" aria-hidden="true">
        <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
        <path d="M24 14a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (state === "error") {
    return (
      <svg viewBox="0 0 28 28" fill="none" className="size-7 text-error" aria-hidden="true">
        <path d="M14 8v7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="14" cy="19" r="1.5" fill="currentColor" />
      </svg>
    );
  }

  const strokeColor = state === "recording" ? "white" : "currentColor";
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={`size-7 ${state === "recording" ? "text-white" : "text-accent"}`}
      aria-hidden="true"
    >
      <rect x="10.5" y="4" width="7" height="12" rx="3.5" stroke={strokeColor} strokeWidth="2" />
      <path d="M6 13.5a8 8 0 0 0 16 0" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
      <path d="M14 21.5v3" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const STATE_LABELS: Record<MicState, string> = {
  idle: "Voice recording (not yet available)",
  recording: "Recording (preview only)",
  processing: "Processing (preview only)",
  error: "Recording error (preview only)",
};

/** Presentational only — not wired to any audio capture. Always rendered disabled. */
export function MicButton({ state, label }: MicButtonProps) {
  return (
    <button
      type="button"
      disabled
      aria-label={label ?? STATE_LABELS[state]}
      className={`flex size-[72px] items-center justify-center rounded-full disabled:cursor-not-allowed ${STATE_STYLES[state]}`}
    >
      <MicIcon state={state} />
    </button>
  );
}
