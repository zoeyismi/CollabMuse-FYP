import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import type { IconProps } from "@/components/Icons";
import { cn } from "@/lib/utils";

type GlassButtonProps = {
  children: ReactNode;
  href?: string;
  icon?: ComponentType<IconProps>;
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function GlassButton({
  children,
  href,
  icon: Icon,
  variant = "primary",
  className,
  disabled,
  ...buttonProps
}: GlassButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition",
    "border shadow-glass backdrop-blur-xl",
    "hover:-translate-y-0.5 active:scale-[0.98]",
    disabled && "cursor-not-allowed opacity-45 hover:translate-y-0 active:scale-100",
    variant === "primary" &&
      "border-white/70 bg-[#f4f7f4] text-[#071014] hover:bg-white",
    variant === "secondary" &&
      "border-white/14 bg-white/8 text-white hover:bg-white/14",
    variant === "quiet" &&
      "border-white/10 bg-transparent text-white/78 shadow-none hover:bg-white/10",
    className,
  );
  const content = (
    <>
      {Icon ? <Icon className="h-4 w-4" /> : null}
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
