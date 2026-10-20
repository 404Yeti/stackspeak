"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { CodeInput } from "@/components/ui/CodeInput";
import { ClassroomHeader } from "./ClassroomHeader";
import { HighlightedCode } from "./HighlightedCode";
import { CodeLines } from "./CodeLines";
import { TeacherGuidePanel } from "./TeacherGuidePanel";
import { SupportPanel } from "./SupportPanel";
import type {
  Stage,
  StudentExercise,
  TeacherGuide,
  VocabularyEntry,
} from "./types";

const stages: Stage[] = ["Read", "Explain", "Fix"];
export function ClassroomWorkspace({
  exercise: e,
  teacher = false,
  shareable = false,
}: {
  exercise: StudentExercise;
  teacher?: boolean;
  shareable?: boolean;
}) {
  const [stage, setStage] = useState<Stage>("Read");
  const [panel, setPanel] = useState("Vocabulary");
  const [code, setCode] = useState(e.fix.buggyCode);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [presentation, setPresentation] = useState(false);
  const [guide, setGuide] = useState<TeacherGuide | null>(null);
  const [guideState, setGuideState] = useState<
    "closed" | "loading" | "open" | "error" | "unavailable"
  >("closed");
  const [notice, setNotice] = useState("");
  const [resetting, setResetting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [codeSize, setCodeSize] = useState(16);
  const [presentationSize, setPresentationSize] = useState(22);
  const [lineFocus, setLineFocus] = useState<VocabularyEntry | null>(null);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const stageChanged = useRef(false);
  const fontSize = presentation ? presentationSize : codeSize;
  const setFontSize = presentation ? setPresentationSize : setCodeSize;
  function goToStage(next: Stage) {
    stageChanged.current = true;
    setStage(next);
    setLineFocus(null);
    setPanel(
      next === "Read"
        ? "Vocabulary"
        : next === "Explain"
          ? "Questions"
          : "Hints",
    );
  }
  useEffect(() => {
    if (stageChanged.current) stageHeading.current?.focus();
  }, [stage]);
  function focusVocabulary(entry: VocabularyEntry) {
    setStage("Read");
    setLineFocus((current) => (current?.term === entry.term ? null : entry));
  }
  const controller = useRef<AbortController | null>(null);
  const editorScroll = useRef<HTMLPreElement>(null);
  useEffect(() => () => controller.current?.abort(), []);

  function hideGuide() {
    controller.current?.abort();
    controller.current = null;
    setGuide(null);
    setGuideState("closed");
  }
  async function revealGuide() {
    hideGuide();
    const request = new AbortController();
    controller.current = request;
    setGuideState("loading");
    try {
      const response = await fetch(`/classroom/api/guide/${e.slug}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: request.signal,
      });
      if (controller.current !== request || request.signal.aborted) return;
      if (response.status === 503) {
        setGuideState("unavailable");
        return;
      }
      if (!response.ok) throw new Error("Guide unavailable");
      const result: TeacherGuide = await response.json();
      if (controller.current !== request || request.signal.aborted) return;
      setGuide(result);
      setGuideState("open");
    } catch {
      if (!request.signal.aborted && controller.current === request)
        setGuideState("error");
    }
  }
  function togglePresentation() {
    hideGuide();
    setPresentation(!presentation);
    setNotice("");
    setResetting(false);
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/exercises/${e.slug}`,
      );
      setNotice("Student link copied.");
    } catch {
      setNotice(
        "Copy wasn’t available. Open the student view and copy its address.",
      );
    }
  }
  function reset() {
    setCode(e.fix.buggyCode);
    setExplanations({});
    goToStage("Read");
    setPreview(false);
    hideGuide();
    setResetting(false);
    setNotice("Exercise reset. Your edits and notes were cleared.");
  }
  const codeShown = stage === "Fix" ? code : e.readCode;
  return (
    <div
      className={`classroom-shell ${presentation ? "classroom-presenting" : ""}`}
      style={{ "--classroom-code-size": `${fontSize}px` } as CSSProperties}
    >
      <ClassroomHeader teacher={teacher} student={!teacher} />
      <div className="classroom-workspace">
        <div className="classroom-context">
          <Link
            className="classroom-text-button"
            href={teacher ? "/classroom" : "/"}
          >
            ← {teacher ? "Exercise library" : "StackSpeak"}
          </Link>
          <span className="text-xs text-text-muted">
            {teacher
              ? "Teacher-led lesson"
              : "Your edits stay in this browser tab"}
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="classroom-meta mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="info">{e.language}</Badge>
              <Badge>{e.difficulty}</Badge>
              <span className="text-xs text-text-muted">
                {e.minutes} min · {e.topics.join(" · ")}
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{e.title}</h1>
            <p className="classroom-description mt-3 text-sm text-text-muted">
              {e.description}
            </p>
          </div>
          <div className="classroom-actions flex flex-wrap gap-2">
            {teacher && shareable && (
              <Button variant="secondary" onClick={copyLink}>
                Copy student link
              </Button>
            )}
            {teacher && !shareable && (
              <Badge tone="accent">Private draft · sharing unavailable</Badge>
            )}
            <Button
              variant="secondary"
              onClick={togglePresentation}
              aria-pressed={presentation}
            >
              {presentation ? "Exit presentation" : "Present lesson"}
            </Button>
            {!presentation && (
              <Button variant="ghost" onClick={() => setResetting(true)}>
                Reset exercise
              </Button>
            )}
          </div>
        </div>
        <p role="status" className="mt-2 text-sm text-success">
          {notice}
        </p>
        {teacher && shareable && !presentation && (
          <p className="mt-2 text-xs text-text-muted">
            <Link
              href={`/exercises/${e.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Open student view in a new tab
            </Link>{" "}
            · Public link contains no answer guide.
          </p>
        )}
        {resetting && (
          <section
            role="alert"
            aria-labelledby="reset-title"
            className="my-4 flex flex-wrap items-center gap-4 rounded-lg border border-accent bg-surface p-4"
          >
            <h2 id="reset-title">Clear your edits and explanation notes?</h2>
            <Button onClick={reset}>Clear and reset</Button>
            <Button variant="secondary" onClick={() => setResetting(false)}>
              Keep working
            </Button>
          </section>
        )}
        <nav className="classroom-stages" aria-label="Exercise stages">
          {stages.map((s, i) => (
            <button
              key={s}
              onClick={() => goToStage(s)}
              aria-current={stage === s ? "step" : undefined}
            >
              <span className="classroom-stage-number">0{i + 1}</span>
              {s}
            </button>
          ))}
          <p className="ml-auto hidden text-xs text-text-muted lg:block">
            Read it. Explain it. Fix it.
          </p>
        </nav>
        <div className="classroom-columns">
          <section aria-labelledby="stage-title" className="min-w-0">
            <p className="classroom-eyebrow">
              {stage === "Read"
                ? "START WITH CURIOSITY"
                : stage === "Explain"
                  ? "MAKE YOUR THINKING HEARD"
                  : "ONE CHANGE. A CLEAR EXPLANATION."}
            </p>
            <h2
              ref={stageHeading}
              tabIndex={-1}
              id="stage-title"
              className="mt-2 text-xl font-semibold"
            >
              {stage === "Read"
                ? "Walk through the code"
                : stage === "Explain"
                  ? "Explain it in your own words"
                  : "Find the problem. Make the fix."}
            </h2>
            <p className="mb-5 mt-3 leading-relaxed text-text-muted">
              {stage === "Fix"
                ? e.fix.instructions
                : stage === "Explain"
                  ? "Use the questions to explain the behavior and your reasoning. There’s more than one good way to say it."
                  : e.instructions}
            </p>
            <div
              className="classroom-code-controls"
              aria-label="Code display controls"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">Code size</span>
                <button
                  aria-label="Decrease code size"
                  disabled={fontSize <= 14}
                  onClick={() => setFontSize(Math.max(14, fontSize - 2))}
                >
                  −
                </button>
                <output aria-live="polite" aria-label="Code font size">
                  {fontSize} px
                </output>
                <button
                  aria-label="Increase code size"
                  disabled={fontSize >= 28}
                  onClick={() => setFontSize(Math.min(28, fontSize + 2))}
                >
                  +
                </button>
              </div>
              {lineFocus && (
                <button
                  className="classroom-text-button"
                  onClick={() => setLineFocus(null)}
                >
                  Clear line focus
                </button>
              )}
            </div>
            {lineFocus && (
              <p role="status" className="mb-3 text-sm text-accent-soft">
                {lineFocus.term}: Read code, lines{" "}
                {lineFocus.readLines?.join(", ")}. Your Fix draft is unchanged.
              </p>
            )}
            <div className="classroom-code" aria-label="Lesson code">
              {stage === "Fix" && !preview ? (
                <div
                  className="classroom-editable"
                  style={
                    {
                      "--classroom-gutter": `${String(code.split("\n").length).length}ch`,
                    } as CSSProperties
                  }
                  onScrollCapture={(event) => {
                    if (
                      event.target instanceof HTMLTextAreaElement &&
                      editorScroll.current
                    ) {
                      editorScroll.current.scrollTop = event.target.scrollTop;
                      editorScroll.current.scrollLeft = event.target.scrollLeft;
                    }
                  }}
                >
                  <CodeInput
                    id="classroom-code"
                    filename={e.filename}
                    value={code}
                    onChange={setCode}
                    maxLength={20000}
                  />
                  <pre
                    ref={editorScroll}
                    aria-hidden="true"
                    className="classroom-code-overlay"
                  >
                    <code>
                      <HighlightedCode code={code + "\n"} />
                    </code>
                  </pre>
                </div>
              ) : (
                <CodeEditor
                  filename={e.filename}
                  code={codeShown}
                  highlightedCode={
                    <CodeLines
                      code={codeShown}
                      highlightedLines={lineFocus?.readLines ?? []}
                    />
                  }
                  fullWidth
                  label={stage === "Fix" ? "Your syntax preview" : "Read-only"}
                />
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
              <p>
                Execution is unavailable in Classroom. You can still read,
                discuss, and edit.
              </p>
              {stage === "Fix" && (
                <button
                  className="classroom-text-button"
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? "Back to editing" : "Syntax preview"}
                </button>
              )}
            </div>
            {stage === "Fix" && (
              <p className="mt-2 text-xs text-text-muted">
                Edits stay in this tab until you reload or reset. Use spaces to
                indent; Tab moves to the next control.
              </p>
            )}
            <div className="classroom-stage-actions mt-6 flex justify-between gap-4">
              <Button
                variant="ghost"
                disabled={stage === "Read"}
                onClick={() => goToStage(stages[stages.indexOf(stage) - 1])}
              >
                ← Previous
              </Button>
              {stage !== "Fix" && (
                <Button
                  onClick={() => {
                    const next = stages[stages.indexOf(stage) + 1];
                    goToStage(next);
                  }}
                >
                  Continue to {stages[stages.indexOf(stage) + 1]} →
                </Button>
              )}
              {stage === "Fix" && (
                <p className="self-center text-sm text-text-muted">
                  Discuss what changed and why.
                </p>
              )}
            </div>
            {teacher && !presentation && (
              <TeacherGuidePanel
                exercise={e}
                guide={guide}
                guideState={guideState}
                hideGuide={hideGuide}
                revealGuide={revealGuide}
              />
            )}
          </section>
          <SupportPanel
            exercise={e}
            panel={panel}
            setPanel={setPanel}
            explanations={explanations}
            setExplanations={setExplanations}
            selectedTerm={lineFocus?.term}
            onVocabularyFocus={focusVocabulary}
          />
        </div>
      </div>
    </div>
  );
}
