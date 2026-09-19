import type { ComponentType } from "react";
import type { IconProps } from "@/components/Icons";
import { GlassCard } from "@/components/GlassCard";

type FeatureCardProps = {
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
};

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="h-full transition duration-300 hover:-translate-y-1">
      <GlassCard className="h-full p-6">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-brass">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-white/62">{description}</p>
      </GlassCard>
    </div>
  );
}
