"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { getChallengeTrace, type ChallengeTrace } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useCallback } from "react";
import { useStageContent } from "./useStageContent";
import type { Mark } from "./challengeReducer";
import { expectedOutcome, pyRepr } from "./pyRepr";
import {
  BulletList,
  ContentState,
  InfoCard,
  PipRow,
  StageHeading,
  StageNav,
  StageShell,
} from "./StageLayout";
import type { StageProps } from "./stageTypes";

const MARK_OPTIONS: { value: Mark; label: string }[] = [
  { value: "matches", label: "My prediction matched" },
  { value: "differs", label: "It didn't match" },
  { value: "unsure", label: "I'm not sure" },
];

export type TraceContent = ReturnType<typeof useStageContent<ChallengeTrace>>;

export function useTraceContent(challengeId: string, enabled: boolean): TraceContent {
  const load = useCallback((signal: AbortSignal) => getChallengeTrace(challengeId, signal), [challengeId]);
  return useStageContent<ChallengeTrace>(enabled, load);
}

export function TraceStage({
  state,
  dispatch,
  focusHeading,
  onBack,
  onNext,
  blockedReason,
  content,
}: StageProps & { content: TraceContent }) {
  const trace = content.data;

  return (
    <StageShell
      main={<CodeEditor filename="main.py" code={state.code} label="Your code (read-only)" fullWidth />}
      side={
        <>
          <InfoCard title="Problem">
            <StageHeading focusOnMount={focusHeading}>Trace it by hand</StageHeading>
            <p role="note" className="rounded-md border border-border-subtle bg-elevated p-3 text-sm text-text-primary">
              Self-check — StackSpeak did not run your code. For each case, predict what your fixed
              code does, then reveal the expected outcome and compare.
            </p>
          </InfoCard>

          {!trace && (
            <ContentState
              loading={content.loading}
              error={content.error as ApiError | undefined}
              onRetry={content.retry}
              what="the trace cases"
            />
          )}

          {trace && (
            <>
              <InfoCard title="The contract">
                <p className="text-sm text-text-muted">{trace.expected_behavior}</p>
                <BulletList items={trace.trace_prompts} />
              </InfoCard>

              {trace.test_cases.map((testCase, index) => {
                const revealed = Boolean(state.revealed[index]);
                const prediction = state.predictions[index] ?? "";
                return (
                  <Card key={testCase.description} className="flex flex-col gap-3">
                    <fieldset className="flex min-w-0 flex-col gap-3">
                      <legend className="text-sm font-medium text-text-primary">
                        Case {index + 1}: {testCase.description}
                      </legend>
                      <p className="break-words font-mono text-xs text-text-muted">
                        get_average({pyRepr(testCase.input)})
                      </p>

                      <label htmlFor={`predict-${index}`} className="text-sm text-text-primary">
                        What will your code return or raise?
                      </label>
                      <input
                        id={`predict-${index}`}
                        type="text"
                        value={prediction}
                        maxLength={200}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) =>
                          dispatch({ type: "setPrediction", index, value: event.target.value })
                        }
                        className="w-full rounded-md border border-border-subtle bg-background p-3 font-mono text-sm text-text-primary placeholder:text-icon-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        placeholder="returns … or raises …"
                      />

                      {!revealed ? (
                        <div>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={prediction.trim() === ""}
                            onClick={() => dispatch({ type: "reveal", index })}
                          >
                            Reveal expected outcome
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <p className="text-sm text-text-primary">
                            Expected: <span className="font-mono">{expectedOutcome(testCase)}</span>
                          </p>
                          <div role="radiogroup" aria-label={`How your prediction compared, case ${index + 1}`} className="flex flex-col gap-2">
                            {MARK_OPTIONS.map((option) => (
                              <label key={option.value} className="flex min-h-11 items-center gap-3 text-sm text-text-primary">
                                <input
                                  type="radio"
                                  name={`mark-${index}`}
                                  className="size-5 accent-accent"
                                  checked={state.marks[index] === option.value}
                                  onChange={() => dispatch({ type: "mark", index, mark: option.value })}
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </fieldset>
                  </Card>
                );
              })}

              <PipRow expression="idea">
                If a case didn&apos;t match, go back to Fix and adjust your code — your answers are
                kept.
              </PipRow>
              <StageNav onBack={onBack} onNext={onNext} nextLabel="Continue to Defend" blockedReason={blockedReason} />
            </>
          )}

          {!trace && <StageNav onBack={onBack} />}
        </>
      }
    />
  );
}
