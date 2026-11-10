const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameItem = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].every((key) => same(a[key], b[key]));
const conflict = () => Object.assign(new Error("Another collaborator changed the same item. Reload the room and try again."), { statusCode: 409 });

// Apply only non-conflicting changes to the latest saved collection.
export function mergeRoomEdits(current, previous, next) {
  const before = new Map(previous.map((item) => [item.id, item]));
  const after = new Map(next.map((item) => [item.id, item]));
  const saved = new Map(current.map((item) => [item.id, item]));
  const removed = new Set(previous.filter((item) => !after.has(item.id)).map((item) => item.id));
  for (const oldItem of previous) {
    const newItem = after.get(oldItem.id);
    const savedItem = saved.get(oldItem.id);
    if (!savedItem) {
      if (newItem && !sameItem(oldItem, newItem)) throw conflict();
      continue;
    }
    if (!newItem) {
      if (!sameItem(savedItem, oldItem)) throw conflict();
      continue;
    }
    for (const key of new Set([...Object.keys(oldItem), ...Object.keys(newItem)])) {
      if (!same(oldItem[key], newItem[key]) && !same(savedItem[key], oldItem[key]) && !same(savedItem[key], newItem[key])) throw conflict();
    }
  }
  for (const newItem of next) {
    if (!before.has(newItem.id) && saved.has(newItem.id) && !sameItem(saved.get(newItem.id), newItem)) throw conflict();
  }
  const result = current.filter((item) => !removed.has(item.id)).map((item) => {
    const oldItem = before.get(item.id);
    const newItem = after.get(item.id);
    if (!oldItem || !newItem) return item;
    const merged = { ...item };
    for (const key of new Set([...Object.keys(oldItem), ...Object.keys(newItem)])) {
      if (same(oldItem[key], newItem[key])) continue;
      if (Object.hasOwn(newItem, key)) merged[key] = newItem[key];
      else delete merged[key];
    }
    return merged;
  });
  const currentIds = new Set(result.map((item) => item.id));
  for (const item of next) {
    if (!before.has(item.id) && !currentIds.has(item.id)) {
      result.push(item);
      currentIds.add(item.id);
    }
  }
  return result;
}
