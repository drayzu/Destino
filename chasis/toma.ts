import * as THREE from 'three';
import type { Timeline } from '../estudios/timeline';
import type { PlanoCamara } from './tipos';

/**
 * A shot, written as Tiempo's (CHASIS.md): the camera round what it looks at. One parametrisation,
 * a handful of tracks of the act's own timeline, nothing else:
 *
 * - What it looks at: a point (`cx`, `cy`, `cz`), or the spark, as much as `lw` (0..1). Looking at the
 *   spark, the spark is in the frame by construction: the camera and the spark are one shot.
 * - Where it stands round that: azimuth `az` and elevation `el` (degrees; keep |el| under ~80) and
 *   distance 10^`ld`, so a pull-back keeps its pace across scales.
 * - Where that sits on the screen: `mx`, `my` (degrees right and up of the middle), and `roll`, `fov`.
 *
 * Its «up» is the world's (+Y): the horizon stays level, and nothing spins.
 */
export const TRACKS_TOMA = ['cx', 'cy', 'cz', 'az', 'el', 'ld', 'lw', 'mx', 'my', 'roll', 'fov'] as const;

/**
 * The contract at a seam through the frame (`costura: 'cuadro'`, CHASIS.md): an act's first and last
 * picture have the spark this many degrees right and up of the middle, with this lens. An act that
 * keeps it can go after or before any other that does.
 */
export const CONTRATO = { mx: 0, my: -1, fov: 40 };

const D = THREE.MathUtils.degToRad;
const Y = new THREE.Vector3(0, 1, 0);
const centro = new THREE.Vector3();
const r = new THREE.Vector3();
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const eje = new THREE.Vector3();
const arriba = new THREE.Vector3();

export function toma(tl: Timeline, p: number, chispa: THREE.Vector3 | null, out: PlanoCamara): PlanoCamara {
  const lw = chispa ? THREE.MathUtils.clamp(tl.get('lw', p), 0, 1) : 0;
  centro.set(tl.get('cx', p), tl.get('cy', p), tl.get('cz', p));
  if (chispa && lw > 0) centro.lerp(chispa, lw);
  const az = D(tl.get('az', p));
  const el = D(tl.get('el', p));
  const dist = Math.pow(10, tl.get('ld', p));
  r.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  out.pos.copy(centro).addScaledVector(r, dist);
  // (straight up or down, «up» leans to the side the shot comes from, so it never spins)
  const polo = THREE.MathUtils.smoothstep(Math.abs(el), D(78), D(89));
  arriba.copy(Y).lerp(eje.set(-Math.sin(az), 0, -Math.cos(az)).multiplyScalar(Math.sign(el)), polo).normalize();
  m.lookAt(out.pos, centro, arriba);
  out.quat.setFromRotationMatrix(m);
  // Where what it looks at sits on the screen: the gaze turned the other way.
  const mx = tl.get('mx', p);
  const my = tl.get('my', p);
  if (mx) out.quat.multiply(q.setFromAxisAngle(eje.set(0, 1, 0), D(mx)));
  if (my) out.quat.multiply(q.setFromAxisAngle(eje.set(1, 0, 0), D(-my)));
  const roll = tl.get('roll', p);
  if (roll) out.quat.multiply(q.setFromAxisAngle(eje.set(0, 0, 1), D(roll)));
  out.fov = tl.get('fov', p) || 40;
  out.dist = dist;
  out.lw = lw;
  return out;
}
