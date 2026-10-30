import * as THREE from 'three';
import { materia, materiaBuilder, type Nube } from './motor/materia';
import { grupo, sup, type Cuenta } from './placa';

/** What the remake's studies share: the work's colour, the power clock, and pieces of GLSL. */

/** Ours: the teal of the civilization and of «tú». */
export const TEAL = new THREE.Color(0.44, 0.89, 0.76);
export const TEAL_HEX = '#6fe3c1';

const COMA = (x: number, d = 2) => x.toFixed(d).replace('.', ',');

/** The clock: the power as a power of ten in watts, and its Kardashev type (Sagan) on the line below. */
export function potencia(lp: number, antes = '', a = 1): Cuenta {
  const k = (lp - 6) / 10;
  return { pisos: ['10', String(Math.floor(lp))], unidad: 'W', linea: `${antes}tipo ${COMA(Math.max(0, k))}`, h: 1, a };
}

/**
 * The estimated year, as the clock writes it: «año 2026», «año 22 000», «año 3 millones», «año
 * −3 800 millones», «año 10¹⁴». Two significant figures past ten thousand.
 */
export function textoAnio(y: number) {
  const neg = y < 0;
  const a = Math.abs(y);
  let s: string;
  if (a < 1e4) s = String(Math.round(a));
  else if (a >= 1e12) s = `10${sup(Math.floor(Math.log10(a) + 1e-9))}`;
  else {
    const e = Math.floor(Math.log10(a));
    const v = Math.round(a / 10 ** (e - 1)) * 10 ** (e - 1);
    if (v < 1e6) s = grupo(v);
    else if (v < 1.5e6) s = '1 millón';
    else s = `${grupo(Math.round(v / 1e6))} millones`;
  }
  return `año ${neg ? '−' : ''}${s}`;
}

/**
 * The year at beat p, between anchors [beat, year] (in order). It moves in logarithm: of the years
 * before now in the past, of the years after now in the future (so the ages go by at an even pace,
 * from thousands of millions of years ago to today, or from today to 10¹⁰⁰).
 */
export function anioEn(p: number, anclas: [number, number][]) {
  const v = (y: number) => (y <= 2026 ? -Math.log10(2027 - y) : Math.log10(y - 2025));
  const y = (x: number) => (x <= 0 ? 2027 - Math.pow(10, -x) : 2025 + Math.pow(10, x));
  if (p <= anclas[0][0]) return anclas[0][1];
  for (let i = 0; i < anclas.length - 1; i++) {
    const [p0, y0] = anclas[i];
    const [p1, y1] = anclas[i + 1];
    if (p <= p1) {
      const k = p1 > p0 ? (p - p0) / (p1 - p0) : 1;
      const s = k * k * (3 - 2 * k);
      return y(v(y0) + (v(y1) - v(y0)) * s);
    }
  }
  return anclas[anclas.length - 1][1];
}

/** GLSL: Matplotlib's «inferno», for anything seen by its heat (Zucker's polynomial fit). */
export const INFERNO = /* glsl */ `
  vec3 inferno(float t) {
    t = clamp(t, 0.0, 1.0);
    const vec3 c0 = vec3(0.0002189403691192265, 0.001651004631001012, -0.01948089843709184);
    const vec3 c1 = vec3(0.1065134194856116, 0.5639564367884091, 3.932712388889277);
    const vec3 c2 = vec3(11.60249308247187, -3.972853965665698, -15.9423941062914);
    const vec3 c3 = vec3(-41.70399613139459, 17.43639888205313, 44.35414519872813);
    const vec3 c4 = vec3(77.162935699427, -33.40235894210092, -81.80730925738993);
    const vec3 c5 = vec3(-71.31942824499214, 32.62606426397723, 73.20951985803202);
    const vec3 c6 = vec3(25.13112622477341, -12.24266895238567, -23.07032500287172);
    return max(c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6))))), vec3(0.0));
  }
`;

/**
 * GLSL: how much of a point on a sphere (radius ~1, its own frame) faces the camera `camL` (same
 * frame): 0 on the far side, 1 on the near side, soft across the limb.
 */
export const HORIZONTE = /* glsl */ `
  float delante(vec3 p, vec3 camL) {
    vec3 n = normalize(p);
    return smoothstep(-0.015, 0.03, dot(n, normalize(camL - p)));
  }
`;

/** A point on the unit sphere from latitude and longitude in degrees (the library's frame: lon 0 at +X, east to −Z). */
export function dirLatLon(lat: number, lon: number, out = new THREE.Vector3()) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return out.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

/** The turn that brings latitude `lat`, longitude `lon` to face +Z with north up. */
export function caraHacia(lat: number, lon: number) {
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2 - THREE.MathUtils.degToRad(lon));
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(lat));
  return qx.multiply(qy);
}

/** «Tú»: a teal point that breathes, a few pixels across with a soft halo, at `pos` (its parent's units). */
export function puntoTu(pos: THREE.Vector3, size: number): Nube {
  const b = materiaBuilder(3);
  b.push(pos.x, pos.y, pos.z, TEAL, size, 2.2);
  for (let i = 0; i < 40; i++) {
    const [x, y, z] = b.onSphere();
    const r = size * 0.9 * Math.sqrt(b.r());
    b.push(pos.x + x * r, pos.y + y * r, pos.z + z * r, TEAL, size * 0.5, 0.25);
  }
  const n = materia(b.data(), { sizeUnit: 1 });
  n.u.uSpread.value = 0;
  n.u.uFuente.value = 1;
  return n;
}
