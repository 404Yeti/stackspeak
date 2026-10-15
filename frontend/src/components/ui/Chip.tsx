export type ChipProps = {
  label: string;
  selected?: boolean;
};

export function Chip({ label, selected = false }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium tracking-wide ${
        selected
          ? "bg-accent text-text-on-accent"
          : "border border-border-subtle bg-elevated text-text-muted"
      }`}
    >
      {label}
    </span>
  );
}
