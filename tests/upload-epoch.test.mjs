import assert from "node:assert/strict";
import { test } from "node:test";
import { getUploadEpoch } from "../lib/upload-epoch.mjs";

test("upload accepts the current version and supports older clients", () => {
  assert.equal(getUploadEpoch("4", 4), 4);
  assert.equal(getUploadEpoch(undefined, 4), 4);
});

test("upload rejects stale or invalid version markers", () => {
  for (const header of ["3", "-1", "NaN", "1.5"]) {
    assert.throws(() => getUploadEpoch(header, 4), { statusCode: 409 });
  }
});
