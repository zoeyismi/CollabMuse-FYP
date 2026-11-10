export function hasPendingVersionChanges(pendingEdits: number, noteInFlight: boolean, clipUploading: boolean): boolean {
  return pendingEdits > 0 || noteInFlight || clipUploading;
}
