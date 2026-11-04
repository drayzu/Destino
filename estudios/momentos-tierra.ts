import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from './motor/materia';
import { gauss } from './motor/math';
import { TEAL, dirLatLon } from './remake';

/**
 * Pieces of the Earth act's moments (tierra.ts): the world's undersea cables, that a pulse from
 * Mumbai lights coast to coast («Al otro lado del mundo»), and a hall of a data centre, rows of racks
 * with their blinking lights, that the camera flies into («Las máquinas que piensan»).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Where the pulse leaves from: Mumbai's landing station. */
export const ORIGEN_RED: [number, number] = [18.95, 72.82];

/**
 * The cables, roughly as they run (lat, lon waypoints at sea): each starts on one drawn before it,
 * so the pulse reaches every point by the shortest way along the network.
 */
const CABLES: [number, number][][] = [
  // West: the Arabian Sea, the Red Sea, Suez, the Mediterranean to Marseille.
  [[18.95, 72.82], [18.2, 70.5], [16.5, 65], [14.5, 58], [13.0, 52.0], [12.2, 46.5], [12.6, 43.4], [14.5, 42.2], [18.5, 40.0], [22.5, 37.8], [26.5, 35.0], [28.0, 33.6], [29.6, 32.6], [31.3, 32.3], [32.5, 30.0], [33.5, 26.0], [34.6, 21.5], [36.3, 15.6], [37.6, 11.0], [39.5, 7.5], [42.0, 6.0], [43.3, 5.4]],
  // Over land, across India: Pune and Hyderabad to Chennai; Nagpur and Kolkata, then by sea to the
  // Andaman Sea; and north to Delhi.
  [[18.95, 72.82], [18.5, 73.9], [17.4, 78.5], [13.1, 80.35]],
  [[18.95, 72.82], [21.1, 79.1], [22.6, 88.4], [21.0, 90.5], [16.5, 93.5], [11.0, 95.0], [6.0, 95.5]],
  [[18.95, 72.82], [23.0, 72.6], [26.9, 75.8], [28.6, 77.2]],
  // Gibraltar and up to Britain.
  [[37.6, 11.0], [37.4, 5.0], [36.5, 0.0], [36.0, -5.6], [36.6, -8.5], [38.5, -10.0], [42.0, -10.3], [44.5, -9.0], [47.5, -6.5], [50.0, -5.5], [50.8, -4.5]],
  // Across the Atlantic.
  [[50.8, -4.5], [51.0, -12], [50.0, -25], [47.0, -40], [43.5, -55], [41.0, -66], [40.5, -73.5]],
  // Down Africa's east coast to the Cape.
  [[12.2, 46.5], [11.6, 49.5], [9.0, 51.3], [5.0, 49.5], [2.0, 46.5], [-1.5, 42.5], [-4.1, 39.8], [-6.8, 39.6], [-11.0, 40.8], [-15.5, 41.0], [-20.0, 36.0], [-25.9, 33.1], [-29.9, 31.2], [-33.5, 27.5], [-34.6, 22.0], [-34.0, 18.4]],
  // And up the west coast to Lisbon.
  [[-34.0, 18.4], [-30.0, 15.5], [-22.0, 13.0], [-12.0, 12.0], [-6.0, 11.0], [0.0, 8.0], [3.5, 5.5], [6.3, 3.4], [4.5, -1.0], [4.5, -7.0], [6.3, -11.0], [9.5, -14.5], [14.7, -17.6], [21.0, -18.0], [28.0, -15.5], [33.5, -10.5], [36.6, -8.5]],
  // Karachi and the Gulf.
  [[18.95, 72.82], [21.5, 69.5], [24.0, 67.0], [25.0, 62.0], [24.5, 58.5], [26.4, 56.6], [25.4, 55.0], [26.3, 51.5], [29.3, 48.2]],
  // South round India to Colombo.
  [[18.95, 72.82], [15.0, 72.6], [10.5, 74.5], [7.5, 76.2], [5.6, 79.0], [6.9, 79.8]],
  // Up to Chennai.
  [[5.6, 79.0], [6.5, 82.0], [9.5, 81.5], [13.1, 80.35]],
  // East to Singapore through the Malacca Strait.
  [[5.6, 79.0], [5.8, 86.0], [6.0, 93.0], [5.6, 96.0], [4.5, 98.8], [3.0, 100.8], [1.9, 102.5], [1.3, 103.8]],
  // Up to Hong Kong.
  [[1.3, 103.8], [2.5, 105.5], [5.5, 107.5], [10.0, 109.6], [15.0, 111.0], [19.0, 113.0], [22.2, 114.2]],
  // Shanghai and Tokyo.
  [[22.2, 114.2], [23.5, 117.5], [25.5, 120.3], [28.0, 122.3], [31.2, 122.0], [31.5, 125.5], [32.5, 128.8], [33.2, 132.5], [33.6, 135.5], [34.6, 139.0], [35.0, 139.9]],
  // Across the Pacific: the other side of the world.
  [[35.0, 139.9], [35.0, 142.5], [38.0, 152], [41.0, 165], [42.5, 180], [42.0, -165], [40.0, -145], [38.0, -130], [37.6, -122.6]],
  // Manila.
  [[22.2, 114.2], [19.0, 117.5], [15.5, 119.7], [14.6, 120.9]],
  // Jakarta, Perth and round to Sydney, and on to Auckland.
  [[1.3, 103.8], [-1.5, 105.5], [-5.0, 106.5], [-6.1, 106.8]],
  [[-5.0, 106.5], [-6.0, 105.6], [-9.0, 107.0], [-14.0, 110.0], [-22.0, 112.5], [-31.9, 115.7], [-35.0, 116.0], [-36.0, 121.0], [-36.5, 130.0], [-38.5, 140.0], [-39.5, 145.0], [-38.5, 149.0], [-33.9, 151.25]],
  [[-33.9, 151.25], [-35.5, 160], [-36.8, 174.8]],
];

/** Where the cables land: a ring of light opens there as the pulse arrives. */
const PUERTOS: [number, number][] = [
  [43.3, 5.4], [50.8, -4.5], [40.5, -73.5], [-4.1, 39.8], [-34.0, 18.4], [6.3, 3.4], [24.0, 67.0], [25.4, 55.0], [6.9, 79.8], [13.1, 80.35], [1.3, 103.8], [22.2, 114.2], [31.2, 122.0], [35.0, 139.9], [37.6, -122.6], [14.6, 120.9], [-6.1, 106.8], [-31.9, 115.7], [-33.9, 151.25], [-36.8, 174.8], [31.3, 32.3], [12.6, 43.4], [-25.9, 33.1], [14.7, -17.6],
];

/**
 * The network in points, on the sea (unit sphere, the Earth's frame). `aKind`: how far the pulse
 * has to go to get there (radians along the cables); `aDelay`: 0 a cable, 1 a ring at a landing
 * (with `aFrom.x` its angle round the ring).
 */
export function redDatos(): MateriaData {
  const b = materiaBuilder(401);
  const r = b.r;
  const hechos: { p: THREE.Vector3; d: number }[] = [];
  const PASO = 0.0006;
  const llegada = (q: THREE.Vector3) => {
    let mejor = Infinity;
    for (const h of hechos) mejor = Math.min(mejor, h.d + h.p.angleTo(q));
    return mejor;
  };
  // Each cable from where it joins the network, its points knowing how far the pulse has come.
  for (const c of CABLES) {
    const pts = c.map(([la, lo]) => dirLatLon(la, lo));
    let d = hechos.length ? llegada(pts[0]) : 0;
    const propios: { p: THREE.Vector3; d: number }[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const z = pts[i + 1];
      const w = a.angleTo(z);
      const n = Math.max(1, Math.ceil(w / PASO));
      const s = Math.sin(w) || 1;
      for (let k = 0; k < n; k++) {
        const t = (k + r()) / n;
        const p = a.clone().multiplyScalar(Math.sin((1 - t) * w) / s).addScaledVector(z, Math.sin(t * w) / s);
        p.add(V(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.00012)).normalize().multiplyScalar(1.0009);
        b.push(p.x, p.y, p.z, TEAL, 0.0016, 0.9, { kind: d + t * w, delay: 0 });
        if (k % 6 === 0) propios.push({ p: p.clone().normalize(), d: d + t * w });
      }
      d += w;
    }
    hechos.push(...propios);
  }
  // The rings at the landings.
  for (const [la, lo] of PUERTOS) {
    const c = dirLatLon(la, lo);
    const d = llegada(c);
    for (let i = 0; i < 72; i++) b.push(c.x, c.y, c.z, TEAL, 0.0022, 1.2, { kind: d, delay: 1, from: [(i / 72) * Math.PI * 2, 0, 0] });
  }
  return b.data();
}

/**
 * Each cable as a way for a spark: where the pulse reaches its start (radians along the network),
 * its length, and the place on it (just over the sea) for a distance along the network.
 */
export function rutasRed() {
  const hechos: { p: THREE.Vector3; d: number }[] = [];
  const llegada = (q: THREE.Vector3) => {
    let mejor = Infinity;
    for (const h of hechos) mejor = Math.min(mejor, h.d + h.p.angleTo(q));
    return mejor;
  };
  return CABLES.map((c) => {
    const pts = c.map(([la, lo]) => dirLatLon(la, lo));
    const d0 = hechos.length ? llegada(pts[0]) : 0;
    const acum = [0];
    for (let i = 0; i + 1 < pts.length; i++) acum.push(acum[i] + pts[i].angleTo(pts[i + 1]));
    for (let i = 0; i + 1 < pts.length; i++) for (let k = 0; k < 8; k++) {
      const t = k / 8;
      hechos.push({ p: pts[i].clone().lerp(pts[i + 1], t).normalize(), d: d0 + acum[i] + t * (acum[i + 1] - acum[i]) });
    }
    const largo = acum[acum.length - 1];
    const camino = (sv: number, out: THREE.Vector3) => {
      const x = THREE.MathUtils.clamp(sv - d0, 0, largo);
      let i = 0;
      while (i < acum.length - 2 && acum[i + 1] < x) i++;
      const w = acum[i + 1] - acum[i];
      const t = w > 0 ? (x - acum[i]) / w : 0;
      const sw = Math.sin(w) || 1;
      out.copy(pts[i]).multiplyScalar(Math.sin((1 - t) * w) / sw).addScaledVector(pts[i + 1], Math.sin(t * w) / sw);
      return out.normalize().multiplyScalar(1.0016);
    };
    return { d0, largo, camino };
  });
}

/** GLSL for the network: a bright head where the pulse is, a lit wake, a faint glow it leaves. */
export const GLSL_RED = {
  pre: /* glsl */ `
    uniform float uFrente, uRed, uResto;
    uniform vec3 uCamL;
    float delanteR(vec3 p, vec3 camL) {
      vec3 n = normalize(p);
      return smoothstep(-0.015, 0.03, dot(n, normalize(camL - p)));
    }
  `,
  move: /* glsl */ `
    float dF = uFrente - aKind;
    float llego = step(0.0, dF);
    if (aDelay > 0.5) {
      // A ring opening on the sea round the landing.
      vec3 c = normalize(position);
      vec3 t1 = normalize(cross(abs(c.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), c));
      vec3 t2 = cross(c, t1);
      float rad = 0.003 + 0.035 * (1.0 - exp(-max(dF, 0.0) * 9.0));
      p = normalize(c + (t1 * cos(aFrom.x) + t2 * sin(aFrom.x)) * rad) * 1.001;
      em *= llego * exp(-max(dF, 0.0) * 7.0) * 0.9;
    } else {
      float cabeza = exp(-dF * dF / (2.0 * 0.01 * 0.01));
      float estela = llego * exp(-max(dF, 0.0) / 0.07);
      // (and after it, the data keeps flowing: dashes running out along every cable)
      float tren = (smoothstep(0.7, 0.88, fract((aKind - uTime * 0.1) / 0.05)) * (1.0 - smoothstep(0.88, 1.0, fract((aKind - uTime * 0.1) / 0.05)))) * smoothstep(0.0, 0.15, dF);
      em *= (cabeza * 3.0 + estela * 1.8) * mix(0.25, 1.0, smoothstep(0.0, 0.12, aKind)) + llego * uResto * (0.35 + 1.1 * tren);
      sz *= 1.0 + 1.5 * cabeza;
    }
    // (dimmer right under the camera: a head running beneath it would fill the frame with its glow)
    em *= uRed * delanteR(p, uCamL) * mix(0.12, 1.0, smoothstep(0.02, 0.12, length(p - uCamL)));
  `,
};

// ---------------------------------------------------------------- the data centre's hall

/** The hall, in metres (x east along the aisles, y up, z south), its middle at the origin. */
export const SALA = { pares: 6, racks: 48, ancho: 0.6, fondo: 1.05, pasillo: 1.3, alto: 2.0 };
const PASO_SALA = SALA.fondo * 2 + SALA.pasillo;
const Z0_SALA = -(SALA.pares * PASO_SALA - SALA.pasillo) / 2;
/** The aisle the camera flies down (the middle one), its z; and the hall's length. */
export const PASILLO_Z = Z0_SALA + 2 * PASO_SALA + 2 * SALA.fondo + SALA.pasillo / 2;
export const LARGO_SALA = SALA.racks * SALA.ancho;

/**
 * The racks: each a cabinet with a column of servers whose small lights blink (blue-white, some
 * green, a few amber), its frame a faint line of points; the floor's tiles. Racks stand in pairs back
 * to back with an aisle between their fronts. `aKind`: a light's phase; `aDelay`: 0 a light, 1 the
 * frame, 2 the floor; `aFrom.x` how far along the hall it is (for the wave that runs down it).
 */
export function salaDatos(): MateriaData {
  const b = materiaBuilder(409);
  const r = b.r;
  const AZUL = new THREE.Color(0.62, 0.8, 1.0);
  const VERDE = new THREE.Color(0.45, 1.0, 0.6);
  const AMBAR = new THREE.Color(1.0, 0.66, 0.25);
  const MARCO = new THREE.Color(0.32, 0.38, 0.48);
  const largo = LARGO_SALA;
  const paso = PASO_SALA;
  const z0 = Z0_SALA;
  for (let par = 0; par < SALA.pares; par++) {
    // Two rows back to back; their fronts face the aisles on either side.
    for (const lado of [-1, 1]) {
      const zFrente = z0 + par * paso + SALA.fondo + lado * SALA.fondo;
      for (let k = 0; k < SALA.racks; k++) {
        const x0 = -largo / 2 + k * SALA.ancho;
        // The frame: the cabinet's front edges and top.
        for (let i = 0; i < 26; i++) {
          const y = (i / 25) * SALA.alto;
          b.push(x0 + 0.02, y, zFrente, MARCO, 0.012, 0.22, { delay: 1, from: [x0, 0, 0] });
        }
        for (let i = 0; i < 8; i++) b.push(x0 + (i / 8) * SALA.ancho, SALA.alto, zFrente, MARCO, 0.012, 0.22, { delay: 1, from: [x0, 0, 0] });
        // The servers' lights: 3 across, one row per unit (every 9 cm), not every slot full.
        for (let u = 0; u < 20; u++) {
          if (r() < 0.12) continue;
          const y = 0.18 + u * 0.09;
          for (let j = 0; j < 3; j++) {
            const x = x0 + 0.1 + j * 0.035 + (j === 2 ? 0.28 : 0);
            const q = r();
            const col = q < 0.72 ? AZUL : q < 0.92 ? VERDE : AMBAR;
            b.push(x, y, zFrente + lado * 0.004, col, 0.011, 0.6 + r() * 0.6, { kind: r(), delay: 0, from: [x, 0, 0] });
          }
        }
      }
    }
  }
  // The floor's tiles, faint.
  for (let x = -largo / 2 - 3; x <= largo / 2 + 3; x += 0.6)
    for (let z = z0 - 1.5; z <= -z0 + 1.5; z += 0.6) b.push(x, 0, z, MARCO, 0.012, 0.16, { delay: 2, from: [x, 0, 0] });
  // Over each aisle, a line of lamps.
  const LAMPARA = new THREE.Color(0.85, 0.92, 1.0);
  for (let par = 0; par <= SALA.pares; par++) {
    const z = z0 + par * paso - SALA.pasillo / 2;
    for (let x = -largo / 2 + 1.2; x < largo / 2; x += 2.4)
      for (let i = 0; i < 12; i++) b.push(x + (i / 11 - 0.5) * 1.2, 2.95, z + (r() - 0.5) * 0.12, LAMPARA, 0.02, 0.32, { delay: 3, from: [x, 0, 0] });
  }
  return b.data();
}

/**
 * The city round the data centre, for the way down (metres, the hall's frame): streetlights along a
 * grid of roads and scattered buildings, thicker towards its middle, the sea dark to the west of a
 * ragged coast; none within a few hundred metres of the hall.
 */
export function ciudadDatos(): MateriaData {
  const b = materiaBuilder(419);
  const r = b.r;
  const SODIO = new THREE.Color(1.0, 0.58, 0.24);
  const BLANCA = new THREE.Color(1.0, 0.84, 0.64);
  const costa = (z: number) => -8500 + 1400 * Math.sin(z / 3800) + 500 * Math.sin(z / 1100 + 1.3);
  const giro = 0.3;
  const c = Math.cos(giro);
  const sn = Math.sin(giro);
  let n = 0;
  while (n < 26000) {
    let x = (r() - 0.5) * 36000;
    let z = (r() - 0.5) * 36000;
    // (on a road two times in three: snapped to the nearest line of a turned grid)
    if (r() < 0.66) {
      const u = x * c + z * sn;
      const v = -x * sn + z * c;
      const paso = r() < 0.3 ? 1600 : 420;
      const [u2, v2] = r() < 0.5 ? [Math.round(u / paso) * paso, v] : [u, Math.round(v / paso) * paso];
      x = u2 * c - v2 * sn;
      z = u2 * sn + v2 * c;
    }
    if (x < costa(z)) continue;
    const d = Math.hypot(x + 4000, z - 2000);
    if (r() > Math.exp(-(d * d) / (2 * 9000 * 9000)) || Math.hypot(x, z) < 140) continue;
    n++;
    b.push(x, 5 + r() * 25, z, r() < 0.15 ? BLANCA : SODIO, 6, 1.1 + r() * 1.2);
  }
  // Round the hall itself: the lamps of its yard and of the road that comes to it.
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    b.push(Math.cos(a) * 70 * 1.4, 4, Math.sin(a) * 70, BLANCA, 3, 0.9 + r() * 0.4);
  }
  for (let i = 0; i < 160; i++) b.push(-100 - i * 22, 4, 30 + Math.sin(i * 0.05) * 40, SODIO, 4, 1.0 + r() * 0.5);
  return b.data();
}

/** GLSL for the hall: the lights blink; a teal wave runs down the hall from where the spark came in. */
export const GLSL_SALA = {
  pre: /* glsl */ `uniform float uSala, uOla, uXOla; uniform vec3 uTealS;`,
  move: /* glsl */ `
    if (aDelay > 2.5) em *= 1.0;
    else if (aDelay < 0.5) {
      float f = fract(aKind * 13.7 + uTime * (0.4 + 1.6 * fract(aKind * 7.1)));
      em *= 0.35 + 0.9 * step(0.42, f);
      // The thought enters the machines: a teal front runs down the hall, and leaves many of them teal.
      float dx = abs(aFrom.x - uXOla) - uOla;
      float frente = exp(-dx * dx / 4.0);
      float queda = step(dx, 0.0) * step(0.5, fract(aKind * 31.3));
      float lum = max(max(em.r, em.g), em.b);
      em = mix(em, uTealS * (lum * 1.4 + 0.2), clamp(frente + queda * 0.85, 0.0, 1.0));
      em *= 1.0 + 2.5 * frente;
    }
    em *= uSala;
  `,
};
