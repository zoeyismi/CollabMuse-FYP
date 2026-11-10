import assert from "node:assert/strict";
import { test } from "node:test";
import { validateTimingPatch } from "../lib/session-timing.mjs";

test("timing validation accepts supported values and partial updates", () => {
  for (const bpm of [40, 96.5, 220]) assert.doesNotThrow(() => validateTimingPatch({ bpm }));
  for (const timeSignature of ["4/4", "3/4", "6/8"]) assert.doesNotThrow(() => validateTimingPatch({ timeSignature }));
  assert.doesNotThrow(() => validateTimingPatch({}));
});

test("timing validation rejects out-of-range and malformed values", () => {
  for (const bpm of [39, 221, NaN, Infinity, "96", null]) assert.throws(() => validateTimingPatch({ bpm }), { statusCode: 400 });
  for (const timeSignature of ["7/8", "", null, {}]) assert.throws(() => validateTimingPatch({ timeSignature }), { statusCode: 400 });
});
