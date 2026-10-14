import { FACES, emptyFaces, stateAt, SOLVED, toFacelets, validateCube } from './cube';
import type { FaceMap } from './cube';

export type Phase = 'input' | 'review' | 'orient' | 'guide' | 'done';
export type Session = { version: 1; phase: Phase; faces: FaceMap; faceIndex: number; mode: 'scan' | 'manual'; initial: string; moves: string[]; step: number; demo: boolean };
export const SESSION_KEY = 'rubik-pandu-session-v1';
export function newSession(mode: Session['mode']): Session {
  return { version: 1, phase: 'input', faces: emptyFaces(), faceIndex: 0, mode, initial: '', moves: [], step: 0, demo: false };
}
export function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (s.version !== 1 || !['input', 'review', 'orient', 'guide', 'done'].includes(s.phase) || !['scan', 'manual'].includes(s.mode)) return null;
    if (!Number.isInteger(s.faceIndex) || s.faceIndex < 0 || s.faceIndex > 5 || typeof s.demo !== 'boolean') return null;
    if (!s.faces || !FACES.every(f => Array.isArray(s.faces[f]) && s.faces[f].length === 9 && s.faces[f][4] === f && s.faces[f].every(c => typeof c === 'string' && /^[URFDLB?]$/.test(c)))) return null;
    if (typeof s.initial !== 'string' || !Array.isArray(s.moves) || s.moves.length > 100 || !s.moves.every(m => typeof m === 'string' && /^[URFDLB](2|')?$/.test(m))) return null;
    if (!Number.isInteger(s.step) || s.step < 0 || s.step > s.moves.length) return null;
    if (['orient', 'guide', 'done'].includes(s.phase)) {
      if (!validateCube(s.initial).ok || toFacelets(s.faces) !== s.initial || stateAt(s.initial, s.moves, s.moves.length) !== SOLVED) return null;
      if (s.phase === 'done' && s.step !== s.moves.length) return null;
      if (s.phase === 'guide' && s.step === s.moves.length) return null;
      if (s.phase === 'orient' && (s.step !== 0 || s.moves.length === 0)) return null;
    }
    return s;
  } catch { return null; }
}
