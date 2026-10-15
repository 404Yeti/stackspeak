export type CardProps = {
  elevation?: "flat" | "elevated";
  className?: string;
  children: React.ReactNode;
};

export function Card({ elevation = "flat", className, children }: CardProps) {
  const elevationClasses =
    elevation === "elevated"
      ? "bg-elevated shadow-[0_4px_8px_rgba(0,0,0,0.3)]"
      : "bg-surface";

  return (
    <div
      className={`rounded-lg border border-border-subtle p-6 ${elevationClasses} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
