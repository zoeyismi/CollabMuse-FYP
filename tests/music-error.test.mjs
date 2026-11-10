import test from "node:test";
import assert from "node:assert/strict";
import { isUnconfiguredMusicService, musicErrorMessage } from "../lib/music-error.ts";

test("only the explicit unconfigured response confirms no generation", () => {
  const message = "ElevenLabs is not configured. Choose the built-in arranger or configure the API key.";
  assert.equal(isUnconfiguredMusicService(503, message), true);
  assert.equal(isUnconfiguredMusicService(500, message), false);
  assert.equal(isUnconfiguredMusicService(503, "Music service timed out"), false);
  assert.equal(isUnconfiguredMusicService(503, undefined), false);
});

test("known music service errors are translated without hiding unknown details", () => {
  const missing = "ElevenLabs is not configured. Choose the built-in arranger or configure the API key.";
  assert.match(musicErrorMessage(missing, "zh"), /尚未配置 ElevenLabs/);
  assert.equal(musicErrorMessage(missing, "en"), missing);
  assert.equal(musicErrorMessage("Unexpected error details", "zh"), "Unexpected error details");
});
