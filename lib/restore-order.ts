export function shouldApplyRestore(currentEpoch: number, incomingEpoch: number, hasRoomState: boolean): boolean {
  return Number.isSafeInteger(incomingEpoch) && incomingEpoch >= 0 && (!hasRoomState || incomingEpoch > currentEpoch);
}
