export async function getAudioDuration(file: File, timeoutMs = 15000): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      const timeout = window.setTimeout(() => finish(0), timeoutMs);
      const finish = (duration: number) => {
        window.clearTimeout(timeout);
        audio.onloadedmetadata = null;
        audio.onerror = null;
        audio.removeAttribute("src");
        audio.load();
        resolve(duration);
      };
      audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => finish(0);
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
