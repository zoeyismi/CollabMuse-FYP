export function exportSegmentRange(bufferDuration: number, sourceOffset: number, sourceDuration: number): { offset: number; duration: number } | null {
  if (!Number.isFinite(bufferDuration) || !Number.isFinite(sourceOffset) || !Number.isFinite(sourceDuration)) return null;
  const offset = Math.max(0, sourceOffset);
  const duration = Math.min(sourceDuration, bufferDuration - offset);
  return duration > 0 ? { offset, duration } : null;
}
