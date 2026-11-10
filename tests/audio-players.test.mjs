import test from "node:test";
import assert from "node:assert/strict";
import { pauseAudioPlayers, pauseOtherAudioPlayers } from "../lib/audio-players.ts";

test("starting a version preview pauses the other preview players", () => {
  const paused = [];
  const first = { pause: () => paused.push("A") };
  const second = { pause: () => paused.push("B") };
  const single = { pause: () => paused.push("single") };
  pauseOtherAudioPlayers([first, second, single], second);
  assert.deepEqual(paused, ["A", "single"]);
});

test("pauses every available player when comparison changes or closes", () => {
  const paused = [];
  pauseAudioPlayers([{ pause: () => paused.push("A") }, null, { pause: () => paused.push("B") }]);
  assert.deepEqual(paused, ["A", "B"]);
});
