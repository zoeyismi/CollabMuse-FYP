import { createHash } from "node:crypto";

export function createBackupVerifier(expectedHash, expectedSize) {
  const hash = createHash("sha256");
  let size = 0;
  return {
    update(chunk) { hash.update(chunk); size += chunk.length; },
    verify() {
      if (size !== expectedSize || hash.digest("hex") !== expectedHash) {
        throw new Error("An audio file changed while the backup was being created. Please try again.");
      }
    },
  };
}
