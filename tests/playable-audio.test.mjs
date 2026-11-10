import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPlayableAudio } from "../lib/playable-audio.ts";

test("only a reference or timeline clip with audio enables playback", () => {
  assert.equal(hasPlayableAudio(null, [], [{}]), false);
  assert.equal(hasPlayableAudio(null, [{ id: "a" }], [{ clipId: "missing" }]), false);
  assert.equal(hasPlayableAudio(null, [{ id: "a" }], [{ clipId: "a" }]), true);
  assert.equal(hasPlayableAudio("/reference", [], []), true);
  assert.equal(hasPlayableAudio(null, [{ id: "a" }], []), false);
});
