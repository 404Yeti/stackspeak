import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { HighlightedCode } from "./HighlightedCode";
import type { StudentExercise, TeacherGuide } from "./types";

export function TeacherGuidePanel({
  exercise: e,
  guide,
  guideState,
  hideGuide,
  revealGuide,
}: {
  exercise: StudentExercise;
  guide: TeacherGuide | null;
  guideState: "closed" | "loading" | "open" | "error" | "unavailable";
  hideGuide: () => void;
  revealGuide: () => void;
}) {
  return (
    <section className="classroom-guide" aria-labelledby="guide-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="classroom-eyebrow">TEACHER ONLY</p>
          <h2 id="guide-title" className="mt-2 font-semibold">
            Answer guide & teaching notes
          </h2>
        </div>
        <Button
          variant="secondary"
          disabled={guideState === "loading"}
          onClick={guideState === "open" ? hideGuide : revealGuide}
        >
          {guideState === "loading"
            ? "Loading guide…"
            : guideState === "open"
              ? "Hide guide"
              : "Reveal guide"}
        </Button>
      </div>
      {guideState === "closed" && (
        <p className="mt-3 text-sm text-text-muted">
          Closed by default. Stop screen sharing before revealing private
          teaching material.
        </p>
      )}
      {guideState === "loading" && (
        <p role="status" className="mt-3 text-sm text-text-muted">
          Fetching your private guide…
        </p>
      )}
      {guideState === "unavailable" && (
        <p role="status" className="mt-3 text-sm text-text-muted">
          A private teacher guide hasn’t been configured for this environment.
          You can continue teaching with the student materials.
        </p>
      )}
      {guideState === "error" && (
        <p role="alert" className="mt-3 text-sm text-error">
          The guide couldn’t be loaded. Check your connection or{" "}
          <Link href="/classroom/login" className="underline">
            sign in again
          </Link>
          , then retry.
        </p>
      )}
      {guide && guideState === "open" && (
        <div className="mt-5 space-y-6">
          {guide.answers.map((answer) => (
            <div key={answer.questionId}>
              <h3 className="font-medium">
                {e.questions.find((q) => q.id === answer.questionId)?.prompt}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                Ideal spoken explanation: {answer.spokenExample}
              </p>
              <p className="mt-2 text-sm text-success">
                Key technical concepts: {answer.listenFor.join(" · ")}
              </p>
            </div>
          ))}
          <div>
            <h3 className="mb-3 font-medium">One expected correction</h3>
            <CodeEditor
              fullWidth
              filename={e.filename}
              code={guide.correction}
              highlightedCode={<HighlightedCode code={guide.correction} />}
            />
          </div>
          <section>
            <h3 className="mb-3 font-medium">Common misunderstandings</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-text-muted">
              {guide.misunderstandings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-3 font-medium">Follow-up discussion</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-text-muted">
              {guide.followUps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <h3 className="font-medium">Teaching notes</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm text-text-muted">
            {guide.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="text-xs text-text-muted">
            Assess code reasoning and spoken communication separately. This
            guide is a discussion aid, not an automatic grade.
          </p>
        </div>
      )}
    </section>
  );
}
