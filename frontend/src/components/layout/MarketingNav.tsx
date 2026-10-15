"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

const marketingLinks = [
  { label: "Courses", href: "/courses" },
  { label: "Daily Challenge", href: "/daily-challenge" },
  { label: "Interview Practice", href: "/interview-practice" },
  { label: "How it works", href: "#how-it-works" },
];

/**
 * The homepage-only nav from the approved Figma "Product Navigation" frame
 * (node 9:488) — distinct from SiteHeader's in-app nav, which keeps its
 * existing active-route highlighting and "Soon" badges for internal pages.
 * Rendered only on `/`; see SiteHeader for the branch.
 *
 * "Log in"/"Sign up" are rendered disabled rather than linking anywhere —
 * unlike Courses/Daily Challenge/Interview Practice, which go to real
 * routes, there's no scoped auth work yet to point them at, and a fake
 * login flow would be exactly the kind of non-functional control this
 * project avoids (see MicButton for the same pattern).
 *
 * Figma only specifies the 1440px desktop frame, no tablet breakpoint.
 * The full link row + auth buttons don't fit next to the logo until
 * ~1024px (verified: they wrap/overlap at Tailwind's default `md` 768px
 * breakpoint), so the switch to the inline nav happens at `lg` instead,
 * with a reduced `lg:px-10` gutter before the Figma-exact `xl:px-[120px]`
 * kicks in — a responsive assumption, not from the design file.
 */
export function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-border-subtle">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-10 xl:px-[120px]">
        <Link href="/">
          <Logo size="lg" />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {marketingLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Button variant="ghost" disabled aria-label="Log in (coming soon)">
            Log in
          </Button>
          <Button variant="primary" disabled aria-label="Sign up (coming soon)">
            Sign up
          </Button>
        </div>

        <button
          type="button"
          className="rounded-md border border-border-subtle p-2 text-text-primary lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="marketing-mobile-nav"
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
        </button>
      </div>

      {menuOpen && (
        <nav
          id="marketing-mobile-nav"
          aria-label="Primary"
          className="flex flex-col gap-1 border-t border-border-subtle px-6 py-4 lg:hidden"
        >
          {marketingLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:bg-elevated hover:text-text-primary"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-border-subtle pt-4">
            <Button variant="ghost" disabled aria-label="Log in (coming soon)">
              Log in
            </Button>
            <Button variant="primary" disabled aria-label="Sign up (coming soon)">
              Sign up
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
