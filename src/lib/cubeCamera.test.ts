import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitCubeCamera } from './cubeCamera';

describe('cube framing across fullscreen and inline viewports', () => {
  for (const [width, height] of [[320, 900], [375, 750], [393, 650], [900, 320], [500, 354]]) {
    it(`keeps the whole cube and partial turns inside ${width}×${height}`, () => {
      const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
      for (const direction of [[5.4, 4.2, 6.8], [0, 0, 1], [0, 0, -1], [.1, 1, .1], [1, -1, 1]]) {
        camera.position.set(...direction as [number, number, number]);
        fitCubeCamera(camera, width, height, new THREE.Vector3());
        for (const axis of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]) {
          for (const angle of [0, Math.PI / 4, -Math.PI / 4]) {
            for (const x of [-1.48, 1.48]) for (const y of [-1.48, 1.48]) for (const z of [-1.48, 1.48]) {
              const projected = new THREE.Vector3(x, y, z).applyAxisAngle(axis, angle).project(camera);
              expect(Math.abs(projected.x)).toBeLessThanOrEqual(.84);
              expect(Math.abs(projected.y)).toBeLessThanOrEqual(.84);
              expect(projected.z).toBeGreaterThan(-1); expect(projected.z).toBeLessThan(1);
            }
          }
        }
      }
    });
  }
  it('preserves the current viewing direction when entering and leaving fullscreen', () => {
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
    camera.position.set(5.4, 4.2, 6.8);
    const direction = camera.position.clone().normalize();
    const inline = fitCubeCamera(camera, 500, 354, new THREE.Vector3());
    const fullscreen = fitCubeCamera(camera, 375, 750, new THREE.Vector3());
    expect(fullscreen).toBeGreaterThan(inline);
    expect(camera.position.clone().normalize().distanceTo(direction)).toBeLessThan(1e-12);
    fitCubeCamera(camera, 500, 354, new THREE.Vector3());
    expect(camera.position.length()).toBeCloseTo(inline);
  });
});
