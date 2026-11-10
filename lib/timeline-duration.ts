import type { AudioClip, TimelineRegion } from "@/lib/mock-data";

// Region positions are percentages of the resulting timeline, so its duration
// must accommodate each clip after that percentage has been applied.
export function getTimelineDuration(referenceDuration: number, clips: AudioClip[], regions: TimelineRegion[]): number {
  let duration = Math.max(Number.isFinite(referenceDuration) ? referenceDuration : 0, clips.length ? 120 : 0);
  for (const region of regions) {
    const clip = clips.find((item) => item.id === region.clipId);
    if (!clip || !Number.isFinite(region.left) || region.left < 0 || region.left >= 100) continue;
    const offset = Math.max(0, region.sourceOffset ?? 0);
    const available = Math.max(0, clip.duration - offset);
    const clipDuration = Math.min(region.sourceDuration ?? available, available);
    if (!Number.isFinite(clipDuration) || clipDuration <= 0) continue;
    duration = Math.max(duration, clipDuration / (1 - region.left / 100));
  }
  return duration;
}

export function hasTimelineDurationMismatch(duration: number, clips: AudioClip[], regions: TimelineRegion[]): boolean {
  if (!Number.isFinite(duration) || duration <= 0) return false;
  return regions.some((region) => {
    const clip = clips.find((item) => item.id === region.clipId);
    if (!clip || !Number.isFinite(region.width) || region.width <= 0) return false;
    const available = Math.max(0, clip.duration - Math.max(0, region.sourceOffset ?? 0));
    const actual = Math.min(region.sourceDuration ?? available, available);
    if (!Number.isFinite(actual) || actual <= 0) return false;
    const displayed = duration * region.width / 100;
    return Math.abs(displayed - actual) > Math.max(0.5, actual * 0.02);
  });
}
