import test from "node:test";
import assert from "node:assert/strict";
import { requestVersionChange } from "../lib/version-request.ts";

test("version requests time out without reporting success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  try {
    await assert.rejects(requestVersionChange("/test", { method: "POST" }, 10), /aborted/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("version requests return the server response", async () => {
  const originalFetch = globalThis.fetch;
  const expected = new Response(JSON.stringify({ saved: true }), { status: 201 });
  globalThis.fetch = async () => expected;
  try {
    const result = await requestVersionChange("/test", { method: "POST" }, 10);
    assert.equal(result.response, expected);
    assert.deepEqual(result.data, { saved: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
