import { beforeAll, describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { DEMO, FACES, SOLVED, colorCounts, emptyFaces, inverseMove, moveRotation, paintSticker, sliceMove, sliceMoves, stateAt, stickerPose, toFaceMap, toFacelets, validateCube } from './cube';
import type { Vec3 } from './cube';

describe('physical cube validation', () => {
  it('limits a color to nine stickers across all faces, including its locked center', () => {
    let faces = emptyFaces();
    for (const i of [0, 1, 2, 3, 5, 6, 7, 8]) faces = paintSticker(faces, 'F', i, 'B').faces;
    expect(colorCounts(faces).B).toBe(9);
    const rejected = paintSticker(faces, 'R', 0, 'B');
    expect(rejected.error).toContain('9 kotak');
    expect(rejected.faces.R[0]).toBe('?');
    expect(paintSticker(faces, 'F', 0, 'B').error).toBeUndefined();
    faces = paintSticker(faces, 'F', 0, 'F').faces;
    expect(colorCounts(faces).B).toBe(8);
    expect(paintSticker(faces, 'R', 0, 'B').error).toBeUndefined();
    expect(paintSticker(faces, 'F', 4, 'R').faces.F[4]).toBe('F');
  });
  it('accepts legal scrambles and the solved cube', () => {
    for (const s of [SOLVED, DEMO, new Cube().move("B' L D2 F R2 U B2 D' L2").asString()]) expect(validateCube(s).ok).toBe(true);
  });
  it('rejects unfinished input and wrong color counts', () => {
    expect(validateCube(toFacelets(emptyFaces())).ok).toBe(false);
    const r = validateCube('R' + SOLVED.slice(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('berjumlah');
  });
  it('rejects a single flipped edge', () => {
    const c = new Cube(); c.eo[0] = 1;
    expect(validateCube(c.asString()).ok).toBe(false);
  });
  it('rejects a single twisted corner', () => {
    const c = new Cube(); c.co[0] = 1;
    expect(validateCube(c.asString()).ok).toBe(false);
  });
  it('rejects swapped pieces with odd parity even when all colors occur nine times', () => {
    const c = new Cube(); [c.ep[0], c.ep[1]] = [c.ep[1], c.ep[0]];
    expect(validateCube(c.asString()).ok).toBe(false);
  });
  it('rejects impossible color combinations without crashing', () => {
    const a = SOLVED.split(''); [a[0], a[10]] = [a[10], a[0]];
    expect(validateCube(a.join('')).ok).toBe(false);
  });
  it('round trips scan faces in the solver order', () => expect(toFacelets(toFaceMap(DEMO))).toBe(DEMO));
});

function rotate(v: Vec3, axis: 'x' | 'y' | 'z', angle: number): Vec3 {
  const [x, y, z] = v, c = Math.round(Math.cos(angle)), s = Math.round(Math.sin(angle));
  return axis === 'x' ? [x, y * c - z * s, y * s + z * c] : axis === 'y' ? [x * c + z * s, y, -x * s + z * c] : [x * c - y * s, x * s + y * c, z];
}
describe('3D instructional geometry agrees with the solver', () => {
  const poses = FACES.flatMap(face => Array.from({ length: 9 }, (_, i) => stickerPose(face, i)));
  for (const axis of ['x', 'y', 'z'] as const) {
    it(`opposing ${axis} layer angles match the resulting cube state and undo together`, () => {
      const result = Array<string>(54), coordinate = { x: 0, y: 1, z: 2 }[axis];
      const angles = new Map([[-1, -Math.PI / 2], [0, Math.PI / 2]]);
      poses.forEach((pose, i) => {
        const angle = angles.get(pose.position[coordinate]) ?? 0;
        const position = rotate(pose.position, axis, angle), normal = rotate(pose.normal, axis, angle);
        const target = poses.findIndex(p => p.position.every((n, j) => n === position[j]) && p.normal.every((n, j) => n === normal[j]));
        result[target] = DEMO[i];
      });
      const moves = [...angles].map(([layer, angle]) => sliceMove(axis, layer, angle)).join(' ');
      const cube = Cube.fromString(DEMO).move(moves);
      expect(result.join('')).toBe(cube.asString());
      expect(cube.move(inverseMove(moves)).asString()).toBe(DEMO);
    });
  }
  for (const axis of ['x', 'y', 'z'] as const) for (const layers of [[-1, 0], [0, 1], [-1, 1], [-1, 0, 1]]) {
    it(`multi-layer ${axis} ${layers.join(',')} matches real cube moves and can be undone as one gesture`, () => {
      const coordinate = { x: 0, y: 1, z: 2 }[axis], result = Array<string>(54);
      const moves = sliceMoves(axis, layers, 1);
      poses.forEach((pose, i) => {
        const affected = layers.includes(pose.position[coordinate]);
        const position = affected ? rotate(pose.position, axis, Math.PI / 2) : pose.position;
        const normal = affected ? rotate(pose.normal, axis, Math.PI / 2) : pose.normal;
        const target = poses.findIndex(p => p.position.every((n, j) => n === position[j]) && p.normal.every((n, j) => n === normal[j]));
        result[target] = DEMO[i];
      });
      const cube = Cube.fromString(DEMO).move(moves);
      expect(result.join('')).toBe(cube.asString());
      expect(cube.move(inverseMove(moves)).asString()).toBe(DEMO);
    });
  }
  for (const face of [...FACES, 'M', 'E', 'S']) for (const suffix of ['', "'", '2']) {
    const move = face + suffix;
    it(`animates ${move} to exactly the resulting facelet state`, () => {
      const { axis, layer, angle } = moveRotation(move), coordinate = { x: 0, y: 1, z: 2 }[axis];
      const result = Array<string>(54);
      poses.forEach((pose, i) => {
        const affected = pose.position[coordinate] === layer;
        const position = affected ? rotate(pose.position, axis, angle) : pose.position;
        const normal = affected ? rotate(pose.normal, axis, angle) : pose.normal;
        const target = poses.findIndex(p => p.position.every((n, j) => n === position[j]) && p.normal.every((n, j) => n === normal[j]));
        expect(target).toBeGreaterThanOrEqual(0);
        result[target] = DEMO[i];
      });
      expect(result.join('')).toBe(Cube.fromString(DEMO).move(move).asString());
    });
  }
});
describe('solution and progress', () => {
  beforeAll(() => { Cube.initSolver(); }, 60000);
  it('solves multiple real cube states and verifies the final state', () => {
    for (const initial of [DEMO, ...Array.from({ length: 6 }, () => Cube.random().asString())]) {
      const moves = Cube.fromString(initial).solve().trim().split(/\s+/);
      expect(stateAt(initial, moves, moves.length)).toBe(SOLVED);
    }
  });
  it('undoing the last confirmed move restores the previous state', () => {
    const moves = ['R', 'U2', "F'", 'B'];
    for (let step = 1; step <= moves.length; step++) expect(Cube.fromString(stateAt(DEMO, moves, step)).move(inverseMove(moves[step - 1])).asString()).toBe(stateAt(DEMO, moves, step - 1));
  });
});
