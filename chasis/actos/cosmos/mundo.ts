import * as THREE from 'three';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const HOR = 0.8;
/** Round from where the camera comes in, the way the probe it rides goes out (the far side, a little on). */
export const AZ_LEJOS = 118;
export const OTRAS = [
  { c: V(1.15, 0.25, -0.5), col: new THREE.Color(1.0, 0.7, 0.32) },
  { c: V(-0.85, -0.4, 0.95), col: new THREE.Color(1.0, 0.45, 0.68) },
  { c: V(-0.4, 0.9, -1.0), col: new THREE.Color(0.78, 0.62, 1.0) },
];
