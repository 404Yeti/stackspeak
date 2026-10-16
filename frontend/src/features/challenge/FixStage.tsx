"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { TextArea } from "@/components/ui/TextArea";
import { MAX_ANSWER_CHARS, MAX_CODE_CHARS } from "./challengeReducer";
import { BulletList, InfoCard, PipRow, StageHeading, StageNav, StageShell } from "./StageLayout";
import { RunPanel } from "./runCode/RunPanel";
import { useCodeRunner } from "./runCode/useCodeRunner";
import type { StageProps } from "./stageTypes";

export function FixStage({
  challenge,
  state,
  dispatch,
  focusHeading,
  onBack,
  onNext,
  blockedReason,
  flushDraft,
  runnerOptions,
}: StageProps & { runnerOptions?: Parameters<typeof useCodeRunner>[0] }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  // Off unless NEXT_PUBLIC_PYTHON_RUNNER_ENABLED=true and a valid runner URL is set (see docs/python-runner.md).
  const runner = useCodeRunner(runnerOptions);
  const canRun = runner.enabled;
  const runCode = () => {
    flushDraft?.(); // the draft is already saved if the page crashes or the runner takes the tab down
    runner.run(state.code);
  };

  return (
    <StageShell
      main={
        <>
          <CodeInput
            id="fix-code"
            filename="main.py"
            value={state.code}
            maxLength={MAX_CODE_CHARS}
            onChange={(value) => dispatch({ type: "setCode", value })}
            onSubmitShortcut={canRun ? runCode : undefined}
          />
          {canRun && <RunPanel runner={runner} onRun={runCode} />}
        </>
      }
      side={
        <>
          <InfoCard title="Problem">
            <StageHeading focusOnMount={focusHeading}>Fix the function</StageHeading>
            <p className="text-sm text-text-muted">
              {canRun
                ? "Work out what's wrong, then edit the code to fix it. You can run it as often as you like to see what it does — running doesn't check or grade your fix. Use spaces to indent."
                : "Work out what's wrong, then edit the code on the left to fix it. This editor only holds your text — nothing runs it. Use spaces to indent."}
            </p>
          </InfoCard>
          <InfoCard title="Hints (optional)">
            <BulletList items={challenge.fix_prompts} />
          </InfoCard>
          <InfoCard title="Your diagnosis">
            <PipRow expression="coding">Say where the problem is and why your change fixes it.</PipRow>
            <TextArea
              id="diagnosis"
              label="Where is the bug, and why?"
              value={state.diagnosis}
              onChange={(value) => dispatch({ type: "setDiagnosis", value })}
              maxLength={MAX_ANSWER_CHARS}
              rows={5}
              hint="Name the cause, not just the symptom."
            />
            <div className="flex flex-col gap-2">
              {confirmingReset ? (
                <div role="group" aria-label="Confirm reset" className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-text-muted">Replace your code with the starter code?</span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      dispatch({ type: "resetCode", starterCode: challenge.starter_code });
                      runner.clear();
                      setConfirmingReset(false);
                    }}
                  >
                    Yes, reset
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirmingReset(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div>
                  <Button type="button" variant="secondary" onClick={() => setConfirmingReset(true)}>
                    Reset code
                  </Button>
                </div>
              )}
            </div>
            <StageNav onBack={onBack} onNext={onNext} nextLabel="Continue to Trace" blockedReason={blockedReason} />
          </InfoCard>
        </>
      }
    />
  );
}
