import { StepItem, type StepState } from "./StepItem";

// "Trace" (not "Run") until real code execution exists — students predict and
// self-check; nothing is run. See docs/decisions/0002-aud-52-interactive-flow.md.
export type Stage = "Read" | "Explain" | "Fix" | "Trace" | "Defend" | "Feedback";

export const STAGES: Stage[] = ["Read", "Explain", "Fix", "Trace", "Defend", "Feedback"];

export type StageStepperProps = {
  stage: Stage;
};

export function StageStepper({ stage }: StageStepperProps) {
  const currentIndex = STAGES.indexOf(stage);

  return (
    <ol className="flex flex-wrap items-center gap-3" aria-label="Challenge stage progress">
      {STAGES.map((label, index) => {
        const state: StepState =
          index < currentIndex ? "done" : index === currentIndex ? "active" : "upcoming";

        return (
          <li
            key={label}
            aria-current={state === "active" ? "step" : undefined}
            className="flex items-center gap-3"
          >
            <StepItem label={label} number={index + 1} state={state} />
            {index < STAGES.length - 1 && (
              <span aria-hidden="true" className="h-px w-5 bg-border-subtle" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
