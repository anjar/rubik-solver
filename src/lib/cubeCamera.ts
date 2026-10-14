import * as THREE from 'three';

// A sphere encloses the cube even halfway through a layer turn. Fit it to
// the narrower field of view, leaving room to orbit from outside the cube.
export function fitCubeCamera(camera: THREE.PerspectiveCamera, width: number, height: number, target: THREE.Vector3): number {
  camera.aspect = width / height;
  const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  const paddedAngle = Math.atan(Math.tan(Math.min(vertical, horizontal)) * 0.84);
  const distance = 2.6 / Math.sin(paddedAngle);
  camera.position.sub(target).setLength(distance).add(target);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return distance;
}
