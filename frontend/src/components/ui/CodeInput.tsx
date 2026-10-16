"use client";

import { useRef } from "react";

export type CodeInputProps = {
  id: string;
  filename: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
};

/**
 * Editable counterpart to CodeEditor (same chrome, plain <textarea>, no
 * editor dependency). Nothing here runs the code — it is only text the
 * student edits. Tab is NOT captured (that would trap keyboard focus), so
 * indentation is typed as spaces.
 */
export function CodeInput({ id, filename, value, onChange, maxLength }: CodeInputProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = value.split("\n").length;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-accent bg-background">
      <div className="flex items-center justify-between bg-surface px-4 py-2 font-mono text-xs font-medium">
        <label htmlFor={id} className="text-text-primary">
          {filename} — your code
        </label>
        <span className="text-accent-soft">Editing</span>
      </div>
      <div className="flex h-[22rem] gap-4 p-4 font-mono text-sm sm:h-[28rem]">
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="shrink-0 select-none overflow-hidden text-right text-icon-muted"
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <p key={index} className="leading-6">
              {index + 1}
            </p>
          ))}
        </div>
        <textarea
          id={id}
          value={value}
          maxLength={maxLength}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
          }}
          className="min-w-0 flex-1 resize-none overflow-auto bg-transparent leading-6 text-text-primary focus-visible:outline-none"
        />
      </div>
    </div>
  );
}
