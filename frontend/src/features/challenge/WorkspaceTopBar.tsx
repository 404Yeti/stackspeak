import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StageStepper, STAGES, type Stage } from "@/components/ui/StageStepper";

/**
 * The approved workspace top bar (Figma 5:3): compact logo + "Daily
 * Challenge", the stage stepper, and an exit control — "Exit" rather than
 * Figma's "Save & exit", since nothing is saved server-side (drafts stay in
 * this tab's sessionStorage). Below `lg` the 656px stepper doesn't fit, so a
 * compact "Step n of 6" + progress bar takes its place (responsive
 * adaptation, not in Figma).
 */
export function WorkspaceTopBar({ stage }: { stage: Stage }) {
  const index = STAGES.indexOf(stage);

  return (
    <header className="border-b border-border-subtle bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="StackSpeak home">
            <Logo />
          </Link>
          <span className="hidden text-sm text-text-muted sm:inline">Daily Challenge</span>
        </div>

        <div className="hidden lg:block">
          <StageStepper stage={stage} />
        </div>

        <div className="flex justify-end">
          <Button href="/" variant="ghost">
            Exit
          </Button>
        </div>

        <div className="flex w-full flex-col gap-2 lg:hidden">
          <p className="text-sm font-medium text-text-primary">
            Step {index + 1} of {STAGES.length} · {stage}
          </p>
          <ProgressBar value={((index + 1) / STAGES.length) * 100} label="Challenge progress" />
        </div>
      </div>
    </header>
  );
}
