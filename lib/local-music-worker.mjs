import { parentPort, workerData } from "node:worker_threads";
import { renderLocalMusic } from "./local-music-engine.mjs";

try {
  const result = renderLocalMusic(workerData);
  parentPort.postMessage({ buffer: result.buffer, bpm: result.bpm, model: result.model });
} catch (error) {
  parentPort.postMessage({ error: error instanceof Error ? error.message : "Music generation failed" });
}
