import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from '../../../estudios/motor/materia';
import { clamp, gauss, lerp } from '../../../estudios/motor/math';
import { CIUDADES } from '../../../estudios/ciudades';
import { HORIZONTE, TEAL, caraHacia, dirLatLon } from '../../../estudios/remake';
import { toma } from '../../../estudios/rig';
import { montar } from '../../../estudios/chispa';
import { marcoRadial } from '../../toma';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** The face turned to the camera at first, and where the elevator stands (on the equator, East Africa). */
export const CARA = { lat: 24, lon: 36 };
export const CABLE = { lat: 0, lon: 37 };
/** Where «tú» is: in the middle of the face, on the dark of the Red Sea between the lights (a city's core would drown it). */
export const TU_EN = { lat: 22.5, lon: 37.5 };
/** The Sun, behind the Earth and to the left: a thin day crescent on the left limb. */
export const SOL = V(-0.62, 0.22, -0.75).normalize();
export const ALTO = 11;

/**
 * The spark's way over the night Earth (the Earth's own frame, unit sphere): city to city in scene
 * 5 (s 0..4, London to Cairo), then here under the Red Sea and the Arabian Sea in a cable to Mumbai,
 * and into a data centre (s 4..9). Each stretch is one unit of s. [lat, lon, height in radii].
 */
export const PASOS: [number, number, number][] = [
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
  // (each hop an arc that leaves and lands softly, level at the city: an arc ending in a point made a
  // corner at every city, and the camera riding behind saw the spark dip at each)
  const h = PASOS[i][2] + (PASOS[i + 1][2] - PASOS[i][2]) * t + (PASOS[i][2] > 0.005 && PASOS[i + 1][2] > 0.005 ? 0.012 * Math.sin(Math.PI * t) ** 2 : 0);
  return out.normalize().multiplyScalar(1 + h);
}
/** How far along the route (radians of the Earth's arc) each stop is: the legs differ a lot in length. */
export const ARCOS = (() => {
  const a = [0];
  for (let i = 0; i + 1 < PASOS.length; i++) a.push(a[i] + Math.hypot(dirLatLon(PASOS[i][0], PASOS[i][1]).angleTo(dirLatLon(PASOS[i + 1][0], PASOS[i + 1][1])), PASOS[i + 1][2] - PASOS[i][2]));
  return a;
})();
export const arcoDe = (sv: number) => {
  const n = PASOS.length - 1;
  const x = Math.min(Math.max(sv, 0), n);
  const i = Math.min(Math.floor(x), n - 1);
  return ARCOS[i] + (x - i) * (ARCOS[i + 1] - ARCOS[i]);
};
export const svDe = (u: number) => {
  const n = PASOS.length - 1;
  if (u <= 0) return 0;
  if (u >= ARCOS[n]) return n;
  let i = 0;
  while (ARCOS[i + 1] < u) i++;
  return i + (u - ARCOS[i]) / Math.max(1e-9, ARCOS[i + 1] - ARCOS[i]);
};
/**
 * The route as the spark flies it: at each stop at the same s as `rutaTierra`, but by length, and its
 * pace changing smoothly from leg to leg (by stop, a short leg after a long one changed its pace at once
 * there, thirtyfold at Mumbai's last hop). The arc at s through the stops' arcs, monotone and smooth.
 */
export const PEND_ARCOS = (() => {
  const n = ARCOS.length;
  const m = new Float64Array(n);
  for (let k = 1; k < n - 1; k++) {
    const d0 = ARCOS[k] - ARCOS[k - 1];
    const d1 = ARCOS[k + 1] - ARCOS[k];
    if (d0 * d1 > 0) m[k] = (2 * d0 * d1) / (d0 + d1);
  }
  m[0] = ARCOS[1] - ARCOS[0];
  m[n - 1] = ARCOS[n - 1] - ARCOS[n - 2];
  return m;
})();
export function arcoSuave(sv: number) {
  const n = ARCOS.length - 1;
  const x = Math.min(Math.max(sv, 0), n);
  const i = Math.min(Math.floor(x), n - 1);
  const t = x - i;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ARCOS[i] + (t3 - 2 * t2 + t) * PEND_ARCOS[i] + (-2 * t3 + 3 * t2) * ARCOS[i + 1] + (t3 - t2) * PEND_ARCOS[i + 1];
}
export const tmpRuta = V();
export function rutaSuave(sv: number, out = V()) {
  // (and its corners at the stops rounded over a few hundred kilometres of arc: the way turned at
  // each city at once, and the camera flying close behind felt the corner)
  const u = arcoSuave(sv);
  out.set(0, 0, 0);
  let peso = 0;
  let radio = 0;
  for (let k = -4; k <= 4; k++) {
    const w = (1 - (k / 5) ** 2) ** 2;
    rutaTierra(svDe(u + k * 0.01), tmpRuta);
    out.addScaledVector(tmpRuta, w);
    radio += tmpRuta.length() * w;
    peso += w;
  }
  return out.setLength(radio / peso);
}
/**
 * The camera riding the spark over the Earth (its own frame): behind, a little above, looking
 * ahead. It rides by distance along the route, not by stop (a short leg and a long one take the
 * same s), so it can round each city in a wide curve without its average running ahead.
 */
export function montarTierra(sv: number) {
  return montar((x, o) => rutaTierra(svDe(x), o), arcoDe(sv), 0.016, 0.044, 0.012, rutaTierra(sv).normalize(), 0.09, true, 0.05);
}
/**
 * The ride over the night Earth, written (chasis/toma.ts `detras`): the same in despierta's end and
 * here, so the seam between them is the same picture. Behind the spark, over the ground below it
 * (its horizon level), the spark where the contract puts it.
 */
export const VUELO = { el: 34, ld: Math.log10(0.02) };
/**
 * The night Earth first seen (DIRECCION.md, scene 5): low over the Gulf of Aden, looking north-east
 * over the lights with the curve of the Earth ahead, gliding slowly east. `t` beats from the seam
 * (despierta lands on it, tierra goes on from it: the seam is one picture, and one glide). A shot
 * round the Earth's centre in the acts' units (the Earth turned by CARA).
 */
/** How much brighter the lights are as despierta lands on them (its network was them). */
export const BRILLO = 3;
export function llegada(t: number) {
  const d = dirLatLon(6 + 0.45 * t, 41 + 1.3 * t).applyQuaternion(caraHacia(CARA.lat, CARA.lon));
  const G = THREE.MathUtils.radToDeg;
  return { az: G(Math.atan2(d.x, d.z)), el: G(Math.asin(d.y)), ld: Math.log10(1.3 - 0.012 * t), pitch: -52, yaw: 70, fov: 50 };
}
/** The way's heading at route s (rounded over its stops), turned by the Earth's `q`. */
export function rumboTierra(sv: number, q: THREE.Quaternion, out = V()) {
  const u = arcoSuave(sv);
  return out.copy(rutaTierra(svDe(u + 0.1))).sub(rutaTierra(svDe(u - 0.1))).applyQuaternion(q);
}
/** The frame of the ground under route s (marcoRadial), the Earth turned by `q`. */
export function sueloTierra(sv: number, q: THREE.Quaternion) {
  return marcoRadial(rutaSuave(sv).applyQuaternion(q), V(), V(0, 1, 0).applyQuaternion(q));
}
/** Where the data centre is, and the cities its copies go to. */
export const DC = [19.1, 72.9];
export const COPIAS: [number, number][] = [
  [1.35, 103.8],
  [25.2, 55.3],
  [-1.3, 36.8],
  [28.6, 77.2],
  [13.1, 80.3],
  [24.9, 67.0],
];
export const HALO = new THREE.Color(0.35, 0.58, 1.0);
export const HALO_IR = new THREE.Color(1.0, 0.36, 0.12);
export const GEO = 6.6;

// ---------------------------------------------------------------- the lights

/** When a region's cities got their lights: [first, span] in years. */
export function inicio(lat: number, lon: number): [number, number] {
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
export function lpDe(anio: number) {
  const K: [number, number][] = [[1800, 11.81], [1900, 12.15], [1950, 12.54], [1975, 12.9], [2000, 13.11], [2026, 13.28]];
  if (anio <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (anio <= K[i][0]) return lerp(K[i - 1][1], K[i][1], (anio - K[i - 1][0]) / (K[i][0] - K[i - 1][0]));
  return K[K.length - 1][1];
}

export function base(c: THREE.Vector3) {
  const t1 = V(0, 1, 0).cross(c);
  if (t1.lengthSq() < 1e-8) t1.set(1, 0, 0);
  t1.normalize();
  return [t1, c.clone().cross(t1).normalize()];
}

export function slerp(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const w = a.angleTo(b);
  const s = Math.sin(w) || 1;
  return a.clone().multiplyScalar(Math.sin((1 - t) * w) / s).addScaledVector(b, Math.sin(t * w) / s);
}

export function esMar(img: ImageData, d: THREE.Vector3) {
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

export const centros = CIUDADES.map(([la, lo, pop]) => {
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

export const GLSL_LUCES = {
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
export function mapaCalor(img: ImageData): THREE.DataTexture {
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
export const CALOR = {
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
export function cableDatos(c: THREE.Vector3): MateriaData {
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
export function cargaDatos(c: THREE.Vector3): MateriaData {
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
export function anilloDatos(lonCable: number): MateriaData {
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
