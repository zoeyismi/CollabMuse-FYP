export function scoreNoteRange(note, fromBeat, toBeat) {
  const start = Math.max(note.start, fromBeat);
  const end = Math.min(note.start + note.duration, toBeat);
  return end > start ? { offset: start - fromBeat, duration: end - start } : null;
}
