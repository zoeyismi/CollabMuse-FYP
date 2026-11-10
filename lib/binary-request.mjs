export function readBinaryRequest(req, byteLimit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      reject(error);
    };
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > byteLimit) {
        fail(Object.assign(new Error("Upload exceeds the allowed size."), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, size));
    });
    req.on("error", fail);
    req.on("aborted", () => fail(Object.assign(new Error("Upload was interrupted."), { statusCode: 400 })));
  });
}
