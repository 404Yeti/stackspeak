"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PipMascot } from "@/components/ui/PipMascot";
import { ClassroomHeader } from "../ClassroomHeader";
import { studioRequest } from "./client";
import "./studio.css";
type Row = { id: string; slug: string; title: string; language: "Python" | "C#"; difficulty: string; topic: string;
  publication: "draft" | "published"; lockVersion: number; updatedAt: string };
export function StudioLibrary() {
  const router = useRouter();
  const [filters, setFilters] = useState({ search: "", language: "", difficulty: "", topic: "", status: "" });
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const [language, setLanguage] = useState<"Python" | "C#">("Python");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => !!v)), offset: String(offset), limit: "25" });
        const data = await studioRequest<{ exercises: Row[] }>(`?${query}`, "GET", undefined, controller.signal);
        if (!controller.signal.aborted) setRows(data.exercises);
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Library unavailable."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filters, offset, refresh]);
  async function create() {
    setCreating(true); setError("");
    try { const record = await studioRequest<{ id: string }>("", "POST", { language }); router.push(`/classroom/studio/${record.id}`); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not create exercise."); setCreating(false); }
  }
  async function action(row: Row, operation: string) {
    setBusy(row.id); setError(""); setNotice("");
    try {
      const result = await studioRequest<{ id?: string }>(`/${row.id}/${operation}`, "POST", { expectedVersion: row.lockVersion });
      if (operation === "duplicate") { router.push(`/classroom/studio/${result.id}`); return; }
      setNotice(operation === "publish" ? "Exercise published." : "Exercise unpublished."); setRefresh((n) => n + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Action failed."); }
    finally { setBusy(""); }
  }
  return <div className="classroom-shell studio-shell"><ClassroomHeader teacher /><div className="classroom-library studio-library">
    <div className="studio-library-hero"><div><p className="classroom-eyebrow">LESSON PREP, WITH ROOM TO THINK.</p><h1>Your next great lesson<br className="hidden sm:block" /> starts here.</h1><p>Shape the code. Choose the words. Make it a conversation.</p></div><PipMascot expression="idea" size={112} alt="" /></div>
    <div className="studio-library-toolbar"><div><h2>Exercise library</h2><p>Draft privately. Preview as a student. Publish when you’re ready.</p></div><div className="studio-actions"><label className="sr-only" htmlFor="create-language">New exercise language</label><select id="create-language" className="classroom-input" value={language} onChange={(e) => setLanguage(e.target.value as "Python" | "C#")}><option>Python</option><option>C#</option></select><Button disabled={creating} onClick={() => void create()}>{creating ? "Creating…" : "+ Create Exercise"}</Button></div></div>
    <section className="classroom-filters studio-filters" aria-label="Find Studio exercises"><label>Search exercises<input type="search" className="classroom-input" placeholder="Title, description, or topic" value={filters.search} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setOffset(0); }} /></label>
      {([{ key: "language", label: "Language", options: ["Python", "C#"] }, { key: "difficulty", label: "Difficulty", options: ["Beginner", "Intermediate", "Advanced"] }, { key: "status", label: "Status", options: ["draft", "published"] }] as const).map((f) => <label key={f.key}>{f.label}<select className="classroom-input" value={filters[f.key]} onChange={(e) => { setFilters({ ...filters, [f.key]: e.target.value }); setOffset(0); }}><option value="">All</option>{f.options.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>)}
      <label>Topic<input className="classroom-input" value={filters.topic} placeholder="Exact topic" onChange={(e) => { setFilters({ ...filters, topic: e.target.value }); setOffset(0); }} /></label>
    </section>
    {error && <div role="alert" className="studio-error"><p>{error}</p><button className="classroom-text-button" onClick={() => setRefresh((n) => n + 1)}>Retry library</button></div>}{notice && <p role="status" className="studio-notice">{notice}</p>}
    <p className="mb-4 text-sm text-text-muted" role="status">{loading ? "Loading exercises…" : `${rows.length} exercises shown · teacher guides stay private`}</p>
    <div className="space-y-4">{!error && rows.map((row) => <article className="classroom-exercise-card studio-library-row" key={row.id}><div className="classroom-language" aria-hidden="true">{row.language === "Python" ? "Py" : "C#"}</div><div className="studio-row-content"><div className="flex flex-wrap gap-2"><Badge tone="info">{row.language}</Badge><Badge>{row.difficulty}</Badge><Badge tone={row.publication === "published" ? "success" : "accent"}>{row.publication === "published" ? "Published" : "Draft"}</Badge></div><h3>{row.title || "Untitled exercise"}</h3><p>{row.topic || "Add a topic"} · Modified {new Date(row.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p></div><div className="studio-row-actions"><Button variant="secondary" href={`/classroom/studio/${row.id}`}>Edit exercise</Button><div className="studio-actions"><Link className="classroom-text-button" href={`/classroom/studio/${row.id}?tab=preview`}>Preview</Link><button className="classroom-text-button" disabled={busy === row.id} onClick={() => void action(row, "duplicate")}>Duplicate</button><button className="classroom-text-button" disabled={busy === row.id} onClick={() => { if (row.publication !== "published" || window.confirm("Unpublish this exercise and disable its student link?")) void action(row, row.publication === "published" ? "unpublish" : "publish"); }}>{row.publication === "published" ? "Unpublish" : "Publish"}</button></div></div></article>)}</div>
    {!loading && !error && !rows.length && <section className="studio-empty"><PipMascot expression="thinking" size={72} alt="" /><h2>No exercises here yet.</h2><p>Create your first lesson, or clear the filters to find another.</p><Button variant="secondary" onClick={() => { setFilters({ search: "", language: "", difficulty: "", topic: "", status: "" }); setOffset(0); }}>Clear filters</Button></section>}
    <div className="studio-pagination"><Button variant="ghost" disabled={!offset || loading} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous page</Button><Button variant="ghost" disabled={rows.length < 25 || loading} onClick={() => setOffset(offset + 25)}>Next page</Button></div>
    <p className="mt-8 text-xs text-text-muted"><Link href="/classroom" className="classroom-text-button">Open the existing teaching library</Link> · Existing published lessons remain unchanged.</p>
  </div></div>;
}
