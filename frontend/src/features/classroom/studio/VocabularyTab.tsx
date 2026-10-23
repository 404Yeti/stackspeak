"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Draft } from "@/lib/classroom/studio/validation";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { CodeLines } from "../CodeLines";
import { parseReadLines } from "@/lib/classroom/studio/readLines";
import { TextField } from "./Fields";
export function VocabularyTab({ draft, onChange, onValidationChange }: { draft: Draft; onChange: (v: Draft["vocabulary"]) => void; onValidationChange?: (error: string) => void }) {
  // Keep text separate from the numeric draft: invalid input stays editable, never serialized.
  const [texts, setTexts] = useState(() => draft.vocabulary.map((v) => (v.readLines ?? []).join(", ")));
  const max = draft.content.readCode.split("\n").length;
  const errors = texts.map((text) => parseReadLines(text, max).error);
  const error = errors.map((message, i) => message ? `Vocabulary ${i + 1}: ${message}` : "").filter(Boolean).join(" ");
  useEffect(() => { onValidationChange?.(error); }, [error, onValidationChange]);
  const [focus, setFocus] = useState<number[]>([]);
  const entries = draft.vocabulary;
  const update = (i: number, value: Partial<Draft["vocabulary"][number]>) => onChange(entries.map((e, n) => n === i ? { ...e, ...value } : e));
  const move = (i: number, delta: number) => { const next = [...entries]; [next[i], next[i + delta]] = [next[i + delta], next[i]]; onChange(next); const nextTexts = [...texts]; [nextTexts[i], nextTexts[i + delta]] = [nextTexts[i + delta], nextTexts[i]]; setTexts(nextTexts); };
  return <div className="studio-vocabulary-layout"><section className="studio-section">
    <div className="studio-section-heading"><span className="classroom-eyebrow">WORDS THAT MAKE CODE CLEARER</span><h2>Give the explanation a vocabulary.</h2><p>Connect a technical term to the exact lines students will discuss.</p></div>
    {entries.map((entry, i) => <fieldset className="studio-entry" key={i}><legend>Vocabulary {i + 1}</legend>
      <TextField label={`Technical term ${i + 1}`} value={entry.term} onChange={(v) => update(i, { term: v })} maxLength={120} />
      <TextField label={`Definition ${i + 1}`} value={entry.definition} onChange={(v) => update(i, { definition: v })} multiline maxLength={2000} />
      <TextField label={`Example usage ${i + 1}`} value={entry.example} onChange={(v) => update(i, { example: v })} multiline maxLength={2000} />
      <TextField label={`Pronunciation notes ${i + 1}`} value={entry.pronunciation ?? ""} onChange={(v) => update(i, { pronunciation: v })} maxLength={500} />
      <TextField label={`Speaking prompt ${i + 1}`} value={entry.speakingPrompt ?? ""} onChange={(v) => update(i, { speakingPrompt: v })} maxLength={1000} />
      <TextField label="Read code lines (comma separated)" value={texts[i] ?? ""} error={errors[i]} onChange={(text) => {
        setTexts(texts.map((value, n) => n === i ? text : value));
        const parsed = parseReadLines(text, max);
        if (!parsed.error) update(i, { readLines: parsed.lines });
      }} />
      <div className="studio-actions"><Button variant="ghost" disabled={!entry.readLines?.length || !!errors[i]} onClick={() => setFocus(entry.readLines ?? [])}>Highlight lines</Button>
        <button className="classroom-text-button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move vocabulary ${i + 1} up`}>Move up</button>
        <button className="classroom-text-button" disabled={i === entries.length - 1} onClick={() => move(i, 1)} aria-label={`Move vocabulary ${i + 1} down`}>Move down</button>
        <button className="classroom-text-button" onClick={() => { onChange(entries.filter((_, n) => n !== i)); setTexts(texts.filter((_, n) => n !== i)); }}>Delete vocabulary {i + 1}</button></div>
    </fieldset>)}
    <Button variant="secondary" disabled={entries.length >= 100} onClick={() => { onChange([...entries, { term: "", definition: "", example: "", readLines: [] }]); setTexts([...texts, ""]); }}>Add vocabulary</Button>
  </section><aside className="studio-read-reference"><h3 className="mb-3 font-semibold">Read code reference</h3><CodeEditor filename={draft.content.filename} code={draft.content.readCode} highlightedCode={<CodeLines code={draft.content.readCode} highlightedLines={focus} />} fullWidth /><p className="mt-3 text-xs text-text-muted">Line references always belong to Read code, not the student’s Fix edits.</p></aside></div>;
}
