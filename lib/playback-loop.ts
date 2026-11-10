export function getLoopRestartTime(currentTime: number, duration: number, enabled: boolean, start: number, end: number): number | null {
  if (!enabled || !Number.isFinite(duration) || duration <= 0) return null;
  const loopStart = Number.isFinite(start) && start < duration ? Math.max(0, start) : 0;
  const loopEnd = Number.isFinite(end) && end > loopStart ? Math.min(end, duration) : duration;
  return currentTime >= loopEnd ? loopStart : null;
}
