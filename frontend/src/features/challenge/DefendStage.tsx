"use client";

import { useCallback } from "react";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { TextArea } from "@/components/ui/TextArea";
import { getChallengeDefend, type ApiError, type ChallengeDefend } from "@/lib/api";
import { MAX_ANSWER_CHARS } from "./challengeReducer";
import { BulletList, ContentState, InfoCard, PipRow, StageHeading, StageNav, StageShell } from "./StageLayout";
import type { StageProps } from "./stageTypes";
import { useStageContent } from "./useStageContent";

export type DefendContent = ReturnType<typeof useStageContent<ChallengeDefend>>;

export function useDefendContent(challengeId: string, enabled: boolean): DefendContent {
  const load = useCallback((signal: AbortSignal) => getChallengeDefend(challengeId, signal), [challengeId]);
  return useStageContent<ChallengeDefend>(enabled, load);
}

export function DefendStage({
  state,
  dispatch,
  focusHeading,
  onBack,
  onNext,
  blockedReason,
  content,
}: StageProps & { content: DefendContent }) {
  const defend = content.data;

  return (
    <StageShell
      main={<CodeEditor filename="main.py" code={state.code} label="Your code (read-only)" fullWidth />}
      side={
        <>
          <InfoCard title="Problem">
            <StageHeading focusOnMount={focusHeading}>Defend your fix</StageHeading>
            <p className="text-sm text-text-muted">
              Explain your choices the way you would to a teammate reviewing your change: what you
              did, why, and what the alternatives were.
            </p>
          </InfoCard>

          {!defend && (
            <>
              <ContentState
                loading={content.loading}
                error={content.error as ApiError | undefined}
                onRetry={content.retry}
                what="the defend questions"
              />
              <StageNav onBack={onBack} />
            </>
          )}

          {defend && (
            <>
              <InfoCard title="Think about">
                <BulletList items={defend.defend_prompts} />
              </InfoCard>
              <InfoCard title="Your defense">
                <PipRow expression="explaining">Give reasons, and use words like &ldquo;because&rdquo; and &ldquo;so that&rdquo;.</PipRow>
                <TextArea
                  id="defense"
                  label="Why did you fix it this way?"
                  value={state.defense}
                  onChange={(value) => dispatch({ type: "setDefense", value })}
                  maxLength={MAX_ANSWER_CHARS}
                  rows={7}
                  hint="Your answer stays in this browser tab."
                />
                <StageNav onBack={onBack} onNext={onNext} nextLabel="Continue to Feedback" blockedReason={blockedReason} />
              </InfoCard>
            </>
          )}
        </>
      }
    />
  );
}
