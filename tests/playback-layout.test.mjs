import assert from "node:assert/strict";
import { test } from "node:test";
import { playbackLayoutKey } from "../lib/playback-layout.ts";

test("playback layout changes for timing and source edits but not volume changes", () => {
  const regions = [{ id: "r", clipId: "c", lane: 0, left: 10, width: 20, sourceOffset: 0, sourceDuration: 5 }];
  const clips = [{ id: "c", trackId: "t", duration: 10 }];
  const tracks = [{ id: "t", volume: 0.5 }];
  const key = playbackLayoutKey(regions, clips, tracks, 120);
  assert.notEqual(playbackLayoutKey([{ ...regions[0], left: 20 }], clips, tracks, 120), key);
  assert.notEqual(playbackLayoutKey([{ ...regions[0], sourceDuration: 4 }], clips, tracks, 120), key);
  assert.notEqual(playbackLayoutKey(regions, clips, tracks, 180), key);
  assert.equal(playbackLayoutKey(regions, clips, [{ ...tracks[0], volume: 0.1, muted: true }], 120), key);
  assert.equal(playbackLayoutKey(regions, [...clips, { id: "unused", trackId: "t", duration: 2 }], tracks, 120), key);
  assert.notEqual(playbackLayoutKey(regions, clips, tracks, 120, "/audio?snapshot=1"), playbackLayoutKey(regions, clips, tracks, 120, "/audio?snapshot=2"));
});
