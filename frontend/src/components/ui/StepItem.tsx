export type StepState = "done" | "active" | "upcoming";

export type StepItemProps = {
  label: string;
  number: number;
  state: StepState;
};

export function StepItem({ label, number, state }: StepItemProps) {
  const dotClasses =
    state === "upcoming"
      ? "border border-border-subtle bg-elevated"
      : state === "active"
        ? "bg-accent"
        : "bg-success";

  const labelClasses = state === "active" ? "text-text-primary" : "text-text-muted";

  return (
    <span className="flex items-center gap-2">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tracking-wide ${dotClasses}`}
      >
        {state === "done" ? (
          <svg viewBox="0 0 12 12" fill="none" className="size-3" aria-hidden="true">
            <path
              d="M2 6.5L4.5 9L10 3"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className={state === "active" ? "text-text-on-accent" : "text-text-muted"}>
            {number}
          </span>
        )}
      </span>
      <span className={`text-sm font-medium ${labelClasses}`}>{label}</span>
    </span>
  );
}
