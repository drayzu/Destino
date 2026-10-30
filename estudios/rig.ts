import * as THREE from 'three';
import type { Timeline } from './timeline';

/**
 * The remake's camera, as Tiempo's: written in tracks that flow through their keys (monotone
 * cubic), never in eased windows that stop at their edges. One parametrisation serves every shot:
 *
 * - Where it is: around a centre (`cx`, `cy`, `cz`), at azimuth `az` and elevation `el` (degrees)
 *   and distance 10^`ld`. Orbiting a planet and riding up a cable from it are the same three tracks.
 *   `ox`, `oy`, `oz` shift it by a fixed amount (to ride beside a cable instead of on it).
 * - Where it looks: in the frame of that place (out from the centre, east, north), `pitch` −90 looks
 *   straight at the centre, 0 at the horizon, +90 straight out; `yaw` turns the gaze round the
 *   outward axis (90 keeps north up while looking down). So a dive and a look up are one track.
 * - `roll` and `fov` (degrees).
 *
 * Distances move in logarithm, so a pull-back keeps its pace across scales.
 */

export const TRACKS_CAM = ['cx', 'cy', 'cz', 'az', 'el', 'ld', 'ox', 'oy', 'oz', 'yaw', 'pitch', 'roll', 'fov'] as const;
const D = THREE.MathUtils.degToRad;
const Y = new THREE.Vector3(0, 1, 0);

export interface Toma {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  up: THREE.Vector3;
  fov: number;
  /** The local frame there: out from the centre, east and north. */
  r: THREE.Vector3;
  e: THREE.Vector3;
  n: THREE.Vector3;
}

/**
 * The shot at beat p. `mira`: a point the gaze turns towards, as much as `peso` (0..1), for shots
 * that keep something moving in frame (a point on a cable below, a cargo ahead). `lugar`: a place
 * the camera is carried to, as much as `peso` (riding a stream the scene moves).
 */
export function toma(tl: Timeline, p: number, out?: Toma, mira?: { punto: THREE.Vector3; peso: number; arriba?: THREE.Vector3; delante?: THREE.Vector3 }, lugar?: { punto: THREE.Vector3; peso: number }): Toma {
  const o = out ?? { pos: new THREE.Vector3(), dir: new THREE.Vector3(), up: new THREE.Vector3(), fov: 40, r: new THREE.Vector3(), e: new THREE.Vector3(), n: new THREE.Vector3() };
  const az = D(tl.get('az', p));
  const el = D(tl.get('el', p));
  const d = Math.pow(10, tl.get('ld', p));
  o.r.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  o.pos.set(tl.get('cx', p) + tl.get('ox', p), tl.get('cy', p) + tl.get('oy', p), tl.get('cz', p) + tl.get('oz', p)).addScaledVector(o.r, d);
  const r0 = o.r.clone();
  const sitio = o.pos.clone();
  // A place the scene drives (riding a stream), as much as `peso`; the frame then follows that place.
  // On the way there (and back), the camera keeps what it looks at in sight: it turns round that
  // point and moves through its distance in logarithm, so a dive from afar onto the spark goes at
  // an even pace instead of rushing in at the end.
  if (lugar && lugar.peso > 0) {
    const w = Math.min(1, lugar.peso);
    if (mira && w < 1 && !girarHacia(o.pos, lugar.punto, mira.punto, w)) o.pos.lerp(lugar.punto, w);
    else if (!mira || w >= 1) o.pos.lerp(lugar.punto, w);
    // Its frame follows that place as far as the gaze is still the rig's own (all of it when no
    // point is looked at; none when the gaze turns to the point as much as the place moves): the
    // rig's look then stays the one it has where it stands, instead of spinning wherever the ride
    // passes close to its centre.
    const c = new THREE.Vector3(tl.get('cx', p), tl.get('cy', p), tl.get('cz', p));
    const sigue = mira ? THREE.MathUtils.clamp(w - mira.peso, 0, 1) : 1;
    const f = sitio.lerp(o.pos, sigue);
    o.r.set(f.x - c.x, f.y - c.y, f.z - c.z).addScaledVector(r0, d * 0.3).normalize();
  }
  // East and north of that place (round the centre's own vertical).
  o.e.crossVectors(Y, o.r);
  if (o.e.lengthSq() < 1e-10) o.e.set(1, 0, 0);
  o.e.normalize();
  o.n.crossVectors(o.r, o.e).normalize();
  const pitch = D(tl.get('pitch', p));
  const yaw = D(tl.get('yaw', p));
  const h = new THREE.Vector3().copy(o.e).multiplyScalar(Math.cos(yaw)).addScaledVector(o.n, Math.sin(yaw));
  o.dir.copy(h).multiplyScalar(Math.cos(pitch)).addScaledVector(o.r, Math.sin(pitch)).normalize();
  // Up: the gaze turned a quarter more upwards (never parallel to it), then the roll.
  o.up.copy(h).multiplyScalar(-Math.sin(pitch)).addScaledVector(o.r, Math.cos(pitch)).normalize();
  if (mira && mira.peso > 0) {
    // (a point the camera passes right through cannot be looked at: there the gaze lets go of it)
    const lejos = lugar ? lugar.punto.distanceTo(mira.punto) : 0;
    const cerca = lejos > 0 ? THREE.MathUtils.smoothstep(o.pos.distanceTo(mira.punto), 0.12 * lejos, 0.45 * lejos) : 1;
    const w = Math.min(1, mira.peso) * cerca;
    const hacia = mira.punto.clone().sub(o.pos).normalize();
    // The gaze turns towards the point at an even angular pace (a straight blend of two directions
    // far apart sweeps fastest in the middle).
    // («up» turns with it, so it stays well defined however far the gaze goes.)
    const ang = o.dir.angleTo(hacia);
    if (ang > 1e-7) {
      const eje = new THREE.Vector3().crossVectors(o.dir, hacia);
      if (eje.lengthSq() < 1e-12) eje.copy(o.up);
      eje.normalize();
      o.dir.applyAxisAngle(eje, ang * w).normalize();
      o.up.applyAxisAngle(eje, ang * w);
    }
    // Looking at a point, «up» leans to the scene's vertical (+Y), so the horizon stays level; less
    // so when the gaze is near the vertical itself (there «level» means nothing, and would spin).
    // A ride brings its own «up» (the way's, leaning ahead), which never fails: it takes over early.
    const ref = (mira.arriba ?? Y).clone();
    // (a ride looking steeply down takes «ahead» as its up, so it never spins there)
    if (mira.arriba && mira.delante) ref.addScaledVector(mira.delante, 0.8 * THREE.MathUtils.smoothstep(Math.abs(o.dir.dot(mira.arriba)), 0.6, 0.95));
    const nivel = mira.arriba ? w : w * (1 - THREE.MathUtils.smoothstep(Math.abs(o.dir.dot(Y)), 0.96, 0.999));
    o.up.addScaledVector(o.dir, -o.up.dot(o.dir));
    if (o.up.lengthSq() < 1e-8) o.up.copy(o.n);
    o.up.normalize();
    const yo = new THREE.Vector3().copy(ref).addScaledVector(o.dir, -o.dir.dot(ref));
    if (yo.lengthSq() > 1e-8) o.up.lerp(yo.normalize(), nivel);
    o.up.addScaledVector(o.dir, -o.up.dot(o.dir));
    if (o.up.lengthSq() < 1e-8) o.up.copy(o.n);
    o.up.normalize();
  }
  const roll = D(tl.get('roll', p));
  if (roll) o.up.applyAxisAngle(o.dir, roll);
  o.fov = tl.get('fov', p);
  return o;
}

/**
 * Moves `pos` a fraction `w` of the way to `hacia`, turning round `pivote` and through its distance
 * to it in logarithm. False (and `pos` untouched) where that has no meaning (either end on the pivot,
 * or the two exactly on opposite sides of it).
 */
function girarHacia(pos: THREE.Vector3, hacia: THREE.Vector3, pivote: THREE.Vector3, w: number) {
  const v0 = pos.clone().sub(pivote);
  const v1 = hacia.clone().sub(pivote);
  const l0 = v0.length();
  const l1 = v1.length();
  if (l0 < 1e-12 || l1 < 1e-12) return false;
  v0.divideScalar(l0);
  v1.divideScalar(l1);
  const ang = v0.angleTo(v1);
  if (ang > Math.PI - 1e-4) return false;
  if (ang > 1e-7) v0.applyAxisAngle(new THREE.Vector3().crossVectors(v0, v1).normalize(), ang * w);
  pos.copy(pivote).addScaledVector(v0, Math.exp(Math.log(l0) + (Math.log(l1) - Math.log(l0)) * w));
  return true;
}

/** Puts the camera where the shot says. */
export function aplicarToma(camera: THREE.PerspectiveCamera, t: Toma) {
  camera.position.copy(t.pos);
  camera.up.copy(t.up);
  camera.lookAt(t.pos.clone().add(t.dir));
  camera.fov = t.fov;
}

/** Azimuth and elevation (degrees) of a direction, as the rig reads them. */
export function angulos(v: THREE.Vector3) {
  const u = v.clone().normalize();
  return { az: THREE.MathUtils.radToDeg(Math.atan2(u.x, u.z)), el: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(u.y, -1, 1))) };
}
