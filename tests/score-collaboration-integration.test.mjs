import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createDefaultScore } from '../lib/score.mjs';

const base = process.env.COLLABMUSE_TEST_URL;
if (!base) throw new Error('COLLABMUSE_TEST_URL must point to an isolated server');
const wait = (socket, name) => new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error(`timeout ${name}`)), 5000); socket.once(name, (value) => { clearTimeout(timeout); resolve(value); }); });
test('two editors retain distinct changes and reject conflicting changes', async () => {
  const a = io(base, { path: '/api/socket', transports: ['websocket'] });
  const b = io(base, { path: '/api/socket', transports: ['websocket'] });
  try {
    await Promise.all([wait(a, 'connect'), wait(b, 'connect')]);
    const snapshots = [wait(a, 'room:snapshot'), wait(b, 'room:snapshot')];
    a.emit('room:join', 'demo'); b.emit('room:join', 'demo');
    const [snapshot] = await Promise.all(snapshots);
    const composition = { id: 'test', title: 'Test', key: 'C major', tempo: 96, style: '', explanation: '', notes: [], provider: 'local', score: createDefaultScore({ key: 'C', bars: 16 }) };
    const init = wait(a, 'room:composition');
    a.emit('room:composition', { roomId: 'demo', arrangementEpoch: snapshot.arrangementEpoch, composition, previousScore: null });
    const original = (await init).composition;
    const left = structuredClone(original); left.score.chords[0] = 'Dm';
    const right = structuredClone(original); right.score.chords[1] = 'Em';
    const savedA = wait(a, 'room:composition');
    a.emit('room:composition', { roomId: 'demo', arrangementEpoch: snapshot.arrangementEpoch, composition: left, previousScore: original.score });
    await savedA;
    const savedB = wait(a, 'room:composition');
    b.emit('room:composition', { roomId: 'demo', arrangementEpoch: snapshot.arrangementEpoch, composition: right, previousScore: original.score });
    const merged = (await savedB).composition;
    assert.deepEqual(merged.score.chords.slice(0, 2), ['Dm', 'Em']);
    const stale = structuredClone(original); stale.score.chords[0] = 'Am';
    const rejected = wait(b, 'room:sync-error');
    b.emit('room:composition', { roomId: 'demo', arrangementEpoch: snapshot.arrangementEpoch, composition: stale, previousScore: original.score });
    assert.match((await rejected).message, /not saved/i);
    const room = await (await fetch(`${base}/api/rooms/demo`)).json();
    assert.deepEqual(room.room.composition.score.chords.slice(0, 2), ['Dm', 'Em']);
  } finally { a.disconnect(); b.disconnect(); }
});
