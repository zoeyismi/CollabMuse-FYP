export function hasPlayableAudio(referenceUrl: string | null, clips: ReadonlyArray<{ id: string }>, regions: ReadonlyArray<{ clipId?: string }>): boolean {
  return Boolean(referenceUrl || regions.some((region) => region.clipId && clips.some((clip) => clip.id === region.clipId)));
}
