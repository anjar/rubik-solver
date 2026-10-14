import * as THREE from 'three';
import { sliceMove, stickerPose } from './cube';
import type { Face, Vec3 } from './cube';

type Axis = 'x' | 'y' | 'z';
type Turn = { axis: Axis; layer: number; screenAxis: THREE.Vector2 };
type Contact = { face: Face; index: number };
const AXES: Axis[] = ['x', 'y', 'z'];
export function inferDragTurn(face: Face, index: number, delta: THREE.Vector2, project: (point: Vec3) => THREE.Vector2, others: Contact[] = []): Turn | null {
  if (delta.length() < 8) return null;
  const pose = stickerPose(face, index);
  const point = new THREE.Vector3(...pose.position).addScaledVector(new THREE.Vector3(...pose.normal), 0.48);
  const origin = project(point.toArray() as Vec3);
  let best: Turn | null = null, score = 0;
  AXES.forEach((axis, i) => {
    if (pose.normal[i] || others.some(p => stickerPose(p.face, p.index).normal[i])) return;
    const vector = new THREE.Vector3(); vector[axis] = 1;
    const tangent = new THREE.Vector3().crossVectors(vector, point).multiplyScalar(0.2).add(point);
    const screenAxis = project(tangent.toArray() as Vec3).sub(origin);
    if (screenAxis.length() < 0.01) return;
    screenAxis.normalize();
    const alignment = Math.abs(screenAxis.dot(delta.clone().normalize()));
    if (alignment > score) { score = alignment; best = { axis, layer: pose.position[i], screenAxis }; }
  });
  return score >= 0.5 ? best : null;
}

export type SliceMotion = { pivot: THREE.Group; axis: Axis; from: number; to: number };
type Options = {
  element: HTMLCanvasElement; camera: THREE.PerspectiveCamera; root: THREE.Group;
  busy: () => boolean; onTurn: (move: string) => void;
  animate: (motions: SliceMotion[], done: () => void) => void;
};
// Fingers share a physical rotation axis, but each selected layer has its own
// signed angle. Opposing drags must never cancel through a shared centroid.
export function installCubeInteraction({ element, camera, root, busy, onTurn, animate }: Options): () => void {
  const pointers = new Map<number, THREE.Vector2>();
  const positions = new Map<number, THREE.Vector2>();
  const origins = new Map<number, THREE.Vector2>();
  const contacts = new Map<number, Contact>();
  let previous: THREE.Vector2 | null = null;
  let blocked = false, orbit = false, generation = 0;
  type Layer = { pivot: THREE.Group; angle: number; frozen: boolean };
  let drag: { axis: Axis; layers: Map<number, Layer>; directions: Map<number, { layer: number; screen: THREE.Vector2 }> } | null = null;
  const center = () => {
    const p = new THREE.Vector2(); pointers.forEach(v => p.add(v)); return p.divideScalar(pointers.size || 1);
  };
  const project = (point: Vec3) => {
    const rect = element.getBoundingClientRect();
    const p = new THREE.Vector3(...point).project(camera);
    return new THREE.Vector2(p.x * rect.width / 2, -p.y * rect.height / 2);
  };
  const restore = () => {
    if (!drag) return;
    for (const { pivot } of drag.layers.values()) {
      pivot.rotation[drag.axis] = 0; pivot.updateMatrixWorld(true);
      for (const cubie of [...pivot.children]) root.attach(cubie);
      root.remove(pivot);
    }
    drag = null;
  };
  const targetAngle = (angle: number) => Math.abs(angle) >= Math.PI / 12 ? Math.sign(angle) * Math.PI / 2 : 0;
  const updateAngles = () => {
    if (!drag) return;
    const distance = Math.max(element.getBoundingClientRect().width * 0.24, 55);
    for (const [number, layer] of drag.layers) {
      if (layer.frozen) continue;
      let sum = 0, count = 0;
      for (const [id, direction] of drag.directions) {
        if (direction.layer !== number) continue;
        sum += positions.get(id)!.clone().sub(origins.get(id)!).dot(direction.screen);
        count++;
      }
      layer.angle = THREE.MathUtils.clamp(sum / count / distance, -1, 1) * Math.PI / 2;
      layer.pivot.rotation[drag.axis] = layer.angle;
    }
  };
  const rotateCamera = (delta: THREE.Vector2) => {
    const up = camera.up.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0));
    const offset = camera.position.clone().applyQuaternion(q);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const speed = 2 * Math.PI / Math.max(element.getBoundingClientRect().height, 1);
    spherical.theta -= delta.x * speed;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi - delta.y * speed, 0.12, Math.PI - 0.12);
    camera.position.setFromSpherical(spherical).applyQuaternion(q.invert());
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  };
  const down = (event: PointerEvent) => {
    if (busy()) return;
    restore();
    for (const id of contacts.keys()) if (!pointers.has(id)) { contacts.delete(id); positions.delete(id); origins.delete(id); }
    const point = new THREE.Vector2(event.clientX, event.clientY);
    pointers.set(event.pointerId, point); positions.set(event.pointerId, point);
    try { element.setPointerCapture(event.pointerId); } catch { /* Synthetic events have no capture target. */ }
    const rect = element.getBoundingClientRect();
    root.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((point.x - rect.left) / rect.width * 2 - 1, -(point.y - rect.top) / rect.height * 2 + 1), camera);
    const hit = ray.intersectObjects(root.children, true)[0];
    const picked: Contact | null = hit?.object.userData.face ? { face: hit.object.userData.face, index: hit.object.userData.index } : null;
    if (picked) contacts.set(event.pointerId, picked);
    if (pointers.size === 1) { blocked = false; orbit = !picked || event.button === 2 || event.shiftKey; }
    else if (!orbit && !picked) blocked = true;
    pointers.forEach((point, id) => { origins.set(id, point.clone()); positions.set(id, point.clone()); });
    previous = center();
  };
  const move = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    const point = new THREE.Vector2(event.clientX, event.clientY);
    pointers.set(event.pointerId, point); positions.set(event.pointerId, point);
    if (orbit) {
      const current = center();
      if (previous) rotateCamera(current.clone().sub(previous));
      previous = current; return;
    }
    const picked = contacts.get(event.pointerId);
    if (blocked || !picked) return;
    if (!drag) {
      const others = [...contacts.entries()].filter(([id]) => id !== event.pointerId).map(([, contact]) => contact);
      const turn = inferDragTurn(picked.face, picked.index, point.clone().sub(origins.get(event.pointerId)!), project, others);
      if (!turn) return;
      const coordinate = AXES.indexOf(turn.axis);
      const layers = new Map<number, Layer>();
      const directions = new Map<number, { layer: number; screen: THREE.Vector2 }>();
      for (const [id, contact] of contacts) {
        const pose = stickerPose(contact.face, contact.index), layer = pose.position[coordinate];
        const origin = new THREE.Vector3(...pose.position).addScaledVector(new THREE.Vector3(...pose.normal), .48);
        const axis = new THREE.Vector3(); axis[turn.axis] = 1;
        const tangent = new THREE.Vector3().crossVectors(axis, origin).multiplyScalar(.2).add(origin);
        directions.set(id, { layer, screen: project(tangent.toArray() as Vec3).sub(project(origin.toArray() as Vec3)).normalize() });
        if (!layers.has(layer)) { const pivot = new THREE.Group(); root.add(pivot); layers.set(layer, { pivot, angle: 0, frozen: false }); }
      }
      for (const cubie of [...root.children]) {
        if (cubie.userData.cubie) layers.get(Math.round(cubie.position[turn.axis]))?.pivot.add(cubie);
      }
      drag = { axis: turn.axis, layers, directions };
    }
    updateAngles();
  };
  const up = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    positions.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    updateAngles(); pointers.delete(event.pointerId); previous = center();
    if (blocked || orbit) {
      if (!pointers.size) { positions.clear(); origins.clear(); contacts.clear(); }
      return;
    }
    if (drag && pointers.size) {
      for (const [number, layer] of drag.layers) {
        const held = [...drag.directions].some(([id, d]) => d.layer === number && pointers.has(id));
        if (!held) { layer.frozen = true; layer.angle = targetAngle(layer.angle); layer.pivot.rotation[drag.axis] = layer.angle; }
      }
      return;
    }
    if (drag) {
      const { axis, layers } = drag, token = generation;
      const sorted = [...layers].sort(([a], [b]) => a - b);
      const motions = sorted.map(([, layer]) => ({ pivot: layer.pivot, axis, from: layer.angle, to: targetAngle(layer.angle) }));
      const moves = sorted.filter(([, layer]) => targetAngle(layer.angle) !== 0).map(([number, layer]) => sliceMove(axis, number, targetAngle(layer.angle))).join(' ');
      animate(motions, () => {
        if (token !== generation) return;
        if (moves) { drag = null; onTurn(moves); }
        else restore();
      });
    }
    blocked = true;
  };
  const cancel = () => {
    generation++; restore(); pointers.clear(); positions.clear(); origins.clear(); contacts.clear(); previous = null; blocked = false;
  };
  const contextMenu = (event: Event) => event.preventDefault();
  element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up); element.addEventListener('pointercancel', cancel); element.addEventListener('contextmenu', contextMenu);
  return () => {
    element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', cancel);
    element.removeEventListener('contextmenu', contextMenu); cancel();
  };
}
