import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import type { IconProps } from "@/components/Icons";
import { cn } from "@/lib/utils";

type GlassButtonProps = {
  children: ReactNode;
  href?: string;
  icon?: ComponentType<IconProps>;
  /** primary = black pill, secondary = white pill with ring shadow, quiet = text-only pill. */
  variant?: "primary" | "secondary" | "quiet";
  size?: "md" | "lg";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function buttonClasses(variant: GlassButtonProps["variant"] = "primary", size: GlassButtonProps["size"] = "md") {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-normal transition-colors duration-150 ease-studio",
    size === "md" ? "h-9 px-3.5" : "h-10 px-4",
    variant === "primary" && "bg-black text-white hover:bg-ink-700",
    variant === "secondary" && "bg-white text-black shadow-ring hover:bg-cream",
    variant === "quiet" && "bg-transparent text-black hover:bg-stone",
  );
}

export function GlassButton({
  children,
  href,
  icon: Icon,
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...buttonProps
}: GlassButtonProps) {
  const classes = cn(buttonClasses(variant, size), disabled && "cursor-not-allowed opacity-40", className);
  const content = (
    <>
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </>
  );

  if (href) {
    return (
      <Link className={classes} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled} {...buttonProps}>
      {content}
    </button>
  );
}
