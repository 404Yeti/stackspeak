import Image from "next/image";

export type LogoSize = "sm" | "lg";

/**
 * The approved StackSpeak horizontal logo lockup: the real icon asset
 * (downloaded from Figma) plus the wordmark as real text — matching the
 * approved colors exactly (Stack in primary text, Speak in emerald) rather
 * than an image, so it stays accessible and crisp at any size.
 *
 * `sm` (default) is the existing in-app header lockup (28px icon, unchanged
 * from AUD-50). `lg` is the marketing-nav lockup from the approved homepage
 * frame (36px icon, bolder/larger wordmark) — it uses a separate icon asset,
 * not a CSS-scaled copy, because Figma's own "Logo Icon" component draws a
 * proportionally thicker stroke at its Small size variant for legibility,
 * and 36px is that Small variant's native size.
 */
export function Logo({ size = "sm" }: { size?: LogoSize }) {
  const iconSrc = size === "lg" ? "/brand/logo-icon-sm.svg" : "/brand/logo-icon.svg";
  const iconSize = size === "lg" ? 36 : 28;
  const gapClass = size === "lg" ? "gap-[10.5px]" : "gap-2";
  const textClass = size === "lg" ? "text-[22.5px] tracking-[-0.675px]" : "text-lg tracking-tight";

  return (
    <span className={`inline-flex items-center ${gapClass}`}>
      <Image src={iconSrc} alt="" width={iconSize} height={iconSize} priority />
      <span className={`font-bold ${textClass}`}>
        <span className="text-text-primary">Stack</span>
        <span className="text-success">Speak</span>
      </span>
    </span>
  );
}
