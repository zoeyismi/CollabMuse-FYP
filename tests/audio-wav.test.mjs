import assert from "node:assert/strict";
import { test } from "node:test";
import { audioBufferExceedsPcmRange, audioBufferToWav } from "../lib/audio-wav.ts";

test("mix clipping detection checks both channels and both polarities", () => {
  const buffer = (samples) => ({ numberOfChannels: samples.length, getChannelData: (channel) => new Float32Array(samples[channel]) });
  assert.equal(audioBufferExceedsPcmRange(buffer([[0, 1], [-1, 0.5]])), false);
  assert.equal(audioBufferExceedsPcmRange(buffer([[0], [1.1]])), true);
  assert.equal(audioBufferExceedsPcmRange(buffer([[-1.1]])), true);
});

test("WAV export interleaves and clips stereo samples with a valid PCM header", async () => {
  const samples = [new Float32Array([-2, 0, 1]), new Float32Array([1, 0.5, -1])];
  const reads = [0, 0];
  const blob = audioBufferToWav({
    numberOfChannels: 2, length: 3, sampleRate: 44100,
    getChannelData(channel) { reads[channel] += 1; return samples[channel]; },
  });
  const bytes = await blob.arrayBuffer();
  const view = new DataView(bytes);
  assert.equal(blob.type, "audio/wav");
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), "WAVE");
  assert.equal(view.getUint32(4, true), 48);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(40, true), 12);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true)), [-32768, 32767, 0, 16383, 32767, -32768]);
  assert.deepEqual(reads, [1, 1]);
});

test("WAV encoding rejects invalid samples rather than silently writing damaged audio", () => {
  for (const sample of [NaN, Infinity, -Infinity]) {
    const buffer = { numberOfChannels: 1, length: 1, sampleRate: 44100, getChannelData: () => new Float32Array([sample]) };
    assert.throws(() => audioBufferToWav(buffer), /invalid samples/i);
  }
});
