"use client";
import { Button } from "@/components/ui/Button";
export default function ClassroomError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-2xl font-semibold">Classroom couldn’t open</h1>
      <p className="my-4 text-text-muted">
        Please try again. Your existing Daily Challenge is still available.
      </p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
