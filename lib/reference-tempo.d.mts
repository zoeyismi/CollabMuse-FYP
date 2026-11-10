type TempoClip = {
  analysis?: { bpm?: number } | null;
  generation?: { bpm?: number; provider?: string } | null;
} | null | undefined;

export function referenceTempo(clip: TempoClip): number | null;
export function referenceTempoDetails(clip: TempoClip): { bpm: number; estimated: boolean } | null;
