"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ApiError, getDailyChallenge, type ChallengeLoad } from "@/lib/api";
import { STAGE_LABELS, STAGE_ORDER, blockedReason, flowReducer, initialState } from "./challengeReducer";
import { clearDraft, draftKey, loadDraft, saveDraft } from "./draftStorage";
import { DefendStage, useDefendContent } from "./DefendStage";
import { ExplainStage } from "./ExplainStage";
import { FeedbackStage, useReviewContent } from "./FeedbackStage";
import { FixStage } from "./FixStage";
import { ReadStage } from "./ReadStage";
import { ContentState, PipRow } from "./StageLayout";
import { TraceStage, useTraceContent } from "./TraceStage";
import { WorkspaceTopBar } from "./WorkspaceTopBar";

/** After this long without a response, say the server may be waking up. */
const SLOW_LOAD_MS = 5_000;

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "ready"; challenge: ChallengeLoad };

/**
 * Loads the real daily challenge, then hands off to the stage flow. All
 * student state is local (reducer + sessionStorage); nothing the student
 * writes is sent to the server, and no code is ever executed.
 */
export function ChallengeWorkspace() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);
  const [flowKey, setFlowKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const slowTimer = setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    getDailyChallenge(controller.signal).then(
      (challenge) => {
        clearTimeout(slowTimer);
        setLoad({ status: "ready", challenge });
      },
      (error: unknown) => {
        clearTimeout(slowTimer);
        if (controller.signal.aborted) return;
        setLoad({
          status: "error",
          error: error instanceof ApiError ? error : new ApiError("network", "Could not reach the server."),
        });
      },
    );
    return () => {
      clearTimeout(slowTimer);
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    setSlow(false);
    setAttempt((n) => n + 1);
  }, []);

  if (load.status === "ready") {
    return (
      <ChallengeFlow
        key={flowKey}
        challenge={load.challenge}
        onRestart={() => {
          clearDraft(draftKey(load.challenge.id, load.challenge.version));
          setFlowKey((n) => n + 1);
        }}
      />
    );
  }

  return (
    <>
      <WorkspaceTopBar stage="Read" />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="mb-6 text-3xl font-semibold text-text-primary">Daily Challenge</h1>
        {load.status === "loading" ? (
          <Card>
            <div role="status" className="flex flex-col gap-3">
              <PipRow expression="thinking">Loading today&apos;s challenge…</PipRow>
              {slow && (
                <p className="text-sm text-text-muted">
                  The server may be waking up — this can take up to 30 seconds.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <ContentState loading={false} error={load.error} onRetry={retry} what="today's challenge" />
        )}
      </div>
    </>
  );
}

function ChallengeFlow({ challenge, onRestart }: { challenge: ChallengeLoad; onRestart: () => void }) {
  const key = draftKey(challenge.id, challenge.version);
  // Mounted only after a client-side fetch, so reading sessionStorage here
  // can't cause a hydration mismatch.
  const [state, dispatch] = useReducer(
    flowReducer,
    challenge.starter_code,
    (starter) => loadDraft(key) ?? initialState(starter),
  );
  const [navigated, setNavigated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => saveDraft(key, state), 250);
    return () => clearTimeout(timer);
  }, [key, state]);

  const stageIndex = STAGE_ORDER.indexOf(state.stage);
  // Each stage's content is requested only once the student reaches it.
  const trace = useTraceContent(challenge.id, stageIndex >= STAGE_ORDER.indexOf("trace"));
  const defend = useDefendContent(challenge.id, stageIndex >= STAGE_ORDER.indexOf("defend"));
  const review = useReviewContent(challenge.id, stageIndex >= STAGE_ORDER.indexOf("feedback"));

  const traceCaseCount = trace.data?.test_cases.length ?? 0;
  const reason = blockedReason(state, traceCaseCount);

  const stageProps = {
    challenge,
    state,
    dispatch,
    focusHeading: navigated,
    onBack: stageIndex > 0
      ? () => {
          setNavigated(true);
          dispatch({ type: "back" });
        }
      : undefined,
    onNext: () => {
      setNavigated(true);
      dispatch({ type: "next", traceCaseCount });
    },
    blockedReason: reason,
  };

  return (
    <>
      <WorkspaceTopBar stage={STAGE_LABELS[state.stage]} />
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">{challenge.title}</h1>
          <Badge tone="info">{challenge.language === "python" ? "Python" : challenge.language}</Badge>
          <Badge tone="neutral">{challenge.difficulty}</Badge>
        </div>

        {state.stage === "read" && <ReadStage {...stageProps} />}
        {state.stage === "explain" && <ExplainStage {...stageProps} />}
        {state.stage === "fix" && <FixStage {...stageProps} />}
        {state.stage === "trace" && <TraceStage {...stageProps} content={trace} />}
        {state.stage === "defend" && <DefendStage {...stageProps} content={defend} />}
        {state.stage === "feedback" && (
          <FeedbackStage {...stageProps} content={review} onRestart={onRestart} />
        )}
      </div>
    </>
  );
}

