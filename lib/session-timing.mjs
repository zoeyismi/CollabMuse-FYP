const signatures = new Set(["4/4", "3/4", "6/8"]);

export function validateTimingPatch(patch) {
  if (Object.hasOwn(patch, "bpm") && (typeof patch.bpm !== "number" || !Number.isFinite(patch.bpm) || patch.bpm < 40 || patch.bpm > 220)) {
    throw Object.assign(new Error("Tempo must be between 40 and 220 BPM."), { statusCode: 400 });
  }
  if (Object.hasOwn(patch, "timeSignature") && !signatures.has(patch.timeSignature)) {
    throw Object.assign(new Error("Unsupported time signature."), { statusCode: 400 });
  }
}
