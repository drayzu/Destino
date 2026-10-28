import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';
import { cilindroPuntos } from './cilindro';

/**
 * An O'Neill cylinder (Island Three: 8 km across, 32 km long; O'Neill 1976), in kilometres, its
 * axis along local Y. Inside, three valleys of land alternate with three long windows; the whole
 * world turns once every ~2 minutes (√(g/R) for 1 g at 4 km), and that turn is its gravity, so the
 * land climbs up the sides and overhead. Outside, three mirrors hinged at the windows throw the
 * sunlight in. The air inside fades what is far into a pale haze.
 *
 * `giro` is the part that turns; the group's own orientation puts the axis towards the Sun.
 */

const R = 4;
const L = 32;
/** Turns per second for 1 g at 4 km: ω = √(g/R). */
export const OMEGA = Math.sqrt(9.81 / 4000);

export function cilindro() {
  const group = new THREE.Group();
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uCamL: { value: new THREE.Vector3(0, -40, 0) }, uDay: { value: 1 }, uTime: { value: 0 } };
  // The hull, the land, the caps and the petal mirrors, in points (cilindro.ts).
  const cuerpo = cilindroPuntos(giro);

  // Who lives here: lights of homes along the valleys, seen from inside as a scatter of points.
  const b = materiaBuilder(808);
  for (let i = 0; i < 9000; ) {
    const th = b.r() * Math.PI * 2;
    const sec = (((th + Math.PI) % (2.0943951)) + 2.0943951) % 2.0943951;
    if (sec / 2.0943951 >= 0.5) continue;
    const y = (b.r() - 0.5) * L * 0.96;
    const warm = b.r() < 0.6;
    b.push(Math.cos(th) * R * 0.998, y, Math.sin(th) * R * 0.998, warm ? new THREE.Color(1.0, 0.8, 0.55) : new THREE.Color(0.5, 1.0, 0.85), 0.012, 0.5);
    i++;
  }
  const casas = materia(b.data(), { pre: `uniform float uNight;`, move: `em *= uNight;`, uniforms: { uNight: { value: 0.3 } } });
  giro.add(casas.points);

  return {
    group,
    giro,
    uni,
    casas,
    R,
    L,
    /** Per frame: the camera in the cylinder's frame (km, the turning part), the ambient time, the focal length and pixel ratio. */
    update(camL: THREE.Vector3, time: number, night = 0.3, vista: { focal: number; dpr: number } = { focal: 1000, dpr: 1 }) {
      giro.rotation.y = time * OMEGA;
      uni.uCamL.value.copy(camL);
      cuerpo.update(camL, vista, time);
      uni.uTime.value = time;
      // The homes are points (they do not hide behind the hull): only seen from inside.
      const inside = Math.abs(camL.y) < L / 2 && Math.hypot(camL.x, camL.z) < R;
      casas.u.uNight.value = inside ? night : 0;
    },
  };
}
