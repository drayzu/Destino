import * as THREE from 'three';

/**
 * Galaxies as the sky has them, not one spiral copied (Diego, 30 Oct: «todas se ven iguales y
 * perfectas»): grand-design spirals, open or tight; barred spirals; spirals of many ragged arms;
 * ellipticals, round or flattened, old and warm; lenticulars, a disc with no arms; irregulars, clumpy
 * and blue. Each its own size, tilt, lopsidedness and colour.
 *
 * `formaGalaxia` draws one round a centre into `emit(x, y, z, t, luz, tinte)`: the offset from the
 * centre, how far out (0 core .. 1 edge, for colour ramps), the light, and a tint to multiply the
 * scene's own colour by (warm cores, blue arms, pink star-forming knots).
 */

export type Emitir = (x: number, y: number, z: number, t: number, luz: number, tinte: THREE.Color) => void;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CALIDO = new THREE.Color(1.0, 0.86, 0.66);
const VIEJO = new THREE.Color(1.0, 0.8, 0.58);
const AZUL = new THREE.Color(0.78, 0.88, 1.0);
const BLANCO = new THREE.Color(1, 1, 1);
const ROSA = new THREE.Color(1.0, 0.62, 0.72);

/** One galaxy of `n` points, about `R` across its disc, round the origin. */
export function formaGalaxia(r: () => number, n: number, R0: number, emit: Emitir) {
  const g = () => (r() + r() + r() + r() - 2) * 0.866;
  // Its size: most small, a few large.
  const R = R0 * Math.exp(g() * 0.45);
  // Its tilt, and a disc frame.
  const eje = V(g(), g(), g()).normalize();
  const t1 = V(0, 1, 0).cross(eje);
  if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
  t1.normalize();
  const t2 = eje.clone().cross(t1);
  const en = (a: number, b: number, h: number, t: number, luz: number, tinte: THREE.Color) => {
    emit(t1.x * a + t2.x * b + eje.x * h, t1.y * a + t2.y * b + eje.y * h, t1.z * a + t2.z * b + eje.z * h, t, luz, tinte);
  };
  const tipo = r();
  if (tipo < 0.26) espiral(r, g, n, R, en, 2, 1.4 + r() * 2.2, r() < 0.3);
  else if (tipo < 0.42) espiral(r, g, n, R, en, 2, 1.6 + r() * 1.4, true, true);
  else if (tipo < 0.58) espiral(r, g, n, R, en, 3 + Math.floor(r() * 3), 1.2 + r() * 1.6, false, false, true);
  else if (tipo < 0.78) eliptica(r, g, n, R, en);
  else if (tipo < 0.88) lenticular(r, g, n, R, en);
  else irregular(r, g, n, R, en);
}

type En = (a: number, b: number, h: number, t: number, luz: number, tinte: THREE.Color) => void;

/** A spiral: a bulge, `brazos` arms winding at `paso`, perhaps a bar, perhaps ragged and clumpy. */
function espiral(r: () => number, g: () => number, n: number, R: number, en: En, brazos: number, paso: number, lado = false, barra = false, grumos = false) {
  const giro = r() * Math.PI * 2;
  const bulbo = 0.12 + r() * 0.12;
  const largoBarra = barra ? 0.25 + r() * 0.2 : 0;
  // Lopsided a little: one side's arms a touch longer.
  const ladeo = lado ? 0.25 : 0.08;
  const nucleo = Math.floor(n * (0.18 + 0.1 * r()));
  for (let k = 0; k < n; k++) {
    if (k < nucleo) {
      en(g() * R * bulbo, g() * R * bulbo, g() * R * bulbo * 0.7, 0, 1.0, CALIDO);
      continue;
    }
    if (barra && k < nucleo * 1.6) {
      const x = (r() * 2 - 1) * R * largoBarra;
      en(x * Math.cos(giro) - g() * R * 0.04 * Math.sin(giro), x * Math.sin(giro) + g() * R * 0.04 * Math.cos(giro), g() * R * 0.03, 0.15, 0.8, CALIDO);
      continue;
    }
    const b = k % brazos;
    const q0 = Math.sqrt(r());
    const q = (largoBarra + (1 - largoBarra) * q0) * R * (1 + ladeo * Math.cos(giro + (b / brazos) * Math.PI * 2));
    const fase = (b / brazos) * Math.PI * 2 + giro + Math.log(q / R + 0.05) * paso;
    const ancho = grumos ? 0.55 : 0.32;
    const a = fase + g() * ancho * (0.6 + q0);
    let x = Math.cos(a) * q;
    let y = Math.sin(a) * q;
    // Ragged arms: points gathered in knots along them.
    if (grumos && r() < 0.5) {
      const kx = Math.round(x / (R * 0.12)) * R * 0.12;
      const ky = Math.round(y / (R * 0.12)) * R * 0.12;
      x = kx + g() * R * 0.03;
      y = ky + g() * R * 0.03;
    }
    const rosa = r() < 0.05;
    en(x, y, g() * R * 0.04, 0.15 + 0.7 * q0, rosa ? 0.9 : 0.5, rosa ? ROSA : q0 < 0.3 ? BLANCO : AZUL);
  }
}

/** An elliptical: a smooth swarm, brightest at the middle, round or flattened, old and warm. */
function eliptica(r: () => number, g: () => number, n: number, R: number, en: En) {
  const b = 0.45 + r() * 0.55;
  const c = 0.35 + r() * 0.65;
  for (let k = 0; k < n; k++) {
    // Steep towards the middle (most of its light in its heart).
    const q = Math.pow(r(), 2.2) * R * 0.9;
    const x = g();
    const y = g();
    const z = g();
    const l = Math.hypot(x, y, z) || 1;
    en((x / l) * q, (y / l) * q * b, (z / l) * q * c, q / R, 0.45 + 0.6 * (1 - q / R), VIEJO);
  }
}

/** A lenticular: a bulge and a smooth disc, no arms. */
function lenticular(r: () => number, g: () => number, n: number, R: number, en: En) {
  for (let k = 0; k < n; k++) {
    if (k < n * 0.35) {
      en(g() * R * 0.18, g() * R * 0.18, g() * R * 0.12, 0, 0.95, CALIDO);
      continue;
    }
    const a = r() * Math.PI * 2;
    const q = (0.1 + Math.pow(r(), 0.8) * 0.9) * R;
    en(Math.cos(a) * q, Math.sin(a) * q, g() * R * 0.025, q / R, 0.45, VIEJO);
  }
}

/** An irregular: clumps of young blue stars and pink nebulae, no order. */
function irregular(r: () => number, g: () => number, n: number, R: number, en: En) {
  const nudos = 3 + Math.floor(r() * 5);
  const cs = Array.from({ length: nudos }, () => [g() * R * 0.5, g() * R * 0.35, g() * R * 0.2]);
  for (let k = 0; k < n; k++) {
    const c = cs[Math.floor(r() * nudos)];
    const s = R * (0.08 + 0.12 * r());
    const rosa = r() < 0.12;
    en(c[0] + g() * s, c[1] + g() * s, c[2] + g() * s * 0.6, 0.5, rosa ? 0.85 : 0.5, rosa ? ROSA : AZUL);
  }
}
