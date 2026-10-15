import { Card } from "@/components/ui/Card";

// Matches the approved Figma "How It Works" section (Figma file
// n7YeKpNgstVlKSoq46VSjj, node 9:553) exactly — four steps, not the six
// learning-sequence stages shown elsewhere (e.g. StageStepper), and
// deliberately not generated from that six-stage list.
const steps = [
  {
    label: "Read it",
    description:
      "Study a real code sample in an IDE-style workspace. Find the purpose, the structure, and the problems.",
  },
  {
    label: "Explain it",
    description:
      "Say what the code does out loud. Your technical understanding and your English are assessed separately.",
  },
  {
    label: "Fix it",
    description: "Edit the code, run real automated tests, and see exactly what passes and what fails.",
  },
  {
    label: "Defend it",
    description:
      "Explain your choices to an AI interviewer: trade-offs, edge cases, and what you would change in production.",
  },
];

export function LearningSequence() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => (
        <Card key={step.label} className="flex flex-col gap-2">
          <span className="font-mono text-sm text-accent-soft">0{index + 1}</span>
          <h3 className="text-2xl font-semibold tracking-tight text-text-primary">{step.label}</h3>
          <p className="text-sm text-text-muted">{step.description}</p>
        </Card>
      ))}
    </div>
  );
}
