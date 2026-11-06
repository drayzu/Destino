import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from '../../../estudios/motor/materia';
import { gauss } from '../../../estudios/motor/math';
import { TEAL } from '../../../estudios/remake';
import { S, brazo } from '../apertura';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const Y = V(0, 1, 0);
export const D2R = THREE.MathUtils.degToRad;
export const G = V();
/** Where the ship is, a little way from the Sun. */
export const Q = S.clone().add(V(0.004, 0.0005, -0.003));
export const enDisco = (R: number, j: number, off: number) => {
  const th = brazo(R, j) + off;
  return V(Math.sin(th) * R, 0.03, Math.cos(th) * R);
};
export const ZOO = enDisco(30, 0, 0.5);
export const CALLAN = enDisco(36, 1, 0.42);
export const FILTRO = enDisco(42, 0, 0.62);
/** The single star past the edge. */
export const UNA = enDisco(57, 1, 0.55).add(V(0, 0.4, 0));
/** Where the camera stands round the living world when its star is right behind it. */
export const AZ_ALBA = 238;
/** How much the gaze goes with the spark as it flies from one encounter to the next. */
export const VIAJA = 0;

/** The living world's own seas and lands (not ours): deep ocean, green and ochre lands, ice at the poles. */
export const MUNDO_VIVO = /* glsl */ `
  float cv = fbm(n * 1.6 + vec3(3.1, 7.7, 1.3));
  float suelo = smoothstep(0.5, 0.53, cv);
  vec3 verde = mix(vec3(0.12, 0.26, 0.08), vec3(0.42, 0.34, 0.17), smoothstep(0.48, 0.72, fbm(n * 4.3 + 2.0)));
  float hielo = smoothstep(0.8, 0.9, abs(n.y) + 0.08 * fbm(n * 7.0));
  alb = mix(mix(vec3(0.025, 0.1, 0.27), verde, suelo), vec3(0.55, 0.58, 0.62), hielo);
  // (alive on its night side too, with no lights of anyone's: its seas faintly glowing, the land a
  // darker shape on them, and auroras round its poles; a black disc ringed in blue read as a hoop)
  extra += vec3(0.0, 0.018, 0.028) * (1.0 - suelo) * (1.0 - hielo) * (0.6 + 0.4 * fbm(n * 9.0 + 4.0));
  float aurora = smoothstep(0.8, 0.84, abs(n.y)) * (1.0 - smoothstep(0.86, 0.9, abs(n.y)));
  float cortina = smoothstep(0.35, 0.75, fbm(vec3(atan(n.z, n.x) * 5.0, n.y * 14.0, 1.7)));
  extra += vec3(0.04, 0.16, 0.1) * aurora * cortina;
`;

/** The probes that keep away: a still lattice round the living world, from three radii out (its units). */
export function vigiasDatos(): MateriaData {
  const b = materiaBuilder(213);
  const n = 2200;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i;
    const q = 3.1 + b.r() * 0.6;
    b.push(Math.cos(th) * rr * q, y * q, Math.sin(th) * rr * q, TEAL, 0.03, 1.3);
  }
  return b.data();
}

/** A globular cluster: a few thousand old stars, crowded to the middle (its own units, radius ~1). */
export function callanDatos(): MateriaData {
  const b = materiaBuilder(223);
  const c = new THREE.Color();
  for (let i = 0; i < 3200; i++) {
    const [x, y, z] = b.onSphere();
    const q = 0.08 + Math.pow(b.r(), 1.8) * 1.1;
    c.setRGB(1, 0.8, 0.58).lerp(new THREE.Color(0.78, 0.86, 1), b.r() * b.r());
    const brillo = 0.5 + 2.2 * Math.pow(b.r(), 6);
    b.push(x * q, y * q * 0.85, z * q, c, 0.006 + 0.01 * Math.pow(b.r(), 3), brillo);
  }
  return b.data();
}

/** A call: a sphere of teal that spreads from the spark (unit radius, scaled by the shader). */
export function llamadaDatos(): MateriaData {
  const b = materiaBuilder(225);
  for (let i = 0; i < 5000; i++) {
    const [x, y, z] = b.onSphere();
    b.push(x, y, z, TEAL, 0.004, 0.22);
  }
  return b.data();
}

/** A dim red star (its own units: radius 1): points, a glow round them. */
export function rojaDatos(): MateriaData {
  const b = materiaBuilder(227);
  const r = b.r;
  for (let i = 0; i < 14000; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.pow(r(), 0.25);
    b.push(x * q, y * q, z * q, new THREE.Color(1.0, 0.2, 0.07), 0.03, 0.045);
  }
  for (let i = 0; i < 2000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 1 + r() * r() * 1.6;
    b.push(x * q, y * q, z * q, new THREE.Color(0.8, 0.16, 0.06), 0.1, 0.012);
  }
  return b.data();
}

/**
 * A dead swarm: collectors, square and ash-grey, on a broken shell round the red star, tumbling
 * (they catch its light now and then); some adrift, out of the shell (its own units).
 */
export function muertosDatos(): MateriaData {
  const b = materiaBuilder(229);
  const r = b.r;
  for (let i = 0; i < 52000; i++) {
    const [x, y, z] = b.onSphere();
    const roto = Math.sin(x * 5 + y * 3) * Math.sin(z * 4) > 0.2;
    if (roto && r() < 0.88) continue;
    const suelto = r() < 0.06;
    const q = suelto ? 3.3 + r() * 2.8 : 3.2 + gauss(r) * 0.06;
    const g = 0.22 + r() * 0.16;
    b.push(x * q, y * q, z * q, new THREE.Color(g * 1.1, g, g * 0.92), suelto ? 0.014 + r() * 0.03 : 0.012, 0.09 + r() * 0.07, { kind: suelto ? 1 : 0 });
  }
  return b.data();
}
