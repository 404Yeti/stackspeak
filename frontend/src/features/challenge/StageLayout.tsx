"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PipMascot, type PipExpression } from "@/components/ui/PipMascot";
import type { ApiError } from "@/lib/api";

/** Two-column workspace on `lg`+, stacked (main first) below. */
export function StageShell({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-6">{main}</div>
      <div className="flex min-w-0 flex-col gap-6">{side}</div>
    </div>
  );
}

/** Stage heading; takes focus on mount after a stage change so screen readers announce it. */
export function StageHeading({ children, focusOnMount }: { children: ReactNode; focusOnMount: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <h2
      ref={ref}
      tabIndex={-1}
      className="text-xl font-semibold text-text-primary focus:outline-none"
    >
      {children}
    </h2>
  );
}

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      {children}
    </Card>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PipRow({ expression, children }: { expression: PipExpression; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0">
        {/* Decorative: the adjacent text carries the meaning. */}
        <PipMascot expression={expression} size={60} alt="" />
      </div>
      <div className="min-w-0 text-sm text-text-muted">{children}</div>
    </div>
  );
}

export function StageNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  blockedReason,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  /** Visible explanation of why Continue is disabled; null/undefined when enabled. */
  blockedReason?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {onBack && (
          <Button type="button" variant="secondary" size="lg" onClick={onBack}>
            Back
          </Button>
        )}
        {onNext && (
          <Button
            type="button"
            size="lg"
            disabled={Boolean(blockedReason)}
            aria-describedby={blockedReason ? "continue-hint" : undefined}
            onClick={onNext}
          >
            {nextLabel}
          </Button>
        )}
      </div>
      {blockedReason && (
        <p id="continue-hint" className="text-xs text-text-muted">
          {blockedReason}
        </p>
      )}
    </div>
  );
}

const ERROR_COPY: Record<ApiError["kind"], string> = {
  network: "We couldn't reach the StackSpeak server.",
  timeout: "The server took too long to respond.",
  not_found: "That challenge doesn't exist.",
  server: "The server ran into a problem.",
  invalid: "The server sent something we didn't expect.",
};

/** Loading / error (with Retry) placeholder for content fetched from the API. */
export function ContentState({
  loading,
  error,
  onRetry,
  what,
}: {
  loading: boolean;
  error?: ApiError;
  onRetry: () => void;
  what: string;
}) {
  if (error) {
    return (
      <Card className="flex flex-col gap-3" >
        <div role="alert" className="flex flex-col gap-3">
          <PipRow expression="confused">
            <p className="font-medium text-text-primary">Couldn&apos;t load {what}.</p>
            <p>{ERROR_COPY[error.kind]} Your answers so far are safe.</p>
          </PipRow>
          <div>
            <Button type="button" variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          </div>
        </div>
      </Card>
    );
  }
  if (loading) {
    return (
      <Card>
        <div role="status">
          <PipRow expression="thinking">Loading {what}…</PipRow>
        </div>
      </Card>
    );
  }
  return null;
}
