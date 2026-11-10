export function resolveTempoInput(value: string, current: number): number {
  if (!value.trim()) return current;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return current;
  return Math.max(40, Math.min(220, parsed));
}

export function resolveTempoEdit(value: string, initial: string, current: number): number {
  return value === initial ? current : resolveTempoInput(value, current);
}
