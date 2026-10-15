import Image from "next/image";

export type PipExpression =
  | "idle"
  | "listening"
  | "thinking"
  | "explaining"
  | "success"
  | "confused"
  | "error"
  | "idea"
  | "coding"
  | "celebrating";

export type PipMascotProps = {
  expression: PipExpression;
  size?: number;
  /** Accessible description. Defaults to naming the expression; pass "" for purely decorative use. */
  alt?: string;
};

/**
 * Pip, the approved StackSpeak mascot (brand approval 2026-10-15). Purely
 * illustrative — renders a static expression image, never animates or
 * implies Pip is actively listening/thinking/responding to anything real.
 */
export function PipMascot({ expression, size = 120, alt }: PipMascotProps) {
  return (
    <Image
      src={`/mascot/${expression}.png`}
      alt={alt ?? `Pip, the StackSpeak mascot (${expression})`}
      width={size}
      height={size}
    />
  );
}
