"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Draft, Guide } from "@/lib/classroom/studio/validation";
import { ApiError, studioRequest } from "./client";
type Acknowledged = { draft: string; guide: string | null };
/** One queue and shared version for draft/guide writes. Private data stays in component memory. */
export function useAutosave(id: string, initialVersion: number, draft: Draft, guide: Guide | null) {
  const latest = useRef({ draft, guide });
  useLayoutEffect(() => { latest.current = { draft, guide }; }, [draft, guide]);
  const [ack, setAck] = useState<Acknowledged>({ draft: JSON.stringify(draft), guide: null });
  const saved = useRef(ack);
  const version = useRef(initialVersion);
  const running = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  const [status, setStatus] = useState("Saved");
  const [error, setError] = useState("");
  const [blockedStatus, setBlockedStatus] = useState<number | null>(null);
  const blocked = blockedStatus !== null;
  const dirty = JSON.stringify(draft) !== ack.draft || (guide !== null && JSON.stringify(guide) !== ack.guide);
  const acceptGuide = useCallback((value: Guide) => { saved.current.guide = JSON.stringify(value); setAck({ ...saved.current }); }, []);
  const setVersion = useCallback((value: number) => { version.current = value; }, []);
  const save = useCallback(async (): Promise<boolean> => {
    if (running.current) return running.current;
    if (blocked) return false;
    const task = async () => {
      if (mounted.current) { setStatus("Saving…"); setError(""); }
      try {
        let remaining;
        do {
          const content = JSON.stringify(latest.current.draft);
          if (content !== saved.current.draft) {
            const result = await studioRequest<{ lockVersion: number }>(`/${id}`, "PATCH", { expectedVersion: version.current, draft: JSON.parse(content) });
            version.current = result.lockVersion; saved.current.draft = content;
          }
          const privateContent = latest.current.guide === null ? null : JSON.stringify(latest.current.guide);
          if (privateContent !== null && privateContent !== saved.current.guide) {
            const result = await studioRequest<{ lockVersion: number }>(`/${id}/guide`, "PUT", { expectedVersion: version.current, guide: JSON.parse(privateContent) });
            version.current = result.lockVersion; saved.current.guide = privateContent;
          }
          if (mounted.current) setAck({ ...saved.current });
          remaining = JSON.stringify(latest.current.draft) !== saved.current.draft ||
            (latest.current.guide !== null && JSON.stringify(latest.current.guide) !== saved.current.guide);
        } while (remaining && mounted.current);
        if (mounted.current) setStatus("Saved");
        return true;
      } catch (err) {
        if (mounted.current) {
          setStatus("Not saved"); setError(err instanceof Error ? err.message : "Save failed. Retry before leaving.");
          if (err instanceof ApiError && [401, 409].includes(err.status)) setBlockedStatus(err.status);
        }
        return false;
      }
    };
    running.current = task();
    try { return await running.current; } finally { running.current = null; }
  }, [blocked, id]);
  useEffect(() => {
    if (!dirty || blocked) return;
    const timer = window.setTimeout(() => { void save(); }, 1000);
    return () => window.clearTimeout(timer);
  }, [draft, guide, dirty, blocked, save]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!dirty) return;
    const currentUrl = window.location.href;
    const currentState = window.history.state;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (link && link.getAttribute("target") !== "_blank" && !window.confirm("You have unsaved changes. Leave without saving?")) event.preventDefault();
    };
    const submit = (event: SubmitEvent) => { if (!window.confirm("You have unsaved changes. Sign out without saving?")) event.preventDefault(); };
    const pop = (event: PopStateEvent) => { if (!window.confirm("You have unsaved changes. Leave without saving?")) {
      event.stopImmediatePropagation(); window.history.pushState(currentState, "", currentUrl);
    } };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", pop, true);
    document.addEventListener("click", navigate, true);
    document.addEventListener("submit", submit, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", pop, true);
      document.removeEventListener("click", navigate, true); document.removeEventListener("submit", submit, true); };
  }, [dirty]);
  return { save, dirty, status: dirty && status === "Saved" ? "Unsaved changes" : status, error, blocked,
    version, setVersion, acceptGuide, canRetrySession: blockedStatus === 401, resumeSession: () => setBlockedStatus(null), busy: status === "Saving…" };
}
