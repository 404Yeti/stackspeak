export type TestResultRowProps = {
  label: string;
  status: "pass" | "fail";
};

export function TestResultRow({ label, status }: TestResultRowProps) {
  const isFail = status === "fail";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex size-[18px] shrink-0 items-center justify-center rounded-full ${
          isFail ? "bg-error" : "bg-success"
        }`}
      >
        {isFail ? (
          <svg viewBox="0 0 10 10" fill="none" className="size-2.5" aria-hidden="true">
            <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" fill="none" className="size-2.5" aria-hidden="true">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="font-mono text-xs text-text-primary">{label}</span>
    </div>
  );
}
