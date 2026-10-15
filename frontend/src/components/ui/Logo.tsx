import Image from "next/image";

/**
 * The approved StackSpeak horizontal logo lockup: the real icon asset
 * (downloaded from Figma, frontend/public/brand/logo-icon.svg) plus the
 * wordmark as real text — matching the approved colors exactly (Stack in
 * primary text, Speak in emerald) rather than an image, so it stays
 * accessible and crisp at any size.
 */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <Image src="/brand/logo-icon.svg" alt="" width={28} height={28} priority />
      <span className="text-lg font-bold tracking-tight">
        <span className="text-text-primary">Stack</span>
        <span className="text-success">Speak</span>
      </span>
    </span>
  );
}
