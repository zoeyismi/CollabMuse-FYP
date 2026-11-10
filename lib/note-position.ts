import type { RoomNote, TimelineRegion } from "@/lib/mock-data";

export function notePosition(note: RoomNote, regions: TimelineRegion[]): number {
  const region = note.regionId ? regions.find((item) => item.id === note.regionId) : undefined;
  if (!region) return Math.max(0, Math.min(100, note.position ?? 0));
  const offset = Math.max(0, Math.min(1, note.regionOffset ?? 0.5));
  return Math.max(0, Math.min(100, region.left + region.width * offset));
}
