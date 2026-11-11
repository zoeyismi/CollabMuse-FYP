import { cn } from "@/lib/utils";

type CollaboratorAvatarsProps = {
  names: string[];
  className?: string;
};

const tones = [
  "bg-human-wash text-human-ink",
  "bg-human text-white",
  "bg-ink-700 text-white",
  "bg-stone text-black",
];

export function CollaboratorAvatars({ names, className }: CollaboratorAvatarsProps) {
  return (
    <div className={cn("flex -space-x-2", className)}>
      {names.map((name, index) => (
        <div
          key={`${name}-${index}`}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-xs font-medium shadow-lg",
            tones[index % tones.length],
          )}
          title={name}
        >
          {name.slice(0, 2)}
        </div>
      ))}
    </div>
  );
}
