import * as THREE from 'three';
import type { Stage } from '../estudios/stage';
import { crearChispa } from '../estudios/chispa';
import type { Acto, EscenaChasis, Film, FrameActo } from './tipos';
import { pistasDe, type CamaraHorneada } from './pista';
import CAMARAS from './camaras.json';

/**
 * The film (CHASIS.md): every act on one line of beats, ONE camera, ONE spark.
 *
 * - **One spark.** Each act says where the spark is in its own units (`chispa(p)`). Across a seam
 *   the engine places the next act's world so that its spark starts exactly where the last one's
 *   ends: the spark is one continuous way through the whole film (until a cut, under a cover).
 * - **One camera.** It rides that way: behind the spark by the act's `mLd`, its place and its gaze the
 *   way smoothed over a stretch of it (by its length, not its beats, so a fast flight and a slow
 *   drift ride alike), and the way crosses seams like any other stretch. Where an act wants a shot
 *   of its own, the camera turns from the ride to its rig (`lw`). Nothing corrects it afterwards.
 * - **Pure.** Everything here is a function of the beat: the same beat is the same picture, reached
 *   from before, from after, or straight away. Nothing is measured while the film plays.
 * - The camera lives in the units of the act that holds the beat; the other act across a seam is
 *   placed in them by a similarity (scale and shift, the acts share their axes), composed in double
 *   precision between those two acts only.
 */

/** Beats across a seam during which the last act is still drawn, fading. */
export const RELEVO = 1.8;
/** The quickest anything may come or go, in beats (the guard checks every act's `presencias`). */
export const FUNDIDO_MIN = 0.4;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** x' = s·x + t: an act's units into another's (no turn: acts share their axes). */
export class Sim {
  constructor(
    public s = 1,
    public t = V(),
  ) {}
  aplicar(v: THREE.Vector3, out = V()) {
    return out.copy(v).multiplyScalar(this.s).add(this.t);
  }
  /** This one after `o` (first `o`, then this). */
  tras(o: Sim) {
    return new Sim(this.s * o.s, o.t.clone().multiplyScalar(this.s).add(this.t));
  }
  inversa() {
    return new Sim(1 / this.s, this.t.clone().multiplyScalar(-1 / this.s));
  }
  matriz(out = new THREE.Matrix4()) {
    return out.makeScale(this.s, this.s, this.s).setPosition(this.t);
  }
}

export interface Tramo {
  acto: Acto;
  inicio: number;
  largo: number;
  /** Shots between cuts and world seams: the spark's way is continuous within one. */
  plano: number;
  /** Stretches between cuts: their acts' units map into each other. */
  cadena: number;
  /** How it came in from the act before. */
  costura: 'chispa' | 'corte' | 'mundo' | null;
}

/** The camera at a beat: in the units of the act `i` that holds it. */
export interface Pose {
  i: number;
  p: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  fov: number;
  /** The spark there (same units), or null. */
  chispa: THREE.Vector3 | null;
  /** How far behind the spark the ride is (same units); the rig's distance when not riding. */
  dist: number;
  /** How much it rides. */
  lw: number;
}

export function crearPelicula(stage: Stage, escenas: EscenaChasis[]) {
  const tramos: Tramo[] = [];
  let cursor = 0;
  let plano = 0;
  let cadena = 0;
  for (const [k, e] of escenas.entries()) {
    const grupo = new THREE.Group();
    stage.root.add(grupo);
    const s = Object.create(stage, { root: { value: grupo } }) as Stage;
    stage.reset();
    const acto = e.montar(s);
    acto.grupo = grupo;
    const costura = k === 0 ? null : (acto.costura ?? 'chispa');
    if (costura === 'corte' || costura === 'mundo') plano++;
    if (costura === 'corte') cadena++;
    tramos.push({ acto, inicio: cursor, largo: acto.tl.length, plano, cadena, costura });
    cursor += acto.tl.length;
  }
  const TOTAL = cursor;

  // ---- The seams: each act's units into the one before's.
  const aPrev: (Sim | null)[] = tramos.map(() => null);
  for (let k = 1; k < tramos.length; k++) {
    const A = tramos[k - 1].acto;
    const B = tramos[k].acto;
    if (tramos[k].costura === 'corte') continue;
    if (tramos[k].costura === 'mundo') {
      // (a seam through a world: this act's `entrada` lands on the last one's `salida`, same place, same size)
      if (!A.salida || !B.entrada) throw new Error(`costura ${A.id} → ${B.id}: falta salida o entrada`);
      const s = A.salida.escala / B.entrada.escala;
      aPrev[k] = new Sim(s, A.salida.pos.clone().sub(B.entrada.pos.clone().multiplyScalar(s)));
      continue;
    }
    const a = V();
    const c = V();
    if (!A.chispa(tramos[k - 1].largo, a, 0) || !B.chispa(0, c, 0)) throw new Error(`costura ${A.id} → ${B.id}: sin chispa en el encuentro`);
    // (the ride the same distance on both sides: the camera simply goes on)
    const s = Math.pow(10, A.tl.get('mLd', tramos[k - 1].largo) - B.tl.get('mLd', 0));
    aPrev[k] = new Sim(s, a.clone().sub(c.clone().multiplyScalar(s)));
  }
  /** Act i's units into act j's (same shot only; identity otherwise). */
  const sims = tramos.map((_, i) =>
    tramos.map((__, j) => {
      if (i === j || tramos[i].cadena !== tramos[j].cadena) return new Sim();
      let m = new Sim();
      if (i > j) for (let k = i; k > j; k--) m = aPrev[k]!.tras(m);
      else for (let k = j; k > i; k--) m = m.tras(aPrev[k]!.inversa());
      return m;
    }),
  );
  const planoDe = tramos.map((t) => {
    const del = tramos.filter((x) => x.plano === t.plano);
    return { desde: del[0].inicio, hasta: del[del.length - 1].inicio + del[del.length - 1].largo };
  });

  /** The act at beat b, and the beat inside it. */
  /** The ambient time the spark's way is read at (the frame's; 0 for the pace and the guards). */
  let tiempo = 0;
  function enTramo(b: number) {
    let i = 0;
    for (let k = 0; k < tramos.length; k++) if (b >= tramos[k].inicio) i = k;
    return { i, p: clamp(b - tramos[i].inicio, 0, tramos[i].largo) };
  }

  /** The spark at beat b in act j's units (b kept inside j's shot). False where there is none. */
  function chispaEn(b: number, j: number, out: THREE.Vector3) {
    const pl = planoDe[j];
    const bb = clamp(b, pl.desde, pl.hasta);
    const { i, p } = enTramo(Math.min(bb, pl.hasta - 1e-9));
    if (tramos[i].plano !== tramos[j].plano) return false;
    if (!tramos[i].acto.chispa(p, out, tiempo)) return false;
    sims[i][j].aplicar(out, out);
    return true;
  }

  // ---- The camera.
  // ---- The camera: baked (tools/hornear.mjs, chasis/camaras.json), as Tiempo's is. Each act's
  // camera is a set of keys the film flows through; nothing chases anything, nothing corrects it.
  const pistas = tramos.map((t) => {
    const c = (CAMARAS as Record<string, CamaraHorneada>)[t.acto.id];
    if (!c) throw new Error(`sin cámara horneada para ${t.acto.id} (node tools/hornear.mjs)`);
    return pistasDe(c);
  });

  function camara(b: number): Pose {
    const { i, p } = enTramo(b);
    const k = pistas[i];
    const quat = new THREE.Quaternion(k.qx.get(p), k.qy.get(p), k.qz.get(p), k.qw.get(p)).normalize();
    const ch = V();
    const hay = chispaEn(b, i, ch);
    return { i, p, pos: V(k.x.get(p), k.y.get(p), k.z.get(p)), quat, fov: k.fov.get(p), chispa: hay ? ch : null, dist: Math.pow(10, k.ld.get(p)), lw: hay ? clamp(k.lw.get(p), 0, 1) : 0 };
  }

  // ---- Drawing a beat.
  const chispa = crearChispa();
  stage.root.add(chispa.nube.points);
  chispa.nube.points.renderOrder = 50;
  const camino = { j: 0, f: (s: number, out: THREE.Vector3) => (chispaEn(s, camino.j, out) ? out : out.set(NaN, NaN, NaN)) };

  function fundir(grupo: THREE.Object3D, k: number, escala: number) {
    grupo.traverse((o) => {
      const un = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms;
      if (o.renderOrder === -100) o.visible = k > 0.3;
      if (!un) return;
      if (un.uEscalaMundo) un.uEscalaMundo.value = escala;
      if (un.uFundido) un.uFundido.value = k;
    });
  }

  const filmEn = (i: number, p: number): Film => {
    const a = tramos[i].acto;
    if (!tramos[i].costura || tramos[i].costura === 'corte' || p >= RELEVO) return a.film;
    const b = tramos[i - 1].acto.film;
    const k = smooth(clamp(p / RELEVO, 0, 1));
    return { strength: b.strength + (a.film.strength - b.strength) * k, radius: b.radius + (a.film.radius - b.radius) * k, threshold: b.threshold + (a.film.threshold - b.threshold) * k, exposure: b.exposure + (a.film.exposure - b.exposure) * k };
  };

  /**
   * Places everything for beat b (the camera, every act, the spark) without drawing; returns the
   * frame for the plate. `f` gives the page's own (time, size).
   */
  function poner(b: number, f: Omit<FrameActo, 'p' | 'camera' | 'chispa' | 'propio' | 'focal' | 'presencia' | 'nubeChispa'>, soloCamara = false) {
    tiempo = soloCamara ? 0 : f.time;
    const pose = camara(b);
    const { i, p } = pose;
    const cam = stage.camera;
    const A = tramos[i].acto;
    cam.position.copy(pose.pos);
    cam.quaternion.copy(pose.quat);
    cam.fov = pose.fov;
    cam.near = A.cerca;
    cam.far = A.lejos;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    if (soloCamara) return { pose, frame: null };
    const focal = f.H / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    // The act before, across a seam through the spark: still drawn, fading.
    const prev = tramos[i].costura && tramos[i].costura !== 'corte' && p < RELEVO ? i - 1 : -1;
    // (an act that takes the flight on in mid air, `continuo`, is all there from its first beat; the
    // one going out leaves to it what both draw)
    const continuo = tramos[i].costura === 'chispa' && !!A.continuo;
    const c = continuo ? 1 : smooth(clamp((p - 0.05) / (RELEVO * 0.8), 0, 1));
    const enCam = V();
    const mPrev = new THREE.Matrix4();
    for (const [k, t] of tramos.entries()) {
      const g = t.acto.grupo;
      const on = k === i || k === prev;
      g.visible = on;
      if (!on) continue;
      g.matrixAutoUpdate = false;
      sims[k][i].matriz(mPrev);
      g.matrix.copy(mPrev);
      g.updateMatrixWorld(true);
      fundir(g, k === i ? (prev >= 0 ? c : 1) : 1 - smooth(clamp((p - 0.05) / (RELEVO * 0.8), 0, 1)), sims[k][i].s);
      // (its update reads the camera in its own units)
      const inv = sims[i][k];
      cam.position.copy(inv.aplicar(pose.pos, enCam));
      cam.near = A.cerca * inv.s;
      cam.far = A.lejos * inv.s;
      cam.updateMatrixWorld();
      const ch = pose.chispa ? inv.aplicar(pose.chispa, V()) : null;
      const luz = k === i ? (prev >= 0 ? c : 1) : 1 - smooth(clamp((p - 0.05) / (RELEVO * 0.8), 0, 1));
      t.acto.update({ ...f, p: k === i ? p : t.largo, camera: cam, focal, chispa: ch, propio: k === i, saliente: k !== i && continuo, presencia: luz, nubeChispa: chispa.nube });
      const tope = t.acto.relevoMaxPx;
      if (k !== i && tope) g.traverse((o) => {
        const un = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms;
        if (un?.uMaxPx) un.uMaxPx.value = Math.min(un.uMaxPx.value, tope * f.dpr);
      });
    }
    cam.position.copy(pose.pos);
    cam.near = A.cerca;
    cam.far = A.lejos;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // The spark: one, on the film's way, in this act's units.
    camino.j = i;
    const on = pose.chispa ? (A.luz ? A.luz(p) : A.tl.get('on', p)) : 0;
    chispa.nube.points.visible = on > 0.001;
    if (pose.chispa && on > 0.001) {
      // (its wake: the way back over about its ride's distance on screen)
      const D = Math.max(pose.dist, 1e-30);
      let atras = 0.05;
      let largo = 0;
      const a = V();
      const z = pose.chispa.clone();
      for (; atras < 3; atras += 0.05) {
        if (!chispaEn(b - atras, i, a)) break;
        largo += a.distanceTo(z);
        z.copy(a);
        if (largo > 0.7 * D) break;
      }
      chispa.update(camino.f, b, atras / 55, on, A.titila ? A.titila(p) : A.tl.get('tit', p), pose.pos, focal, f.dpr, f.time);
      chispa.nube.u.uFundido.value = 1;
      chispa.nube.u.uEscalaMundo.value = 1;
    }
    const film = filmEn(i, p);
    stage.bloom.strength = film.strength;
    stage.bloom.radius = film.radius;
    stage.bloom.threshold = film.threshold;
    stage.renderer.toneMappingExposure = film.exposure;
    const frame: FrameActo = { ...f, p, camera: cam, focal, chispa: pose.chispa, propio: true, presencia: 1, nubeChispa: chispa.nube };
    return { pose, frame };
  }

  return { tramos, TOTAL, enTramo, chispaEn, camara, poner, sims };
}

export type Pelicula = ReturnType<typeof crearPelicula>;
