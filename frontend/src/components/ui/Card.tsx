export type CardProps = {
  elevation?: "flat" | "elevated";
  /** Accent border instead of the default subtle one — e.g. the "Flagship"
   * course card on the homepage. A distinct prop rather than letting callers
   * override the border via className, since two conflicting Tailwind
   * border-color utilities in one class list don't reliably resolve by
   * source order. */
  highlighted?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Card({ elevation = "flat", highlighted = false, className, children }: CardProps) {
  const elevationClasses =
    elevation === "elevated"
      ? "bg-elevated shadow-[0_4px_8px_rgba(0,0,0,0.3)]"
      : "bg-surface";
  const borderClass = highlighted ? "border-accent" : "border-border-subtle";

  return (
    <div
      className={`rounded-lg border ${borderClass} p-6 ${elevationClasses} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
