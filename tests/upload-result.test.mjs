import assert from "node:assert/strict";
import { test } from "node:test";
import { isCurrentUpload } from "../lib/upload-result.ts";

test("upload work is applied only to the arrangement that started it", () => {
  assert.equal(isCurrentUpload(0, 0), true);
  assert.equal(isCurrentUpload(3, 3), true);
  assert.equal(isCurrentUpload(3, 4), false);
});
