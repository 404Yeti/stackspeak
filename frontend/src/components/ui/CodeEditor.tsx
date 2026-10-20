import type { ReactNode } from "react";

export type CodeEditorProps = {
  filename: string;
  code: string;
  /** Right-hand header label. Defaults to "Read-only". */
  label?: string;
  /** Drop the 640px cap so the editor fills its column (workspace layouts). */
  fullWidth?: boolean;
  /** Optional escaped React token spans; code remains the line-number source. */
  highlightedCode?: ReactNode;
};

/**
 * Always read-only. There is no "editable" mode because nothing in the app
 * can actually save or run an edit yet — an "Editing" badge over static text
 * would be a fake control, not a shell.
 */
export function CodeEditor({ filename, code, label = "Read-only", fullWidth = false, highlightedCode }: CodeEditorProps) {
  const lines = code.split("\n");

  return (
    <div className={`w-full ${fullWidth ? "" : "max-w-[640px]"} overflow-hidden rounded-lg border border-border-subtle bg-background`}>
      <div className="flex items-center justify-between bg-surface px-4 py-2 font-mono text-xs font-medium">
        <span className="text-text-primary">{filename}</span>
        <span className="text-text-muted">{label}</span>
      </div>
      <div className="flex gap-4 overflow-x-auto p-4 font-mono text-sm">
        <div aria-hidden="true" className="select-none text-right text-icon-muted">
          {lines.map((_, index) => (
            <p key={index} className="leading-6">
              {index + 1}
            </p>
          ))}
        </div>
        <pre className="leading-6 text-text-primary">
          <code>{highlightedCode ?? code}</code>
        </pre>
      </div>
    </div>
  );
}
