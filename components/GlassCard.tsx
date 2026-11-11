import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  /** subtle = white raised surface with the ring shadow; default = flat cream card. */
  subtle?: boolean;
};

export function GlassCard({ className, subtle = false, ...props }: GlassCardProps) {
  return (
    <div
      className={cn("rounded-2xl", subtle ? "bg-white shadow-ring" : "bg-cream", className)}
      {...props}
    />
  );
}
