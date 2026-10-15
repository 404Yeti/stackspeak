import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-text-on-accent hover:bg-accent-strong",
  secondary:
    "bg-elevated text-text-primary border border-border-subtle hover:border-accent",
  ghost: "text-accent-soft hover:text-accent",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-sm",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

type ButtonAsButton = ButtonOwnProps &
  ComponentPropsWithoutRef<"button"> & { href?: undefined };

type ButtonAsLink = ButtonOwnProps &
  ComponentPropsWithoutRef<typeof Link> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const classes = [baseClasses, variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(" ");

  if (props.href !== undefined) {
    return <Link {...(props as ButtonAsLink)} className={classes} />;
  }

  return <button {...(props as ButtonAsButton)} className={classes} />;
}
