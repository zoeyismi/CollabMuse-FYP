export function createMusicWorkerRunner({ createWorker, maxJobs = 2, timeoutMs = 60000 }) {
  let jobs = 0;
  return function run(input) {
    if (jobs >= maxJobs) throw Object.assign(new Error("Music generation is busy. Please try again shortly."), { statusCode: 429 });
    jobs += 1;
    return new Promise((resolve, reject) => {
      let worker;
      try { worker = createWorker(input); }
      catch (error) { jobs -= 1; reject(error); return; }
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        jobs -= 1;
        if (error) reject(error); else resolve(result);
      };
      const timer = setTimeout(() => {
        finish(Object.assign(new Error("Music generation timed out. Please try again."), { statusCode: 504 }));
        Promise.resolve().then(() => worker.terminate()).catch(() => {});
      }, timeoutMs);
      worker.once("message", (result) => result.error ? finish(new Error(result.error)) : finish(null, result));
      worker.once("error", (error) => finish(error));
      worker.once("exit", (code) => { if (!settled) finish(new Error(`Music worker exited before returning audio (${code}).`)); });
    });
  };
}
