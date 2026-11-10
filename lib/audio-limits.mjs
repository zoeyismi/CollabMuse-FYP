export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export function audioFileSizeError(size) {
  if (!Number.isSafeInteger(size) || size <= 0) return "The audio file is empty or its size could not be read.";
  if (size > MAX_AUDIO_BYTES) return "The audio file exceeds the 25 MiB limit. Choose a smaller file.";
  return null;
}

export function recordingSizeWarning(size) {
  if (size > MAX_AUDIO_BYTES) return "Recording stopped because it exceeds the 25 MiB upload limit. Download it to keep the take.";
  if (size >= MAX_AUDIO_BYTES * 0.9) return "This recording is approaching the 25 MiB upload limit. Stop soon or download the finished take.";
  return "";
}

export function recordingMustStop(size) {
  return size > MAX_AUDIO_BYTES;
}

export function displayRecordingSizeWarning(warning, language) {
  if (language !== "zh") return warning;
  if (warning === recordingSizeWarning(MAX_AUDIO_BYTES + 1)) return "录音超过 25 MiB 上传上限，已自动停止。请下载录音以保留本次录制。";
  if (warning === recordingSizeWarning(MAX_AUDIO_BYTES)) return "录音即将达到 25 MiB 上传上限，请尽快停止，或在录制完成后下载。";
  return warning;
}
