import Link from "next/link";

const footerLinks = [
  { label: "Courses", href: "/courses" },
  { label: "Practice Lab", href: "/practice-lab" },
  { label: "Interview Practice", href: "/interview-practice" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle px-6 py-8 text-sm text-text-muted">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p>StackSpeak — Read it. Explain it. Fix it. Defend it.</p>
        <nav className="flex flex-wrap items-center gap-4" aria-label="Footer">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-text-primary">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
