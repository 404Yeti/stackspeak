export type ProgressBarProps = {
  /** Percent complete, 0–100. Out-of-range values are clamped. */
  value: number;
  label?: string;
};

export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const fillColor = clamped >= 100 ? "bg-success" : "bg-accent";

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-elevated"
    >
      <div
        className={`h-2 rounded-full ${fillColor}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
