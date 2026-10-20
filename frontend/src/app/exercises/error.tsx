"use client";
import { Button } from "@/components/ui/Button";
export default function ExerciseError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-2xl font-semibold">This exercise couldn’t load</h1>
      <p className="my-4 text-text-muted">
        Check your connection and try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
