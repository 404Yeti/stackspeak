import { CodeEditor } from "@/components/ui/CodeEditor";
import { MicButton } from "@/components/ui/MicButton";
import { TextArea } from "@/components/ui/TextArea";
import { MAX_ANSWER_CHARS } from "./challengeReducer";
import { BulletList, InfoCard, PipRow, StageHeading, StageNav, StageShell } from "./StageLayout";
import type { StageProps } from "./stageTypes";

export function ExplainStage({ challenge, state, dispatch, focusHeading, onBack, onNext, blockedReason }: StageProps) {
  return (
    <StageShell
      main={<CodeEditor filename="main.py" code={challenge.starter_code} fullWidth />}
      side={
        <>
          <InfoCard title="Problem">
            <StageHeading focusOnMount={focusHeading}>Explain the code</StageHeading>
            <p className="text-sm text-text-muted">
              Read the code, then explain what you think it does. Use your own words. You
              don&apos;t need to be 100% correct — just try.
            </p>
          </InfoCard>
          <InfoCard title="Hints (optional)">
            <BulletList items={challenge.explain_prompts} />
          </InfoCard>
          <InfoCard title="Your explanation">
            <PipRow expression="idle">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <MicButton state="idle" label="Voice answers (coming soon)" />
                </div>
                <p>Voice answers are coming soon. For now, type your explanation.</p>
              </div>
            </PipRow>
            <TextArea
              id="explanation"
              label="What does this code do?"
              value={state.explanation}
              onChange={(value) => dispatch({ type: "setExplanation", value })}
              maxLength={MAX_ANSWER_CHARS}
              rows={6}
              hint="Complete sentences help. Your answer stays in this browser tab."
            />
            <StageNav onBack={onBack} onNext={onNext} nextLabel="Continue to Fix" blockedReason={blockedReason} />
          </InfoCard>
        </>
      }
    />
  );
}
