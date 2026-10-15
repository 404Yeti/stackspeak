const stages = [
  { label: "Read", description: "Understand unfamiliar code before touching it." },
  { label: "Explain", description: "Say out loud what the code does and why." },
  { label: "Fix", description: "Identify bugs, edge cases, and design problems." },
  { label: "Run", description: "Implement and test a solution." },
  { label: "Defend", description: "Justify your engineering decisions verbally." },
  { label: "Feedback", description: "Review separate technical and spoken-English assessment." },
];

export function LearningSequence() {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stages.map((stage, index) => (
        <li
          key={stage.label}
          className="rounded-lg border border-border-subtle bg-surface p-5"
        >
          <span className="font-mono text-xs text-accent-soft">
            0{index + 1}
          </span>
          <h3 className="mt-1 text-lg font-semibold text-text-primary">{stage.label}</h3>
          <p className="mt-2 text-sm text-text-muted">{stage.description}</p>
        </li>
      ))}
    </ol>
  );
}
