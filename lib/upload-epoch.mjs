export function getUploadEpoch(header, currentEpoch) {
  const epoch = header === undefined ? currentEpoch : Number(header);
  if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch !== currentEpoch) {
    throw Object.assign(new Error("The room was restored while you were editing. Reload the saved room before editing again."), { statusCode: 409 });
  }
  return epoch;
}
