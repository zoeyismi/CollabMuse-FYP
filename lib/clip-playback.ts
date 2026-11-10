const activeRequests = new WeakMap<object, object>();

export async function startTrackedAudio(
  audio: Pick<HTMLAudioElement, "play" | "pause">,
  isCurrent: () => boolean,
): Promise<object | null> {
  const request = {};
  activeRequests.set(audio, request);
  await audio.play();
  if (!isCurrent()) {
    if (activeRequests.get(audio) === request) audio.pause();
    return null;
  }
  return activeRequests.get(audio) === request ? request : null;
}

export async function playClipSegment(
  audio: Pick<HTMLAudioElement, "play" | "pause">,
  durationSeconds: number,
  isCurrent: () => boolean,
  schedule: (callback: () => void, delayMs: number) => void,
): Promise<void> {
  const request = await startTrackedAudio(audio, isCurrent);
  if (!request || activeRequests.get(audio) !== request) return;
  schedule(() => { if (isCurrent() && activeRequests.get(audio) === request) audio.pause(); }, Math.max(0, durationSeconds * 1000));
}
