export const MAX_AUDIO_BYTES: number;
export function audioFileSizeError(size: number): string | null;
export function recordingSizeWarning(size: number): string;
export function recordingMustStop(size: number): boolean;
export function displayRecordingSizeWarning(warning: string, language: string): string;
