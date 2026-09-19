import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  subtle?: boolean;
};

export function GlassCard({ className, subtle = false, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-surface rounded-[28px]",
        subtle && "border-white/10 bg-white/[0.055] shadow-none",
        className,
      )}
      {...props}
    />
  );
}
