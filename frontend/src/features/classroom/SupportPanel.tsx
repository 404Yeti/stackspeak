import type { StudentExercise, VocabularyEntry } from "./types";
export function SupportPanel({
  exercise: e,
  panel,
  setPanel,
  explanations,
  setExplanations,
  selectedTerm,
  onVocabularyFocus,
}: {
  exercise: StudentExercise;
  selectedTerm?: string;
  onVocabularyFocus: (entry: VocabularyEntry) => void;
  panel: string;
  setPanel: (panel: string) => void;
  explanations: Record<string, string>;
  setExplanations: (notes: Record<string, string>) => void;
}) {
  return (
    <aside className="classroom-support" aria-label="Exercise support">
      <div className="classroom-support-tabs" aria-label="Choose support">
        {["Vocabulary", "Questions", "Hints"].map((p) => (
          <button
            key={p}
            aria-pressed={panel === p}
            onClick={() => setPanel(p)}
          >
            {p}
          </button>
        ))}
      </div>
      {panel === "Vocabulary" && (
        <div className="p-5">
          <h2 className="mb-5 text-lg font-semibold">
            Words for the walkthrough
          </h2>
          <div className="space-y-6">
            {e.vocabulary.map((v) => (
              <section key={v.term}>
                <h3 className="font-mono text-sm font-medium text-accent-soft">
                  {v.readLines ? (
                    <button
                      aria-label={`Highlight ${v.term} in Read code`}
                      aria-pressed={selectedTerm === v.term}
                      className="classroom-vocabulary-link"
                      onClick={() => onVocabularyFocus(v)}
                    >
                      {v.term} <span aria-hidden="true">↗</span>
                    </button>
                  ) : (
                    v.term
                  )}
                </h3>
                {v.readLines && (
                  <p className="mt-1 text-xs text-text-muted">
                    Read code · lines {v.readLines.join(", ")}
                  </p>
                )}
                <p className="mt-2 text-sm leading-relaxed">{v.definition}</p>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  “{v.example}”
                </p>
                {v.speakingPrompt && (
                  <p className="mt-3 border-l-2 border-accent pl-3 text-xs leading-relaxed text-text-muted">
                    Say it aloud: {v.speakingPrompt}
                  </p>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
      {panel === "Questions" && (
        <div className="space-y-6 p-5">
          <h2 className="text-lg font-semibold">Think it through</h2>
          {e.questions.map((q, i) => (
            <div key={q.id}>
              <label className="block text-sm leading-relaxed" htmlFor={q.id}>
                <span className="mr-2 text-accent-soft">0{i + 1}</span>
                {q.prompt}
              </label>
              <textarea
                id={q.id}
                value={explanations[q.id] ?? ""}
                maxLength={5000}
                onChange={(event) =>
                  setExplanations({
                    ...explanations,
                    [q.id]: event.target.value,
                  })
                }
                className="classroom-input mt-3 min-h-24 w-full"
                placeholder="Optional notes, in your own words…"
              />
            </div>
          ))}
          <p className="text-xs text-text-muted">
            Notes stay in this tab. They are not submitted or graded.
          </p>
        </div>
      )}
      {panel === "Hints" && (
        <div className="p-5">
          <h2 className="mb-3 text-lg font-semibold">
            A nudge, when you need it
          </h2>
          <p className="mb-5 text-sm text-text-muted">
            Try explaining the problem before opening a hint.
          </p>
          {e.fix.hints.map((hint, i) => (
            <details key={hint} className="border-t border-border-subtle py-4">
              <summary className="cursor-pointer text-sm font-medium">
                Hint {i + 1}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {hint}
              </p>
            </details>
          ))}
        </div>
      )}
    </aside>
  );
}
