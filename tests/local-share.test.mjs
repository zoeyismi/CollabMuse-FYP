import test from "node:test";
import assert from "node:assert/strict";
import { isLoopbackHostname } from "../lib/local-share.ts";

test("identifies loopback links without labeling LAN or public links as localhost", () => {
  for (const host of ["localhost", "LOCALHOST", "studio.localhost", "127.0.0.1", "127.1.2.3", "[::1]", "::1"]) assert.equal(isLoopbackHostname(host), true);
  for (const host of ["example.com", "192.168.1.2", "localhost.example.com"]) assert.equal(isLoopbackHostname(host), false);
});
