import { Suspense } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LearningSequence } from "@/features/home/LearningSequence";
import { BackendStatus } from "@/features/home/BackendStatus";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-20 px-6 py-16">
      <section className="flex flex-col items-start gap-6">
        <Badge tone="accent">StackSpeak v0.1 Public Preview</Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">
          Read it. Explain it. Fix it. Defend it.
        </h1>
        <p className="max-w-2xl text-lg text-text-muted">
          StackSpeak is a voice-first coding comprehension and technical English
          learning platform. Read unfamiliar code, explain it aloud, fix what&apos;s
          broken, and defend your decisions — building independent engineering
          judgment along the way.
        </p>
        <div className="flex flex-wrap gap-4">
          <Button href="/daily-challenge" variant="primary" size="lg">
            Start today&apos;s challenge
          </Button>
          <Button href="/courses" variant="secondary" size="lg">
            Browse courses
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold text-text-primary">
          The core learning sequence
        </h2>
        <LearningSequence />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold text-text-primary">System status</h2>
        <Suspense
          fallback={
            <div className="rounded-lg border border-border-subtle bg-surface p-6 text-sm text-text-muted">
              Checking backend status…
            </div>
          }
        >
          <BackendStatus />
        </Suspense>
      </section>
    </div>
  );
}
