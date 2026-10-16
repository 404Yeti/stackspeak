"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { primaryNavLinks } from "@/lib/navigation";
import { Badge } from "@/components/ui/Badge";
import { Logo } from "@/components/ui/Logo";
import { MarketingNav } from "@/components/layout/MarketingNav";

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname === "/") {
    return <MarketingNav />;
  }

  // The Daily Challenge workspace renders its own approved top bar (stage
  // stepper + Exit) — see features/challenge/WorkspaceTopBar.tsx.
  if (pathname === "/daily-challenge") {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border-subtle bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {primaryNavLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-elevated text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {link.label}
                {link.comingSoon && <Badge tone="neutral">Soon</Badge>}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="rounded-md border border-border-subtle p-2 text-text-primary md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
        </button>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="flex flex-col gap-1 border-t border-border-subtle px-6 py-4 md:hidden"
        >
          {primaryNavLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-elevated text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {link.label}
                {link.comingSoon && <Badge tone="neutral">Soon</Badge>}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
