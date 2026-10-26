import * as THREE from 'three';
import { lerp } from './math';

/**
 * Where the camera is and what it looks at, in world units (AU, the Sun at the origin), in double
 * precision. The journey goes from a few kilometres to the whole galaxy and beyond, so the world is
 * never drawn at its own scale: the camera sits at the origin and the world is moved and scaled
 * around it so that what it looks at is one unit away (the pivot). Every matrix is composed in
 * JavaScript doubles before reaching the GPU, so a planet near the camera stays exact while the
 * galaxy is still in the same scene.
 */
export interface Vista {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  fov: number;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** A view from distance `d` at azimuth `az` and elevation `el` around a target. */
export function orbita(target: THREE.Vector3, d: number, az: number, el: number, fov = 42, up = UP): Vista {
  return {
    pos: target.clone().add(V(Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d)),
    target: target.clone(),
    up: up.clone(),
    fov,
  };
}

/** Between two views: the target moves straight, the distance in logarithm (a dive keeps its pace across scales). */
export function mezcla(a: Vista, b: Vista, t: number): Vista {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ta = a.target.clone().lerp(b.target, t);
  const da = a.pos.clone().sub(a.target);
  const db = b.pos.clone().sub(b.target);
  const la = da.length();
  const lb = db.length();
  const dir = da.divideScalar(la || 1).lerp(db.divideScalar(lb || 1), t);
  if (dir.lengthSq() < 1e-12) dir.copy(db);
  dir.normalize();
  const d = Math.exp(lerp(Math.log(Math.max(la, 1e-300)), Math.log(Math.max(lb, 1e-300)), t));
  return { pos: ta.clone().addScaledVector(dir, d), target: ta, up: a.up.clone().lerp(b.up, t).normalize(), fov: lerp(a.fov, b.fov, t) };
}

const tmp = V();
/**
 * Puts the camera at the origin looking where the view says, and moves and scales the world (its
 * root group) so that the target is one unit away. Returns the scale (scene units per world unit).
 */
export function aplicar(root: THREE.Object3D, camera: THREE.PerspectiveCamera, v: Vista) {
  const d = Math.max(v.pos.distanceTo(v.target), 1e-300);
  const k = 1 / d;
  root.scale.setScalar(k);
  root.position.copy(v.pos).multiplyScalar(-k);
  root.updateMatrixWorld(true);
  camera.position.set(0, 0, 0);
  camera.up.copy(v.up);
  camera.lookAt(tmp.copy(v.target).sub(v.pos).multiplyScalar(k));
  camera.fov = v.fov;
  camera.near = 1e-4;
  camera.far = 1e30;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return k;
}

/** A world point on the screen (device pixels), or null if it is behind the camera. */
export function proyectarMundo(w: THREE.Vector3, v: Vista, k: number, camera: THREE.Camera, W: number, H: number, out = { x: 0, y: 0 }) {
  tmp.copy(w).sub(v.pos).multiplyScalar(k).project(camera);
  if (tmp.z >= 1) return null;
  out.x = ((tmp.x + 1) / 2) * W;
  out.y = ((1 - tmp.y) / 2) * H;
  return out;
}
