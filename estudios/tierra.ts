import * as THREE from 'three';
import { EASE, Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { clamp, gauss, lerp } from './motor/math';
import { ease, mapaTierra } from './comun';
import { tierra as tierraHorizontes } from '../src/horizontes';
import { CIUDADES } from './ciudades';
import { HORIZONTE, INFERNO, TEAL, caraHacia, dirLatLon, potencia, puntoTu, anioEn } from './remake';
import { angulos, aplicarToma, toma } from './rig';
import { crearChispa, montar, type Chispa } from './chispa';
import type { Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';
import { GLSL_RED, GLSL_SALA, LARGO_SALA, ORIGEN_RED, PASILLO_Z, ciudadDatos, redDatos, rutasRed, salaDatos } from './momentos-tierra';

/**
 * Study A of the remake: scenes 6 and 7 of ESCALETA.md, «La Tierra de noche» and «El cable»
 * (GUION.md, moments 15–19).
 *
 * The Earth fills half the frame with its night towards us (Europe, Africa, the Middle East, India).
 * Two hundred years of lights spread over it like a slow fire, first in Europe and North America,
 * then everywhere at once. «Hoy»: the point among the lights. The camera turns towards the day side,
 * enormous next to our lights. A curtain sweeps the frame and the Earth is seen by its heat. From the
 * equator a teal thread rises: the elevator. The camera rides up beside it while factories and data
 * centres climb past, and the Earth cools as its industry leaves. At the top, a ring of industry
 * round the planet: type I.
 *
 * Ways: 1 «Luces», the night as it is photographed (fine, warm, a dust of small towns); 2 «Red», the
 * same cities as knots joined by threads of light, with pulses running along them (the network that
 * the brain becomes in scene 5).
 *
 * Units: Earth radii, the Earth at the origin.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** The face turned to the camera at first, and where the elevator stands (on the equator, East Africa). */
export const CARA = { lat: 24, lon: 36 };
const CABLE = { lat: 0, lon: 37 };
/** Where «tú» is: in the middle of the face, on the dark of the Red Sea between the lights (a city's core would drown it). */
const TU_EN = { lat: 22.5, lon: 37.5 };
/** The Sun, behind the Earth and to the left: a thin day crescent on the left limb. */
export const SOL = V(-0.62, 0.22, -0.75).normalize();
const ALTO = 11;

/**
 * The spark's way over the night Earth (the Earth's own frame, unit sphere): city to city in scene
 * 5 (s 0..4, London to Cairo), then here under the Red Sea and the Arabian Sea in a cable to Mumbai,
 * and into a data centre (s 4..9). Each stretch is one unit of s. [lat, lon, height in radii].
 */
const PASOS: [number, number, number][] = [
  [51.5, -0.1, 0.016],
  [48.9, 2.35, 0.012],
  [41.9, 12.5, 0.012],
  [37.98, 23.7, 0.012],
  [30.0, 31.2, 0.01],
  [21.5, 38.6, 0.0006],
  [12.8, 45.0, -0.0008],
  [16.0, 60.0, -0.0008],
  [19.0, 72.6, 0.0006],
  [19.1, 72.9, 0.006],
];
/** s where scene 5 hands the spark over (Cairo), and where the cable runs. */
export const S_CAIRO = 4;
export function rutaTierra(sv: number, out = V()) {
  const n = PASOS.length - 1;
  const sc = Math.min(Math.max(sv, 0), n);
  const i = Math.min(Math.floor(sc), n - 1);
  const t = sc - i;
  const a = dirLatLon(PASOS[i][0], PASOS[i][1]);
  const b = dirLatLon(PASOS[i + 1][0], PASOS[i + 1][1]);
  const w = a.angleTo(b);
  const sw = Math.sin(w) || 1;
  out.copy(a).multiplyScalar(Math.sin((1 - t) * w) / sw).addScaledVector(b, Math.sin(t * w) / sw);
  const h = PASOS[i][2] + (PASOS[i + 1][2] - PASOS[i][2]) * t + (PASOS[i][2] > 0.005 && PASOS[i + 1][2] > 0.005 ? 0.012 * Math.sin(Math.PI * t) : 0);
  return out.normalize().multiplyScalar(1 + h);
}
/** How far along the route (radians of the Earth's arc) each stop is: the legs differ a lot in length. */
const ARCOS = (() => {
  const a = [0];
  for (let i = 0; i + 1 < PASOS.length; i++) a.push(a[i] + Math.hypot(dirLatLon(PASOS[i][0], PASOS[i][1]).angleTo(dirLatLon(PASOS[i + 1][0], PASOS[i + 1][1])), PASOS[i + 1][2] - PASOS[i][2]));
  return a;
})();
const arcoDe = (sv: number) => {
  const n = PASOS.length - 1;
  const x = Math.min(Math.max(sv, 0), n);
  const i = Math.min(Math.floor(x), n - 1);
  return ARCOS[i] + (x - i) * (ARCOS[i + 1] - ARCOS[i]);
};
const svDe = (u: number) => {
  const n = PASOS.length - 1;
  if (u <= 0) return 0;
  if (u >= ARCOS[n]) return n;
  let i = 0;
  while (ARCOS[i + 1] < u) i++;
  return i + (u - ARCOS[i]) / Math.max(1e-9, ARCOS[i + 1] - ARCOS[i]);
};
/**
 * The camera riding the spark over the Earth (its own frame): behind, a little above, looking
 * ahead. It rides by distance along the route, not by stop (a short leg and a long one take the
 * same s), so it can round each city in a wide curve without its average running ahead.
 */
export function montarTierra(sv: number) {
  return montar((x, o) => rutaTierra(svDe(x), o), arcoDe(sv), 0.016, 0.044, 0.012, rutaTierra(sv).normalize(), 0.09, true, 0.05);
}
/** Where the data centre is, and the cities its copies go to. */
const DC = [19.1, 72.9];
const COPIAS: [number, number][] = [
  [1.35, 103.8],
  [25.2, 55.3],
  [-1.3, 36.8],
  [28.6, 77.2],
  [13.1, 80.3],
  [24.9, 67.0],
];
const HALO = new THREE.Color(0.35, 0.58, 1.0);
const HALO_IR = new THREE.Color(1.0, 0.36, 0.12);
const GEO = 6.6;

// ---------------------------------------------------------------- the lights

/** When a region's cities got their lights: [first, span] in years. */
function inicio(lat: number, lon: number): [number, number] {
  if (lat > 35 && lon > -12 && lon < 45) return [1880, 55];
  if (lat > 44 && lon >= 45) return [1925, 50];
  if (lon < -50 && lat > 15) return [1885, 55];
  if (lon < -30) return [1920, 60];
  if (lat < -10 && lon > 110) return [1895, 50];
  if (lon > 125 && lat > 25) return [1900, 55];
  if (lon > 95 && lat > 18) return [1955, 50];
  if (lon > 60) return [1950, 62];
  if (lat > 12 && lon > 25) return [1940, 55];
  return [1960, 62];
}

/** World power (log10 W) by year: Smil and the Energy Institute, as the plate says. */
function lpDe(anio: number) {
  const K: [number, number][] = [[1800, 11.81], [1900, 12.15], [1950, 12.54], [1975, 12.9], [2000, 13.11], [2026, 13.28]];
  if (anio <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (anio <= K[i][0]) return lerp(K[i - 1][1], K[i][1], (anio - K[i - 1][0]) / (K[i][0] - K[i - 1][0]));
  return K[K.length - 1][1];
}

function base(c: THREE.Vector3) {
  const t1 = V(0, 1, 0).cross(c);
  if (t1.lengthSq() < 1e-8) t1.set(1, 0, 0);
  t1.normalize();
  return [t1, c.clone().cross(t1).normalize()];
}

function slerp(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const w = a.angleTo(b);
  const s = Math.sin(w) || 1;
  return a.clone().multiplyScalar(Math.sin((1 - t) * w) / s).addScaledVector(b, Math.sin(t * w) / s);
}

function esMar(img: ImageData, d: THREE.Vector3) {
  const lat = Math.asin(clamp(d.y, -1, 1));
  const lon = Math.atan2(-d.z, d.x);
  const px = Math.min(img.width - 1, Math.floor((lon / (2 * Math.PI) + 0.5) * img.width));
  const py = Math.floor((0.5 - lat / Math.PI) * (img.height - 1));
  const k = (py * img.width + px) * 4;
  const R = img.data[k];
  const G = img.data[k + 1];
  const B = img.data[k + 2];
  return B > R * 1.15 && B > G * 0.95;
}

const centros = CIUDADES.map(([la, lo, pop]) => {
  const [a0, span] = inicio(la, lo);
  return { c: dirLatLon(la, lo), pop, anio: a0 + span * clamp(0.04 + 0.6 * (1 - Math.sqrt(pop / 37)), 0, 1) };
});

/**
 * The night lights: each city a cloud of points by its size (a whiter core, sodium round it), the
 * roads between neighbours, and (way 1) the dust of small towns over the land near them. `aDat`:
 * the year it lights, the kind (0 city, 1 town, 2 road), how far along its road, a phase.
 */
export function luces(img: ImageData, red: boolean): { data: MateriaData; dat: Float32Array } {
  const b = materiaBuilder(red ? 21 : 11);
  const r = b.r;
  const dat: number[] = [];
  const SODIO = new THREE.Color(1.0, 0.56, 0.22);
  const BLANCA = new THREE.Color(1.0, 0.84, 0.62);
  const R = 1.0015;
  for (const k of centros) {
    const [t1, t2] = base(k.c);
    const sig = (red ? 0.0014 : 0.0034) * Math.pow(k.pop, 0.42);
    const n = Math.round((red ? 40 : 90) * Math.sqrt(k.pop));
    for (let i = 0; i < n; i++) {
      const nucleo = i < n * 0.2;
      const s = nucleo ? sig * 0.35 : sig;
      const dx = gauss(r) * s;
      const dy = gauss(r) * s;
      const p = k.c.clone().addScaledVector(t1, dx).addScaledVector(t2, dy).normalize().multiplyScalar(R);
      b.push(p.x, p.y, p.z, nucleo ? BLANCA : SODIO, 0.0011, red ? (nucleo ? 0.7 : 0.3) : nucleo ? 0.38 : 0.16);
      dat.push(k.anio + (Math.hypot(dx, dy) / sig) * 9 + r() * 6, 0, 0, r());
    }
  }
  // Way 2: the roads, each city to its nearest neighbours (threads with pulses).
  const hechos = new Set<string>();
  if (red) centros.forEach((k, i) => {
    const cerca = centros
      .map((m, j) => ({ m, j, d: k.c.angleTo(m.c) }))
      .filter((x) => x.j !== i && x.d < (red ? 0.26 : 0.2))
      .sort((a, z) => a.d - z.d)
      .slice(0, red ? 3 : 2);
    for (const { m, j, d } of cerca) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (hechos.has(key)) continue;
      hechos.add(key);
      const n = Math.round(d * (red ? 3200 : 1400));
      const fase = r();
      const desde = Math.max(k.anio, m.anio) + 6;
      for (let q = 0; q < n; q++) {
        const t = r();
        const j2 = red ? 0.0005 : 0.0018;
        const p = slerp(k.c, m.c, t).add(V(gauss(r) * j2, gauss(r) * j2, gauss(r) * j2)).normalize().multiplyScalar(R);
        b.push(p.x, p.y, p.z, SODIO, 0.0009, red ? 0.32 : 0.07);
        dat.push(desde + r() * 12, 2, i < j ? t : 1 - t, fase);
      }
    }
  });
  // Way 1: the carpet of towns over the land round the cities, from a coarse density grid.
  if (!red) {
    const GW = 360;
    const GH = 180;
    const dens = new Float32Array(GW * GH);
    const anios = new Float32Array(GW * GH).fill(2030);
    const d = V();
    for (let y = 0; y < GH; y++) {
      const lat = (0.5 - (y + 0.5) / GH) * Math.PI;
      for (let x = 0; x < GW; x++) {
        const lon = ((x + 0.5) / GW - 0.5) * 2 * Math.PI;
        d.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
        let w = 0;
        for (const k of centros) {
          const c = d.dot(k.c);
          if (c < 0.95) continue;
          const a2 = Math.acos(Math.min(1, c)) ** 2;
          const e = Math.pow(k.pop, 0.75) * (Math.exp(-a2 / (2 * 0.035 * 0.035)) + 0.35 * Math.exp(-a2 / (2 * 0.1 * 0.1)));
          if (e > 0.05) anios[y * GW + x] = Math.min(anios[y * GW + x], k.anio + 12);
          w += e;
        }
        dens[y * GW + x] = w;
      }
    }
    for (let i = 0; i < 900000; i++) {
      const [x, y, z] = b.onSphere();
      d.set(x, y, z);
      const lat = Math.asin(y);
      const lon = Math.atan2(-z, x);
      const gx = Math.min(GW - 1, Math.floor((lon / (2 * Math.PI) + 0.5) * GW));
      const gy = Math.min(GH - 1, Math.floor((0.5 - lat / Math.PI) * GH));
      const w = dens[gy * GW + gx];
      if (w < 0.02 || r() > w / (w + 2.2)) continue;
      if (esMar(img, d)) continue;
      d.multiplyScalar(R);
      const brillo = r();
      b.push(d.x, d.y, d.z, brillo > 0.93 ? BLANCA : SODIO, 0.0009, 0.1 + 0.32 * brillo * brillo);
      dat.push(anios[gy * GW + gx] + r() * 40, 1, 0, r());
    }
  }
  return { data: b.data(), dat: new Float32Array(dat) };
}

const GLSL_LUCES = {
  pre: /* glsl */ `
    attribute vec4 aDat;
    uniform vec3 uCamL, uSunL;
    uniform float uAnio, uWipe, uIR, uRed, uLuz, uOlaL, uBaja;
    uniform vec3 uWipeAx, uOlaC, uTealL;
    ${HORIZONTE}
  `,
  move: /* glsl */ `
    // (diving down to a city, its lights come down to the ground with the camera)
    if (uBaja < 1.0) p = normalize(p) * (1.0 + (length(p) - 1.0) * uBaja);
    float on = smoothstep(aDat.x, aDat.x + 16.0, uAnio);
    float crece = mix(0.4, 1.0, smoothstep(aDat.x, aDat.x + 80.0, uAnio));
    float noche = 1.0 - smoothstep(-0.2, 0.08, dot(normalize(p), uSunL));
    float pulso = 0.0;
    if (aDat.y > 1.5) {
      float x = fract(aDat.z * 2.0 - uTime * 0.22 + aDat.w * 7.0);
      pulso = uRed * smoothstep(0.86, 1.0, x) * 5.0;
    }
    em *= on * crece * delante(p, uCamL) * mix(0.04, 1.0, noche) * uLuz * (1.0 + pulso);
    // (the pulse from Mumbai: a teal ring that runs over the lights as the cables carry it)
    if (uOlaL > 0.0) {
      float dO = acos(clamp(dot(normalize(p), uOlaC), -1.0, 1.0)) * 1.18 - uOlaL;
      float ola = exp(-dO * dO / (2.0 * 0.03 * 0.03)) * smoothstep(0.03, 0.15, length(p - uCamL));
      float lumL = max(max(em.r, em.g), em.b);
      em = mix(em, uTealL * (lumL * 2.0 + 0.04), ola * 0.75) * (1.0 + 0.6 * ola);
    }
  `,
  post: /* glsl */ `
    em *= mix(1.0, smoothstep(uWipe - 0.012, uWipe + 0.012, dot(normalize(p), uWipeAx)), uIR);
  `,
};

// ---------------------------------------------------------------- the heat

/**
 * The Earth seen by its heat, as a map (equirectangular, the library's frame): warmer towards the
 * equator, a little over land, and much over the cities. The planet's own surface hook reads it.
 */
function mapaCalor(img: ImageData): THREE.DataTexture {
  const W = 512;
  const H = 256;
  const px = new Uint8Array(W * H * 4);
  const d = V();
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
      d.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
      let h = 0.12 + 0.3 * Math.pow(Math.cos(lat), 1.6) + (esMar(img, d) ? 0 : 0.04);
      for (const k of centros) {
        const c = d.dot(k.c);
        if (c < 0.99) continue;
        const a = Math.acos(Math.min(1, c));
        h += 0.05 * Math.sqrt(k.pop) * Math.exp(-(a * a) / (2 * 0.02 * 0.02));
      }
      const i = ((H - 1 - y) * W + x) * 4;
      px[i] = Math.round(Math.min(h, 0.8) * 255);
      px[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(px, W, H, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * The curtain: past a plane that sweeps across the planet (`uWipeAx`, the camera's right in the
 * planet's frame; `uWipe`, how far it has gone), the ground is seen by its heat.
 */
const CALOR = {
  pre: /* glsl */ `
    uniform sampler2D uCalor;
    uniform float uIR, uWarm, uWipe;
    uniform vec3 uWipeAx;
  `,
  glsl: /* glsl */ `
    float mIR = uIR * (1.0 - smoothstep(uWipe - 0.012, uWipe + 0.012, dot(n, uWipeAx)));
    if (mIR > 0.0) {
      float h = texture2D(uCalor, uvDe(n)).r + uWarm * 0.2;
      alb = mix(alb, vec3(0.0), mIR);
      vec3 cal = vec3(smoothstep(0.04, 0.5, h), smoothstep(0.36, 0.86, h) * 0.72, smoothstep(0.72, 1.0, h) * 0.45);
      extra = mix(extra, cal * 0.5, mIR);
    }
  `,
};

// ---------------------------------------------------------------- the elevator

/** The cable: points from the ground to ALTO radii, denser low; it grows to `uAlto`. */
function cableDatos(c: THREE.Vector3): MateriaData {
  const b = materiaBuilder(9);
  const [t1, t2] = base(c);
  for (let i = 0; i < 14000; i++) {
    const u = b.r();
    const h = 1 + (ALTO - 1) * Math.pow(u, 1.7);
    const j = 0.0008 * h;
    const p = c.clone().multiplyScalar(h).addScaledVector(t1, gauss(b.r) * j).addScaledVector(t2, gauss(b.r) * j);
    b.push(p.x, p.y, p.z, TEAL, 0.00016, 0.6, { kind: h });
  }
  return b.data();
}

/**
 * What climbs it: factories (teal blocks of points) and data centres (white-blue slabs), packets
 * that ride the cable up for ever. `position` holds each point's place in its packet; `aKind` the
 * packet's phase; `aDelay` when it appears (0..1, with the industry).
 */
function cargaDatos(c: THREE.Vector3): MateriaData {
  const b = materiaBuilder(13);
  const [t1, t2] = base(c);
  const FRIA = new THREE.Color(0.78, 0.88, 1.0);
  const N = 170;
  for (let k = 0; k < N; k++) {
    const fase = k / N + b.r() * 0.004;
    const datos = k % 4 === 3;
    const s = 0.0032 + b.r() * 0.0022;
    const lado = (b.r() - 0.5) * 0.0016;
    const nx = datos ? 7 : 4;
    const ny = datos ? 7 : 4;
    const nz = datos ? 2 : 5;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++)
        for (let q = 0; q < nz; q++) {
          const o = t1
            .clone()
            .multiplyScalar(((i / (nx - 1 || 1)) - 0.5) * s + lado)
            .addScaledVector(t2, ((j / (ny - 1 || 1)) - 0.5) * s)
            .addScaledVector(c, ((q / (nz - 1 || 1)) - 0.5) * s * (datos ? 0.15 : 1));
          b.push(o.x, o.y, o.z, datos ? FRIA : TEAL, s * 0.2, datos ? 0.32 : 0.36, { kind: fase, delay: b.r() });
        }
  }
  return b.data();
}

/** The industry in orbit: a ring at geostationary height, that spreads round from the cable. */
function anilloDatos(lonCable: number): MateriaData {
  const b = materiaBuilder(17);
  const lo0 = THREE.MathUtils.degToRad(lonCable);
  for (let i = 0; i < 42000; i++) {
    const a = b.r() * Math.PI * 2;
    const R = GEO + gauss(b.r) * 0.05;
    const y = gauss(b.r) * 0.012;
    const lo = lo0 + a;
    let dif = a > Math.PI ? Math.PI * 2 - a : a;
    dif /= Math.PI;
    b.push(Math.cos(lo) * R, y, -Math.sin(lo) * R, b.r() < 0.12 ? 0xffffff : TEAL, 0.004, 0.25 + b.r() * 0.25, { kind: dif });
  }
  return b.data();
}

// ---------------------------------------------------------------- the scene

export const tierraNoche: Escena = {
  id: 'tierra',
  nombre: 'A · La Tierra de noche y el cable',
  estilos: [
    { key: '1', nombre: 'Luces', nota: 'La noche como se fotografía: luces finas y cálidas, polvo de pueblos sobre la tierra, caminos tenues.' },
    { key: '2', nombre: 'Red', nota: 'Las mismas ciudades como nudos unidos por hilos de luz, con pulsos que los recorren: la red en que se convierte el cerebro.' },
  ],
  montar(stage, estilo): Instancia {
    const red = estilo === 1;
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.5;
    stage.bloom.threshold = 0.42;
    stage.renderer.toneMappingExposure = 1.15;

    const earth = new THREE.Group();
    earth.quaternion.copy(caraHacia(CARA.lat, CARA.lon));
    root.add(earth);
    const base = `${import.meta.env.BASE_URL}texturas/`;
    const calorU = { uCalor: { value: null as THREE.Texture | null }, uIR: { value: 0 }, uWarm: { value: 0 }, uWipe: { value: -2 }, uWipeAx: { value: V(1, 0, 0) } };
    const planeta = tierraHorizontes(base, { giro: 0, superficie: { ...CALOR, uniforms: calorU } });
    earth.add(planeta.group);

    const cDir = dirLatLon(CABLE.lat, CABLE.lon);
    const cW = cDir.clone().applyQuaternion(earth.quaternion);
    const cAng = angulos(cW);
    /** Riding beside the cable, not on it: a fixed step east of it. */
    const lado = V(0, 1, 0).cross(cW).normalize().multiplyScalar(0.03);
    /** The last view: 48° above the equator and turned from the cable, so the ring opens and the cable shows in profile. */
    const norte = V(0, 1, 0).applyQuaternion(earth.quaternion);
    const fin = angulos(cW.clone().applyAxisAngle(norte, THREE.MathUtils.degToRad(-75)).multiplyScalar(Math.cos(0.84)).addScaledVector(norte, Math.sin(0.84)));
    const tuPos = dirLatLon(TU_EN.lat, TU_EN.lon).multiplyScalar(1.004);

    const nubes: Nube[] = [];
    const add = (n: Nube) => {
      n.u.uSpread.value = 0;
      earth.add(n.points);
      nubes.push(n);
      return n;
    };
    const comunes = () => ({ uCamL: { value: V() }, uSunL: { value: V() }, uWipe: { value: -2 }, uWipeAx: { value: V(1, 0, 0) } });

    const cable = add(
      materia(cableDatos(cDir), {
        pre: /* glsl */ `uniform float uAlto;`,
        move: /* glsl */ `
          em *= 1.0 - smoothstep(uAlto - 0.25, uAlto, aKind);
          em *= 1.0 - 0.9 * smoothstep(${GEO.toFixed(1)}, ${ALTO.toFixed(1)}, aKind);
          float dz = (aKind - uAlto) / 0.12;
          em *= 1.0 + 3.0 * exp(-dz * dz);
        `,
        uniforms: { uAlto: { value: 1 } },
      }),
    );
    cable.u.uFuente.value = 0.3;
    const carga = add(
      materia(cargaDatos(cDir), {
        pre: /* glsl */ `uniform vec3 uC; uniform float uInd, uAlto;`,
        move: /* glsl */ `
          float h = 1.03 * pow(${ALTO.toFixed(1)} / 1.03, fract(aKind + uTime * 0.0045));
          p = position + uC * h;
          em *= step(aDelay, uInd) * smoothstep(1.03, 1.08, h) * (1.0 - smoothstep(uAlto - 0.3, uAlto, h));
          em *= 1.0 - 0.8 * smoothstep(${GEO.toFixed(1)}, ${ALTO.toFixed(1)}, h);
        `,
        uniforms: { uC: { value: cDir.clone() }, uInd: { value: 0 }, uAlto: { value: 1 } },
      }),
    );
    carga.u.uFuente.value = 0.15;
    const anillo = add(
      materia(anilloDatos(CABLE.lon), {
        pre: /* glsl */ `uniform float uAni;`,
        move: /* glsl */ `em *= smoothstep(aKind - 0.08, aKind, uAni * 1.08);`,
        uniforms: { uAni: { value: 0 } },
      }),
    );
    anillo.u.uFuente.value = 0.35;
    const tu = add(puntoTu(tuPos, 0.008));

    // The spark, the submarine cable it takes, and the copies that leave the data centre.
    const chispa = crearChispa();
    earth.add(chispa.nube.points);
    const cableB = materiaBuilder(311);
    // A fine line on the sea floor, not a tube: many small points.
    for (let i = 0; i < 40000; i++) {
      const sv = 5 + cableB.r() * 3;
      const q = rutaTierra(sv).normalize().multiplyScalar(0.9994);
      cableB.push(q.x, q.y, q.z, TEAL, 0.00012, 0.28);
    }
    const cableMar = add(materia(cableB.data(), { pre: `uniform float uOn;`, move: `em *= uOn;`, uniforms: { uOn: { value: 0 } } }));
    cableMar.u.uFuente.value = 0.5;
    const copias: { ch: Chispa; a: THREE.Vector3; b: THREE.Vector3 }[] = COPIAS.map(([la, lo]) => {
      const ch = crearChispa();
      earth.add(ch.nube.points);
      return { ch, a: dirLatLon(DC[0], DC[1]), b: dirLatLon(la, lo) };
    });
    const arcoCopia = (c: { a: THREE.Vector3; b: THREE.Vector3 }) => (sv: number, out: THREE.Vector3) => {
      const t = THREE.MathUtils.clamp(sv, 0, 1);
      const w = c.a.angleTo(c.b);
      const sw = Math.sin(w) || 1;
      out.copy(c.a).multiplyScalar(Math.sin((1 - t) * w) / sw).addScaledVector(c.b, Math.sin(t * w) / sw);
      return out.normalize().multiplyScalar(1.006 + 0.02 * Math.sin(Math.PI * t));
    };

    // The world's undersea cables, that the pulse lights from Mumbai.
    const cables = add(materia(redDatos(), { ...GLSL_RED, uniforms: { uFrente: { value: -1 }, uRed: { value: 0 }, uResto: { value: 1 }, uCamL: { value: V() } } }));
    cables.u.uFuente.value = 0.7;
    // And the pulse's heads: sparks, copies of ours, one down each cable as the pulse reaches it.
    const corredores = rutasRed().map((r) => {
      const ch = crearChispa();
      earth.add(ch.nube.points);
      return { ...r, ch };
    });

    // The data centre's hall, in metres, standing on the ground at DC (its own frame: east, up, south).
    const M = 1 / 6371000;
    const dcE = dirLatLon(DC[0], DC[1]);
    const dcW = dcE.clone().applyQuaternion(earth.quaternion);
    const esteW = V(-Math.sin(THREE.MathUtils.degToRad(DC[1])), 0, -Math.cos(THREE.MathUtils.degToRad(DC[1]))).applyQuaternion(earth.quaternion);
    const surW = esteW.clone().cross(dcW).normalize();
    const qL = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(esteW, dcW, surW));
    const qLinv = qL.clone().invert();
    /** World to the hall's frame (in Earth radii, its origin on the ground at DC), and back. */
    const aLocal = (w: THREE.Vector3, out = V()) => out.copy(w).sub(dcW).applyQuaternion(qLinv);
    const aMundo = (l: THREE.Vector3, out = V()) => out.copy(l).applyQuaternion(qL).add(dcW);
    const salaG = new THREE.Group();
    salaG.position.copy(dcW);
    // (its aisles turned a little off east, so the camera comes in along the way it has been turning)
    const qSala = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), THREE.MathUtils.degToRad(-7));
    salaG.quaternion.copy(qL).multiply(qSala);
    salaG.scale.setScalar(M);
    root.add(salaG);
    const sala = materia(salaDatos(), { ...GLSL_SALA, uniforms: { uSala: { value: 0 }, uOla: { value: -1 }, uXOla: { value: 0 }, uTealS: { value: TEAL.clone() } } });
    sala.u.uSpread.value = 0;
    sala.u.uFuente.value = 1;
    // (its sizes are metres, like its places)
    sala.u.uSizeUnit.value = M;
    salaG.add(sala.points);
    nubes.push(sala);
    const ciudad = materia(ciudadDatos(), { pre: `uniform float uCiudad;`, move: `em *= uCiudad;`, uniforms: { uCiudad: { value: 0 } } });
    ciudad.u.uSpread.value = 0;
    ciudad.u.uFuente.value = 1;
    ciudad.u.uSizeUnit.value = M;
    salaG.add(ciudad.points);
    nubes.push(ciudad);

    let lucesN: Nube | null = null;
    const listo = (async () => {
      const img = await mapaTierra();
      const l = luces(img, red);
      lucesN = materia(l.data, { ...GLSL_LUCES, uniforms: { ...comunes(), uAnio: { value: 1800 }, uIR: { value: 0 }, uRed: { value: red ? 1 : 0 }, uLuz: { value: 1 }, uOlaL: { value: 0 }, uBaja: { value: 1 }, uOlaC: { value: dirLatLon(ORIGEN_RED[0], ORIGEN_RED[1]) }, uTealL: { value: TEAL.clone() } }, extra: { aDat: [l.dat, 4] } });
      lucesN.u.uFuente.value = 0.5;
      add(lucesN);
      calorU.uCalor.value = mapaCalor(img);
      await planeta.listo;
    })();

    // ---------------------------------------------------------------- the moments (GUION.md 15–19)
    const tl = new Timeline();
    /** A tween that starts `off` beats after the cursor (the cursor stays). */
    const luego = (off: number, dur: number, v: Record<string, number>, e: ((t: number) => number) | null = null) => {
      tl.wait(off);
      tl.with(dur, v, e);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: 12, el: 9, ld: 0.74, yaw: 90, pitch: -90, roll: 0, fov: 40, anio: 2026, tu: 0, wipe: -1.4, warm: 0, ir: 0, presencia: 1, alto: 1, ind: 0, ani: 0, lw: 0, lh: 1, lp2: 13.28, rs: S_CAIRO, rw: 1, on: 1, cable: 0, dc: 0, copias: 0, vel: 0.2, frente: -0.05, cables: 0, resto: 1, ola: -1 });

    // Under the Red Sea and the Arabian Sea in a cable to Mumbai; as the spark lands, the pulse runs
    // on along every cable of the world, coast to coast and over the curve of the Earth to its other
    // side, while the camera rises off the sea to watch it go.
    tl.label('otroLado').caption(6.4, 'Al otro lado del mundo', 'Lo que piensa uno, en un instante lo sabe el otro lado del mundo.');
    tl.with(0.8, { cable: 1 });
    tl.to(1.0, { rs: S_CAIRO + 1, vel: 0.35 });
    // (the act's rig centre goes to the hall, unseen while the hall's rig has the camera: so the pace
    // measures the dive by how far the camera is from what it frames)
    luego(1.5, 0.5, { cx: dcW.x, cy: dcW.y, cz: dcW.z });
    tl.to(3.2, { rs: S_CAIRO + 4, vel: 0.5 });
    luego(-0.3, 0.4, { cables: 1 });
    tl.keyAt(tl.at('otroLado') + 3.9, { frente: -0.12 });
    tl.keyAt(tl.at('otroLado') + 4.2, { frente: 0 });
    tl.keyAt(tl.at('otroLado') + 5.3, { frente: 0.55 });
    tl.keyAt(tl.at('otroLado') + 7.2, { frente: 3.5 });
    tl.to(0.8, { rs: S_CAIRO + 4.6, vel: 0.15 });
    luego(0, 1.0, { vel: 0 });
    tl.wait(1.4);

    // Down into the data centre the spark went into: from orbit to its roof, and along an aisle of
    // racks whose lights take its teal as it reaches them; then up and away, its copies leaving.
    tl.label('maquinas').caption(7.6, 'Las máquinas que piensan', 'Y ahora pensamos también fuera de la cabeza. Las máquinas que piensan crecen cada año.');
    luego(0, 1.6, { cable: 0 });
    luego(0.4, 2.4, { resto: 0 });
    luego(0, 2.0, { dc: 1 });
    luego(0.6, 2.4, { rs: S_CAIRO + 5.6 });
    luego(2.9, 0.2, { on: 0 });
    luego(2.8, 2.6, { ola: 34 });
    luego(5.0, 2.6, { copias: 1 });
    luego(3.4, 0.2, { cables: 0 });
    // (the act's own rig, unseen while the hall's rig has the camera, waits where «luces» begins)
    luego(4.0, 2.0, { rw: 0, fov: 34 });
    luego(6.6, 0.8, { cx: 0, cy: 0, cz: 0 });
    tl.wait(7.6);

    tl.label('luces').caption(4.4, 'Doscientos años de luces', 'En doscientos años encendimos el planeta: primero de a poco, después de golpe.');
    tl.with(1.8, { dc: 0, on: 0 });
    tl.to(0.9, { anio: 1800, az: 8, el: 7, ld: 0.7 });
    tl.to(3.5, { anio: 2026, az: 3, el: 5, ld: 0.64 });

    tl.label('hoy').caption(3.6, 'Hoy', 'Hoy usamos diecinueve billones de vatios: tipo 0,73 en la escala de Kardashev. Unos pocos encienden la pantalla en que miras esto.');
    luego(0.4, 0.9, { tu: 1 });
    tl.to(3.6, { az: 0, el: 4, ld: 0.58 });

    tl.label('energia').caption(3.6, 'Más energía, más calor', 'Hay espacio para crecer: el Sol le da a la Tierra casi diez mil veces más. Pero lo que usamos termina como calor.');
    tl.with(1.0, { tu: 0 });
    tl.to(3.6, { az: -52, el: 12, ld: 0.66 });

    tl.label('calor').caption(3.9, 'El calor nos echa', 'Un planeta solo se enfría brillando hacia el espacio. Si seguimos creciendo aquí, se recalienta: hay que salir.');
    tl.with(0.01, { ir: 1 });
    luego(0.3, 1.8, { wipe: 1.4 }, EASE.sine);
    luego(1.4, 2.4, { warm: 1, lp2: 16 });
    luego(1.6, 1.6, { presencia: 0.45 });
    tl.to(3.9, { az: -24, el: 8, ld: 0.68 });

    // The thread rises from the equator, seen from the side, and the Earth cools as the industry
    // climbs it. Then the camera goes beside the cable, looking out at the horizon with the factories
    // rising through the frame, and looks down more and more as it climbs.
    tl.label('cable').caption(10.4, 'La industria sale al espacio', 'Las fábricas suben por el cable. Allá arriba su calor se va al vacío, y podemos seguir creciendo hasta el tipo I.');
    tl.with(1.8, { alto: ALTO });
    luego(0.6, 2.4, { ind: 1 });
    luego(0.5, 2.4, { warm: 0 });
    luego(1.3, 1.9, { ir: 0, presencia: 1 });
    tl.to(2.6, { az: cAng.az + 30, el: cAng.el + 12, ld: 0.5 });
    tl.to(2.4, { az: cAng.az, el: cAng.el, ld: 0.075, ox: lado.x, oy: lado.y, oz: lado.z, pitch: -9, yaw: 180, roll: 7, fov: 54 });
    tl.to(5.4, { ld: 0.74, pitch: -74, roll: 0, fov: 48 });
    luego(-2.2, 3.0, { ani: 1 });
    // At the top, away from the cable to see the whole Earth with its ring.
    tl.to(3.0, { az: fin.az, el: fin.el, ld: 1.36, ox: 0, oy: 0, oz: 0, pitch: -90, yaw: 90, fov: 34 });
    tl.label('fin').wait(0.6);

    const tm = toma(tl, 0);

    // ---- The camera from the cable to the hall and back up: a rig of its own in the hall's frame
    // (its «up» is the ground's up at Mumbai, so the curve of the Earth and the aisle's floor stay
    // level). It takes over from the act's rig while both ride the spark (the same shot), and hands
    // back where «luces» begins, standing exactly where the act's rig stands then.
    const P0 = 2.5;
    const P1 = tl.at('luces');
    const tl2 = new Timeline();
    /** What the hall's rig looks at: the far end of the aisle, at eye height (hall frame, radii). */
    const enHall = (x: number, y: number, z: number) => V(x * M, y * M, z * M).applyQuaternion(qSala);
    const cL = enHall(LARGO_SALA / 2 + 2, 1.5, PASILLO_Z);
    const dirLocal = (w: THREE.Vector3) => w.clone().applyQuaternion(qLinv);
    const rigLocal = (posL: THREE.Vector3) => {
      const d = posL.clone().sub(cL);
      return { ...angulos(d), ld: Math.log10(d.length()) };
    };
    /** The rig's pitch, yaw and roll that give this gaze and this «up» from this place (hall frame). */
    const miradaLocal = (posL: THREE.Vector3, dir: THREE.Vector3, up: THREE.Vector3) => {
      const r = posL.clone().sub(cL).normalize();
      const e = V(0, 1, 0).cross(r).normalize();
      const n = r.clone().cross(e).normalize();
      const sp = THREE.MathUtils.clamp(dir.dot(r), -1, 1);
      const pitch = Math.asin(sp);
      const h = dir.clone().addScaledVector(r, -sp).normalize();
      const yaw = Math.atan2(h.dot(n), h.dot(e));
      const up0 = h.clone().multiplyScalar(-Math.sin(pitch)).addScaledVector(r, Math.cos(pitch));
      const roll = Math.atan2(up0.clone().cross(up).dot(dir), up0.dot(up));
      const G = THREE.MathUtils.radToDeg;
      // (the same gaze written with the yaw nearest 90, the rig's own: past the vertical if need be)
      if (Math.cos(yaw - Math.PI / 2) < 0) return { pitch: -180 - G(pitch), yaw: G(yaw) + 180, roll: ((G(roll) + 360) % 360) - 180 };
      return { pitch: G(pitch), yaw: G(yaw), roll: G(roll) };
    };
    // Where the ride is as the rig starts to let go of it.
    const lugarEn = (pp: number) => aLocal(montarTierra(tl.get('rs', pp)).lugar.applyQuaternion(earth.quaternion));
    const r0 = rigLocal(lugarEn(3.0));
    // Where the act's rig stands as «luces» begins.
    const tFin = toma(tl, P1);
    const posFin = aLocal(tFin.pos);
    const rFin = rigLocal(posFin);
    const mFin = miradaLocal(posFin, dirLocal(tFin.dir), dirLocal(tFin.up));
    const enSala = (m: number) => Math.log10(m * M);
    /** A shot over the Earth: from above (lat, lon) at `alt` radii, looking at (tla, tlo) on the ground, the horizon level. */
    const sobre = (la: number, lo: number, alt: number, tla: number, tlo: number) => {
      const posW = dirLatLon(la, lo).multiplyScalar(1 + alt).applyQuaternion(earth.quaternion);
      const tgtW = dirLatLon(tla, tlo).applyQuaternion(earth.quaternion);
      const posL = aLocal(posW);
      const dirL = dirLocal(tgtW.sub(posW).normalize());
      const upL = dirLocal(posW.clone().normalize());
      upL.addScaledVector(dirL, -upL.dot(dirL)).normalize();
      return { ...rigLocal(posL), ...miradaLocal(posL, dirL, upL) };
    };
    const subida = sobre(17.5, 64, 0.09, 19.4, 76.5);
    const cima = sobre(19.2, 66.5, 0.2, 18.9, 78.5);
    tl2.set({ cx: cL.x, cy: cL.y, cz: cL.z, ox: 0, oy: 0, oz: 0, az: r0.az, el: r0.el, ld: r0.ld, pitch: -90, yaw: 90, roll: 0, fov: 40, rw: 1 });
    // Off the ride and up off the sea: India below, the pulse running out to the curve of the Earth.
    tl2.keyAt(3.0, { rw: 1, az: r0.az, el: r0.el, ld: r0.ld, pitch: -90, yaw: 90, roll: 0 });
    tl2.keyAt(5.0, { rw: 0 });
    tl2.keyAt(5.4, subida);
    tl2.keyAt(6.9, { ...cima, fov: 40 });
    // Down onto the hall and in along its aisle, low over the floor.
    tl2.keyAt(9.4, { ...rigLocal(enHall(-LARGO_SALA / 2 - 3, 1.6, PASILLO_Z)), pitch: -90, yaw: 90, roll: 0 });
    tl2.keyAt(11.0, { ...rigLocal(enHall(LARGO_SALA / 2 - 7, 1.55, PASILLO_Z)), pitch: -90, yaw: 90, roll: 0 });
    // Up and away to where the act's rig waits.
    tl2.keyAt(P1, { az: rFin.az, el: rFin.el, ld: rFin.ld, pitch: mFin.pitch, yaw: mFin.yaw, roll: mFin.roll, fov: tFin.fov });
    const tm2 = toma(tl2, 0);
    const vW = V();

    /** The spark's way: the act's route to the data centre, then straight down into its hall. */
    // (where it comes down: the middle of the aisle, the hall's frame turned into the Earth's)
    const bajaE = enHall(0, 0, PASILLO_Z).applyQuaternion(qL).applyQuaternion(earth.quaternion.clone().invert());
    const hSala = Math.log10(1.2 * M);
    const rutaMia = (sv: number, out: THREE.Vector3) => {
      if (sv <= S_CAIRO + 5) return rutaTierra(sv, out);
      const k = Math.min(1, (sv - S_CAIRO - 5) / 0.6);
      const h = Math.pow(10, lerp(Math.log10(0.006), hSala, k));
      return out.copy(dcE).multiplyScalar(1 + h).addScaledVector(bajaE, k);
    };
    const solL = V();
    const camL = V();
    const inv = new THREE.Quaternion();
    const centroV = V();

    return {
      tl,
      listo,
      entrada: { pos: V(), escala: 1 },
      salida: { pos: V(), escala: 1 },
      escalera: false,
      cuenta(p) {
        const anio = tl.get('anio', p);
        const c = p < tl.at('luces') ? potencia(13.28) : p < tl.at('hoy') ? potencia(lpDe(anio)) : p < tl.at('calor') ? potencia(13.28, 'hoy · ') : potencia(tl.get('lp2', p));
        // How far we reach: one world, ours.
        return { ...c, alcance: '1 mundo' };
      },
      // The years: the two hundred years of lights, today, and the first steps out (soon: the
      // machines that think make everything go faster).
      anio(p) {
        if (p >= tl.at('luces') && p < tl.at('hoy')) return tl.get('anio', p);
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[0, 2026], [a('energia'), 2026], [a('calor'), 2030], [a('cable'), 2034], [a('fin'), 2045]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'II · Nosotros, hoy', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-4;
        camera.far = 400;
        // Riding the spark over the Earth (its frame turned into the world's), or the rig's own shot.
        const rs = tl.get('rs', p);
        const rw = tl.get('rw', p);
        const mira: { punto: THREE.Vector3; peso: number; arriba?: THREE.Vector3; delante?: THREE.Vector3 } = { punto: cW.clone().multiplyScalar(tl.get('lh', p)), peso: tl.get('lw', p) };
        let lugarR: { punto: THREE.Vector3; peso: number } | undefined;
        if (rw > 0.001) {
          const m = montarTierra(rs);
          mira.punto.copy(m.mira.applyQuaternion(earth.quaternion));
          mira.peso = rw;
          mira.arriba = m.arriba.applyQuaternion(earth.quaternion);
          mira.delante = m.delante.applyQuaternion(earth.quaternion);
          lugarR = { punto: m.lugar.applyQuaternion(earth.quaternion), peso: rw };
        }
        const mio = p >= P0 && p < P1;
        if (!mio) aplicarToma(camera, toma(tl, p, tm, mira, lugarR));
        else {
          // The hall's rig (its frame), riding the same spark at first.
          const rw2 = tl2.get('rw', p);
          let miraL: typeof mira | undefined;
          let lugarL: { punto: THREE.Vector3; peso: number } | undefined;
          if (rw2 > 0.001) {
            const m = montarTierra(rs);
            miraL = { punto: aLocal(m.mira.applyQuaternion(earth.quaternion)), peso: rw2, arriba: dirLocal(m.arriba.applyQuaternion(earth.quaternion)), delante: dirLocal(m.delante.applyQuaternion(earth.quaternion)) };
            lugarL = { punto: aLocal(m.lugar.applyQuaternion(earth.quaternion)), peso: rw2 };
          }
          const t2 = toma(tl2, p, tm2, miraL, lugarL);
          aMundo(t2.pos, camera.position);
          camera.up.copy(t2.up).applyQuaternion(qL);
          camera.lookAt(vW.copy(t2.dir).applyQuaternion(qL).add(camera.position));
          camera.fov = t2.fov;
          // Down to the hall's scale, the near plane comes in with the camera.
          camera.near = THREE.MathUtils.clamp((camera.position.length() - 1) * 0.02, 2e-9, 1e-4);
        }
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        earth.updateMatrixWorld();

        inv.copy(earth.quaternion).invert();
        solL.copy(SOL).applyQuaternion(inv);
        camL.copy(camera.position).applyQuaternion(inv);
        planeta.update({ sol: solL, camara: camL, focal: f.focal, dpr: f.dpr, tiempo: t, presencia: tl.get('presencia', p) * THREE.MathUtils.smoothstep(camera.position.length() - 1, 0.00004, 0.0008) });
        chispa.update(rutaMia, rs, 0.0011, tl.get('on', p), 0, camL, f.focal, f.dpr, t);
        cableMar.u.uOn.value = tl.get('cable', p);
        // The pulse along the world's cables, and the ring it runs over the lights; how high the camera
        // is (lights, cables and ground fade as it goes down below them, into the hall).
        const alt = camera.position.length() - 1;
        const frente = tl.get('frente', p);
        cables.u.uFrente.value = frente;
        cables.u.uRed.value = tl.get('cables', p) * THREE.MathUtils.smoothstep(alt, 0.003, 0.008);
        cables.u.uResto.value = tl.get('resto', p);
        cables.u.uCamL.value.copy(camL);
        const enRed = tl.get('cables', p);
        for (const c of corredores) {
          // (lit as the pulse reaches its cable, gone a little after it reaches the end)
          const on = enRed * THREE.MathUtils.smoothstep(frente, c.d0 - 0.005, c.d0 + 0.03) * (1 - THREE.MathUtils.smoothstep(frente, c.d0 + c.largo, c.d0 + c.largo + 0.25)) * THREE.MathUtils.smoothstep(alt, 0.003, 0.008);
          c.ch.update(c.camino, frente, 0.0016, on, 0, camL, f.focal, f.dpr, t);
        }
        // (from afar the hall is a glow, its light spread over all it covers: dimmer with the square of
        // the distance past a few tens of metres, so it never burns as one point)
        const dSala = Math.max(1e-9, camera.position.distanceTo(salaG.position)) / M;
        sala.u.uSala.value = tl.get('dc', p) * Math.min(1, (30 / dSala) ** 2);
        // (the city round it only on the way down and up: gone from afar, and from inside the hall)
        const altM = alt / M;
        ciudad.u.uCiudad.value = tl.get('dc', p) * Math.min(1, (20000 / Math.max(altM, 1)) ** 2) * THREE.MathUtils.smoothstep(altM, 40, 160);
        sala.u.uOla.value = tl.get('ola', p);
        const cp = tl.get('copias', p);
        // (each copy stays lit where it arrives, and they all fade together with the data centre)
        const enc = THREE.MathUtils.smoothstep(cp, 0.0, 0.04) * tl.get('dc', p);
        for (const c of copias) c.ch.update(arcoCopia(c), cp, 0.012, enc, 0, camL, f.focal, f.dpr, t);

        const ir = tl.get('ir', p);
        const wipe = ir > 0 ? tl.get('wipe', p) : -2;
        // The curtain sweeps from the left of the frame to its right: the camera's right, planet frame.
        const eje = V(1, 0, 0).applyQuaternion(camera.quaternion).applyQuaternion(inv);
        calorU.uIR.value = ir;
        calorU.uWipe.value = wipe;
        calorU.uWipeAx.value.copy(eje);
        calorU.uWarm.value = tl.get('warm', p);
        if (planeta.halo) planeta.halo.uColor.value.copy(HALO).lerp(HALO_IR, ir * ease(-1, 1, wipe));
        if (lucesN) {
          lucesN.u.uCamL.value.copy(camL);
          lucesN.u.uSunL.value.copy(solL);
          lucesN.u.uAnio.value = tl.get('anio', p);
          lucesN.u.uWipe.value = wipe;
          lucesN.u.uWipeAx.value.copy(eje);
          lucesN.u.uIR.value = ir;
          lucesN.u.uOlaL.value = tl.get('resto', p) > 0.001 ? Math.max(0, frente) * tl.get('cables', p) : 0;
          lucesN.u.uBaja.value = Math.min(1, alt / 0.006);
          lucesN.u.uLuz.value = THREE.MathUtils.smoothstep(alt, 0.000012, 0.00008);
        }
        const alto = tl.get('alto', p);
        cable.u.uAlto.value = alto;
        carga.u.uAlto.value = alto;
        carga.u.uInd.value = tl.get('ind', p);
        anillo.u.uAni.value = tl.get('ani', p);
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.25 * Math.sin(t * 1.5));

        // The planet hides what is behind it (the cable's far side, the ring behind the Earth).
        centroV.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
        for (const n of [cable, carga, anillo]) n.u.uOcc.value.set(centroV.x, centroV.y, centroV.z, 1.0);
        for (const c of corredores) c.ch.nube.u.uOcc.value.set(centroV.x, centroV.y, centroV.z, 1.0);
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        // Close up, the cable and the racks stay fine points.
        cableMar.u.uMaxPx.value = 3 * f.dpr;
        cables.u.uMaxPx.value = 4 * f.dpr;
        sala.u.uMaxPx.value = 5 * f.dpr;
        ciudad.u.uMaxPx.value = 3 * f.dpr;
        // Flying low over the towns: their lights stay points, not blurred discs.
        if (lucesN) lucesN.u.uMaxPx.value = lerp(2.5, 7, THREE.MathUtils.smoothstep(alt, 0.0002, 0.003)) * f.dpr;
      },
      efectos(p) {
        return { vel: tl.get('vel', p), calor: tl.get('warm', p) * tl.get('ir', p) * 0.9 };
      },
      placa(g, f) {
        // The curtain's edge while it sweeps.
        const ir = tl.get('ir', f.p);
        const w = tl.get('wipe', f.p);
        if (ir > 0.5 && w > -1 && w < 1) {
          const q = V(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(w).project(camera);
          const x = ((q.x + 1) / 2) * f.W;
          const grad = g.createLinearGradient(0, 0, 0, f.H);
          grad.addColorStop(0, 'rgba(255,140,80,0)');
          grad.addColorStop(0.5, 'rgba(255,140,80,0.55)');
          grad.addColorStop(1, 'rgba(255,140,80,0)');
          g.fillStyle = grad;
          g.fillRect(x - 0.75 * f.dpr, 0, 1.5 * f.dpr, f.H);
        }
      },
      dispose() {
        void lerp;
      },
    };
  },
};
