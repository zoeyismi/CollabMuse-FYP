export function remapSplitNotes(notes, previous, first, second) {
  const ratio = first.width / previous.width;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) throw new Error("Invalid clip split.");
  return notes.map((note) => {
    if (note.regionId !== previous.id) return note;
    const offset = Math.max(0, Math.min(1, note.regionOffset ?? 0.5));
    const inFirst = offset < ratio;
    return {
      ...note,
      regionId: inFirst ? first.id : second.id,
      regionOffset: inFirst ? offset / ratio : (offset - ratio) / (1 - ratio),
      position: Math.max(0, Math.min(100, previous.left + previous.width * offset)),
    };
  });
}

export function remapMergedNotes(notes, first, second, merged) {
  if (!Number.isFinite(merged.width) || merged.width <= 0) throw new Error("Invalid clip merge.");
  return notes.map((note) => {
    const part = note.regionId === first.id ? first : note.regionId === second.id ? second : null;
    if (!part) return note;
    const offset = Math.max(0, Math.min(1, note.regionOffset ?? 0.5));
    const position = part.left + part.width * offset;
    return { ...note, regionId: merged.id, regionOffset: Math.max(0, Math.min(1, (position - merged.left) / merged.width)), position: Math.max(0, Math.min(100, position)) };
  });
}

export function preserveRemovedRegionNotePositions(notes, previousRegions, nextRegions) {
  const remaining = new Set(nextRegions.map((region) => region.id));
  const removed = new Map(previousRegions.filter((region) => !remaining.has(region.id)).map((region) => [region.id, region]));
  let changed = false;
  const updated = notes.map((note) => {
    const region = removed.get(note.regionId);
    if (!region) return note;
    const offset = Math.max(0, Math.min(1, note.regionOffset ?? 0.5));
    changed = true;
    return { ...note, position: Math.max(0, Math.min(100, region.left + region.width * offset)) };
  });
  return { notes: updated, changed };
}
