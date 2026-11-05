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
 *   distance 10^`ld`, so a pull-back keeps its pace across scales; shifted by `ox`, `oy`, `oz`.
 * - Where it looks from there, in the frame of that place (out from the centre, east, north): `pitch`
 *   −90 (the default) straight at the centre, 0 at the horizon; `yaw` turns the gaze round the outward
 *   axis (90, the default, keeps north up). Standing on a world and looking at its horizon is one shot.
 * - Where that sits on the screen: `mx`, `my` (degrees right and up of the middle), and `roll`, `fov`.
 *
 * Looking at the centre, «up» is the world's (+Y): the horizon stays level, and nothing spins.
 */
export const TRACKS_TOMA = ['cx', 'cy', 'cz', 'az', 'el', 'ld', 'lw', 'ox', 'oy', 'oz', 'yaw', 'pitch', 'mx', 'my', 'roll', 'fov'] as const;

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
const e = new THREE.Vector3();
const n = new THREE.Vector3();
const h = new THREE.Vector3();
const dir = new THREE.Vector3();
const up = new THREE.Vector3();
const cero = new THREE.Vector3();
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const eje = new THREE.Vector3();

export function toma(tl: Timeline, p: number, chispa: THREE.Vector3 | null, out: PlanoCamara): PlanoCamara {
  const lw = chispa ? THREE.MathUtils.clamp(tl.get('lw', p), 0, 1) : 0;
  centro.set(tl.get('cx', p), tl.get('cy', p), tl.get('cz', p));
  if (chispa && lw > 0) centro.lerp(chispa, lw);
  const az = D(tl.get('az', p));
  const el = D(tl.get('el', p));
  const dist = Math.pow(10, tl.get('ld', p));
  r.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  out.pos.copy(centro).addScaledVector(r, dist);
  out.pos.x += tl.get('ox', p);
  out.pos.y += tl.get('oy', p);
  out.pos.z += tl.get('oz', p);
  // East and north there (round the centre's vertical); straight over or under the centre, east is
  // the shot's own, from its azimuth, so nothing spins.
  e.crossVectors(Y, r);
  const largoE = e.length();
  const polo = 1 - THREE.MathUtils.smoothstep(largoE, 0.02, 0.12);
  if (largoE > 1e-9) e.divideScalar(largoE);
  else e.set(0, 0, 0);
  if (polo > 0) e.lerp(eje.set(Math.cos(az), 0, -Math.sin(az)), polo);
  if (e.lengthSq() < 1e-10) e.set(1, 0, 0);
  e.normalize();
  n.crossVectors(r, e).normalize();
  const pitch = D(tl.has('pitch') ? tl.get('pitch', p) : -90);
  const yaw = D(tl.has('yaw') ? tl.get('yaw', p) : 90);
  h.copy(e).multiplyScalar(Math.cos(yaw)).addScaledVector(n, Math.sin(yaw));
  dir.copy(h).multiplyScalar(Math.cos(pitch)).addScaledVector(r, Math.sin(pitch)).normalize();
  up.copy(h).multiplyScalar(-Math.sin(pitch)).addScaledVector(r, Math.cos(pitch)).normalize();
  // (a camera's matrix looks down its −Z: from the origin towards `dir`)
  m.lookAt(cero, dir, up);
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

type Valor = number | ((p: number) => number);

/**
 * Keys for a ride behind the spark (written, not chased): from p0 to p1, every `cada` beats, the
 * camera's azimuth from the way's heading there plus `fi` (0: right behind), its elevation `el` and
 * distance `ld`. The heading is the way's over ±`suave` beats, so a corner is rounded, and the keys
 * flow through each other: the camera comes round smoothly, it never turns on the corner itself.
 * `chispa(p, out)` is where the spark is at beat p (the act's own). Returns the last azimuth.
 */
export function detras(tl: Timeline, chispa: (p: number, out: THREE.Vector3) => unknown, p0: number, p1: number, o: { cada?: number; suave?: number; fi?: Valor; el: Valor; ld: Valor; azDesde?: number }) {
  const cada = o.cada ?? 0.6;
  const suave = o.suave ?? 0.5;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const val = (x: Valor | undefined, p: number) => (typeof x === 'function' ? x(p) : (x ?? 0));
  let ant = o.azDesde ?? NaN;
  const pasos = Math.max(1, Math.round((p1 - p0) / cada));
  for (let k = 0; k <= pasos; k++) {
    const p = p0 + ((p1 - p0) * k) / pasos;
    chispa(p + suave, a);
    chispa(p - suave, b);
    a.sub(b);
    let az: number;
    if (Math.hypot(a.x, a.z) <= 1e-9 * a.length() || a.lengthSq() === 0) az = Number.isFinite(ant) ? ant : 0;
    else az = THREE.MathUtils.radToDeg(Math.atan2(a.x, a.z)) + 180 + val(o.fi, p);
    if (Number.isFinite(ant)) az += 360 * Math.round((ant - az) / 360);
    ant = az;
    tl.keyAt(p, { az, el: val(o.el, p), ld: val(o.ld, p) });
  }
  return ant;
}
