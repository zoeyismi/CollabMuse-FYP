export function referenceTempoDetails(clip) {
  const generated = Number(clip?.generation?.bpm);
  if (clip?.generation?.provider === "collabmuse" && Number.isFinite(generated) && generated >= 40 && generated <= 220) return { bpm: generated, estimated: false };

  const analyzed = Number(clip?.analysis?.bpm);
  if (Number.isFinite(analyzed) && analyzed >= 60 && analyzed <= 180) return { bpm: analyzed, estimated: true };

  if (Number.isFinite(generated) && generated >= 60 && generated <= 180) return { bpm: generated, estimated: false };
  return null;
}

export function referenceTempo(clip) {
  return referenceTempoDetails(clip)?.bpm ?? null;
}
