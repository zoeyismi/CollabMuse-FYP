import test from "node:test";
import assert from "node:assert/strict";
import { roomConnectionLabel, roomConnectionMessage } from "../lib/room-connection-status.ts";

test("compact connection labels distinguish all states in both languages", () => {
  assert.equal(roomConnectionLabel("online", "zh"), "房间已连接");
  assert.match(roomConnectionLabel("offline", "zh"), /重连/);
  assert.match(roomConnectionLabel("denied", "zh"), /无法访问/);
  assert.doesNotMatch(roomConnectionLabel("denied", "zh"), /重连/);
  assert.equal(roomConnectionLabel("online"), "Room online");
  assert.equal(roomConnectionLabel("denied"), "Room unavailable");
});

test("distinguishes lost access from connection and reconnect states", () => {
  assert.match(roomConnectionMessage("denied"), /owner for access/i);
  assert.doesNotMatch(roomConnectionMessage("denied"), /reconnect/i);
  assert.match(roomConnectionMessage("offline"), /reconnect/i);
  assert.match(roomConnectionMessage("connecting"), /connecting/i);
  assert.equal(roomConnectionMessage("online"), "");
});

test("Chinese messages distinguish permissions from connectivity", () => {
  assert.match(roomConnectionMessage("denied", "zh"), /所有者.*权限/);
  assert.doesNotMatch(roomConnectionMessage("denied", "zh"), /重新连接/);
  assert.match(roomConnectionMessage("offline", "zh"), /重新连接/);
  assert.match(roomConnectionMessage("connecting", "zh"), /正在连接/);
  assert.equal(roomConnectionMessage("online", "zh"), "");
});
