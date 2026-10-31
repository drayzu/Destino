import * as THREE from 'three';
import type { Camino } from './chispa';
import { caraHacia, dirLatLon } from './remake';
import { CARA } from './tierra';
import { E, FIN_RIEL_LUNA, LUNA, M, MA, N_LUNA, RE, RL, RM, RMA, RV, SOL_V, U_LUNA, VE, caminoRio, enRiel, enRielLuna, enRielX } from './interior';

/**
 * A flight the spark makes without ever stopping, and the camera that chases it (Diego, 30 Oct: «el
 * viaje del pensamiento debe ser fluido… debe parecer como que estamos volando de forma continua»).
 *
 * - Its way is one smooth curve through the points given.
 * - Its clock is the act's: each stretch between two named points takes the beats given, and within
 *   it the spark goes as fast as the worlds near it are far (the same sense of speed by a world and
 *   between worlds, quicker still in the open); along a launcher it gains speed. The distance along
 *   the way, read against time, is then smoothed, so the speed itself never jumps.
 * - The camera chases it a fixed time behind (so its distance follows the speed, as it would behind
 *   anything that flies), above and off to a side (its wake seen along its length, never end on);
 *   by a world it moves out from it and its gaze leans towards it, the world beside the spark, never
 *   so far that the spark leaves the frame, and never back over its shoulder.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const D2R = THREE.MathUtils.degToRad;
const smooth = THREE.MathUtils.smoothstep;

export interface Mundo {
  pos: THREE.Vector3;
  R: number;
  /** How far the camera moves out from it, in the chase's own scale. */
  fuera: number;
  /** How much the gaze leans to it. */
  mira: number;
  /** How far behind it may be (cosine against the way) and still hold the gaze. */
  atras: number;
}

export interface Vuelo {
  /** The spark at flight time τ (beats since it left). */
  camino: Camino;
  /** The chase at τ: the camera's place and the point it looks at; returns the way's direction. */
  seguir(tau: number, lugar: THREE.Vector3, mira: THREE.Vector3): THREE.Vector3;
  velEn(tau: number, out: THREE.Vector3): THREE.Vector3;
  /** When the spark is at a named point. */
  tauDe(nombre: string): number;
}

export function crearVuelo(
  puntos: THREE.Vector3[],
  hito: Record<string, number>,
  dura: [string, string, number][],
  acelera: string[],
  escalas: { pos: THREE.Vector3; R: number }[],
  mundos: Mundo[],
): Vuelo {
  const ruta = new THREE.CatmullRomCurve3(puntos, false, 'centripetal');
  const escalaEn = (q: THREE.Vector3) => {
    let k = 0;
    for (const x of escalas) k += Math.pow(Math.max(1e-6, q.distanceTo(x.pos)), -3);
    return Math.pow(k, -1 / 3);
  };
  // Length along the way, and how much time each bit asks for.
  const NS = 160000;
  const lTab = new Float64Array(NS + 1);
  const wTab = new Float64Array(NS + 1);
  {
    const q0 = ruta.getPoint(0, V());
    const q1 = V();
    for (let k = 1; k <= NS; k++) {
      ruta.getPoint(k / NS, q1);
      const dL = q1.distanceTo(q0);
      lTab[k] = lTab[k - 1] + dL;
      const Dk = escalaEn(q1);
      // (not quite in proportion: by a world it would all but stop, as if to land, and in the open
      // surge away; a gentler curve)
      wTab[k] = dL / (Math.pow(Dk, 0.75) * (1 + 2 * smooth(Dk, 1.5, 12)));
      q0.copy(q1);
    }
  }
  const kDe = (n: string) => Math.round((hito[n] / (puntos.length - 1)) * NS);
  const tauTab = new Float64Array(NS + 1);
  for (const [a, b, d] of dura) {
    const ka = kDe(a);
    const kb = kDe(b);
    let suma = 0;
    for (let k = ka + 1; k <= kb; k++) {
      if (acelera.includes(a)) wTab[k] /= 0.35 + (k - ka) / (kb - ka);
      suma += wTab[k];
    }
    for (let k = ka + 1; k <= kb; k++) tauTab[k] = tauTab[k - 1] + (wTab[k] * d) / suma;
  }
  const kFin = kDe(dura[dura.length - 1][1]);
  const TAU_FIN = tauTab[kFin];
  const L_FIN = lTab[kFin];
  // (past its last point it goes on at the speed it had, straight on: the act that takes it from
  // there leads it on its own way)
  const vFin = (lTab[kFin] - lTab[kFin - 200]) / Math.max(1e-9, tauTab[kFin] - tauTab[kFin - 200]);
  const finP = ruta.getPoint(kFin / NS, V());
  const finT = finP.clone().sub(ruta.getPoint((kFin - 200) / NS, V())).normalize();
  const DT = 0.02;
  const SIG = 0.35;
  const PAD = Math.ceil((3 * SIG) / DT);
  const MAS = 6;
  // (the grid starts a little before it leaves: smoothed, it eases off its rest before τ = 0)
  const T_MIN = -PAD * DT;
  const NG = Math.ceil((TAU_FIN + MAS - T_MIN) / DT) + 1;
  const lGrid = new Float64Array(NG);
  {
    const crudo = new Float64Array(NG + 2 * PAD);
    let k = 0;
    for (let j = 0; j < crudo.length; j++) {
      const tau = T_MIN + (j - PAD) * DT;
      if (tau <= 0) crudo[j] = 0;
      else if (tau >= TAU_FIN) crudo[j] = L_FIN + vFin * (tau - TAU_FIN);
      else {
        while (k < kFin - 1 && tauTab[k + 1] < tau) k++;
        const f = (tau - tauTab[k]) / Math.max(1e-12, tauTab[k + 1] - tauTab[k]);
        crudo[j] = lTab[k] + (lTab[k + 1] - lTab[k]) * THREE.MathUtils.clamp(f, 0, 1);
      }
    }
    const nucleo: number[] = [];
    let sn = 0;
    for (let i = -PAD; i <= PAD; i++) {
      const w = Math.exp(-0.5 * Math.pow((i * DT) / SIG, 2));
      nucleo.push(w);
      sn += w;
    }
    for (let j = 0; j < NG; j++) {
      let acc = 0;
      for (let i = 0; i < nucleo.length; i++) acc += crudo[j + i] * nucleo[i];
      lGrid[j] = acc / sn;
    }
  }
  const tDeL = (L: number) => {
    let lo = 0;
    let hi = kFin;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lTab[mid] <= L) lo = mid;
      else hi = mid;
    }
    const f = (L - lTab[lo]) / Math.max(1e-12, lTab[hi] - lTab[lo]);
    return (lo + THREE.MathUtils.clamp(f, 0, 1)) / NS;
  };
  const lDeTau = (tau: number) => {
    const x = THREE.MathUtils.clamp((tau - T_MIN) / DT, 0, NG - 1);
    const j = Math.min(NG - 2, Math.floor(x));
    return lGrid[j] + (lGrid[j + 1] - lGrid[j]) * (x - j);
  };
  const camino: Camino = (sv, out) => {
    const L = lDeTau(sv);
    if (L <= L_FIN) return ruta.getPoint(tDeL(L), out);
    return out.copy(finP).addScaledVector(finT, L - L_FIN);
  };
  const tauDe = (n: string) => tauTab[kDe(n)];

  const CAMPANA = Array.from({ length: 16 }, (_, i) => {
    const u = ((i + 0.5) / 16) * 2 - 1;
    return (1 - u * u) ** 2;
  });
  const CAMPANA_S = CAMPANA.reduce((a, b) => a + b, 0);
  const tmpC = V();
  const tmpD = V();
  const prom = (tau: number, w: number, out: THREE.Vector3) => {
    out.set(0, 0, 0);
    for (let i = 0; i < 16; i++) out.addScaledVector(camino(tau + (((i + 0.5) / 16) * 2 - 1) * w, tmpC), CAMPANA[i] / CAMPANA_S);
    return out;
  };
  const velEn = (tau: number, out: THREE.Vector3) => camino(tau + 0.06, out).sub(camino(tau - 0.06, tmpD)).divideScalar(0.12);
  const T0 = ruta.getTangent(0, V()).normalize();
  const LAG = 0.4;
  const seguir = (tau: number, lugarO: THREE.Vector3, miraO: THREE.Vector3) => {
    const P = camino(tau, V());
    // (its way's direction; at rest, the way it will leave by, blended in as it gets going)
    const T = velEn(tau - LAG * 0.5, V());
    const rap = T.length();
    T.addScaledVector(T0, 0.02).normalize();
    // (where it was a moment ago, a little smoothed; never nearer than the worlds round it allow,
    // so by the Moon the camera sees a globe, not its grains)
    prom(tau - LAG, 0.22, lugarO);
    const dist = lugarO.distanceTo(P);
    const esc = Math.hypot(dist, 0.6 * escalaEn(P));
    const S = T.clone().cross(Y);
    if (S.lengthSq() < 1e-8) S.set(1, 0, 0);
    S.normalize();
    lugarO.addScaledVector(T, -(esc - dist)).addScaledVector(Y, 0.4 * esc).addScaledVector(S, 0.55 * esc);
    const pesos = mundos.map((x) => 1 - smooth(P.distanceTo(x.pos) / x.R, 4.5, 13));
    mundos.forEach((x, i) => {
      if (pesos[i] > 0) lugarO.addScaledVector(P.clone().sub(x.pos).normalize(), x.fuera * pesos[i] * esc);
    });
    prom(tau + 0.12, 0.3, miraO);
    const dS = miraO.clone().sub(lugarO);
    const LS = Math.max(1e-9, dS.length());
    dS.divideScalar(LS);
    const hacia = V();
    mundos.forEach((x, i) => {
      if (pesos[i] <= 0) return;
      const dB = x.pos.clone().sub(lugarO).normalize();
      hacia.addScaledVector(dB, x.mira * pesos[i] * smooth(dB.dot(T), x.atras, x.atras + 0.4));
    });
    const m = Math.min(1, hacia.length());
    if (m > 1e-4) {
      hacia.normalize();
      const th = dS.angleTo(hacia);
      const TH = 0.3;
      const eje = dS.clone().cross(hacia);
      if (eje.lengthSq() > 1e-12) dS.applyAxisAngle(eje.normalize(), TH * Math.tanh((m * th) / TH));
    }
    miraO.copy(lugarO).addScaledVector(dS, LS);
    return T;
  };
  return { camino, seguir, velEn, tauDe };
}

/** Never into a world: near one the place is eased out to a little over its ground. */
export const SUELOS = [
  { pos: E, R: RE, r0: 1.12, r1: 1.6 },
  { pos: LUNA, R: RL, r0: 1.12, r1: 1.6 },
  { pos: MA, R: RMA, r0: 1.1, r1: 1.3 },
  { pos: VE, R: RV, r0: 1.08, r1: 1.22 },
  { pos: M, R: RM, r0: 1.06, r1: 1.2 },
];
export function suelo(lugar: THREE.Vector3) {
  for (const x of SUELOS) {
    const d = lugar.distanceTo(x.pos);
    const r0 = x.R * x.r0;
    const r1 = x.R * x.r1;
    if (d < r1) lugar.sub(x.pos).setLength(r0 + (r1 - r0) * Math.exp((d - r1) / (r1 - r0))).add(x.pos);
  }
  return lugar;
}

/** Where scene 7 leaves the camera: high over the Earth, the ring open. */
export const DIR7 = (() => {
  const q = caraHacia(CARA.lat, CARA.lon);
  const cW = dirLatLon(0, 37).applyQuaternion(q);
  const norte = Y.clone().applyQuaternion(q);
  return cW.applyAxisAngle(norte, D2R(-75)).multiplyScalar(Math.cos(0.84)).addScaledVector(norte, Math.sin(0.84)).normalize();
})();

let interior: Vuelo | null = null;
/**
 * The spark through the inner system, acts III's sistema and mercurio together (one flight: the act
 * that ends hands it to the next in mid air). From the Earth's face scene 7 leaves in sight, low
 * round its day side to the Moon, down onto its launcher and off it; once round Mars, under the
 * ring of mirrors at its south pole; across to Venus and round behind it (the parasol hiding the
 * Sun), low over a city on its night side and up away; across to Mercury, down onto its rail, fired
 * along it, and down the river of rock to the swarm.
 */
export function vueloInterior(): Vuelo {
  if (interior) return interior;
  const sM = MA.clone().negate().setY(0).normalize();
  const lM = Y.clone().cross(sM).normalize();
  const enMarte = (az: number, r: number, y: number) => MA.clone().addScaledVector(sM, Math.cos(D2R(az)) * r).addScaledVector(lM, Math.sin(D2R(az)) * r).addScaledVector(Y, y);
  const sV = SOL_V.clone().setY(0).normalize();
  const lV = Y.clone().cross(sV).normalize();
  const enVenus = (az: number, el: number, r: number) =>
    VE.clone()
      .addScaledVector(sV, Math.cos(D2R(az)) * Math.cos(D2R(el)) * r)
      .addScaledVector(lV, Math.sin(D2R(az)) * Math.cos(D2R(el)) * r)
      .addScaledVector(Y, Math.sin(D2R(el)) * r);
  const puntos: THREE.Vector3[] = [];
  const hito: Record<string, number> = {};
  const pon = (q: THREE.Vector3, nombre?: string) => {
    if (nombre) hito[nombre] = puntos.length;
    puntos.push(q);
  };
  const dirEL = LUNA.clone().sub(E).normalize();
  // The Earth and the Moon.
  pon(E.clone().addScaledVector(DIR7, RE * 1.2), 'inicio');
  pon(E.clone().addScaledVector(DIR7.clone().multiplyScalar(0.6).addScaledVector(dirEL, 0.45).normalize(), RE * 1.5));
  pon(E.clone().addScaledVector(DIR7.clone().multiplyScalar(0.18).addScaledVector(dirEL, 0.85).normalize(), RE * 2.0));
  pon(LUNA.clone().addScaledVector(U_LUNA, -0.26).addScaledVector(N_LUNA, -0.05));
  pon(enRielLuna(-0.55, 0.02));
  pon(enRielLuna(-0.25, 0.006));
  for (let i = 0; i <= 10; i++) pon(enRielLuna(i / 10, 0.0012), i === 0 ? 'riel0' : i === 10 ? 'riel1' : undefined);
  // Off the Moon towards Mars; once round it.
  pon(FIN_RIEL_LUNA.clone().addScaledVector(U_LUNA, 0.1).addScaledVector(N_LUNA, 0.004));
  pon(FIN_RIEL_LUNA.clone().addScaledVector(U_LUNA, 0.6).addScaledVector(N_LUNA, 0.05));
  pon(LUNA.clone().lerp(MA, 0.3).addScaledVector(Y, 0.8));
  pon(enMarte(-38, 4.2, 0.35));
  pon(enMarte(15, 1.0, 0.15), 'marte');
  pon(enMarte(70, 0.64, 0.03));
  pon(enMarte(125, 0.62, -0.3));
  pon(enMarte(180, 0.52, -0.56));
  pon(enMarte(235, 0.62, -0.3));
  pon(enMarte(290, 0.85, 0.0), 'marte2');
  pon(enMarte(323, 2.6, 0.15));
  // Across, above the plane, to Venus' side; round behind it at an even height, over the lights of
  // a city on its night side, and up away from it (never between it and the parasol, sunward; never
  // so low it seems to land).
  pon(MA.clone().lerp(VE, 0.5).addScaledVector(Y, 1.6));
  pon(enVenus(72, 7, RV * 13));
  pon(enVenus(100, 8, RV * 4), 'venus');
  pon(enVenus(148, 5, RV * 3));
  pon(enVenus(182, 4, RV * 2.75));
  pon(enVenus(210, 8, RV * 2.5));
  pon(enVenus(232, 14, RV * 2.3));
  pon(enVenus(252, 20, RV * 2.45), 'venus2');
  pon(enVenus(268, 28, RV * 3.4));
  pon(enVenus(280, 34, RV * 6));
  // Across to Mercury (the act changes here, in mid air), down onto its rail as onto the Moon's,
  // fired along it, and down the river of rock towards the Sun.
  pon(VE.clone().lerp(M, 0.5).addScaledVector(Y, 1.4), 'corte');
  const aVenus = VE.clone().sub(M).setY(0).normalize();
  pon(M.clone().addScaledVector(aVenus, 3.0).addScaledVector(Y, 0.5));
  pon(M.clone().addScaledVector(aVenus, 1.0).addScaledVector(Y, 0.14));
  pon(enRielX(-0.6, 0.05));
  pon(enRielX(-0.3, 0.015));
  pon(enRielX(-0.1, 0.006));
  for (let i = 0; i <= 10; i++) pon(enRiel(i / 10, 0.004), i === 0 ? 'merc0' : i === 10 ? 'merc1' : undefined);
  for (const s of [0.004, 0.012, 0.03, 0.06, 0.1, 0.16, 0.24, 0.34, 0.46, 0.58, 0.7, 0.8, 0.88, 0.95, 1.0]) {
    pon(caminoRio(s).addScaledVector(Y, 0.02 * smooth(s, 0, 0.05)), s === 1.0 ? 'rio1' : undefined);
  }
  interior = crearVuelo(
    puntos,
    hito,
    [
      ['inicio', 'riel0', 5.4],
      ['riel0', 'riel1', 1.8],
      ['riel1', 'marte', 4.9],
      ['marte', 'marte2', 7.6],
      ['marte2', 'venus', 5.3],
      ['venus', 'venus2', 7.4],
      ['venus2', 'corte', 3.2],
      ['corte', 'merc0', 5.6],
      ['merc0', 'merc1', 2.6],
      ['merc1', 'rio1', 6.0],
    ],
    ['riel0', 'merc0'],
    [
      { pos: E, R: RE },
      { pos: LUNA, R: RL },
      { pos: MA, R: RMA },
      { pos: VE, R: RV },
      { pos: M, R: RM },
      { pos: V(), R: 1 },
    ],
    [
      { pos: E, R: RE, fuera: 0.35, mira: 0.3, atras: -0.3 },
      { pos: LUNA, R: RL, fuera: 1.1, mira: 0.2, atras: -0.85 },
      { pos: MA, R: RMA, fuera: 0.9, mira: 0.65, atras: -0.3 },
      { pos: VE, R: RV, fuera: 0.9, mira: 0.65, atras: -0.3 },
      { pos: M, R: RM, fuera: 0.7, mira: 0.5, atras: -0.5 },
      { pos: V(), R: 1, fuera: 0.3, mira: 0.35, atras: -0.2 },
    ],
  );
  return interior;
}
