import type { AudioClip, TimelineRegion, Track } from "@/lib/mock-data";
import { audioBufferToWav } from "@/lib/audio-wav";
import { getTimelineDuration } from "@/lib/timeline-duration";
import { exportSegmentRange } from "@/lib/export-segment";

type VersionPreview = {
  tracks: Track[];
  timelineRegions: TimelineRegion[];
  audioClips: AudioClip[];
  audioAvailable: boolean;
  referenceMuted: boolean;
  legacyReferenceUnknown: boolean;
};

export async function renderVersionPreview(roomId: string, versionId: string): Promise<{ blob: Blob; legacyReferenceUnknown: boolean }> {
  const base = `/api/rooms/${encodeURIComponent(roomId)}/versions/${encodeURIComponent(versionId)}/preview`;
  const metadataResponse = await fetch(base);
  if (!metadataResponse.ok) throw new Error("Could not load this version.");
  const data = await metadataResponse.json() as VersionPreview;
  const context = new AudioContext();
  try {
    const decode = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("A version audio file is missing or unavailable.");
      return context.decodeAudioData(await response.arrayBuffer());
    };
    const reference = data.audioAvailable ? await decode(`${base}/audio`) : null;
    const referenceDuration = reference?.duration ?? 0;
    const timelineDuration = getTimelineDuration(referenceDuration, data.audioClips, data.timelineRegions);
    const items: Array<{ buffer: AudioBuffer; start: number; offset: number; duration: number; gain: number }> = [];
    const hasSolo = data.tracks.some((track) => track.solo);
    if (reference && !data.referenceMuted && !hasSolo) items.push({ buffer: reference, start: 0, offset: 0, duration: reference.duration, gain: 1 });
    const decoded = new Map<string, Promise<AudioBuffer>>();
    for (const region of data.timelineRegions) {
      const clip = data.audioClips.find((item) => item.id === region.clipId);
      if (!region.clipId) continue;
      if (!clip) throw new Error(`Audio for “${region.label}” is missing from this version.`);
      const track = data.tracks[region.lane ?? -1] ?? data.tracks.find((item) => item.id === clip.trackId);
      if (!track) throw new Error(`The track for “${region.label}” is missing from this version.`);
      const gain = Math.max(0, Math.min(1, track.volume ?? 0.8));
      if (track.muted || (hasSolo && !track.solo) || gain === 0) continue;
      if (!decoded.has(clip.id)) decoded.set(clip.id, decode(`${base}/clips/${encodeURIComponent(clip.id)}`));
      const buffer = await decoded.get(clip.id)!;
      const range = exportSegmentRange(buffer.duration, region.sourceOffset ?? 0, region.sourceDuration ?? clip.duration);
      if (!range) throw new Error(`Audio range for “${region.label}” is invalid. Check this version before comparing.`);
      items.push({ buffer, start: (region.left / 100) * timelineDuration, ...range, gain });
    }
    if (!items.length) throw new Error(data.legacyReferenceUnknown ? "This older version does not contain reference-audio information." : "This version has no audible audio to preview.");
    const duration = Math.max(...items.map((item) => item.start + item.duration));
    if (!Number.isFinite(duration) || duration > 300) throw new Error("Version previews are limited to five minutes.");
    const offline = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * 44100)), 44100);
    for (const item of items) {
      const source = offline.createBufferSource();
      const gain = offline.createGain();
      source.buffer = item.buffer;
      gain.gain.value = item.gain;
      source.connect(gain);
      gain.connect(offline.destination);
      source.start(item.start, item.offset, item.duration);
    }
    return { blob: audioBufferToWav(await offline.startRendering()), legacyReferenceUnknown: data.legacyReferenceUnknown };
  } finally {
    await context.close();
  }
}
