import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnPath } from "../lib/safe-return-path.ts";

test("preserves local room invitations and query strings", () => {
  assert.equal(safeReturnPath("/room/room-1?invite=abc#notes"), "/room/room-1?invite=abc#notes");
  assert.equal(safeReturnPath("/dashboard"), "/dashboard");
});

test("rejects external or ambiguous login return paths", () => {
  for (const path of [null, "", "https://example.com", "//example.com", "/\\example.com", "javascript:alert(1)"]) {
    assert.equal(safeReturnPath(path), "/dashboard");
  }
});
