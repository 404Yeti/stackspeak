// Static build year — avoids Next.js treating the footer as a non-prerenderable
// dynamic value for what is, in practice, a once-a-year change.
const COPYRIGHT_YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle px-6 py-8 text-sm text-text-muted">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
        <p>&copy; {COPYRIGHT_YEAR} StackSpeak. Read it. Explain it. Fix it. Defend it.</p>
        <p>Sprint 01 — Application Foundation</p>
      </div>
    </footer>
  );
}
