import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RotateCcw } from 'lucide-react';
import { COLORS, FACES, moveRotation, stickerPose } from '../lib/cube';
import { installCubeInteraction } from '../lib/cubeInteraction';
import type { SliceMotion } from '../lib/cubeInteraction';
import { fitCubeCamera } from '../lib/cubeCamera';
import type { Face, Sticker } from '../lib/cube';

type Props = { facelets: string; move?: string; replay?: number; onComplete?: () => void; compact?: boolean; editFace?: Face; onStickerClick?: (index: number) => void; simulator?: boolean; onTurn?: (move: string) => void };
type SceneHandle = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; root: THREE.Group; animation: { pivot: THREE.Group; axis: 'x' | 'y' | 'z'; angle: number; start: number; finished: boolean; from?: number; duration?: number; done?: () => void; motions?: SliceMotion[] } | null };
const PLASTIC = '#25322e';

export function CubeView({ facelets, move, replay = 0, onComplete, compact = false, editFace, onStickerClick, simulator = false, onTurn }: Props) {
  const host = useRef<HTMLDivElement>(null), handle = useRef<SceneHandle | null>(null);
  const completed = useRef(onComplete);
  completed.current = onComplete;
  const editing = useRef({ face: editFace, click: onStickerClick, simulator, turn: onTurn });
  editing.current = { face: editFace, click: onStickerClick, simulator, turn: onTurn };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Model Rubik 3D. Geser untuk melihat sisi lain.');
    renderer.domElement.setAttribute('role', 'img');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(5.4, 4.2, 6.8);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI - 0.15;
    controls.rotateSpeed = 0.65;
    controls.saveState();
    scene.add(new THREE.AmbientLight(0xffffff, 2.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 8, 5);
    scene.add(key);
    const root = new THREE.Group();
    scene.add(root);
    handle.current = { scene, camera, controls, root, animation: null };
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height);
      const currentControls = handle.current!.controls;
      const distance = fitCubeCamera(camera, width, height, currentControls.target);
      // Reset should restore the reference angle at the fitted distance,
      // rather than bringing the old, cropped fullscreen zoom back.
      currentControls.position0.sub(currentControls.target0).setLength(distance).add(currentControls.target0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    let frame = 0;
    const render = (time: number) => {
      const a = handle.current?.animation;
      if (a && !a.finished) {
        const t = Math.max(0, Math.min((time - a.start) / (a.duration ?? 1400), 1));
        const motions = a.motions ?? [{ pivot: a.pivot, axis: a.axis, from: a.from ?? 0, to: a.angle }];
        for (const motion of motions) motion.pivot.rotation[motion.axis] = motion.from + (motion.to - motion.from) * (t * t * (3 - 2 * t));
        if (t >= 1) { a.finished = true; if (a.done) a.done(); else completed.current?.(); }
      }
      handle.current?.controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    const contextLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    let pointer: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { if (!editing.current.simulator) pointer = { x: e.clientX, y: e.clientY }; };
    const up = (e: PointerEvent) => {
      const start = pointer; pointer = null;
      if (editing.current.simulator || !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5 || !editing.current.face) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = ray.intersectObjects(root.children, true)[0];
      if (hit?.object.userData.face === editing.current.face && hit.object.userData.index !== 4) editing.current.click?.(hit.object.userData.index);
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      handle.current?.controls.dispose();
      disposeGroup(root);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.dispose();
      renderer.domElement.remove();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    const h = handle.current;
    if (!h) return;
    h.controls.enabled = !simulator;
    if (!simulator) return;
    return installCubeInteraction({
      element: host.current!.querySelector('canvas')!, camera: h.camera, root: h.root,
      busy: () => !!h.animation && !h.animation.finished,
      onTurn: turn => editing.current.turn?.(turn),
      animate: (motions, done) => {
        const first = motions[0];
        h.animation = { pivot: first.pivot, axis: first.axis, from: first.from, angle: first.to, motions, duration: 220, start: performance.now(), finished: false, done };
      },
    });
  }, [simulator, facelets]);

  useEffect(() => {
    const h = handle.current;
    if (!h || !editFace) return;
    const normal = new THREE.Vector3(...stickerPose(editFace, 4).normal);
    const up = new THREE.Vector3(...stickerPose(editFace, 1).position).sub(new THREE.Vector3(...stickerPose(editFace, 4).position)).normalize();
    const right = new THREE.Vector3().crossVectors(up, normal);
    h.camera.up.copy(up);
    h.camera.position.copy(normal.multiplyScalar(8)).addScaledVector(up, 1.6).addScaledVector(right, 1.6);
    const element = h.controls.domElement!;
    h.controls.dispose();
    h.controls = new OrbitControls(h.camera, element);
    h.controls.enableDamping = true;
    h.controls.enablePan = false;
    h.controls.enableZoom = false;
    h.controls.rotateSpeed = 0.65;
    const { width, height } = host.current!.getBoundingClientRect();
    if (width > 0 && height > 0) fitCubeCamera(h.camera, width, height, h.controls.target);
    h.controls.update();
    h.controls.saveState();
  }, [editFace]);

  useEffect(() => {
    const h = handle.current;
    if (!h) return;
    h.animation = null;
    disposeGroup(h.root);
    h.root.clear();
    const cubies = new Map<string, THREE.Group>();
    const box = new RoundedBoxGeometry(0.94, 0.94, 0.94, 2, 0.07);
    const sticker = new RoundedBoxGeometry(0.79, 0.79, 0.018, 2, 0.055);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: PLASTIC, roughness: 0.7 });
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if (!x && !y && !z) continue;
      const cubie = new THREE.Group();
      cubie.position.set(x, y, z);
      cubie.userData.cubie = true;
      cubie.add(new THREE.Mesh(box, bodyMaterial));
      cubies.set(`${x},${y},${z}`, cubie);
      h.root.add(cubie);
    }
    FACES.forEach((face, fi) => {
      for (let index = 0; index < 9; index++) {
        const { position, normal } = stickerPose(face, index);
        const color = (facelets[fi * 9 + index] || '?') as Sticker;
        const material = new THREE.MeshStandardMaterial({ color: COLORS[color]?.hex ?? COLORS['?'].hex, roughness: 0.48 });
        const tile = new THREE.Mesh(sticker, material);
        tile.userData = { face, index };
        tile.position.set(...normal).multiplyScalar(0.478);
        tile.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal));
        cubies.get(position.join(','))!.add(tile);
      }
    });
    if (move) {
      const rotation = moveRotation(move);
      const pivot = new THREE.Group();
      h.root.add(pivot);
      cubies.forEach(cubie => {
        if (cubie.position[rotation.axis] === rotation.layer) {
          pivot.add(cubie);
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box, 30), new THREE.LineBasicMaterial({ color: '#729886', transparent: true, opacity: 0.65 }));
          cubie.add(edges);
        }
      });
      h.animation = { pivot, axis: rotation.axis, angle: rotation.angle, start: performance.now() + 450, finished: false };
    }
  }, [facelets, move, replay]);

  return <div className={`cube-scene ${compact ? 'compact' : ''} ${simulator ? 'simulator' : ''}`}>
    <div className="cube-canvas" ref={host} />
    {failed ? <div className="cube-fallback" role="alert">{editFace ? 'Tampilan 3D tidak tersedia. Kamu bisa memakai “Isi lewat grid 2D” di bawah.' : 'Tampilan 3D tidak tersedia. Aktifkan akselerasi grafis atau buka di browser lain sebelum mengikuti panduan.'}</div> : <>
      <span className="cube-hint">{simulator ? 'Tarik kotak: putar baris · Tarik luar: putar Rubik' : editFace ? 'Ketuk kotak untuk mengisi · Geser untuk melihat' : 'Geser untuk melihat sisi lain'}</span>
      <button className="cube-reset" type="button" onClick={() => handle.current?.controls.reset()} aria-label="Kembalikan tampilan" title="Kembalikan tampilan"><RotateCcw size={16} /></button>
    </>}
  </div>;
}
function disposeGroup(root: THREE.Group) {
  root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose();
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
  });
}
