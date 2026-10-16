import { CodeEditor } from "@/components/ui/CodeEditor";
import { BulletList, InfoCard, PipRow, StageHeading, StageNav, StageShell } from "./StageLayout";
import type { StageProps } from "./stageTypes";

export function ReadStage({ challenge, focusHeading, onNext }: StageProps) {
  return (
    <StageShell
      main={<CodeEditor filename="main.py" code={challenge.starter_code} fullWidth />}
      side={
        <>
          <InfoCard title="Problem">
            <StageHeading focusOnMount={focusHeading}>Read the code</StageHeading>
            <p className="text-sm text-text-muted">
              Read the code carefully. Next you&apos;ll explain what it does, work out what&apos;s
              wrong, fix it, trace it by hand, and defend your choices. Nothing here runs your code
              — you&apos;ll reason about it yourself.
            </p>
          </InfoCard>
          <InfoCard title="What you'll practice">
            <BulletList items={challenge.learning_objectives} />
          </InfoCard>
          <PipRow expression="idle">Take your time. When you&apos;re ready, start explaining.</PipRow>
          <StageNav onNext={onNext} nextLabel="Start explaining" />
        </>
      }
    />
  );
}
