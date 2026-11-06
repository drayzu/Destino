import * as THREE from 'three';
import type { PlanoCamara } from './tipos';

/**
 * First person along a way (DIRECCION.md: you are the one who travels): the camera on the way at
 * beat p, looking ahead along it, its gaze drawn to the worlds it goes to and round. For flights whose
 * way is a function of the beat (the spark's old way: `vuelo.ts`), where `toma.ts`'s `vuelo` needs a
 * curve read by its length.
 *
 * Each world (`Mundo`) draws the gaze three ways:
 * - `cerca`: near it and ahead or beside, this much (a world passed by).
 * - `destino` [from, to]: the world the way goes to, held from far off through a long lens (the
 *   crossing has it ahead, growing, and the lens opens as it comes).
 * - `visita` [from, to]: while the way goes round it, held by the clock, whatever the way's own
 *   direction (let go by where it is, the gaze swung off it at once as the way turned away).
 * The gaze turns as a head turns (round «up», then up or down), never onto what is right behind
 * (there the turn could go either way round), and is averaged over a beat round p: a sudden turn of
 * the way, or of what draws the eye, becomes a turn of the head.
 */
export interface Mundo {
  c: THREE.Vector3;
  R: number;
  cerca?: number;
  destino?: [number, number];
  visita?: [number, number];
  /** How far off it draws the gaze, against its radius (1: the distances above; a sun, more). */
  alcance?: number;
  /** A destination held even when it is off to the side, not only ahead (the head turns to it). */
  aLado?: boolean;
}

const Y = new THREE.Vector3(0, 1, 0);
const PESOS = [1, 2, 4, 6, 8, 9, 10, 9, 8, 6, 4, 2, 1];
const CAMPANA = [1, 4, 6, 4, 1];

export function primeraPersona(camino: (p: number, out: THREE.Vector3) => THREE.Vector3, mundos: Mundo[], o: { fov?: number; arriba?: THREE.Vector3 } = {}) {
  const FOV = o.fov ?? 52;
  const arriba = o.arriba ?? Y;
  const P = new THREE.Vector3();
  const A = new THREE.Vector3();
  const T = new THREE.Vector3();
  const D = new THREE.Vector3();
  const W = new THREE.Vector3();
  const ade = new THREE.Vector3();
  const hA = new THREE.Vector3();
  const hB = new THREE.Vector3();
  const suma = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const out: PlanoCamara = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: FOV, dist: 1, lw: 0 };
  const sm = THREE.MathUtils.smoothstep;
  const ssm = THREE.MathUtils.smootherstep;

  /** From direction a towards b by k, as a head turns: round «up», then up or down (into a). */
  const girar = (a: THREE.Vector3, b: THREE.Vector3, k: number) => {
    const elA = Math.asin(THREE.MathUtils.clamp(a.dot(arriba), -1, 1));
    const elB = Math.asin(THREE.MathUtils.clamp(b.dot(arriba), -1, 1));
    hA.copy(a).addScaledVector(arriba, -a.dot(arriba));
    hB.copy(b).addScaledVector(arriba, -b.dot(arriba));
    if (hA.lengthSq() < 1e-12 || hB.lengthSq() < 1e-12) return a.lerp(b, k).normalize();
    hA.normalize();
    hB.normalize();
    const giro = Math.atan2(T.crossVectors(hA, hB).dot(arriba), hA.dot(hB));
    // (nearly right round, the turn could go either way: let go of it before it gets there)
    k *= 1 - sm(Math.abs(giro), 2.3, 2.9);
    hA.applyAxisAngle(arriba, giro * k);
    const el = elA + (elB - elA) * k;
    return a.copy(hA).multiplyScalar(Math.cos(el)).addScaledVector(arriba, Math.sin(el));
  };

  /** Where it looks at beat p (into D), its lens, and how near the nearest world is. */
  const mirada = (p: number) => {
    P.set(0, 0, 0);
    for (let i = 0; i < 5; i++) P.addScaledVector(camino(p + (i - 2) * 0.05, T), CAMPANA[i] / 16);
    A.set(0, 0, 0);
    for (let i = 0; i < 6; i++) A.addScaledVector(camino(p + 0.3 + i * 0.1, T), 1 / 6);
    D.copy(A).sub(P);
    if (D.lengthSq() < 1e-16) D.set(0, 0, -1);
    D.normalize();
    ade.copy(D);
    let cerca = Infinity;
    let tele = 0;
    let fovTele = FOV;
    for (const w of mundos) {
      W.copy(w.c).sub(P);
      const L = W.length();
      W.divideScalar(L);
      cerca = Math.min(cerca, Math.max(L - w.R, 1e-6));
      const Lr = L / (w.R * (w.alcance ?? 1));
      const enDestino = w.destino ? sm(p, w.destino[0], w.destino[0] + 1.4) * (1 - sm(p, w.destino[1] - 1.4, w.destino[1])) : 0;
      const lejos = enDestino > 0 ? enDestino * sm(Lr, 10, 24) * (w.aLado ? sm(W.dot(ade), -0.6, 0.1) : sm(W.dot(ade), 0.0, 0.6)) : 0;
      const visita = w.visita ? ssm(p, w.visita[0], w.visita[0] + 1.8) * (1 - ssm(p, w.visita[1] - 2.4, w.visita[1])) * (1 - sm(Lr, 6, 20)) : 0;
      const deCerca = w.visita || !w.cerca ? 0 : w.cerca * (1 - sm(Lr, 3, 16)) * sm(W.dot(ade), -0.85, -0.2);
      let k = Math.max(deCerca, 0.95 * lejos, (w.cerca ?? 0.8) * visita);
      k *= sm(W.dot(ade), -0.92, -0.7);
      if (k <= 0) continue;
      girar(D, W, k);
      if (lejos > tele) {
        tele = lejos;
        fovTele = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan((w.R * 3.2) / L)), 7, FOV);
      }
    }
    return { fov: FOV + (fovTele - FOV) * tele, cerca };
  };

  return (p: number): PlanoCamara => {
    suma.set(0, 0, 0);
    let fov = 0;
    let pesos = 0;
    for (let i = 0; i < PESOS.length; i++) {
      const r = mirada(p + (i - 6) * 0.15);
      suma.addScaledVector(D, PESOS[i]);
      fov += r.fov * PESOS[i];
      pesos += PESOS[i];
    }
    const r = mirada(p);
    out.pos.copy(P);
    m.lookAt(T.set(0, 0, 0), suma.normalize(), arriba);
    out.quat.setFromRotationMatrix(m);
    out.fov = fov / pesos;
    out.dist = r.cerca;
    return out;
  };
}
