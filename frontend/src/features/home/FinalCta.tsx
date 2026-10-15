import { Button } from "@/components/ui/Button";

export function FinalCta() {
  return (
    <section className="px-6 py-10 lg:px-[120px]">
      <div className="flex flex-col items-center gap-6 rounded-lg border border-accent bg-elevated px-6 py-12 text-center lg:py-16">
        <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-text-primary">
          Read code. Explain it aloud. Communicate like an engineer.
        </h2>
        <Button href="/daily-challenge" variant="primary" size="lg">
          Start Learning Free
        </Button>
      </div>
    </section>
  );
}
