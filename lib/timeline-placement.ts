export function findFreeTimelineStart(regions: Array<{ left: number; width: number }>, width: number, preferredStart = 0): number | null {
  if (!Number.isFinite(width) || width <= 0 || width > 100) return null;
  const intervals = regions
    .filter((region) => Number.isFinite(region.left) && Number.isFinite(region.width) && region.width > 0)
    .map((region) => ({ start: Math.max(0, region.left), end: Math.min(100, region.left + region.width) }))
    .filter((region) => region.end > region.start)
    .sort((a, b) => a.start - b.start);
  const findFrom = (offset: number) => {
    let start = offset;
    for (const interval of intervals) {
      if (interval.end <= start) continue;
      if (start + width <= interval.start + 1e-8) return start;
      start = Math.max(start, interval.end);
    }
    return start + width <= 100 + 1e-8 ? start : null;
  };
  const preferred = Number.isFinite(preferredStart) ? Math.max(0, preferredStart) : 0;
  return findFrom(preferred) ?? (preferred > 0 ? findFrom(0) : null);
}
