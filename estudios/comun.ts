import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from './motor/materia';
import { formaGalaxia } from './galaxias';

/**
 * What the studies share: the Earth as points coloured with its real map (the series' treatment
 * from horizontes-cuerpos: 60 % saturation, pow 1.3, a little cold), and small helpers.
 * In the work itself the Earth comes from the library; here a lighter copy is enough, and its
 * points can be reordered (pixelated, turned into bits) by the scenes' own GLSL.
 */

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** «Tú»: the teal of the civilization in Destino, our colour in the series. */
export const TU = new THREE.Color(0.45, 1.0, 0.85);
export const VIOLETA3 = new THREE.Color(0.79, 0.7, 1.0);

export const ease = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

let mapa: Promise<ImageData> | null = null;
/** The Earth's day map, read once into the CPU. */
export function mapaTierra() {
  mapa ??= new Promise<ImageData>((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 512;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.drawImage(img, 0, 0, 1024, 512);
      res(x.getImageData(0, 0, 1024, 512));
    };
    img.onerror = rej;
    img.src = `${import.meta.env.BASE_URL}texturas/2k_earth_daymap.jpg`;
  });
  return mapa;
}

/** The series' colour treatment of a map texel. */
function grado(r: number, g: number, b: number, out: THREE.Color) {
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  r = l + (r - l) * 0.6;
  g = l + (g - l) * 0.6;
  b = l + (b - l) * 0.6;
  return out.setRGB(Math.pow(r, 1.3) * 0.9, Math.pow(g, 1.3) * 0.96, Math.pow(b, 1.3) * 1.04);
}

/**
 * The Earth as `n` points on a unit sphere (Fibonacci, jittered in its cell). North is +Y, longitude
 * 0 at +X and east towards −Z, as in the library. `aKind` holds 1 over the sea, 0 on land; `aFrom`
 * the latitude and longitude (radians) and 0, for the scenes that reorder it.
 */
export function tierraDatos(img: ImageData, n: number, seed = 7): MateriaData {
  const b = materiaBuilder(seed);
  const c = new THREE.Color();
  const ga = Math.PI * (3 - Math.sqrt(5));
  const size = 4.76 / Math.sqrt(n);
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5 + (b.r() - 0.5) * 0.9) / n) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ga * i + (b.r() - 0.5) * ga * 0.5;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    const lat = Math.asin(y);
    const lon = Math.atan2(-z, x);
    const px = Math.min(img.width - 1, Math.floor((lon / (2 * Math.PI) + 0.5) * img.width));
    const py = Math.floor((0.5 - lat / Math.PI) * (img.height - 1));
    const k = (py * img.width + px) * 4;
    const R = img.data[k] / 255;
    const G = img.data[k + 1] / 255;
    const B = img.data[k + 2] / 255;
    grado(R, G, B, c);
    const mar = B > R * 1.15 && B > G * 0.95 ? 1 : 0;
    b.push(x, y, z, c, size, 1, { from: [lat, lon, 0], kind: mar });
  }
  return b.data();
}

/** GLSL: the day side lit by `uSol` (a unit vector in the planet's frame), soft as with air. */
export const LUZ_TIERRA = /* glsl */ `
  float luzTierra(vec3 n, vec3 sol) {
    float mu = dot(n, sol);
    return smoothstep(-0.14, 0.42, mu) * 0.9 + 0.012;
  }
`;

/** Santiago de Chile, where «tú» is (lat, lon in radians), on the unit sphere of `tierraDatos`. */
export function aqui(lat = -33.45, lon = -70.66) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return V(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

/** Looks the camera from `pos` at `at`, with `up`. */
export function mirar(camera: THREE.PerspectiveCamera, pos: THREE.Vector3, at: THREE.Vector3, up = V(0, 1, 0)) {
  camera.position.copy(pos);
  camera.up.copy(up);
  camera.lookAt(at);
}

/** Interpolates between two distances in log space (camera pull-backs feel even). */
export const logLerp = (a: number, b: number, t: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);

/**
 * A cosmic web in the unit ball: knots joined to their nearest neighbours by filaments, and a haze
 * of field galaxies. `aFrom` holds each point's knot (for scenes that pull matter in); the second
 * array is a uniform random place in the ball for each point (for scenes that dissolve it).
 */
export function redCosmica(seed: number, nodos = 90, col = (t: number, out: THREE.Color) => out.setRGB(1, 0.92 - 0.12 * t, 0.78 - 0.2 * t), espirales = false) {
  const b = materiaBuilder(seed);
  const r = b.r;
  const g = () => (r() + r() + r() + r() - 2) * 0.866;
  const ns: THREE.Vector3[] = [];
  for (let i = 0; i < nodos; i++) {
    const [x, y, z] = b.onSphere();
    ns.push(V(x, y, z).multiplyScalar(Math.cbrt(r()) * 0.92));
  }
  const c = new THREE.Color();
  const azar: number[] = [];
  const punto = (x: number, y: number, z: number, k: THREE.Vector3, t: number, s: number, l: number, tinte?: THREE.Color) => {
    col(t, c);
    if (tinte) c.multiply(tinte);
    b.push(x, y, z, c, s, l, { from: [k.x, k.y, k.z] });
    const [a, e, o] = b.onSphere();
    const q = Math.cbrt(r());
    azar.push(a * q, e * q, o * q);
  };
  for (const n of ns) {
    if (espirales) {
      // A galaxy at the knot, each its own kind (galaxias.ts).
      formaGalaxia(r, 300, 0.019, (x, y, z, t, luz, tinte) => punto(n.x + x, n.y + y, n.z + z, n, 0.15 + 0.4 * t, t < 0.05 ? 0.004 : 0.003, luz, tinte));
    } else for (let k = 0; k < 80; k++) punto(n.x + g() * 0.022, n.y + g() * 0.022, n.z + g() * 0.022, n, 0.1, 0.006, 0.6);
    const cerca = ns.filter((m) => m !== n).sort((a, z) => a.distanceTo(n) - z.distanceTo(n)).slice(0, 3);
    for (const m of cerca) {
      const kk = Math.round(m.distanceTo(n) * 230);
      for (let i = 0; i < kk; i++) {
        const t = r();
        punto(n.x + (m.x - n.x) * t + g() * 0.011, n.y + (m.y - n.y) * t + g() * 0.011, n.z + (m.z - n.z) * t + g() * 0.011, t < 0.5 ? n : m, 0.6, 0.004, 0.45);
      }
    }
  }
  for (let i = 0; i < 5000; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r());
    const p = V(x * q, y * q, z * q);
    let best = ns[0];
    for (const n of ns) if (n.distanceToSquared(p) < best.distanceToSquared(p)) best = n;
    punto(p.x, p.y, p.z, best, 1, 0.003, 0.15);
  }
  return { data: b.data(), azar: new Float32Array(azar), nodos: ns };
}
