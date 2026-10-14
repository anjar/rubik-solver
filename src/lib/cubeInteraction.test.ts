// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installCubeInteraction } from './cubeInteraction';
import { FACES, stickerPose } from './cube';

function fixture() {
  const element = document.createElement('canvas');
  element.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500, toJSON: () => ({}) });
  const root = new THREE.Group();
  const cubies = new Map<string, THREE.Group>();
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const cubie = new THREE.Group(); cubie.position.set(x, y, z); cubie.userData.cubie = true;
    cubie.add(new THREE.Mesh(new THREE.BoxGeometry(.94, .94, .94), new THREE.MeshBasicMaterial()));
    root.add(cubie); cubies.set([x, y, z].join(','), cubie);
  }
  FACES.forEach(face => {
    for (let index = 0; index < 9; index++) {
      const pose = stickerPose(face, index), tile = new THREE.Mesh(new THREE.PlaneGeometry(.8, .8), new THREE.MeshBasicMaterial());
      tile.position.set(...pose.normal).multiplyScalar(.48);
      tile.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...pose.normal));
      tile.userData = { face, index }; cubies.get(pose.position.join(','))!.add(tile);
    }
  });
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  camera.position.set(0, 0, 9); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  const turns: string[] = [];
  const cleanup = installCubeInteraction({ element, camera, root, busy: () => false, onTurn: m => turns.push(m), animate: (motions, done) => { for (const motion of motions) motion.pivot.rotation[motion.axis] = motion.to; done(); } });
  const at = (index: number) => {
    const pose = stickerPose('F', index);
    const p = new THREE.Vector3(...pose.position).addScaledVector(new THREE.Vector3(...pose.normal), .48).project(camera);
    return [250 + p.x * 250, 250 - p.y * 250];
  };
  const pointer = (type: string, id: number, x: number, y: number) => {
    const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(e, 'pointerId', { value: id }); element.dispatchEvent(e);
  };
  return { element, camera, root, turns, cleanup, at, pointer };
}

describe('simulator gestures against actual raycast geometry', () => {
  it('drags the front top row right into a U inverse turn', () => {
    const f = fixture(), [x, y] = f.at(0);
    f.pointer('pointerdown', 1, x, y); f.pointer('pointermove', 1, x + 100, y); f.pointer('pointerup', 1, x + 100, y);
    expect(f.turns).toEqual(["U'"]); f.cleanup();
  });
  it('allows the middle row to turn as a real E slice', () => {
    const f = fixture(), [x, y] = f.at(3);
    f.pointer('pointerdown', 1, x, y); f.pointer('pointermove', 1, x + 100, y); f.pointer('pointerup', 1, x + 100, y);
    expect(f.turns).toEqual(['E']); f.cleanup();
  });
  it('snaps a very small drag back without changing cube state', () => {
    const f = fixture(), [x, y] = f.at(0);
    f.pointer('pointerdown', 1, x, y); f.pointer('pointermove', 1, x + 10, y); f.pointer('pointerup', 1, x + 10, y);
    expect(f.turns).toEqual([]); expect(f.root.children.filter(c => c.userData.cubie)).toHaveLength(27); f.cleanup();
  });
  it('turns two touched rows together without orbiting or double-committing on release', () => {
    const f = fixture(), [x, y] = f.at(0), [x2, y2] = f.at(3), before = f.camera.position.clone();
    f.pointer('pointerdown', 1, x, y); f.pointer('pointerdown', 2, x2, y2);
    f.pointer('pointermove', 1, x + 100, y); f.pointer('pointermove', 2, x2 + 100, y2);
    f.pointer('pointerup', 1, x + 100, y); f.pointer('pointerup', 2, x2 + 100, y2);
    expect(f.turns).toEqual(["E U'"]);
    expect(f.camera.position.distanceTo(before)).toBe(0); f.cleanup();
  });
  it('moves the top row right and bottom row left simultaneously', () => {
    const f = fixture(), [x, y] = f.at(0), [x2, y2] = f.at(6);
    f.pointer('pointerdown', 1, x, y); f.pointer('pointerdown', 2, x2, y2);
    f.pointer('pointermove', 1, x + 100, y); f.pointer('pointermove', 2, x2 - 100, y2);
    const angles = f.root.children.filter(c => !c.userData.cubie).map(c => c.rotation.y);
    expect(angles.some(a => a > 0)).toBe(true); expect(angles.some(a => a < 0)).toBe(true);
    f.pointer('pointerup', 1, x + 100, y); f.pointer('pointerup', 2, x2 - 100, y2);
    expect(f.turns).toEqual(["D' U'"]); f.cleanup();
  });
  it('moves the left column up and middle column down simultaneously', () => {
    const f = fixture(), [x, y] = f.at(0), [x2, y2] = f.at(1);
    f.pointer('pointerdown', 1, x, y); f.pointer('pointerdown', 2, x2, y2);
    f.pointer('pointermove', 1, x, y - 100); f.pointer('pointermove', 2, x2, y2 + 100);
    f.pointer('pointerup', 1, x, y - 100); f.pointer('pointerup', 2, x2, y2 + 100);
    expect(f.turns).toEqual(["L' M"]); f.cleanup();
  });
  it('lets the second finger keep moving after the first releases its own row', () => {
    const f = fixture(), [x, y] = f.at(0), [x2, y2] = f.at(6);
    f.pointer('pointerdown', 1, x, y); f.pointer('pointerdown', 2, x2, y2);
    f.pointer('pointermove', 1, x + 100, y); f.pointer('pointerup', 1, x + 100, y);
    expect(f.turns).toEqual([]);
    f.pointer('pointermove', 2, x2 - 100, y2); f.pointer('pointerup', 2, x2 - 100, y2);
    expect(f.turns).toEqual(["D' U'"]); f.cleanup();
  });
  it('does not rotate a second row when its finger stays still', () => {
    const f = fixture(), [x, y] = f.at(0), [x2, y2] = f.at(3);
    f.pointer('pointerdown', 1, x, y); f.pointer('pointerdown', 2, x2, y2);
    f.pointer('pointermove', 1, x + 100, y);
    f.pointer('pointerup', 1, x + 100, y); f.pointer('pointerup', 2, x2, y2);
    expect(f.turns).toEqual(["U'"]); f.cleanup();
  });
  it('turns three touched rows together with three fingers', () => {
    const f = fixture();
    for (const [id, index] of [[1, 0], [2, 3], [3, 6]]) {
      const [x, y] = f.at(index); f.pointer('pointerdown', id, x, y);
    }
    for (const [id, index] of [[1, 0], [2, 3], [3, 6]]) {
      const [x, y] = f.at(index); f.pointer('pointermove', id, x + 100, y);
    }
    for (const [id, index] of [[1, 0], [2, 3], [3, 6]]) {
      const [x, y] = f.at(index); f.pointer('pointerup', id, x + 100, y);
    }
    expect(f.turns).toEqual(["D E U'"]); f.cleanup();
  });
  it('orbits the whole cube when the gesture starts outside its stickers', () => {
    const f = fixture(), before = f.camera.position.clone();
    f.pointer('pointerdown', 1, 20, 20); f.pointer('pointermove', 1, 90, 40); f.pointer('pointerup', 1, 90, 40);
    expect(f.camera.position.distanceTo(before)).toBeGreaterThan(.1);
    expect(f.turns).toEqual([]); f.cleanup();
  });
  it('cancels an interrupted gesture without a turn', () => {
    const f = fixture(), [x, y] = f.at(0);
    f.pointer('pointerdown', 1, x, y); f.pointer('pointermove', 1, x + 80, y); f.pointer('pointercancel', 1, x + 80, y);
    expect(f.turns).toEqual([]); expect(f.root.children.filter(c => c.userData.cubie)).toHaveLength(27); f.cleanup();
  });
});
