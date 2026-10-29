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
export function toma(tl: Timeline, p: number, out?: Toma, mira?: { punto: THREE.Vector3; peso: number }, lugar?: { punto: THREE.Vector3; peso: number }): Toma {
  const o = out ?? { pos: new THREE.Vector3(), dir: new THREE.Vector3(), up: new THREE.Vector3(), fov: 40, r: new THREE.Vector3(), e: new THREE.Vector3(), n: new THREE.Vector3() };
  const az = D(tl.get('az', p));
  const el = D(tl.get('el', p));
  const d = Math.pow(10, tl.get('ld', p));
  o.r.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  o.pos.set(tl.get('cx', p) + tl.get('ox', p), tl.get('cy', p) + tl.get('oy', p), tl.get('cz', p) + tl.get('oz', p)).addScaledVector(o.r, d);
  // A place the scene drives (riding a stream), as much as `peso`; the frame then follows that place.
  if (lugar && lugar.peso > 0) {
    o.pos.lerp(lugar.punto, Math.min(1, lugar.peso));
    o.r.set(o.pos.x - tl.get('cx', p), o.pos.y - tl.get('cy', p), o.pos.z - tl.get('cz', p)).normalize();
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
    const hacia = mira.punto.clone().sub(o.pos).normalize();
    o.dir.lerp(hacia, Math.min(1, mira.peso)).normalize();
    // Looking at a point, «up» leans to the scene's vertical (+Y), so the horizon stays level.
    o.up.lerp(Y, Math.min(1, mira.peso));
    o.up.addScaledVector(o.dir, -o.up.dot(o.dir));
    if (o.up.lengthSq() < 1e-8) o.up.copy(o.n);
    o.up.normalize();
  }
  const roll = D(tl.get('roll', p));
  if (roll) o.up.applyAxisAngle(o.dir, roll);
  o.fov = tl.get('fov', p);
  return o;
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
