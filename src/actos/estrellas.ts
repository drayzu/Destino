import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { clamp, lerp, smoothstep } from '../engine/math';
import { TEAL, cifra, ink, nota, type Muro } from '../engine/placa';
import { flecha, panel, texto } from '../engine/lamina';
import { mezcla, mirar, vuelo as volar, type Vista } from '../engine/vista';
import { LY_AU, type Mundo } from '../mundo/mundo';
import { R_SUN, faros } from '../mundo/obras';
import { VECINAS, dondeVecina, estrella, rutasVecinas, vecinas, vela } from '../mundo/vecinas';
import { naveGeneracional } from '../mundo/nave';
import { OMEGA } from '../mundo/habitat';
import { enfocar, geometria, puntos } from '../horizontes';
import type { Acto, Cuadro } from './tipos';

/**
 * Act IV · Estrellas vecinas (10²⁶ → ~10²⁹ W). Four moments, each with one subject and its own
 * colour:
 *
 * - Velas de luz: a beam of tens of gigawatts pushes a sail of a few grams and a few metres to a
 *   fifth of the speed of light in minutes (Breakthrough Starshot, 2016). The beam is infrared,
 *   invisible: the sail glows dull red with its heat.
 * - A un quinto de la luz: riding it, twenty years to α Centauri. Real aberration and Doppler: the
 *   stars bunch ahead and turn bluer, those behind redder and dimmer. At the end it flies between
 *   α Centauri A and B, golden and orange (0.06 AU from A).
 * - Frenar con su luz: nothing slows it, so it passes. A slower, larger sail (4.6 % of c at most)
 *   can brake with the light and gravity of A and B and stay at Proxima (Heller & Hippke 2017).
 * - Muro · la luz pone el freno: growing 2.3 % a year we would want the whole galaxy in ~2 500
 *   years, but light takes 100 000 to cross it (Murphy 2011). From here time runs in millions.
 *
 * The sails are drawn in the camera's own space (`cabina`): light years from the Sun the world's
 * coordinates no longer tell metres apart, so the world places only what is far.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
/** A metre in AU. */
const M = 1 / 1.495978707e11;
/** Scene units per metre for what rides with the camera (in front of everything in the world). */
const SIGMA = 1e-4;

const VA = VECINAS[0];
const VB = VECINAS[1];
const VP = VECINAS[2];
/** α Centauri: the pair's middle, the line between them, A and B (AU, world). */
const AC = dondeVecina(VA).multiplyScalar(LY_AU);
const DIR = AC.clone().normalize();
const SEP = DIR.clone().cross(UP).normalize().applyAxisAngle(DIR, 0.5);
const A = AC.clone().addScaledVector(SEP, -7.6);
const B = AC.clone().addScaledVector(SEP, 9.4);
const PROX = dondeVecina(VP).multiplyScalar(LY_AU);
const R_A = 1.22 * R_SUN;
const R_B = 0.86 * R_SUN;
/** Where the sail is launched: on the way out, past the swarm. */
const L0 = DIR.clone().multiplyScalar(0.42);
/** Its flight: to pass A 1.5 AU off, on the side away from B. */
const FB = A.clone().addScaledVector(SEP, -0.06);
const RUMBO = FB.clone().sub(L0).normalize();
const TRAMO = FB.distanceTo(L0);
const LADO = RUMBO.clone().cross(UP).normalize();
const ARRIBA = LADO.clone().cross(RUMBO).normalize();

/**
 * Where a point is seen from `cam` moving at `beta` (c) along `vel`: aberration, the same the sky and
 * the starfield get (cos θ' = (cos θ + β) / (1 + β cos θ)). The near stars are drawn at their seen
 * place, or they and their far points were two stars in two places.
 */
function aberrar(w: THREE.Vector3, cam: THREE.Vector3, vel: THREE.Vector3, beta: number) {
  if (beta <= 0) return w.clone();
  const d = w.clone().sub(cam);
  const L = d.length();
  d.divideScalar(L);
  const c = d.dot(vel);
  const c2 = (c + beta) / (1 + beta * c);
  const perp = d.clone().addScaledVector(vel, -c);
  const pl = perp.length();
  if (pl < 1e-9) return w.clone();
  return cam.clone().addScaledVector(vel.clone().multiplyScalar(c2).addScaledVector(perp, Math.sqrt(Math.max(0, 1 - c2 * c2)) / pl), L);
}

export function estrellas(): Acto {
  let tl: Timeline;
  let P: (l: string, d?: number) => number;
  const ease = smoothstep;
  let m: Mundo;

  const vec = vecinas();
  const rutas = rutasVecinas();
  const starA = estrella(new THREE.Color(1.0, 0.86, 0.62), 20);
  const starB = estrella(new THREE.Color(1.0, 0.6, 0.32), 16);
  const starP = estrella(new THREE.Color(1.0, 0.36, 0.2), 8);
  starA.group.position.copy(A);
  starA.group.scale.setScalar(R_A);
  starB.group.position.copy(B);
  starB.group.scale.setScalar(R_B);
  starP.group.position.copy(PROX);
  starP.group.scale.setScalar(0.154 * R_SUN);

  // What rides with the camera: Starshot's sail (2 m) and the braking sail (160 m).
  const cabina = new THREE.Group();
  const velaS = vela(12);
  const velaG = vela(24);
  cabina.add(velaS.group, velaG.group);
  // A ship that is a world: the O'Neill cylinder (in points, km), its axis along its way, braking
  // into Alpha Centauri on a fusion jet. Drawn in the cabin, like the sails.
  const nave = new THREE.Group();
  nave.scale.setScalar(1000 * SIGMA);
  const naveGiro = new THREE.Group();
  nave.add(naveGiro);
  // (not another cylinder: a generation ship of its own shape)
  const naveG = naveGeneracional();
  nave.add(naveG.fijo);
  naveGiro.add(naveG.giro);
  const NJ = 26000;
  const jp = new Float32Array(NJ * 3);
  const jc = new Float32Array(NJ * 3);
  const js = new Float32Array(NJ);
  const jseed = new Float32Array(NJ);
  for (let i = 0; i < NJ; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random());
    jp.set([Math.cos(a) * r, 0, Math.sin(a) * r], i * 3);
    const hot = Math.random();
    jc.set(hot < 0.75 ? [0.4, 0.62, 1.0] : [0.85, 0.75, 1.0], i * 3);
    js[i] = 0.25 + Math.random() * 0.35;
    jseed[i] = Math.random();
  }
  const chorro = puntos(geometria({ position: jp, color: jc, size: js, seed: jseed, aKind: new Float32Array(NJ) }), {
    pre: 'uniform float uT, uOn;',
    cuerpo: /* glsl */ `
      // Thrown ahead of the ship (it brakes): a narrow jet that widens and fades, flowing.
      float f = fract(seed + uT * 0.35);
      float w = 0.35 + f * 3.5;
      p = vec3(position.x * w, 16.5 + f * 140.0, position.z * w);
      em = color * pow(1.0 - f, 2.6) * 0.09 * uOn;
      sz *= 1.0 + f * 2.5;`,
    uniforms: { uT: { value: 0 }, uOn: { value: 0 } },
  });
  chorro.u.uMinPx.value = 1.3;
  naveGiro.parent!.add(chorro.points);
  cabina.add(nave);

  // While a sail is too small to see (metres across, kilometres away), a light marks it: Starshot's
  // teal, the braking sail's gold.
  const faro = faros([
    { color: new THREE.Color(1.4, 2.6, 2.2), px: 4.5 },
    { color: new THREE.Color(2.6, 2.1, 1.3), px: 4 },
  ]);
  cabina.add(faro.points);

  // ------------------------------------------------------------ the sail's flight
  /** Where the cruise ends and the closing in begins, and where the pass begins (fractions of the leg). */
  const K_LOG = 0.55;
  const K_PASO = 0.7;
  /** The pass by A: how far past it (AU along the way, negative before), by beat: in logarithm far
   * off and linear within H of it (a sinh), RITMO e-folds a beat, the closing in's own pace. */
  const H = 0.06;
  function pasoX(p: number) {
    const p0 = P('a4.viaje') + K_PASO * (P('a4.frenar') - P('a4.viaje'));
    const ritmo = Math.log(100) / ((K_PASO - K_LOG) * (P('a4.frenar') - P('a4.viaje')));
    return Math.sinh(Math.asinh(-30 / H) + ritmo * (p - p0)) * H;
  }
  /** The sail from A (AU): small numbers, precise to the metre (from the Sun they are not). */
  const sailA = (p: number) => SEP.clone().multiplyScalar(-0.06).addScaledVector(RUMBO, pasoX(p));
  /** How far the sail is from its launch (AU) and its speed (c), by beat. */
  function vuelo(p: number) {
    const a = P('a4');
    const kL = (p - a) / (P('a4.viaje') - a);
    const kV = (p - P('a4.viaje')) / (P('a4.frenar') - P('a4.viaje'));
    if (p < P('a4.viaje')) {
      // Constant push for ~10 minutes: s = ½ a t², v = a t (0.12 AU, 0.2 c).
      const u = clamp((kL - 0.5) / 0.5, 0, 1);
      return { s: 0.12 * u * u, beta: 0.2 * u };
    }
    // The cruise, at its real constant speed (the years tick evenly); the last 3 000 AU shrink in
    // logarithm at a steady pace, so A and B grow; the pass goes on at that same pace (a sinh), in
    // slow motion close to A (the passing itself lasts minutes), and away again.
    if (kV < K_LOG) return { s: lerp(0.12, TRAMO - 3000, kV / K_LOG), beta: 0.2 };
    if (kV < K_PASO) return { s: TRAMO - Math.exp(lerp(Math.log(3000), Math.log(30), (kV - K_LOG) / (K_PASO - K_LOG))), beta: 0.2 };
    return { s: TRAMO + pasoX(p), beta: 0.2 };
  }
  const velaW = (s: number) => L0.clone().addScaledVector(RUMBO, s);
  /** Behind the sail and a little above, looking ahead. Metres, in the sail's frame. */
  const DETRAS = V(0, 3.4, -15);
  const LADO_ANTES = V(5.5, 1.2, 3.5);
  const offW = (o: THREE.Vector3) => LADO.clone().multiplyScalar(o.x).addScaledVector(ARRIBA, o.y).addScaledVector(RUMBO, o.z);

  /** The camera's offset from the sail (metres, world axes) and where it looks. */
  function montura(p: number): { off: THREE.Vector3; mira: THREE.Vector3; fov: number } {
    const kL = (p - P('a4')) / (P('a4.viaje') - P('a4'));
    const sw = ease(0.5, 0.85, kL);
    const off = offW(LADO_ANTES.clone().lerp(DETRAS, sw));
    const { s } = vuelo(p);
    const sail = velaW(s);
    // Before it leaves: looking at the sail (the Sun and its swarm behind it). Then further and
    // further ahead of it, so the sail stays in view while the camera swings behind.
    const ahead = sail.clone().addScaledVector(RUMBO, 1).addScaledVector(ARRIBA, 0.03);
    let mira = ahead.clone();
    if (p < P('a4.viaje')) {
      const t = ease(0.5, 0.9, kL);
      const d = Math.exp(lerp(Math.log(0.3 * M), Math.log(1), t));
      mira = sail.clone().addScaledVector(RUMBO, d).addScaledVector(ARRIBA, lerp(-0.06, 0.03, t) * d);
    }
    // (riding, it looks ahead all the way: A rushes by at its side; the turn back to A comes once
    // the camera lets the sail go, in camHaciaFreno)
    return { off, mira, fov: p < P('a4.viaje') ? lerp(52, 60, sw) : 60 };
  }

  // ------------------------------------------------------------ braking at α Centauri A
  /** The braking sail's path around A (AU from A): in from the Sun's side, round A at ~5 radii, out towards B. */
  const U1 = DIR.clone().negate();
  const U2 = SEP.clone();
  const rp = 5 * R_A;
  const ecc = 1.6;
  const fMax = Math.acos(-1 / ecc) * 0.93;
  function frenoRel(k: number) {
    const f = lerp(-fMax, fMax * 0.55, k);
    const r = (rp * (1 + ecc)) / (1 + ecc * Math.cos(f));
    // Its periapsis on the side facing the Sun; rotated so it arrives from where it came.
    const per = U1.clone().applyAxisAngle(U1.clone().cross(U2).normalize(), -0.9);
    const w = U1.clone().cross(U2).normalize().cross(per).normalize();
    return per.multiplyScalar(r * Math.cos(f)).addScaledVector(w, r * Math.sin(f));
  }
  /** The camera lets the first sail go (T0) and reaches the braking one (T1). */
  const T0 = () => P('a4.frenar', 0.1);
  const T1 = () => P('a4.frenar', 1.5);
  const kFreno = (p: number) => (p - T1()) / (P('a4.nave') - T1());
  /** The braking sail from A (AU) and the camera's place behind it (metres): its face towards A,
   * we see it against the star. */
  function frenoL(p: number) {
    const t = ease(0, 1, kFreno(p));
    const rel = frenoRel(t);
    // (its way ahead from just past it, unclamped: at the end, clamped, the way was nought, the camera
    // lost its offset and the sail jumped from the bottom of the frame to its middle)
    const relN = frenoRel(t + 0.01);
    const fwd = relN.clone().sub(rel).normalize();
    const toA = rel.clone().negate().normalize();
    const side = fwd.clone().cross(toA).normalize();
    // Metres behind it on the line to A, a little to one side: the sail cut out against A's disc.
    const offM = toA.clone().multiplyScalar(-760).addScaledVector(side, 230).addScaledVector(fwd, -120);
    return { rel, offM };
  }
  function camFreno(p: number): Vista {
    const { rel, offM } = frenoL(p);
    return { pos: A.clone().add(rel).addScaledVector(offM, M), target: A.clone(), up: UP.clone(), fov: 58 };
  }
  /** Starshot's sail from A once the camera lets it go: held where it was (the pass is in slow motion;
   * at its own pace it was gone in a frame, and the camera with it). */
  const sailSuelta = () => sailA(T0());
  /** Where the camera is from A (AU) between T0 and T1: it backs away from the first sail (which
   * shrinks ahead to its light: it cannot stop), turns back to A, and closes in on the braking sail in
   * powers of ten from farther out, so that sail grows from a point in front of A (the old way flew
   * from one view to the other across the star, and the sail popped in at the end). */
  function haciaFrenoL(p: number) {
    const tau = clamp((p - T0()) / (T1() - T0()), 0, 1);
    const S = sailSuelta().addScaledVector(offW(DETRAS), M * Math.exp(Math.log(200) * ease(0, 0.38, tau)));
    const g = smoothstep(0.3, 1, tau);
    if (g <= 0) return S;
    const { rel, offM } = frenoL(p);
    const E = rel.clone().addScaledVector(offM, M);
    const D0 = S.distanceTo(E);
    const d1 = 300 * M;
    // (the last powers of ten, where the sail grows, given the most time)
    const w = 1 - (1 - g) ** 3;
    const rem = Math.exp(lerp(Math.log(D0), Math.log(d1), w)) - d1 * w;
    return E.add(S.sub(E).multiplyScalar(rem / D0));
  }

  // ------------------------------------------------------------ the camera
  function camVelas(p: number): Vista {
    const kL = (p - P('a4')) / (P('a4.viaje') - P('a4'));
    const mt = montura(p);
    const sail = velaW(vuelo(p).s);
    const near: Vista = { pos: sail.clone().addScaledVector(mt.off, M), target: mt.mira, up: UP.clone(), fov: mt.fov };
    // From the Solar System seen whole (where act III leaves us), a dive to the sail by the Sun.
    const top = V(Math.cos(1.25 - 0.6), 0.85, Math.sin(1.25 - 0.6)).normalize().multiplyScalar(6.2);
    const far: Vista = { pos: top, target: L0.clone().multiplyScalar(0.5), up: UP.clone(), fov: 50 };
    // Falling towards the sail with the Sun (where it is) ahead, then turning to the sail itself; in
    // powers of ten, so it grows from its light to the sail without a jump.
    const t = ease(0.04, 0.3, kL);
    const v: Vista = { pos: volar(far.pos, near.pos, t, 1, near.pos.distanceTo(sail)), target: near.target, up: UP.clone(), fov: lerp(far.fov, near.fov, t) };
    const haciaSol = mirar(v.pos, far.target, sail, ease(0.02, 0.12, kL));
    return { ...v, target: mirar(v.pos, haciaSol, near.target, ease(0.2, 0.3, kL)) };
  }
  function camViaje(p: number): Vista {
    const mt = montura(p);
    const sail = velaW(vuelo(p).s);
    return { pos: sail.clone().addScaledVector(mt.off, M), target: mt.mira, up: UP.clone(), fov: mt.fov };
  }
  /** The ship that is a world: just short of Alpha Centauri, braking (AU; the camera rides beside it). */
  const NAVE = AC.clone().addScaledVector(DIR, -0.05 * LY_AU);
  const naveLado = DIR.clone().cross(UP).normalize();
  const naveArriba = naveLado.clone().cross(DIR).normalize();
  function vNave(p: number): Vista {
    const k = (p - P('a4.nave')) / (P('a4.muro') - P('a4.nave'));
    // Round it slowly from behind and beside: its hull, its petals, its jet thrown ahead.
    const a = lerp(-0.9, 0.5, k);
    const off = naveLado.clone().multiplyScalar(Math.cos(a) * 40e3).addScaledVector(naveArriba, 11e3).addScaledVector(DIR, -18e3 + Math.sin(a) * 26e3);
    // (aimed a little ahead of its middle: the ship fills the left of the frame, its jet the right)
    return { pos: NAVE.clone().addScaledVector(off, M), target: NAVE.clone().addScaledVector(DIR, 6e3 * M).addScaledVector(naveArriba, -3e3 * M), up: naveArriba.clone(), fov: 50 };
  }
  /** Leaving the braking sail: first straight back from it (it shrinks where it is, against A), then
   * the flight to the ship. `k` of the moment. */
  const K_ATRAS = 0.08;
  const K_LLEGA = 0.22;
  const atras = (k: number) => Math.exp(lerp(0, Math.log(40), ease(0, K_ATRAS, k)));
  function camNave(p: number): Vista {
    const k = (p - P('a4.nave')) / (P('a4.muro') - P('a4.nave'));
    if (k >= K_LLEGA) return vNave(p);
    const { rel, offM } = frenoL(P('a4.nave'));
    const back: Vista = { pos: A.clone().add(rel).addScaledVector(offM, M * atras(k)), target: A.clone(), up: UP.clone(), fov: 58 };
    if (k < K_ATRAS) return back;
    // Then to the ship, in powers of ten: the sail falls behind, the ship grows from a point ahead (a
    // straight mix crossed 0.05 light years in a frame: both just popped).
    const b = vNave(p);
    const t = ease(K_ATRAS, K_LLEGA, k);
    const pos = volar(back.pos, b.pos, t, 30e3 * M, 45e3 * M);
    return { pos, target: mirar(pos, back.target, b.target, ease(0, 0.45, t)), up: back.up.clone().lerp(b.up, ease(0.3, 1, t)).normalize(), fov: lerp(back.fov, b.fov, t) };
  }
  /** Pulling back: the neighbourhood, then the whole galaxy, where our bubble is a point. */
  const GAL = V(0, 0, -26000).multiplyScalar(LY_AU);
  function camMuro(p: number): Vista {
    const k = (p - P('a4.muro')) / (P('a4.fin') - P('a4.muro'));
    const from = vNave(P('a4.muro'));
    // (its up is square to the way to Alpha Centauri, not the world's: the gaze down at the
    // neighbourhood is nearly vertical, and the world's up there rolled the picture over)
    const barrio: Vista = { pos: DIR.clone().multiplyScalar(-30 * LY_AU).addScaledVector(UP, 26 * LY_AU), target: DIR.clone().multiplyScalar(4 * LY_AU), up: naveArriba.clone().normalize(), fov: 50 };
    const galaxia: Vista = { pos: GAL.clone().add(V(30000, 62000, 60000).multiplyScalar(LY_AU)), target: GAL.clone().multiplyScalar(0.55), up: UP.clone(), fov: 46 };
    if (k < 0.45) {
      // Away from the ship in powers of ten, so it shrinks to a point instead of vanishing.
      const t = ease(0.0, 0.4, k);
      const pos = volar(from.pos, barrio.pos, t, 45e3 * M, 30 * LY_AU);
      // Looking back at the ship all the way out (the neighbourhood's centre lies between the ship and
      // where we go: turning to it early swung the gaze under us and flipped it as we passed it).
      return { pos, target: mirar(pos, from.target, barrio.target, ease(0.75, 1, t)), up: from.up.clone().lerp(barrio.up, ease(0, 0.6, t)).normalize(), fov: lerp(from.fov, barrio.fov, t) };
    }
    return mezcla(barrio, galaxia, ease(0.5, 0.95, k));
  }
  /** From the passing sail to the braking one (see haciaFrenoL); the gaze turns from ahead back to
   * A by angle (it sweeps past B on the way). */
  function camHaciaFreno(p: number): Vista {
    const tau = (p - T0()) / (T1() - T0());
    const pos = A.clone().add(haciaFrenoL(p));
    const ahead = A.clone().add(sailA(T0())).addScaledVector(RUMBO, 1).addScaledVector(ARRIBA, 0.03);
    // (in two quarter turns, by B's side: ahead and A are nearly opposite, and one half turn between
    // them swung about an axis that wandered as the camera moved: the star jumped across the frame)
    const t = ease(0.16, 0.64, tau);
    const lado = pos.clone().addScaledVector(SEP, 1);
    const target = t < 0.5 ? mirar(pos, ahead, lado, t * 2) : mirar(pos, lado, A, t * 2 - 1);
    return { pos, target, up: UP.clone(), fov: lerp(60, 58, ease(0.3, 1, tau)) };
  }
  function vista(p: number): Vista {
    if (p < P('a4.viaje')) return camVelas(p);
    if (p < T0()) return camViaje(p);
    if (p < T1()) return camHaciaFreno(p);
    if (p < P('a4.nave')) return camFreno(p);
    if (p < P('a4.muro')) return camNave(p);
    return camMuro(p);
  }

  return {
    id: 'a4',
    numero: 'IV',
    nombre: 'Estrellas vecinas',
    // The sails are drawn with the camera, in metres: only the neighbourhood is to scale.
    regla: (p) => p > P('a4.muro', 0.5),
    coreografia(t) {
      tl = t;
      P = (l, d = 0) => tl.at(l) + d * tl.escala;
      tl.label('a4');
      tl.set({ 'a4.lp': 26.58, 'a4.ly': 3.13, 'a4.lr': 12.6, 'a4.bub': 0 });
      tl.caption(5.4, 'Velas de luz', 'Para ir a otra estrella, un láser enorme empuja una vela de pocos gramos: en minutos va a un quinto de la velocidad de la luz.', { fuente: 'Breakthrough Starshot, 2016', desde: 1.2, viaje: 'Hacia la vela' });
      tl.to(5.4, { 'a4.lp': 26.62, 'a4.ly': 3.132 });
      tl.label('a4.viaje');
      tl.caption(8.0, 'A un quinto de la luz', 'Son veinte años hasta Alfa Centauri. A esta velocidad el cielo se deforma: las estrellas se juntan hacia adelante y se ven más azules; las de atrás, más rojas.');
      tl.to(8.0, { 'a4.lp': 26.8, 'a4.ly': 3.138, 'a4.lr': 16.62 });
      tl.label('a4.frenar');
      tl.caption(6.4, 'Frenar con su luz', 'Al llegar no hay con qué frenar. Una vela más grande y más lenta sí puede usar la luz de Alfa Centauri A y B como freno, y quedarse en Próxima.', { fuente: 'Heller y Hippke, 2017' });
      tl.to(6.4, { 'a4.lp': 27.4, 'a4.ly': 3.163 });
      tl.label('a4.nave');
      tl.caption(6.4, 'Naves que son mundos', 'Con personas a bordo no hay atajos: a un 1 % de la luz, el viaje dura siglos. La nave es un mundo, como el cilindro, y quienes llegan son los nietos de los nietos de los que salieron.', { fuente: 'Hein y otros, 2012 (proyecto Hyperion)', desde: 1.0, viaje: 'Hacia una nave que llega' });
      tl.to(6.4, { 'a4.lp': 27.5, 'a4.ly': 3.17 });
      tl.label('a4.muro');
      tl.caption(7.0, 'La luz pone el freno', 'Al ritmo de hoy querríamos toda la galaxia en unos 2 500 años, pero la luz tarda 100 000 en cruzarla. Desde aquí, el tiempo se mide en millones de años.', { fuente: 'Murphy, 2011', desde: 1.05, viaje: 'Alejándonos' });
      tl.to(7.0, { 'a4.lp': 29.0, 'a4.ly': 3.4, 'a4.lr': 17.7, 'a4.bub': 1 });
      tl.label('a4.fin');
    },
    montar(mundo) {
      m = mundo;
      m.gal.add(vec.points, rutas.lines);
      m.nubes.push(...rutas.nubes);
      m.nubes.push(vec);
      m.root.add(starA.group, starB.group, starP.group);
      m.root.parent!.add(cabina);
    },
    vista: (p) => vista(p),
    lectura: (p) => ({ lp: tl.get('a4.lp', p), ly: tl.get('a4.ly', p), lr: tl.get('a4.lr', p) }),
    muro(p): Muro | null {
      const a = ease(P('a4.muro', 1.0), P('a4.muro', 2.0), p);
      return a > 0.01 ? { lp: 29.0, label: 'muro · la velocidad de la luz', a, choque: ease(28.3, 28.95, tl.get('a4.lp', p)) } : null;
    },
    estado(mundo, p) {
      const e = mundo.estado;
      // Light years away the Sun is one star among many: its beacon fades.
      const lejos = vista(p).pos.length() / LY_AU;
      e.faros = 1 - smoothstep(0.5, 6, lejos);
      e.solDim = 0.9;
      e.cercanias = 0;
      e.luna = 0;
      // Riding the sail: the sky as it looks at that speed.
      const { beta } = vuelo(Math.min(p, P('a4.frenar')));
      e.beta = beta * (1 - ease(T0(), T0() + 0.3 * (T1() - T0()), p));
      e.vel = RUMBO.clone();
    },
    update(f: Cuadro) {
      const { p, time, camera, vista: v } = f;
      const here = p > P('a4', -1) && p < P('a4.fin', 2);
      vec.u.uScale.value = f.k * LY_AU;
      vec.u.uOn.value = here ? 1 : 0.6;
      vec.points.visible = p > P('a4', -1);
      vec.u.uBubR.value = 50 * tl.get('a4.bub', p) * ease(P('a4.muro', 0.5), P('a4.muro', 2.5), p);
      // At the wall the neighbours are the subject: brighter, joined to the Sun by routes.
      // They stay until the galaxy takes over the frame, so the pull back never passes through black.
      const barrio = ease(P('a4.muro', 0.3), P('a4.muro', 1.4), p) * (1 - ease(P('a4.muro', 5.2), P('a4.muro', 6.4), p));
      vec.u.uPiso.value = lerp(0.006, 0.5, barrio);
      rutas.mat.opacity = 0.55 * barrio * ease(P('a4.muro', 1.0), P('a4.muro', 2.2), p);
      rutas.lines.visible = rutas.mat.opacity > 0.001;
      // The galaxy's own stars in our bubble too.
      const bub = ease(P('a4.muro', 0.5), P('a4.muro', 2.5), p);
      if (here) {
        m.G.nube.u.uBub.value.set(0, 0, 0);
        m.G.nube.u.uBubR.value = 50 * bub;
        m.G.nube.u.uBubOn.value = bub;
      }
      // α Centauri up close.
      const nearAC = v.pos.distanceTo(AC) < 0.05 * LY_AU && here;
      // (their discs come in gently: switched on at once, the pair brightened in a frame)
      const onAC = here ? smoothstep(0.05 * LY_AU, 0.03 * LY_AU, v.pos.distanceTo(AC)) : 0;
      const vel = m.estado.vel.clone().normalize();
      starA.group.position.copy(aberrar(A, v.pos, vel, m.estado.beta));
      starB.group.position.copy(aberrar(B, v.pos, vel, m.estado.beta));
      // (beyond some AU the starfield's point is the star: the disc's glow, boosted to stay visible
      // from afar, made B outshine A as we turned past it)
      const dA = v.pos.distanceTo(A);
      const dB = v.pos.distanceTo(B);
      starA.update(camera, time, onAC * (1 - smoothstep(4, 15, dA)), dA / R_A);
      starB.update(camera, time, onAC * (1 - smoothstep(4, 15, dB)), dB / R_B);
      starP.update(camera, time, v.pos.distanceTo(PROX) < 0.02 * LY_AU && here ? 1 : 0);
      // The starfield's point gives way only within an AU or so, once the disc is pixels wide (at a
      // hundred AU, as before, both disc and glow were under a pixel: A vanished for a while).
      vec.u.uCerca.value = nearAC ? 2e-5 : 1e-9;

      // ---- the cabin: what rides with the camera, placed from the camera in metres.
      cabina.visible = false;
      velaS.group.visible = false;
      velaG.group.visible = false;
      faro.points.visible = false;
      faro.set(0, V(), 0);
      faro.set(1, V(), 0);
      nave.visible = false;
      chorro.points.visible = false;
      if (!here) return;
      const encender = () => {
        cabina.visible = true;
        faro.points.visible = true;
        faro.mat.uniforms.uDpr.value = f.dpr;
      };
      // The ship that is a world, while we ride beside it.
      if (p > P('a4.nave', -0.3) && p < P('a4.muro', 1.2)) {
        const rel = NAVE.clone().sub(v.pos).divideScalar(M);
        if (rel.length() < 3e9) {
          cabina.visible = true;
          nave.visible = true;
          chorro.points.visible = true;
          nave.position.copy(rel).multiplyScalar(SIGMA);
          nave.quaternion.setFromUnitVectors(UP, DIR);
          naveGiro.rotation.y = time * OMEGA;
          naveGiro.updateMatrixWorld(true);
          naveG.update({ focal: f.focal, dpr: f.dpr });
          chorro.u.uT.value = time;
          chorro.u.uOn.value = ease(P('a4.nave', -0.3), P('a4.nave', 0.6), p);
          enfocar(chorro, { focal: f.focal, dpr: f.dpr }, chorro.u.uGain.value);
        }
      }
      const toView = (w: THREE.Vector3) => w.clone().transformDirection(camera.matrixWorldInverse);
      const kV = (p - P('a4.viaje')) / (P('a4.frenar') - P('a4.viaje'));
      if (p < T1()) {
        // Starshot's sail: where it is from the camera (metres), facing ahead.
        const mt = montura(p);
        const near = p >= P('a4') + (P('a4.viaje') - P('a4')) * 0.3;
        let rel: THREE.Vector3;
        // (riding with it until the camera lets it go; then where it is from the camera, both from A)
        if (near && p < T0()) rel = mt.off.clone().negate();
        else if (p >= T0()) rel = sailSuelta().sub(haciaFrenoL(p)).divideScalar(M);
        else rel = velaW(vuelo(p).s).sub(v.pos).divideScalar(M);
        const lejos = rel.length();
        if (lejos > 600 && (p < P('a4.viaje') || p >= T0())) {
          // Its light, in its direction (the cabin keeps it near; only the direction matters).
          encender();
          faro.set(0, rel.clone().normalize().multiplyScalar(1000 * SIGMA), smoothstep(600, 2600, lejos) * smoothstep(3e12, 3e11, lejos));
        }
        if (lejos < 3000) {
          cabina.visible = true;
          velaS.group.visible = true;
          // (it fades in as its light fades out)
          velaS.uni.uOn.value = smoothstep(3000, 900, lejos);
          velaS.group.position.copy(rel).multiplyScalar(SIGMA);
          velaS.group.scale.setScalar(2 * SIGMA);
          velaS.group.quaternion.setFromUnitVectors(V(0, 0, 1), RUMBO);
          const kL = (p - P('a4')) / (P('a4.viaje') - P('a4'));
          velaS.uni.uCalor.value = p < P('a4.viaje') ? ease(0.42, 0.55, kL) * (1 - ease(0.9, 1.0, kL) * 0.7) : 0.3 * (1 - ease(P('a4.viaje'), P('a4.viaje', 1), p));
          // The Sun's light on it before it leaves; A's as it passes (rising over the closing in, not
          // as 1/d² in its last minutes: it lit up in a frame).
          const sail = velaW(vuelo(p).s);
          const sunDir = sail.clone().negate().normalize();
          const aDir = kV >= K_PASO ? sailA(Math.min(p, T0())).negate() : A.clone().sub(sail);
          const aD = aDir.length();
          const useA = aD < 200;
          velaS.uni.uLuzDir.value.copy(toView(useA ? aDir.normalize() : sunDir));
          velaS.uni.uLuz.value = useA ? 3 * smoothstep(Math.log(60), Math.log(0.5), Math.log(aD)) : Math.min(2, 0.3 / sail.lengthSq());
          velaS.uni.uLuzCol.value.set(useA ? 0xffd9a0 : 0xffe8c8);
        }
      }
      const kN = (p - P('a4.nave')) / (P('a4.muro') - P('a4.nave'));
      if (p > T0() && kN < K_LLEGA) {
        // The braking sail: its face to A, metres from the camera. From A's frame while we come to it
        // (both small numbers: precise), glued while we ride behind it, straight ahead while we back
        // away; then from the world (far off, metres no longer matter).
        const { rel, offM } = frenoL(Math.min(p, P('a4.nave')));
        let relCam: THREE.Vector3;
        if (p < T1()) relCam = rel.clone().sub(haciaFrenoL(p)).divideScalar(M);
        else if (kN < K_ATRAS) relCam = offM.clone().multiplyScalar(-atras(Math.max(kN, 0)));
        else relCam = A.clone().add(rel).sub(v.pos).divideScalar(M);
        const d = relCam.length();
        // Its light while it is a point: we see where it is before it grows.
        const luz = ease(T0() + 0.3 * (T1() - T0()), T0() + 0.5 * (T1() - T0()), p) * smoothstep(3e3, 2e4, d) * (1 - ease(K_ATRAS, K_ATRAS + 0.06, kN));
        if (luz > 0.001) {
          encender();
          faro.set(1, relCam.clone().normalize().multiplyScalar(1000 * SIGMA), luz * 0.8);
        }
        if (d < 4e5) {
          cabina.visible = true;
          velaG.group.visible = true;
          velaG.uni.uOn.value = smoothstep(4e5, 6e4, d);
          velaG.group.position.copy(relCam).multiplyScalar(SIGMA);
          velaG.group.scale.setScalar(160 * SIGMA);
          const toA = rel.clone().negate().normalize();
          velaG.group.quaternion.setFromUnitVectors(V(0, 0, 1), toA);
          const dA = rel.length();
          velaG.uni.uLuzDir.value.copy(toView(toA));
          velaG.uni.uLuz.value = Math.min(4, (0.04 / dA) ** 2);
          velaG.uni.uLuzCol.value.set(0xffd08a);
          velaG.uni.uCalor.value = 0;
        }
      }
      if (faro.points.visible) faro.commit();
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u } = f;
      if (p < P('a4', -0.5) || p > P('a4.fin', 1.5)) return;
      const add = (w: THREE.Vector3, text: string, dx: number, dy: number, a: number) => {
        if (a < 0.01 || !f.lamina) return;
        const q = f.proj(w);
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) nota(g, u, q.x, q.y, text, dx, dy, a);
      };
      const kL = (p - P('a4')) / (P('a4.viaje') - P('a4'));
      const kV = (p - P('a4.viaje')) / (P('a4.frenar') - P('a4.viaje'));
      const kF = kFreno(p);
      const kM = (p - P('a4.muro')) / (P('a4.fin') - P('a4.muro'));
      // The sail: its speed, counted up while the beam pushes.
      const ve = ease(0.5, 0.58, kL) * (1 - ease(0.06, 0.12, kV));
      if (ve > 0.01) {
        const b = vuelo(p).beta;
        cifra(g, u, W * 0.76, H * 0.24, b.toFixed(2).replace('.', ','), '', 58, ve, TEAL, 'de la velocidad de la luz');
        if (f.lamina) {
          // The beam: infrared, invisible; it comes from the swarm, behind.
          const q = f.proj(velaW(vuelo(p).s));
          if (q) {
            for (let k = -2; k <= 2; k++) flecha(g, u, { x: q.x + k * 26 * u - 160 * u, y: q.y + 150 * u }, { x: q.x + k * 6 * u, y: q.y + 14 * u }, '#ff7a5a', ve * 0.7, 1.2, [4, 4], f.time * 40);
            texto(g, u, q.x - 170 * u, q.y + 172 * u, 'haz de láser · infrarrojo, invisible', '#ff9a7a', ve, 10);
          }
        }
      }
      // The trip: the years.
      const vy = ease(0.12, 0.2, kV) * (1 - ease(0.9, 0.98, kV));
      if (vy > 0.01) {
        const s = vuelo(p).s;
        const anos = Math.max(0, Math.min(21.8, (s / TRAMO) * 21.8));
        cifra(g, u, W * 0.76, H * 0.24, String(Math.round(anos)), '', 58, vy, TEAL, 'años de viaje');
        if (f.lamina) {
          texto(g, u, W / 2, H * 0.12, 'adelante: las estrellas se juntan y se ven más azules', '#9fc4ff', vy, 10.5, 'center');
          texto(g, u, W / 2, H * 0.12 + 18 * u, 'atrás: más rojas y débiles', '#ffab8a', vy * 0.7, 10.5, 'center');
        }
      }
      // The aberration cone: what would be 12° from ahead is seen at 10° (cos θ' = (cos θ + β) / (1 + β cos θ)).
      const co = ease(0.1, 0.15, kV) * (1 - ease(0.23, 0.28, kV));
      if (f.lamina && co > 0.01) {
        const c = f.proj(f.vista.pos.clone().addScaledVector(RUMBO, 1e4));
        if (c) {
          const b = vuelo(p).beta;
          const th = (12 * Math.PI) / 180;
          const th2 = Math.acos((Math.cos(th) + b) / (1 + b * Math.cos(th)));
          const r1 = f.focal * Math.tan(th);
          const r2 = f.focal * Math.tan(th2);
          g.save();
          g.lineWidth = 1.2 * u;
          g.globalAlpha = co * 0.55;
          g.strokeStyle = '#ffab8a';
          g.setLineDash([4 * u, 5 * u]);
          g.beginPath();
          g.arc(c.x, c.y, r1, 0, Math.PI * 2);
          g.stroke();
          g.globalAlpha = co * 0.9;
          g.strokeStyle = '#9fc4ff';
          g.setLineDash([]);
          g.beginPath();
          g.arc(c.x, c.y, r2, 0, Math.PI * 2);
          g.stroke();
          g.restore();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + 0.3;
            const dx = Math.cos(a);
            const dy = Math.sin(a);
            flecha(g, u, { x: c.x + dx * (r1 - 2 * u), y: c.y + dy * (r1 - 2 * u) }, { x: c.x + dx * (r2 + 3 * u), y: c.y + dy * (r2 + 3 * u) }, '#9fc4ff', co * 0.8, 1.2);
          }
          texto(g, u, c.x + r1 * 0.72 + 8 * u, c.y - r1 * 0.72, 'quieto, a 12° de adelante', '#ffab8a', co, 10);
          texto(g, u, c.x - r2 * 0.72 - 8 * u, c.y + r2 * 0.72 + 12 * u, 'a 0,2 c se ve a 10°', '#9fc4ff', co, 10, 'right');
        }
      }
      // Faster ways that stay on paper: what physics does not allow (or nobody knows how to do).
      const nf = ease(0.3, 0.36, kV) * (1 - ease(0.5, 0.55, kV));
      if (f.lamina) panel(g, u, W, H, 0.73, 0.37, 'más rápido, solo en papel', ['Bussard: el gas que recoge frena más de lo que empuja', 'Alcubierre: pide energía negativa', 'agujeros de gusano: no se conoce ninguno'], nf);
      const visto = (w: THREE.Vector3) => aberrar(w, f.vista.pos, m.estado.vel.clone().normalize(), m.estado.beta);
      add(visto(A), 'Alfa Centauri A', 34, -30, ease(K_LOG + 0.05, K_LOG + 0.09, kV) * (1 - ease(0.87, 0.9, kV)));
      add(visto(B), 'Alfa Centauri B', 34, -30, ease(K_LOG + 0.05, K_LOG + 0.09, kV) * (1 - ease(0.87, 0.9, kV)));
      // Braking.
      const fr = ease(0.12, 0.2, kF) * (1 - ease(0.9, 0.98, kF));
      if (fr > 0.01) {
        cifra(g, u, W * 0.76, H * 0.24, '4,6 %', '', 58, fr, TEAL, 'de la luz: la más rápida que así puede frenar');
        add(A, 'Alfa Centauri A', -40, -34, fr);
        add(B, 'Alfa Centauri B', 30, -26, fr);
        if (f.lamina) {
          const rel = frenoRel(ease(0, 1, kF));
          const sail = A.clone().add(rel);
          const q0 = f.proj(sail);
          const q1 = f.proj(sail.clone().addScaledVector(rel.clone().normalize(), rel.length() * 0.6));
          if (q0 && q1) {
            flecha(g, u, q0, q1, '#ffd08a', fr, 1.8);
            texto(g, u, q1.x + 10 * u, q1.y, 'la luz de A la empuja hacia atrás', '#ffd08a', fr, 10);
          }
        }
      }
      // The ship's parts, named while we ride beside it (with or without the plate: without them its
      // tanks and fins were a puzzle).
      const kN = (p - P('a4.nave')) / (P('a4.muro') - P('a4.nave'));
      const pa = ease(0.22, 0.32, kN) * (1 - ease(0.84, 0.94, kN));
      if (pa > 0.01) {
        const qN = new THREE.Quaternion().setFromUnitVectors(UP, DIR);
        for (const t of naveG.partes) {
          const q = f.proj(NAVE.clone().addScaledVector(t.en.clone().applyQuaternion(qN), 1000 * M));
          if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) nota(g, u, q.x, q.y, t.texto, t.dx, t.dy, pa);
        }
      }
      // The wall.
      const mu = ease(0.1, 0.18, kM) * (1 - ease(0.9, 1.0, kM));
      if (mu > 0.01) {
        const late = ease(0.55, 0.62, kM);
        cifra(g, u, W * 0.76, H * 0.24, late > 0.5 ? '100 000' : '2 500', '', 58, mu, late > 0.5 ? '#ff9a6a' : TEAL, late > 0.5 ? 'años tarda la luz en cruzar la galaxia' : 'años: toda la galaxia, creciendo un 2,3 % al año');
        add(V(), 'nuestra burbuja', 30, -30, ease(0.2, 0.3, kM) * (1 - ease(0.5, 0.56, kM)));
        add(V(), 'aquí: nuestra burbuja, un punto', 30, -30, ease(0.8, 0.88, kM));
      }
      void ink;
    },
  };
}
