"use client";
import Link from "next/link";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ClassroomHeader } from "../ClassroomHeader";
import { ClassroomWorkspace } from "../ClassroomWorkspace";
import { draftSchema, projectStudent, validatePublish, type Guide } from "@/lib/classroom/studio/validation";
import { type EditorRecord, studioRequest, emptyGuide } from "./client";
import { useAutosave } from "./useAutosave";
import { ContentTab } from "./ContentTab";
import { VocabularyTab } from "./VocabularyTab";
import { GuideTab } from "./GuideTab";
import "./studio.css";
const tabs = ["Content", "Vocabulary", "Teacher Guide", "Preview"] as const;
export function StudioEditor({ initial, deliveryEnabled, startPreview = false }: { initial: EditorRecord; deliveryEnabled: boolean; startPreview?: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial.draft);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [tab, setTab] = useState<typeof tabs[number]>(startPreview ? "Preview" : "Content");
  const [publication, setPublication] = useState(initial.publication);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [acting, setActing] = useState(false);
  const [lineError, setLineError] = useState("");
  const autosave = useAutosave(initial.id, initial.lockVersion, draft, guide, lineError, !!initial.recoveredReadLines?.length);
  const guideRequest = useRef(0);
  async function chooseTab(next: typeof tab) {
    setTab(next); setActionError("");
    if (next !== "Teacher Guide" || guide || loadingGuide) return;
    setLoadingGuide(true);
    const requestId = ++guideRequest.current;
    try {
      // Flush draft changes before loading the guide's shared version.
      if (!(await autosave.save())) return;
      const result = await studioRequest<{ guide: Guide | null; lockVersion: number }>(`/${initial.id}/guide`);
      if (requestId !== guideRequest.current) return;
      if (result.lockVersion !== autosave.version.current) throw new Error("This exercise changed in another tab. Reload before editing the guide.");
      const nextGuide = result.guide ?? emptyGuide();
      autosave.acceptGuide(nextGuide); setGuide(nextGuide);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Guide unavailable. Retry the tab."); }
    finally { setLoadingGuide(false); }
  }
  async function act(action: "publish" | "unpublish" | "duplicate") {
    setActionError(""); setNotice(""); setActing(true);
    try {
      if (action === "publish") validatePublish(draft);
      if (!(await autosave.save())) return;
      const result = await studioRequest<{ lockVersion: number; id?: string }>(`/${initial.id}/${action}`, "POST", { expectedVersion: autosave.version.current });
      if (action === "duplicate") { router.push(`/classroom/studio/${result.id}`); return; }
      autosave.setVersion(result.lockVersion);
      setPublication(action === "publish" ? "published" : "draft");
      setNotice(action === "publish" ? "Published. Students see this saved version." : "Unpublished. The student link is unavailable.");
    } catch (err) { setActionError(err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : err instanceof Error ? err.message : "The action failed. Please retry."); }
    finally { setActing(false); }
  }
  let preview;
  try { const parsed = draftSchema.parse(draft); preview = projectStudent(initial.id, initial.slug, Math.max(1, initial.version), parsed); } catch { /* Incomplete structure has inline save errors. */ }
  return <div className="classroom-shell studio-shell"><ClassroomHeader teacher /><div className="studio-editor">
    <div className="studio-topline"><Link className="classroom-text-button" href="/classroom/studio">← Exercise library</Link><span className="text-xs text-text-muted">Classroom Studio · teacher only</span></div>
    <div className="studio-editor-heading"><div><span className="classroom-eyebrow">READ IT. EXPLAIN IT. MAKE IT YOURS.</span><h1>{draft.content.title || "Untitled exercise"}</h1><div className="mt-3 flex flex-wrap gap-2"><Badge tone={publication === "published" ? "success" : "accent"}>{publication === "published" ? "Published" : "Private draft"}</Badge><Badge>{draft.content.language}</Badge></div></div>
      <div className="studio-actions"><Button variant="secondary" disabled={acting || autosave.busy || autosave.blocked} onClick={() => void autosave.save()}>Save draft</Button><Button disabled={acting || autosave.busy || autosave.blocked} onClick={() => void act("publish")}>{publication === "published" ? "Publish changes" : "Publish exercise"}</Button></div>
    </div>
    <div className="studio-save-bar"><p role="status" aria-live="polite">{autosave.status}</p><span>Draft edits stay private until you publish.</span></div>
    {!!initial.recoveredReadLines?.length && <p role="note" className="studio-notice">Invalid line references were removed from vocabulary {initial.recoveredReadLines.join(", ")} for editing. All vocabulary text is preserved. Review the references; corrections are saved with this draft.</p>}
    {autosave.error && <div role="alert" className="studio-error"><p>{autosave.error}</p>{autosave.blocked ? <><p>Keep this tab open to preserve your unsaved work.</p><a className="classroom-text-button" href="/classroom/login" target="_blank" rel="noreferrer">Sign in in a new tab</a>{autosave.canRetrySession && <button className="classroom-text-button" onClick={autosave.resumeSession}>Retry after sign-in</button>}<button className="classroom-text-button" onClick={() => { if (window.confirm("Reload and discard unsaved changes?")) window.location.reload(); }}>Reload saved exercise</button></> : <Button variant="secondary" onClick={() => void autosave.save()}>Retry save</Button>}</div>}
    {actionError && <p role="alert" className="studio-error">{actionError}</p>}
    {notice && <p role="status" className="studio-notice">{notice}</p>}
    {!deliveryEnabled && <p className="studio-notice">Student links are not enabled in this environment yet. Published lessons in the existing teaching library remain available.</p>}
    <div className="studio-secondary-actions"><button className="classroom-text-button" disabled={acting || autosave.blocked} onClick={() => void act("duplicate")}>Duplicate exercise</button>
      {publication === "published" && <><button className="classroom-text-button" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/exercises/${initial.slug}`); setNotice("Student link copied."); } catch { setNotice(`Student link: /exercises/${initial.slug}`); } }}>Copy student link</button><a href={`/exercises/${initial.slug}`} target="_blank" rel="noreferrer" className="classroom-text-button">Open student link</a><button className="classroom-text-button" disabled={acting || autosave.blocked} onClick={() => { if (window.confirm("Unpublish this exercise? Its student link will return 404.")) void act("unpublish"); }}>Unpublish</button></>}
    </div>
    <div role="tablist" aria-label="Exercise editor" className="studio-tabs">{tabs.map((name, i) => <button key={name} id={`studio-tab-${i}`} role="tab" aria-selected={tab === name} aria-controls={`studio-panel-${i}`} tabIndex={tab === name ? 0 : -1} onClick={() => void chooseTab(name)} onKeyDown={(e) => {
      if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? 3 : (i + (e.key === "ArrowRight" ? 1 : 3)) % 4; void chooseTab(tabs[next]); document.getElementById(`studio-tab-${next}`)?.focus(); }
    }}>{String(i + 1).padStart(2, "0")}<span>{name}</span></button>)}</div>
    <div role="tabpanel" id={`studio-panel-${tabs.indexOf(tab)}`} aria-labelledby={`studio-tab-${tabs.indexOf(tab)}`} className="studio-panel"><fieldset disabled={acting || autosave.blocked} className="min-w-0">
      {tab === "Content" && <ContentTab value={draft.content} onChange={(content) => setDraft({ ...draft, content })} />}
      <div hidden={tab !== "Vocabulary"}><VocabularyTab draft={draft} onChange={(vocabulary) => setDraft({ ...draft, vocabulary })} onValidationChange={setLineError} /></div>
      {tab === "Teacher Guide" && (guide ? <GuideTab value={guide} draft={draft} onChange={setGuide} /> : <p className="p-8" role="status">{loadingGuide ? "Loading private guide…" : "Select Teacher Guide again to retry."}</p>)}
      {tab === "Preview" && <div className="studio-preview"><div className="studio-preview-label"><strong>Student preview · unpublished content</strong><span>Your teacher guide stays private. Preview edits won’t change this lesson.</span></div>{preview ? <ClassroomWorkspace key={JSON.stringify(preview)} exercise={preview} /> : <p className="p-8">Complete the invalid fields before previewing this draft.</p>}</div>}
    </fieldset></div>
  </div></div>;
}
