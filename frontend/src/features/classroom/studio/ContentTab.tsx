"use client";
import type { Draft } from "@/lib/classroom/studio/validation";
import { Button } from "@/components/ui/Button";
import { Field, ListField, StudioCode, TextField } from "./Fields";
export function ContentTab({ value, onChange }: { value: Draft["content"]; onChange: (v: Draft["content"]) => void }) {
  const set = <K extends keyof Draft["content"]>(key: K, next: Draft["content"][K]) => onChange({ ...value, [key]: next });
  return <div className="studio-section">
    <div className="studio-section-heading"><span className="classroom-eyebrow">MAKE ROOM FOR GOOD QUESTIONS</span><h2>Build the conversation.</h2><p>Give students code to read, ideas to explain, and a change to reason about.</p></div>
    <TextField label="Exercise title" value={value.title} onChange={(v) => set("title", v)} maxLength={200} />
    <TextField label="Description" value={value.description} onChange={(v) => set("description", v)} multiline maxLength={4000} />
    <div className="studio-grid">
      <label className="studio-field"><span className="studio-label">Programming language</span><select className="classroom-input" value={value.language} onChange={(e) => set("language", e.target.value as "Python" | "C#")}><option>Python</option><option>C#</option></select></label>
      <label className="studio-field"><span className="studio-label">Difficulty</span><select className="classroom-input" value={value.difficulty} onChange={(e) => set("difficulty", e.target.value as Draft["content"]["difficulty"])}>{["Beginner", "Intermediate", "Advanced"].map((v) => <option key={v}>{v}</option>)}</select></label>
      <TextField label="Topic" value={value.topic} onChange={(v) => set("topic", v)} maxLength={100} />
      <TextField label="Filename" value={value.filename} onChange={(v) => set("filename", v)} maxLength={120} />
      <label className="studio-field"><span className="studio-label">Duration (minutes)</span><input className="classroom-input" type="number" min={1} max={240} value={value.minutes} onChange={(e) => set("minutes", Number(e.target.value))} /></label>
      <TextField label="Tags (comma separated)" value={value.tags.join(", ")} onChange={(v) => set("tags", v.split(",").map((s) => s.trim()))} />
    </div>
    <ListField label="Learning objectives (one per line)" value={value.learningObjectives} onChange={(v) => set("learningObjectives", v)} />
    <TextField label="Student instructions" value={value.instructions} onChange={(v) => set("instructions", v)} multiline />
    <TextField label="Read section" value={value.readContent} onChange={(v) => set("readContent", v)} multiline />
    <StudioCode label="Read code" filename={value.filename} value={value.readCode} onChange={(v) => set("readCode", v)} />
    <Field label="Explain questions" hint="Question IDs remain stable when you edit wording.">
      {value.questions.map((q, i) => <div key={q.id} className="studio-question"><TextField label={`Question ${i + 1}`} value={q.prompt} onChange={(v) => set("questions", value.questions.map((item) => item.id === q.id ? { ...item, prompt: v } : item))} multiline maxLength={2000} />
        <button type="button" className="classroom-text-button" onClick={() => set("questions", value.questions.filter((item) => item.id !== q.id))}>Delete question {i + 1}</button></div>)}
      <Button variant="secondary" disabled={value.questions.length >= 50} onClick={() => set("questions", [...value.questions, { id: crypto.randomUUID(), prompt: "" }])}>Add question</Button>
    </Field>
    <TextField label="Fix / debugging task" value={value.fix.instructions} onChange={(v) => set("fix", { ...value.fix, instructions: v })} multiline />
    <StudioCode label="Starter code" filename={value.filename} value={value.fix.buggyCode} onChange={(v) => set("fix", { ...value.fix, buggyCode: v })} />
    <ListField label="Student hints (one per line)" value={value.fix.hints} onChange={(v) => set("fix", { ...value.fix, hints: v })} />
  </div>;
}
