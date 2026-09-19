import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;
export type IconComponent = (props: IconProps) => JSX.Element;

function BaseIcon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (props: IconProps) => (
  <BaseIcon {...props}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></BaseIcon>
);
export const ArrowLeft = (props: IconProps) => (
  <BaseIcon {...props}><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></BaseIcon>
);
export const ArrowUpRight = (props: IconProps) => (
  <BaseIcon {...props}><path d="M7 17 17 7" /><path d="M8 7h9v9" /></BaseIcon>
);
export const LayoutDashboard = (props: IconProps) => (
  <BaseIcon {...props}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="5" rx="1.5" /><rect x="13" y="11" width="7" height="9" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /></BaseIcon>
);
export const RadioTower = (props: IconProps) => (
  <BaseIcon {...props}><path d="M12 12 8 21" /><path d="m12 12 4 9" /><path d="M8.5 16h7" /><path d="M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /><path d="M16.5 7.5a6 6 0 0 1 0 5" /><path d="M7.5 12.5a6 6 0 0 1 0-5" /></BaseIcon>
);
export const Sparkles = (props: IconProps) => (
  <BaseIcon {...props}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></BaseIcon>
);
export const Music2 = (props: IconProps) => (
  <BaseIcon {...props}><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></BaseIcon>
);
export const UsersRound = (props: IconProps) => (
  <BaseIcon {...props}><path d="M16 20a4 4 0 0 0-8 0" /><circle cx="12" cy="8" r="4" /><path d="M22 20a4 4 0 0 0-3-3.87" /><path d="M2 20a4 4 0 0 1 3-3.87" /></BaseIcon>
);
export const CloudUpload = (props: IconProps) => (
  <BaseIcon {...props}><path d="M12 13V4" /><path d="m8 8 4-4 4 4" /><path d="M20 17.5A4.5 4.5 0 0 0 18 9h-1.2A6 6 0 1 0 6 15.5" /><path d="M8 18h8" /></BaseIcon>
);
export const MousePointer2 = (props: IconProps) => (
  <BaseIcon {...props}><path d="m4 4 7.5 16 2.2-6.3L20 11.5 4 4Z" /></BaseIcon>
);
export const MessageCircle = (props: IconProps) => (
  <BaseIcon {...props}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-4-.9L3 20l1.2-4.5A8.3 8.3 0 1 1 21 11.5Z" /></BaseIcon>
);
export const AudioWaveform = (props: IconProps) => (
  <BaseIcon {...props}><path d="M4 14v-4" /><path d="M8 18V6" /><path d="M12 21V3" /><path d="M16 18V6" /><path d="M20 14v-4" /></BaseIcon>
);
export const BotMessageSquare = MessageCircle;
export const Layers3 = (props: IconProps) => (
  <BaseIcon {...props}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" /></BaseIcon>
);
export const SlidersHorizontal = (props: IconProps) => (
  <BaseIcon {...props}><path d="M4 7h10" /><path d="M18 7h2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></BaseIcon>
);
export const Plus = (props: IconProps) => (
  <BaseIcon {...props}><path d="M12 5v14" /><path d="M5 12h14" /></BaseIcon>
);
export const Search = (props: IconProps) => (
  <BaseIcon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></BaseIcon>
);
export const Circle = (props: IconProps) => (
  <BaseIcon {...props}><circle cx="12" cy="12" r="8" /></BaseIcon>
);
export const Share2 = (props: IconProps) => (
  <BaseIcon {...props}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4" /><path d="m8.6 13.5 6.8 4" /></BaseIcon>
);
export const SendHorizonal = (props: IconProps) => (
  <BaseIcon {...props}><path d="m3 11 18-8-8 18-2-7-8-3Z" /><path d="m11 13 5-5" /></BaseIcon>
);
export const Volume2 = (props: IconProps) => (
  <BaseIcon {...props}><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M16 9a5 5 0 0 1 0 6" /></BaseIcon>
);
export const VolumeX = (props: IconProps) => (
  <BaseIcon {...props}><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m18 9-6 6" /><path d="m12 9 6 6" /></BaseIcon>
);
export const Pause = (props: IconProps) => (
  <BaseIcon {...props}><path d="M8 5v14" /><path d="M16 5v14" /></BaseIcon>
);
export const Play = (props: IconProps) => (
  <BaseIcon {...props}><path d="m8 5 11 7-11 7V5Z" /></BaseIcon>
);
export const SkipBack = (props: IconProps) => (
  <BaseIcon {...props}><path d="M19 20 9 12l10-8v16Z" /><path d="M5 19V5" /></BaseIcon>
);
export const SkipForward = (props: IconProps) => (
  <BaseIcon {...props}><path d="m5 4 10 8-10 8V4Z" /><path d="M19 5v14" /></BaseIcon>
);
export const Upload = CloudUpload;
export const AudioLines = AudioWaveform;
