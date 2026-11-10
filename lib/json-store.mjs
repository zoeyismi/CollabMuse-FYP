import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const fileQueues = new Map();

export function createJsonStore(filePath, initialValue, validate = () => true) {
  const queueKey = path.resolve(filePath);
  if (!fileQueues.has(queueKey)) fileQueues.set(queueKey, { pending: Promise.resolve() });
  const queue = fileQueues.get(queueKey);

  function assertValid(value) {
    if (!validate(value)) throw new Error(`Cannot use saved data from ${filePath}: invalid data structure`);
    return value;
  }

  async function load() {
    let contents;
    try {
      contents = await readFile(filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        try {
          await access(`${filePath}.bak`);
        } catch (backupError) {
          if (backupError.code === "ENOENT") return { value: assertValid(structuredClone(initialValue())), exists: false };
          throw backupError;
        }
        throw new Error(`Saved data is missing from ${filePath}; an existing backup must be reviewed before creating new data.`);
      }
      throw error;
    }
    let value;
    try {
      value = JSON.parse(contents);
    } catch (error) {
      throw new Error(`Cannot read saved data from ${filePath}: invalid JSON`, { cause: error });
    }
    return { value: assertValid(value), exists: true };
  }

  async function save(value, existed) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${randomBytes(8).toString("hex")}.tmp`;
    const backupTemporaryPath = `${filePath}.${randomBytes(8).toString("hex")}.bak.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(value, null, 2), { flag: "wx" });
      try {
        await copyFile(filePath, backupTemporaryPath, constants.COPYFILE_EXCL);
        await rename(backupTemporaryPath, `${filePath}.bak`);
      } catch (error) {
        if (error.code !== "ENOENT" || existed) throw error;
      }
      await rename(temporaryPath, filePath);
    } finally {
      await rm(temporaryPath, { force: true });
      await rm(backupTemporaryPath, { force: true });
    }
  }

  function update(mutator) {
    const operation = queue.pending.then(async () => {
      const { value, exists } = await load();
      const result = await mutator(value);
      assertValid(value);
      await save(value, exists);
      return result;
    });
    queue.pending = operation.catch(() => {});
    return operation;
  }

  return { read: async () => { await queue.pending; return (await load()).value; }, update };
}
