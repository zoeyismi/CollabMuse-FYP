export function hasPendingEdit(pending, kind) {
  for (const key of pending) if (key.startsWith(`${kind}:`)) return true;
  return false;
}

export function settlePendingEdit(pending, kind, eventId) {
  const own = eventId ? pending.delete(`${kind}:${eventId}`) : false;
  return { own, stillSaving: hasPendingEdit(pending, kind) };
}
