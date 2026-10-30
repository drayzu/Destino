import * as THREE from 'three';

/**
 * The inner Solar System as acts III shows it (sistema, mercurio, sol share this frame): solar
 * radii, the Sun at the origin, distances drawn short. Each world's place and radius.
 */

const D2R = THREE.MathUtils.degToRad;
export const enOrbita = (r: number, deg: number, y = 0) => new THREE.Vector3(Math.sin(D2R(deg)) * r, y, Math.cos(D2R(deg)) * r);

export const E = enOrbita(36, 140);
export const RE = 0.35;
export const VE = enOrbita(26, 172);
export const RV = 0.34;
export const MA = enOrbita(50, 106, 0.4);
export const RMA = 0.2;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);

/** The Moon, and its launcher: a rail over its sunlit top that throws rock towards Mars (for its
 * mirrors). It starts on the side that faces the Earth, so the spark comes in from there as a plane
 * lands. `v` 0..1 along it (below 0, the ground leading to it), `alto` over the ground. */
export const LUNA = E.clone().add(V(0.9, 0.12, 0.7));
export const RL = 0.1;
export const U_LUNA = MA.clone().sub(LUNA).normalize();
export const N_LUNA = (() => {
  const arriba = Y.clone().addScaledVector(U_LUNA, -Y.dot(U_LUNA)).normalize();
  const sol = LUNA.clone().negate().normalize();
  const alSol = sol.clone().addScaledVector(U_LUNA, -sol.dot(U_LUNA)).addScaledVector(arriba, -sol.dot(arriba)).normalize();
  return arriba.multiplyScalar(Math.cos(D2R(35))).addScaledVector(alSol, Math.sin(D2R(35))).normalize();
})();
export const enRielLuna = (v: number, alto = 0, out = V()) => {
  const a = -0.9 * (1 - v);
  return out.copy(N_LUNA).multiplyScalar(Math.cos(a)).addScaledVector(U_LUNA, Math.sin(a)).multiplyScalar(RL * 1.01 + alto).add(LUNA);
};
export const FIN_RIEL_LUNA = enRielLuna(1);

/** Venus: the Sun's way from it, and the city the spark skims (on the night side, past the limb, so
 * the way never goes between Venus and its parasol). */
export const SOL_V = VE.clone().negate().normalize();
export const DIR_CIUDAD = SOL_V.clone().applyAxisAngle(Y, D2R(-128)).addScaledVector(Y, 0.22).normalize();
export const CIUDAD = VE.clone().addScaledVector(DIR_CIUDAD, RV * 1.055);

/** Mercury, its rail and the river of rock that leaves it: a logarithmic spiral down to the swarm,
 * `s` 0..1 (`caminoRio`). The rail is an arc of its equator ending where the river leaves, tangent
 * to it (`enRiel`, `v` 0 at its start, 1 at its end; `enRielX` goes on before its start). */
export const RA = 18;
export const RB = 3.0;
export const PHI0 = D2R(205);
export const PHI = 1.45;
export const RM = 0.42;
export function caminoRio(s: number, out = V()) {
  const r = RA * Math.pow(RB / RA, s);
  const ph = PHI0 + PHI * s;
  return out.set(Math.sin(ph) * r, 0, Math.cos(ph) * r);
}
export const T_RIO = caminoRio(0);
export const D_RIO = caminoRio(0.002).sub(T_RIO).normalize();
export const N_RIO = (() => {
  const n = Y.clone().cross(D_RIO).normalize();
  return n.dot(T_RIO) < 0 ? n.negate() : n;
})();
export const M = T_RIO.clone().addScaledVector(N_RIO, -RM);
export const RIEL_A = 1.15;
export function enRielX(v: number, alto = 0, out = V()) {
  const a = (1 - v) * RIEL_A;
  return out.copy(N_RIO).multiplyScalar(Math.cos(a)).addScaledVector(D_RIO, -Math.sin(a)).multiplyScalar(RM * 1.004 + alto).add(M);
}
export function enRiel(v: number, alto = 0, out = V()) {
  return enRielX(Math.min(Math.max(v, 0), 1), alto, out);
}

/** Colours for their marks when they are a few pixels. */
export const COLOR = {
  tierra: new THREE.Color(0.45, 0.68, 1.0),
  venus: new THREE.Color(1.0, 0.88, 0.62),
  marte: new THREE.Color(1.0, 0.52, 0.32),
  mercurio: new THREE.Color(0.78, 0.74, 0.7),
};
