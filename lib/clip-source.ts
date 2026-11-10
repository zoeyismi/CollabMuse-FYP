import type { AudioClip, TimelineRegion } from "@/lib/mock-data";

export function availableRegionDuration(region: TimelineRegion, clip?: AudioClip): number | undefined {
  if (region.clipId && !clip) return 0;
  if ((region.sourceOffset !== undefined && !Number.isFinite(region.sourceOffset)) ||
      (region.sourceDuration !== undefined && !Number.isFinite(region.sourceDuration))) return 0;
  if (clip && (!Number.isFinite(clip.duration) || clip.duration <= 0)) return 0;
  const offset = Math.max(0, region.sourceOffset ?? 0);
  const available = clip && Number.isFinite(clip.duration) ? Math.max(0, clip.duration - offset) : undefined;
  if (region.sourceDuration === undefined) return available;
  const duration = Math.max(0, region.sourceDuration);
  return available === undefined ? duration : Math.min(duration, available);
}

export function canEditRegionTiming(duration: number | undefined): boolean {
  return duration === undefined || (Number.isFinite(duration) && duration > 0);
}
