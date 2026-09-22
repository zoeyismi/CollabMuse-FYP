import { WaveformEditor } from "@/components/WaveformEditor";
import type { RoomNote, TimelineRegion } from "@/lib/mock-data";

type TimelineProps = {
  uploadedFileName: string;
  waveformPeaks?: number[] | null;
  regions?: TimelineRegion[];
  notes?: RoomNote[];
  onSelectionAction?: (label: string) => void;
  onRegionsChange?: (
    regions: TimelineRegion[],
    changedRegion: TimelineRegion,
    mode: "move" | "resize-start" | "resize-end",
  ) => void;
};

export function Timeline({ uploadedFileName, waveformPeaks, regions, notes, onSelectionAction, onRegionsChange }: TimelineProps) {
  return (
    <WaveformEditor
      uploadedFileName={uploadedFileName}
      waveformPeaks={waveformPeaks}
      regions={regions}
      notes={notes}
      onSelectionAction={onSelectionAction}
      onRegionsChange={onRegionsChange}
    />
  );
}
