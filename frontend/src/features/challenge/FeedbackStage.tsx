"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { getChallengeReview, type ApiError, type ChallengeReview } from "@/lib/api";
import { ContentState, PipRow, StageHeading } from "./StageLayout";
import type { StageProps } from "./stageTypes";
import { useStageContent } from "./useStageContent";

const REFERENCE_LABEL = "This is one reference implementation, not the only valid answer.";

export type ReviewContent = ReturnType<typeof useStageContent<ChallengeReview>>;

export function useReviewContent(challengeId: string, enabled: boolean): ReviewContent {
  const load = useCallback((signal: AbortSignal) => getChallengeReview(challengeId, signal), [challengeId]);
  return useStageContent<ChallengeReview>(enabled, load);
}

function Checklist({
  title,
  description,
  items,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  items: string[];
  checked: Record<number, boolean>;
  onToggle: (index: number) => void;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-semibold text-text-primary">{title}</legend>
        <p className="text-sm text-text-muted">{description}</p>
        {items.map((item, index) => (
          <label key={item} className="flex min-h-11 items-start gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-accent"
              checked={Boolean(checked[index])}
              onChange={() => onToggle(index)}
            />
            <span>{item}</span>
          </label>
        ))}
      </fieldset>
    </Card>
  );
}

function Answer({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="whitespace-pre-wrap break-words text-sm text-text-primary">{text}</p>
    </div>
  );
}

export function FeedbackStage({
  state,
  dispatch,
  focusHeading,
  onBack,
  content,
  onRestart,
}: StageProps & { content: ReviewContent; onRestart: () => void }) {
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const review = content.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <StageHeading focusOnMount={focusHeading}>Review your work</StageHeading>
        <p className="max-w-3xl text-sm text-text-muted">
          Technical understanding and communication are reviewed separately. This is a
          self-review — StackSpeak has not evaluated your answers, and there is no score.
        </p>
      </div>

      {!review && (
        <>
          <ContentState
            loading={content.loading}
            error={content.error as ApiError | undefined}
            onRetry={content.retry}
            what="your review"
          />
          <div>
            <Button type="button" variant="secondary" onClick={onBack}>
              Back
            </Button>
          </div>
        </>
      )}

      {review && (
        <>
          <Card className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-text-primary">Your answers</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <Answer label="Explanation" text={state.explanation} />
              <Answer label="Diagnosis" text={state.diagnosis} />
              <Answer label="Defense" text={state.defense} />
            </div>
          </Card>

          <Card className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-text-primary">What was wrong</h3>
            <p className="text-sm text-text-muted">{review.bug_description}</p>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Checklist
              title="Technical understanding"
              description="Tick what you did. Be honest — this is for you."
              items={review.technical_checklist}
              checked={state.technical}
              onToggle={(index) => dispatch({ type: "toggleTechnical", index })}
            />
            <Checklist
              title="Communication"
              description="How clearly you wrote your explanation, diagnosis, and defense."
              items={review.communication_checklist}
              checked={state.communication}
              onToggle={(index) => dispatch({ type: "toggleCommunication", index })}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <CodeEditor filename="main.py" code={state.code} label="Your code" fullWidth />
            <CodeEditor
              filename="main.py"
              code={review.corrected_solution}
              label="One reference implementation"
              fullWidth
            />
          </div>
          <p className="max-w-3xl text-sm text-text-muted">
            <strong className="font-medium text-text-primary">{REFERENCE_LABEL}</strong>{" "}
            {/* The label is owned here; drop it from the note if the backend repeats it. */}
            {review.alternatives_note.replace(REFERENCE_LABEL, "").trim()}
          </p>

          <Card className="flex flex-col gap-4">
            <PipRow expression="celebrating">
              <p className="font-medium text-text-primary">You completed all six stages.</p>
              <p>That&apos;s about finishing the practice — it isn&apos;t a verdict on your code.</p>
            </PipRow>
            <div className="flex flex-wrap items-center gap-3">
              {confirmingRestart ? (
                <div role="group" aria-label="Confirm start over" className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-text-muted">Clear all your answers and start again?</span>
                  <Button type="button" onClick={onRestart}>
                    Yes, start over
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirmingRestart(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <Button type="button" onClick={() => setConfirmingRestart(true)}>
                    Start over
                  </Button>
                  <Button type="button" variant="secondary" onClick={onBack}>
                    Back
                  </Button>
                </>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
