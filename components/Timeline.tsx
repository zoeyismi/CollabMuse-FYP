import { WaveformEditor } from "@/components/WaveformEditor";
import type { TimelineRegion } from "@/lib/mock-data";

type TimelineProps = {
  uploadedFileName: string;
  waveformPeaks?: number[] | null;
  regions?: TimelineRegion[];
  onSelectionAction?: (label: string) => void;
  onRegionsChange?: (
    regions: TimelineRegion[],
    changedRegion: TimelineRegion,
    mode: "move" | "resize-start" | "resize-end",
  ) => void;
};

export function Timeline({ uploadedFileName, waveformPeaks, regions, onSelectionAction, onRegionsChange }: TimelineProps) {
  return (
    <WaveformEditor
      uploadedFileName={uploadedFileName}
      waveformPeaks={waveformPeaks}
      regions={regions}
      onSelectionAction={onSelectionAction}
      onRegionsChange={onRegionsChange}
    />
  );
}
