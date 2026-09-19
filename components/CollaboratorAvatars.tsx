import { cn } from "@/lib/utils";

type CollaboratorAvatarsProps = {
  names: string[];
  className?: string;
};

const tones = [
  "bg-[#efd84c] text-[#11120b]",
  "bg-[#235fba] text-white",
  "bg-[#b71912] text-white",
  "bg-[#f4f7f4] text-[#071014]",
];

export function CollaboratorAvatars({ names, className }: CollaboratorAvatarsProps) {
  return (
    <div className={cn("flex -space-x-2", className)}>
      {names.map((name, index) => (
        <div
          key={`${name}-${index}`}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-xs font-semibold shadow-lg",
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
