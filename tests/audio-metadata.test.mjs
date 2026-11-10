import assert from "node:assert/strict";
import { test } from "node:test";
import { getAudioDuration } from "../lib/audio-metadata.ts";

test("audio metadata resolves valid duration, errors and timeouts and releases its URL", async (t) => {
  const oldAudio = globalThis.Audio;
  const oldWindow = globalThis.window;
  const oldCreate = URL.createObjectURL;
  const oldRevoke = URL.revokeObjectURL;
  t.after(() => { globalThis.Audio = oldAudio; globalThis.window = oldWindow; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; });
  let behavior = "loaded";
  let revoked = 0;
  let cleaned = 0;
  globalThis.window = globalThis;
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => { revoked += 1; };
  globalThis.Audio = class {
    duration = 12.5;
    set src(value) {
      if (value && behavior !== "timeout") queueMicrotask(() => behavior === "loaded" ? this.onloadedmetadata?.() : this.onerror?.());
    }
    removeAttribute() { cleaned += 1; }
    load() {}
  };
  assert.equal(await getAudioDuration({}, 20), 12.5);
  behavior = "error";
  assert.equal(await getAudioDuration({}, 20), 0);
  behavior = "timeout";
  assert.equal(await getAudioDuration({}, 1), 0);
  assert.equal(revoked, 3);
  assert.equal(cleaned, 3);
});
