export function discardMusicErrorResponse(response) {
  if (response.body) void response.body.cancel().catch(() => {});
}

export async function readBoundedJson(response, maxBytes) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) {
    discardMusicErrorResponse(response);
    throw new Error("Composition service response is too large.");
  }
  if (!response.body) throw new Error("Composition service returned an empty response.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new Error("Composition service response is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
}

export async function readMp3Response(response, maxBytes) {
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType && contentType !== "audio/mpeg" && contentType !== "audio/mp3" && contentType !== "application/octet-stream") {
    throw new Error("Music service did not return MP3 audio.");
  }
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) throw new Error("Music service returned an audio file that is too large.");
  if (!response.body) throw new Error("Music service returned an empty audio file.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Music service returned an audio file that is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const audio = Buffer.concat(chunks, size);
  const hasId3 = audio.subarray(0, 3).toString("ascii") === "ID3";
  const hasFrame = audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0;
  if (audio.length < 128 || (!hasId3 && !hasFrame)) throw new Error("Music service returned invalid MP3 audio.");
  return audio;
}
