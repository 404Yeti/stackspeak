"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { TextArea } from "@/components/ui/TextArea";
import { getChallengeTrace, type ApiError, type ChallengeTrace } from "@/lib/api";
import type { Mark } from "./challengeReducer";
import { expectedOutcome, pyRepr } from "./pyRepr";
import { BulletList, ContentState, PipRow, StageHeading, StageNav } from "./StageLayout";
import type { StageProps } from "./stageTypes";
import { describeInput, pickTraceFocusIndex } from "./traceFocus";
import { useStageContent } from "./useStageContent";

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

/**
 * One focused prediction exercise, stacked: the student's code above, a
 * prominent prediction card below. The other public cases stay in the API.
 * Order: predict → reveal expected outcome → compare → continue. Nothing is
 * run, and nothing that gives the outcome away (the case description, the
 * contract) is shown until after the reveal.
 */
export function TraceStage({
  challenge,
  state,
  dispatch,
  focusHeading,
  onBack,
  onNext,
  blockedReason,
  content,
}: StageProps & { content: TraceContent }) {
  const trace = content.data;
  const focusIndex = trace ? pickTraceFocusIndex(trace.test_cases) : null;
  const testCase = trace && focusIndex !== null ? trace.test_cases[focusIndex] : null;

  const edited = state.code !== challenge.starter_code;
  const prediction = focusIndex !== null ? (state.predictions[focusIndex] ?? "") : "";
  const revealed = focusIndex !== null && Boolean(state.revealed[focusIndex]);
  const subject = testCase ? describeInput(testCase.input) : "this input";

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <StageHeading focusOnMount={focusHeading}>Trace it by hand</StageHeading>
        <p role="note" className="rounded-md border border-border-subtle bg-elevated p-3 text-sm text-text-primary">
          Self-check — StackSpeak did not run your code. Predict what your code does, then reveal
          the expected outcome and compare it with your reasoning.
        </p>
      </div>

      <section aria-labelledby="trace-code-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 id="trace-code-title" className="text-base font-semibold text-text-primary">
            {edited ? "Your current code" : "Starter code"}
          </h3>
          <p className="text-sm text-text-muted">
            {edited
              ? "This is the code you edited in Fix — you'll reason about exactly this."
              : "You haven't changed the code in Fix, so this is the starter code. Go back to Fix if you want to edit it first."}
          </p>
        </div>
        <CodeEditor
          filename="main.py"
          code={state.code}
          label={edited ? "Your code · read-only" : "Starter code · read-only"}
          fullWidth
        />
      </section>

      {!trace && (
        <ContentState
          loading={content.loading}
          error={content.error as ApiError | undefined}
          onRetry={content.retry}
          what="the trace exercise"
        />
      )}
      {!trace && <StageNav onBack={onBack} />}

      {trace && !testCase && (
        <Card>
          <p className="text-sm text-text-muted">There is no trace exercise for this challenge yet.</p>
        </Card>
      )}

      {trace && testCase && focusIndex !== null && (
        <>
          <Card highlighted className="flex flex-col gap-5 sm:p-8">
            <section aria-labelledby="trace-exercise-title" className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">Your prediction</Badge>
                  {testCase.is_edge_case && <Badge tone="neutral">Edge case</Badge>}
                </div>
                <h3 id="trace-exercise-title" className="text-xl font-semibold text-text-primary">
                  Predict: what happens with {subject}?
                </h3>
                <p className="text-sm text-text-muted">
                  Imagine calling your code like this, and follow it line by line:
                </p>
                <p className="overflow-x-auto rounded-md border border-border-subtle bg-background p-3 font-mono text-sm text-text-primary">
                  get_average({pyRepr(testCase.input)})
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-text-primary">Think it through</p>
                <BulletList items={trace.trace_prompts} />
              </div>

              <TextArea
                id="trace-prediction"
                label={`What does your code do when it receives ${subject}?`}
                value={prediction}
                onChange={(value) => dispatch({ type: "setPrediction", index: focusIndex, value })}
                maxLength={200}
                rows={3}
                hint="Say what it returns, or whether it raises an error — and why."
              />

              {!revealed ? (
                <div className="flex flex-col gap-2">
                  <div>
                    <Button
                      type="button"
                      size="lg"
                      disabled={prediction.trim() === ""}
                      aria-describedby={prediction.trim() === "" ? "reveal-hint" : undefined}
                      onClick={() => dispatch({ type: "reveal", index: focusIndex })}
                    >
                      Reveal expected outcome
                    </Button>
                  </div>
                  {prediction.trim() === "" && (
                    <p id="reveal-hint" className="text-xs text-text-muted">
                      Write your prediction first — the expected outcome is revealed after.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4 border-t border-border-subtle pt-5">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-text-primary">
                      Expected outcome: <span className="font-mono">{expectedOutcome(testCase)}</span>
                    </p>
                    <p className="text-sm text-text-muted">{trace.expected_behavior}</p>
                    <p className="text-xs text-text-muted">
                      This is what the challenge expects — not a result from running your code.
                    </p>
                  </div>

                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-medium text-text-primary">
                      How did your prediction compare?
                    </legend>
                    {MARK_OPTIONS.map((option) => (
                      <label key={option.value} className="flex min-h-11 items-center gap-3 text-sm text-text-primary">
                        <input
                          type="radio"
                          name="trace-mark"
                          className="size-5 accent-accent"
                          checked={state.marks[focusIndex] === option.value}
                          onChange={() => dispatch({ type: "mark", index: focusIndex, mark: option.value })}
                        />
                        {option.label}
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}
            </section>
          </Card>

          <PipRow expression="idea">
            If it didn&apos;t match, go back to Fix and adjust your code — your answers are kept.
          </PipRow>
          <StageNav onBack={onBack} onNext={onNext} nextLabel="Continue to Defend" blockedReason={blockedReason} />
        </>
      )}
    </div>
  );
}
