import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveTempoInput, resolveTempoEdit } from "../lib/tempo-input.ts";

test("tempo input resolves valid values and respects range", () => {
  assert.equal(resolveTempoInput("120", 96), 120);
  assert.equal(resolveTempoInput("32", 96), 40);
  assert.equal(resolveTempoInput("250", 96), 220);
  assert.equal(resolveTempoInput("120.5", 96), 120.5);
});

test("unchanged focused input adopts a remote tempo update", () => {
  assert.equal(resolveTempoEdit("96", "96", 120), 120);
  assert.equal(resolveTempoEdit("110", "96", 120), 110);
  assert.equal(resolveTempoEdit("", "96", 120), 120);
});

test("empty or invalid tempo leaves the saved value unchanged", () => {
  assert.equal(resolveTempoInput("", 96), 96);
  assert.equal(resolveTempoInput(" ", 96), 96);
  assert.equal(resolveTempoInput("abc", 96), 96);
});
