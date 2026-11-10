export function hasPendingEdit(pending: Set<string>, kind: string): boolean;
export function settlePendingEdit(pending: Set<string>, kind: string, eventId?: string): { own: boolean; stillSaving: boolean };
