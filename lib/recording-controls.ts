export function recordingButtonDisabled(status: string, readOnly: boolean, hasTrack: boolean, hasUnsavedRecording: boolean): boolean {
  if (status === "recording") return false;
  return readOnly || !hasTrack || status !== "idle" || hasUnsavedRecording;
}

export function recordingRequestCanStart(readOnly: boolean, trackIds: string[], targetTrackId: string): boolean {
  return !readOnly && trackIds.includes(targetTrackId);
}

export function recordingAtRisk(status: string, hasUnsavedRecording: boolean): boolean {
  return hasUnsavedRecording || status === "requesting" || status === "recording" || status === "uploading";
}
