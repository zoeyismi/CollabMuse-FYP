import type { AudioClip, TimelineRegion, Track } from "@/lib/mock-data";

export function playbackLayoutKey(regions: TimelineRegion[], clips: AudioClip[], tracks: Track[], duration: number, referenceUrl?: string | null): string {
  const usedClips = new Set(regions.map((region) => region.clipId));
  return JSON.stringify({
    duration,
    referenceUrl: referenceUrl ?? null,
    tracks: tracks.map((track) => track.id),
    regions: regions.map(({ id, clipId, lane, left, width, sourceOffset, sourceDuration }) => ({ id, clipId, lane, left, width, sourceOffset, sourceDuration })),
    clips: clips.filter((clip) => usedClips.has(clip.id)).map(({ id, trackId, duration: clipDuration }) => ({ id, trackId, duration: clipDuration })),
  });
}
