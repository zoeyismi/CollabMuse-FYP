import { isDeepStrictEqual } from 'node:util';

const conflict = () => { throw Object.assign(new Error('The score changed elsewhere. Your edit was not saved; review the latest score and try again.'), { statusCode: 409 }); };

function merge(base, current, incoming, path = '') {
  if (isDeepStrictEqual(incoming, base)) return current;
  if (isDeepStrictEqual(current, base) || isDeepStrictEqual(current, incoming)) return incoming;
  if (base && typeof base === 'object' && typeof base.id === 'string' && Object.hasOwn(base, 'midi')) return conflict();
  if (Array.isArray(base) && Array.isArray(current) && Array.isArray(incoming)) {
    if (path.endsWith('.chords') && base.length === current.length && base.length === incoming.length) {
      return base.map((value, i) => merge(value, current[i], incoming[i], `${path}.${i}`));
    }
    const keyed = (array) => array.every((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string') && new Set(array.map((entry) => entry.id)).size === array.length;
    if (!keyed(base) || !keyed(current) || !keyed(incoming)) return conflict();
    const ids = [...new Set([...current.map((item) => item.id), ...incoming.map((item) => item.id)])];
    return ids.flatMap((id) => {
      const value = merge(base.find((item) => item.id === id), current.find((item) => item.id === id), incoming.find((item) => item.id === id), `${path}.${id}`);
      return value === undefined ? [] : [value];
    });
  }
  if (base && current && incoming && [base, current, incoming].every((value) => typeof value === 'object' && !Array.isArray(value))) {
    const result = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(current), ...Object.keys(incoming)])) {
      const value = merge(base[key], current[key], incoming[key], `${path}.${key}`);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  return conflict();
}

export function mergeScore(base, current, incoming) { return merge(base, current, incoming, 'score'); }
