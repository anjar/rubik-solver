import { describe, expect, it } from 'vitest';
import { SOLVED, toFaceMap } from './cube';
import { newSession, parseSession } from './session';

describe('saved session integrity', () => {
  it('restores a partial manual input', () => {
    const s = newSession('manual'); s.faces.F[0] = 'R';
    expect(parseSession(JSON.stringify(s))).toEqual(s);
  });
  it('restores only a valid solution and confirmed progress', () => {
    const s = { ...newSession('manual'), phase: 'guide', initial: SOLVED, faces: toFaceMap(SOLVED), moves: ['R', "R'"], step: 1 };
    expect(parseSession(JSON.stringify(s))?.step).toBe(1);
    expect(parseSession(JSON.stringify({ ...s, moves: ['R'] }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...s, step: -1 }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...s, phase: 'done' }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...s, step: 2 }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...s, phase: 'orient' }))).toBeNull();
  });
  it('ignores corrupt or old storage without crashing', () => {
    for (const raw of [null, '', '{bad', '{}', JSON.stringify({ ...newSession('scan'), version: 2 })]) expect(parseSession(raw)).toBeNull();
  });
});
