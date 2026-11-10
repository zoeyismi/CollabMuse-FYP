import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createBackupVerifier } from "../lib/backup-verifier.mjs";

test("backup verifier accepts identical data across multiple chunks", () => {
  const bytes = Buffer.from("audio data");
  const verifier = createBackupVerifier(createHash("sha256").update(bytes).digest("hex"), bytes.length);
  verifier.update(bytes.subarray(0, 3));
  verifier.update(bytes.subarray(3));
  assert.doesNotThrow(() => verifier.verify());
});

test("backup verifier rejects changed or truncated audio", () => {
  const bytes = Buffer.from("audio data");
  const digest = createHash("sha256").update(bytes).digest("hex");
  for (const actual of [Buffer.from("other data"), bytes.subarray(0, 3)]) {
    const verifier = createBackupVerifier(digest, bytes.length);
    verifier.update(actual);
    assert.throws(() => verifier.verify(), /changed while the backup/);
  }
});
