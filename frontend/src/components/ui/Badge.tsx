type BadgeTone = "neutral" | "success" | "info" | "error" | "accent";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "text-text-muted",
  success: "text-success",
  info: "text-info",
  error: "text-error",
  accent: "text-accent-soft",
};

export type BadgeProps = {
  tone?: BadgeTone;
  children: React.ReactNode;
};

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-elevated px-2 py-1 text-xs font-medium tracking-wide ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
