export function isCurrentUpload(uploadEpoch: number, currentEpoch: number): boolean {
  return uploadEpoch === currentEpoch;
}
