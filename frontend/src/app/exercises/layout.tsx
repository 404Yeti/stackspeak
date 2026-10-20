import { Suspense } from "react";
export const metadata = { title: "Exercise — StackSpeak" };
export default function SharedExerciseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <p role="status" className="px-6 py-20 text-text-muted">
          Opening your exercise…
        </p>
      }
    >
      {children}
    </Suspense>
  );
}
