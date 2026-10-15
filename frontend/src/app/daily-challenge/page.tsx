import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Daily Challenge — StackSpeak",
};

const stages = ["Read", "Explain", "Fix", "Run", "Defend", "Feedback"];

export default function DailyChallengePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <Badge tone="accent">Coming soon</Badge>
      <h1 className="text-3xl font-semibold text-text-primary">Daily Challenge</h1>
      <p className="text-text-muted">
        Each day StackSpeak will present a new code-reading challenge that walks
        through the full learning sequence below. The challenge workspace —
        code viewer, voice recording, and AI-grounded feedback — is not built
        yet in Sprint 01. This page reserves the route and shows the intended
        flow.
      </p>

      <Card className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-text-muted">Challenge flow</h2>
        <ol className="flex flex-wrap gap-2">
          {stages.map((stage, index) => (
            <li
              key={stage}
              className="flex items-center gap-2 rounded-full border border-border-subtle px-3 py-1.5 text-sm text-text-muted"
            >
              <span className="font-mono text-xs text-accent-soft">{index + 1}</span>
              {stage}
            </li>
          ))}
        </ol>
      </Card>

      <p className="text-sm text-text-muted">
        No challenge content, code execution, or AI feedback is active on this
        route yet — nothing here simulates a real result.
      </p>
    </div>
  );
}
