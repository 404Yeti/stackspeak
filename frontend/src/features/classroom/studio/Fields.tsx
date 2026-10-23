"use client";
import { useId, useRef, type ReactNode } from "react";
import { CodeInput } from "@/components/ui/CodeInput";
import { HighlightedCode } from "../HighlightedCode";
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div className="studio-field"><span className="studio-label">{label}</span>{children}{hint && <p className="text-xs text-text-muted">{hint}</p>}</div>;
}
export function TextField({ label, value, onChange, multiline = false, maxLength = 8000, error }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; maxLength?: number; error?: string;
}) {
  const errorId = useId();
  const validation = { "aria-invalid": !!error, "aria-describedby": error ? errorId : undefined };
  return <><label className="studio-field"><span className="studio-label">{label}</span>{multiline ?
    <textarea {...validation} className="classroom-input min-h-28" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} /> :
    <input {...validation} className="classroom-input" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />}</label>{error && <p id={errorId} role="alert" className="text-sm text-danger">{error}</p>}</>;
}
export function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return <TextField label={label} value={value.join("\n")} onChange={(v) => onChange(v ? v.split("\n") : [])} multiline />;
}
export function StudioCode({ label, value, filename, onChange }: { label: string; value: string; filename: string; onChange: (v: string) => void }) {
  const overlay = useRef<HTMLPreElement>(null);
  return <Field label={label} hint="Syntax highlighting and line numbers. Tab moves to the next control; code is never executed.">
    <div className="studio-code classroom-editable" style={{ "--classroom-gutter": `${String(value.split("\n").length).length}ch` } as React.CSSProperties}
      onScrollCapture={(event) => { if (event.target instanceof HTMLTextAreaElement && overlay.current) {
        overlay.current.scrollTop = event.target.scrollTop; overlay.current.scrollLeft = event.target.scrollLeft;
      } }}>
      <CodeInput id={`studio-${label.replaceAll(" ", "-")}`} filename={`${label} · ${filename}`} value={value} onChange={onChange} maxLength={20000} />
      <pre ref={overlay} aria-hidden="true" className="classroom-code-overlay"><code><HighlightedCode code={value + "\n"} /></code></pre>
    </div>
  </Field>;
}
