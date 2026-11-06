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
const ye = new THREE.Vector3();

/**
 * `marco`: the frame the shot is written in (local → the act's units), for rides over a planet: its
 * «up» the ground's (marcoRadial), so «behind», «over» and the horizon are that ground's. None: the act's own.
 */
export function toma(tl: Timeline, p: number, chispa: THREE.Vector3 | null, out: PlanoCamara, marco?: THREE.Quaternion | null): PlanoCamara {
  const lw = chispa ? THREE.MathUtils.clamp(tl.get('lw', p), 0, 1) : 0;
  centro.set(tl.get('cx', p), tl.get('cy', p), tl.get('cz', p));
  if (chispa && lw > 0) centro.lerp(chispa, lw);
  const az = D(tl.get('az', p));
  const el = D(tl.get('el', p));
  const dist = Math.pow(10, tl.get('ld', p));
  r.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  if (marco) r.applyQuaternion(marco);
  ye.copy(Y);
  if (marco) ye.applyQuaternion(marco);
  out.pos.copy(centro).addScaledVector(r, dist);
  out.pos.x += tl.get('ox', p);
  out.pos.y += tl.get('oy', p);
  out.pos.z += tl.get('oz', p);
  // East and north there (round the centre's vertical); straight over or under the centre, east is
  // the shot's own, from its azimuth, so nothing spins.
  e.crossVectors(ye, r);
  const largoE = e.length();
  const polo = 1 - THREE.MathUtils.smoothstep(largoE, 0.02, 0.12);
  if (largoE > 1e-9) e.divideScalar(largoE);
  else e.set(0, 0, 0);
  if (polo > 0) {
    eje.set(Math.cos(az), 0, -Math.sin(az));
    if (marco) eje.applyQuaternion(marco);
    e.lerp(eje, polo);
  }
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
  const roll = tl.get('roll', p);
  // (as the old rig's: «up» turned round the gaze by `roll`)
  if (roll) out.quat.multiply(q.setFromAxisAngle(eje.set(0, 0, 1), D(-roll)));
  // Where what it looks at sits on the screen: the gaze turned the other way.
  const mx = tl.get('mx', p);
  const my = tl.get('my', p);
  if (mx) out.quat.multiply(q.setFromAxisAngle(eje.set(0, 1, 0), D(mx)));
  if (my) out.quat.multiply(q.setFromAxisAngle(eje.set(1, 0, 0), D(-my)));
  out.fov = tl.get('fov', p) || 40;
  out.dist = dist;
  out.lw = lw;
  return out;
}

/** Between two written shots (`w` 0..1): its place straight, its gaze turned evenly, its fov and distance. */
export function mezclar(a: PlanoCamara, b: PlanoCamara, w: number, out: PlanoCamara) {
  // (`out` may be `a` or `b`)
  const pos = a.pos.clone().lerp(b.pos, w);
  const quat = a.quat.clone().slerp(b.quat, w);
  const fov = a.fov + (b.fov - a.fov) * w;
  const dist = Math.pow(10, Math.log10(a.dist) + (Math.log10(b.dist) - Math.log10(a.dist)) * w);
  const lw = a.lw + (b.lw - a.lw) * w;
  out.pos.copy(pos);
  out.quat.copy(quat);
  out.fov = fov;
  out.dist = dist;
  out.lw = lw;
  return out;
}

type Valor = number | ((p: number) => number);

/**
 * The frame of a place on a world (local → the act's units): «up» out from the world's centre `c`
 * through `punto`, «north» towards the world's axis `eje`. For rides over a planet (`detras`).
 */
export function marcoRadial(punto: THREE.Vector3, c: THREE.Vector3, ejeMundo: THREE.Vector3, out = new THREE.Quaternion()) {
  const u = punto.clone().sub(c).normalize();
  const nn = ejeMundo.clone().addScaledVector(u, -ejeMundo.dot(u));
  if (nn.lengthSq() < 1e-12) nn.set(0, 0, 1).addScaledVector(u, -u.z);
  nn.normalize();
  const x = new THREE.Vector3().crossVectors(u, nn);
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, u, nn));
}

/**
 * Keys for a ride behind the spark (written, not chased): from p0 to p1, every `cada` beats, where the
 * camera stands round the spark: behind its heading (`rumbo(p, out)`, a direction: the way's own,
 * rounded over its corners) plus `fi` degrees (0: right behind), `el` degrees over its horizon and
 * 10^`ld` away. Over a planet, `marco(p)` is the frame of the place below (marcoRadial): «behind» and
 * «over» are that ground's, and the keys carry the roll that keeps that ground's horizon level. The
 * keys flow through each other, so the camera comes round each corner smoothly; it never turns on it.
 * Returns the last azimuth (to go on from).
 */
export function detras(
  tl: Timeline,
  rumbo: (p: number, out: THREE.Vector3) => THREE.Vector3,
  p0: number,
  p1: number,
  o: { cada?: number; fi?: Valor; el: Valor; ld: Valor; marco?: (p: number) => THREE.Quaternion; azDesde?: number },
) {
  const cada = o.cada ?? 0.6;
  const val = (x: Valor | undefined, p: number) => (typeof x === 'function' ? x(p) : (x ?? 0));
  const t = new THREE.Vector3();
  let ant = o.azDesde ?? NaN;
  const pasos = Math.max(1, Math.round((p1 - p0) / cada));
  for (let k = 0; k <= pasos; k++) {
    const p = p0 + ((p1 - p0) * k) / pasos;
    rumbo(p, t);
    if (o.marco) t.applyQuaternion(o.marco(p).clone().invert());
    let az = (Math.hypot(t.x, t.z) > 1e-12 ? THREE.MathUtils.radToDeg(Math.atan2(t.x, t.z)) : Number.isFinite(ant) ? ant - 180 : 0) + 180 + val(o.fi, p);
    if (Number.isFinite(ant)) az += 360 * Math.round((ant - az) / 360);
    ant = az;
    tl.keyAt(p, { az, el: val(o.el, p), ld: val(o.ld, p) });
  }
  return ant;
}

/**
 * Keys that move a shot from one frame to another (`marco` 0 → 1 over p0..p1, the act's `rad`
 * track) without the camera moving: every `cada` beats, the azimuth and elevation that keep the
 * direction it stands in (`az`, `el` in the first frame). The roll that turns the old «up» into the
 * new one comes with it, as a roll of the camera over those beats.
 */
export function aMarco(tl: Timeline, p0: number, p1: number, az: number, el: number, marco: (p: number) => THREE.Quaternion, cada = 0.1) {
  const rw = new THREE.Vector3(Math.cos(D(el)) * Math.sin(D(az)), Math.sin(D(el)), Math.cos(D(el)) * Math.cos(D(az)));
  const rl = new THREE.Vector3();
  const id = new THREE.Quaternion();
  let ant = az;
  const pasos = Math.max(1, Math.round((p1 - p0) / cada));
  for (let k = 0; k <= pasos; k++) {
    const p = p0 + ((p1 - p0) * k) / pasos;
    const w = THREE.MathUtils.smoothstep(p, p0, p1);
    const m = id.clone().slerp(marco(p), w);
    rl.copy(rw).applyQuaternion(m.invert());
    let a = THREE.MathUtils.radToDeg(Math.atan2(rl.x, rl.z));
    a += 360 * Math.round((ant - a) / 360);
    ant = a;
    tl.keyAt(p, { az: a, el: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(rl.y, -1, 1))), rad: w });
  }
  return ant;
}

/** The tracks a written stretch sets (see `escribir`). */
const PISTAS_TOMA = ['az', 'el', 'ld', 'lw', 'mx', 'my', 'fov', 'roll'] as const;

/**
 * A stretch of shot written as keys: rows of p, az, el, ld, lw, mx, my, fov, roll (from
 * `viaje.transcribir` and then edited by hand, or written by hand). Whatever keys those tracks had
 * inside the stretch give way to these. What it looks at between whiles stays the act's `cx…`.
 */
export function escribir(tl: Timeline, filas: readonly (readonly number[])[]) {
  // (rows of twelve also say what it looks at: cx, cy, cz)
  const pistas = filas[0].length > 9 ? [...PISTAS_TOMA, 'cx', 'cy', 'cz'] : PISTAS_TOMA;
  tl.quitar(pistas, filas[0][0], filas[filas.length - 1][0]);
  for (const f of filas) tl.keyAt(f[0], Object.fromEntries(pistas.map((k, j) => [k, f[j + 1]])));
}

/**
 * A flight, first person (DIRECCION.md): the camera on `camino` (a smooth curve with no corners, read
 * by its length) at the fraction the act's track `vu` says, looking ahead along it `adelante` of its
 * length, turned towards what it looks at (`cx…`) as much as `vm` (0..1), raised off the way by `vh`
 * (along «up»), leaning into its curves as a bird does (`alabeo` degrees at most), plus `roll`, and
 * `mx`, `my`, `fov` as in a shot. Its «up» is the world's (+Y) unless `arriba` is given.
 */
export function vuelo(tl: Timeline, p: number, camino: THREE.Curve<THREE.Vector3>, out: PlanoCamara, o: { adelante?: number; alabeo?: number; arriba?: THREE.Vector3; pista?: string } = {}) {
  const ade = o.adelante ?? 0.02;
  const u = THREE.MathUtils.clamp(tl.get(o.pista ?? 'vu', p), 0, 1);
  camino.getPointAt(u, out.pos);
  // Ahead: the way a little further on (at the end, the way's last direction).
  const u1 = Math.min(1, u + ade);
  const delante = u1 > u + 1e-6 ? camino.getPointAt(u1, dir).sub(out.pos) : camino.getTangentAt(u, dir);
  delante.normalize();
  const arribaW = (o.arriba ?? Y).clone();
  out.pos.addScaledVector(arribaW, tl.get('vh', p));
  // What it looks at, as much as `vm`.
  const vm = THREE.MathUtils.clamp(tl.get('vm', p), 0, 1);
  if (vm > 0) {
    centro.set(tl.get('cx', p), tl.get('cy', p), tl.get('cz', p)).sub(out.pos);
    if (centro.lengthSq() > 1e-24) {
      centro.normalize();
      const ang = delante.angleTo(centro);
      if (ang > 1e-6) {
        eje.crossVectors(delante, centro);
        if (eje.lengthSq() < 1e-12) eje.copy(arribaW);
        delante.applyAxisAngle(eje.normalize(), ang * vm);
      }
    }
  }
  // Leaning into the curve: how fast the way turns sideways here.
  const k = 0.01;
  const ta = camino.getTangentAt(Math.max(0, u - k), r);
  const tb = camino.getTangentAt(Math.min(1, u + k), h);
  const lado = up.crossVectors(delante, arribaW).normalize();
  const giro = tb.sub(ta).dot(lado) / (2 * k);
  const alabeo = (o.alabeo ?? 25) * Math.tanh(giro * 0.5);
  m.lookAt(cero, delante, arribaW);
  out.quat.setFromRotationMatrix(m);
  const roll = tl.get('roll', p) + alabeo;
  if (roll) out.quat.multiply(q.setFromAxisAngle(eje.set(0, 0, 1), D(-roll)));
  const mx = tl.get('mx', p);
  const my = tl.get('my', p);
  if (mx) out.quat.multiply(q.setFromAxisAngle(eje.set(0, 1, 0), D(mx)));
  if (my) out.quat.multiply(q.setFromAxisAngle(eje.set(1, 0, 0), D(-my)));
  out.fov = tl.get('fov', p) || 40;
  out.dist = Math.max(1e-30, camino.getLength() * ade);
  out.lw = 0;
  return out;
}
