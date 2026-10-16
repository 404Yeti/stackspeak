import type { ReactNode } from "react";

export type TextAreaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Visible helper text, associated via aria-describedby. */
  hint?: ReactNode;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
};

/** Labeled multi-line text input. Student text is only ever rendered as escaped text. */
export function TextArea({
  id,
  label,
  value,
  onChange,
  hint,
  rows = 5,
  maxLength,
  placeholder,
}: TextAreaProps) {
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-md border border-border-subtle bg-background p-3 text-sm text-text-primary placeholder:text-icon-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      {hint && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
