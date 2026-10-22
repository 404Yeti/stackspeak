"use client";
import type { Guide, Draft } from "@/lib/classroom/studio/validation";
import { ListField, StudioCode, TextField } from "./Fields";
export function GuideTab({ value, draft, onChange }: { value: Guide; draft: Draft; onChange: (v: Guide) => void }) {
  const set = <K extends keyof Guide>(key: K, next: Guide[K]) => onChange({ ...value, [key]: next });
  return <section className="studio-section"><div className="studio-private-note"><strong>Teacher-only guide</strong><p>Visible only to the signed-in teacher. These fields are excluded from student pages and preview. Nothing here is stored in browser storage.</p></div>
    <TextField label="Ideal technical explanation" value={value.idealExplanation} onChange={(v) => set("idealExplanation", v)} multiline />
    <TextField label="Ideal spoken explanation" value={value.spokenExplanation} onChange={(v) => set("spokenExplanation", v)} multiline />
    <StudioCode label="Expected corrected code" filename={draft.content.filename} value={value.expectedSolution} onChange={(v) => set("expectedSolution", v)} />
    <TextField label="Debugging guidance" value={value.debuggingGuidance} onChange={(v) => set("debuggingGuidance", v)} multiline />
    <ListField label="Teaching hints (one per line)" value={value.teachingHints} onChange={(v) => set("teachingHints", v)} />
    <ListField label="Follow-up questions (one per line)" value={value.followUpQuestions} onChange={(v) => set("followUpQuestions", v)} />
    <ListField label="Common misunderstandings (one per line)" value={value.misunderstandings} onChange={(v) => set("misunderstandings", v)} />
    <TextField label="Private teaching notes" value={value.privateNotes} onChange={(v) => set("privateNotes", v)} multiline />
    {value.answers.length > 0 && <div className="studio-entry"><h3 className="font-semibold">Imported question guides</h3>{value.answers.map((a, i) => <div key={a.questionId} className="mt-4"><p>{draft.content.questions.find((q) => q.id === a.questionId)?.prompt ?? "Removed question — remove this answer before saving"}</p>
      <TextField label={`Spoken answer ${i + 1}`} value={a.spokenExample} onChange={(v) => set("answers", value.answers.map((item, n) => n === i ? { ...item, spokenExample: v } : item))} multiline />
      <ListField label={`Listen for ${i + 1}`} value={a.listenFor} onChange={(v) => set("answers", value.answers.map((item, n) => n === i ? { ...item, listenFor: v } : item))} />
      <button className="classroom-text-button" onClick={() => set("answers", value.answers.filter((_, n) => n !== i))}>Delete answer {i + 1}</button></div>)}</div>}
  </section>;
}
