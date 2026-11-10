export function referenceHasEnded(position, duration) {
  return Number.isFinite(duration) && duration > 0 && position >= duration;
}
