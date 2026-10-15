import { TestResultRow, type TestResultRowProps } from "./TestResultRow";

export type TerminalPanelProps = {
  command: string;
  results: TestResultRowProps[];
  summary: string;
  outcome: "passed" | "failed";
};

export function TerminalPanel({ command, results, summary, outcome }: TerminalPanelProps) {
  const isFailed = outcome === "failed";

  return (
    <div className="w-full max-w-[420px] overflow-hidden rounded-lg border border-border-subtle bg-background">
      <div className="flex items-center justify-between bg-surface px-4 py-2 font-mono text-xs font-medium">
        <span className="text-text-primary">Terminal</span>
        <span className={isFailed ? "text-error" : "text-success"}>
          {isFailed ? "Run failed" : "Run passed"}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p className="font-mono text-xs text-text-muted">$ {command}</p>
        {results.map((result) => (
          <TestResultRow key={result.label} {...result} />
        ))}
        <p className={`font-mono text-xs ${isFailed ? "text-error" : "text-success"}`}>{summary}</p>
      </div>
    </div>
  );
}
