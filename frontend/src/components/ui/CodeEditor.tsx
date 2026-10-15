export type CodeEditorProps = {
  filename: string;
  code: string;
};

/**
 * Always read-only. There is no "editable" mode because nothing in the app
 * can actually save or run an edit yet — an "Editing" badge over static text
 * would be a fake control, not a shell.
 */
export function CodeEditor({ filename, code }: CodeEditorProps) {
  const lines = code.split("\n");

  return (
    <div className="w-full max-w-[640px] overflow-hidden rounded-lg border border-border-subtle bg-background">
      <div className="flex items-center justify-between bg-surface px-4 py-2 font-mono text-xs font-medium">
        <span className="text-text-primary">{filename}</span>
        <span className="text-text-muted">Read-only</span>
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
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
