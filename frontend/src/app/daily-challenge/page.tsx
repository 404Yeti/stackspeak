import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StageStepper } from "@/components/ui/StageStepper";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { MicButton } from "@/components/ui/MicButton";
import { Waveform } from "@/components/ui/Waveform";
import { PipMascot } from "@/components/ui/PipMascot";
import { SAMPLE_CHALLENGE_CODE } from "@/lib/sampleChallenge";

export const metadata: Metadata = {
  title: "Daily Challenge — StackSpeak",
};

export default function DailyChallengePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <Badge tone="accent">Coming soon</Badge>
      <h1 className="text-3xl font-semibold text-text-primary">Daily Challenge</h1>
      <p className="text-text-muted">
        Each day StackSpeak will present a new code-reading challenge that walks
        through the full learning sequence below. The challenge workspace —
        code viewer, voice recording, and AI-grounded feedback — is not built
        yet. This page reserves the route and previews the intended layout.
      </p>

      <Card className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-text-muted">Challenge flow</h2>
        <StageStepper stage="Read" />
      </Card>

      <Card className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-muted">Workspace preview</h2>
          <Badge tone="neutral">Noninteractive preview</Badge>
        </div>

        <div className="flex items-start gap-4">
          <PipMascot expression="idle" size={64} />
          <p className="text-sm text-text-muted">
            Pip will guide you through each challenge once this workspace is
            built — explaining, nudging, and celebrating along the way. For
            now, Pip is just here to say hello.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs text-text-muted">Sample challenge — not a real assignment</p>
          <CodeEditor filename="main.py" code={SAMPLE_CHALLENGE_CODE} />
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col items-start gap-2">
            <p className="font-mono text-xs text-text-muted">Sample run output — not from a real test run</p>
            <TerminalPanel
              command="pytest test_average.py"
              results={[
                { label: "Calculates average correctly", status: "pass" },
                { label: "Handles negative numbers", status: "pass" },
                { label: "Handles decimal values", status: "pass" },
              ]}
              summary="3 passed, 0 failed"
              outcome="passed"
            />
          </div>

          <div className="flex flex-col items-start gap-2">
            <p className="font-mono text-xs text-text-muted">Voice recording — not yet available</p>
            <div className="flex items-center gap-4">
              <MicButton state="idle" />
              <Waveform />
            </div>
          </div>
        </div>
      </Card>

      <p className="text-sm text-text-muted">
        Everything above is a static preview with representative sample
        data — no challenge content, code execution, voice recording, or AI
        feedback is active on this route yet. Nothing here simulates a real
        result.
      </p>
    </div>
  );
}
