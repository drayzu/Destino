import * as THREE from 'three';
import type { Stage } from '../estudios/stage';
import { crearChispa } from '../estudios/chispa';
import type { Acto, EscenaChasis, Film, FrameActo, PlanoCamara } from './tipos';
import { pistasDe, type CamaraHorneada } from './pista';
import CAMARAS from './camaras.json';

/**
 * The film (CHASIS.md): every act on one line of beats, ONE camera, ONE spark.
 *
 * - **The camera is baked**: per act, keys of position, orientation, fov and distance the film
 *   flows through (chasis/camaras.json). Nothing chases anything, nothing corrects it afterwards;
 *   changing a key changes the film only between its two neighbours.
 * - **One spark.** Each act says where the spark is in its own units (`chispa(p)`); it is drawn
 *   once, with its wake, wherever the film is.
 * - **Seams.** The next act's world is placed in the last one's units by a similarity (scale and
 *   shift): through the spark (`chispa`: the spark and the camera's distance meet), through a world
 *   (`mundo`: `entrada` on `salida`), or a cut under the last act's cover (`corte`). Across a seam
 *   both acts are drawn for RELEVO beats, the light crossing over; the camera needs nothing there,
 *   its keys already go on.
 * - **Pure.** Everything here is a function of the beat (and, for a world that turns by itself, of
 *   the ambient time): the same beat is the same picture, however it is reached.
 */
/** Beats across a seam during which the last act is still drawn, fading. */
export const RELEVO = 1.8;
/** The quickest anything may come or go, in beats (the guard checks every act's `presencias`). */
export const FUNDIDO_MIN = 0.4;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/**
 * x' = s·q(x) + t: an act's units into another's. Through a world or the spark, acts share their
 * axes (q none); through the frame (`cuadro`), the turn that lays one camera on the other.
 */
export class Sim {
  constructor(
    public s = 1,
    public t = V(),
    public q = new THREE.Quaternion(),
  ) {}
  aplicar(v: THREE.Vector3, out = V()) {
    return out.copy(v).applyQuaternion(this.q).multiplyScalar(this.s).add(this.t);
  }
  /** An orientation into the other units (the turn alone). */
  girar(q: THREE.Quaternion, out = new THREE.Quaternion()) {
    return out.copy(this.q).multiply(q);
  }
  /** This one after `o` (first `o`, then this). */
  tras(o: Sim) {
    return new Sim(this.s * o.s, o.t.clone().applyQuaternion(this.q).multiplyScalar(this.s).add(this.t), this.q.clone().multiply(o.q));
  }
  inversa() {
    const qi = this.q.clone().invert();
    return new Sim(1 / this.s, this.t.clone().applyQuaternion(qi).multiplyScalar(-1 / this.s), qi);
  }
  matriz(out = new THREE.Matrix4()) {
    return out.compose(this.t, this.q, V(this.s, this.s, this.s));
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
  costura: 'chispa' | 'corte' | 'mundo' | 'cuadro' | null;
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

  // ---- The camera: baked (tools/hornear.mjs, chasis/camaras.json), as Tiempo's is. Each act's
  // camera is a set of keys the film flows through; nothing chases anything, nothing corrects it.
  // An act that writes its own camera (`camara`, chasis/toma.ts) needs no keys.
  const pistas = tramos.map((t) => {
    if (t.acto.camara) return null;
    const c = (CAMARAS as Record<string, CamaraHorneada>)[t.acto.id];
    if (!c) throw new Error(`sin cámara para ${t.acto.id}: ni camara() ni claves horneadas`);
    return pistasDe(c);
  });
  /** The ambient time the spark's way is read at (the frame's; 0 for the pace and the guards). */
  let tiempo = 0;
  const chCam = V();
  /** Act i's camera at beat p (its own units): written by the act, or its baked keys. */
  function camaraActo(i: number, p: number): PlanoCamara {
    const A = tramos[i].acto;
    if (A.camara) {
      const out: PlanoCamara = { pos: V(), quat: new THREE.Quaternion(), fov: 40, dist: 1, lw: 0 };
      A.camara(p, A.chispa(p, chCam, tiempo) ? chCam : null, out);
      return out;
    }
    const k = pistas[i]!;
    return {
      pos: V(k.x.get(p), k.y.get(p), k.z.get(p)),
      quat: new THREE.Quaternion(k.qx.get(p), k.qy.get(p), k.qz.get(p), k.qw.get(p)).normalize(),
      fov: k.fov.get(p),
      dist: Math.pow(10, k.ld.get(p)),
      lw: k.lw.get(p),
    };
  }

  // ---- The seams: each act's units into the one before's.
  const aPrev: (Sim | null)[] = tramos.map(() => null);
  for (let k = 1; k < tramos.length; k++) {
    const A = tramos[k - 1].acto;
    const B = tramos[k].acto;
    if (tramos[k].costura === 'corte') continue;
    const la = tramos[k - 1].largo;
    if (tramos[k].costura === 'cuadro') {
      // (a seam through the frame: the two cameras laid on each other, the last act's end on this
      // one's start; the scale so the spark, where both have one, is the same spark. Neither act
      // needs to know the other: only that the picture at the seam is the same, CHASIS.md)
      const ca = camaraActo(k - 1, la);
      const cb = camaraActo(k, 0);
      const a = V();
      const c = V();
      const s = A.chispa(la, a, 0) && B.chispa(0, c, 0) ? ca.pos.distanceTo(a) / Math.max(cb.pos.distanceTo(c), 1e-300) : ca.dist / cb.dist;
      const q = ca.quat.clone().multiply(cb.quat.clone().invert());
      aPrev[k] = new Sim(s, ca.pos.clone().sub(cb.pos.clone().applyQuaternion(q).multiplyScalar(s)), q);
      continue;
    }
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
    // (the camera is the same camera on both sides, and so is the spark: the two points fix the scale)
    const camA = camaraActo(k - 1, la).pos;
    const camB = camaraActo(k, 0).pos;
    const s = camA.distanceTo(a) / Math.max(camB.distanceTo(c), 1e-300);
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
  function camara(b: number): Pose {
    const { i, p } = enTramo(b);
    const c = camaraActo(i, p);
    const ch = V();
    const hay = chispaEn(b, i, ch);
    return { i, p, pos: c.pos, quat: c.quat, fov: c.fov, chispa: hay ? ch : null, dist: c.dist, lw: hay ? clamp(c.lw, 0, 1) : 0 };
  }

  // ---- Drawing a beat.
  const chispa = crearChispa();
  stage.root.add(chispa.nube.points);
  chispa.nube.points.renderOrder = 50;
  const camino = { j: 0, f: (s: number, out: THREE.Vector3) => (chispaEn(s, camino.j, out) ? out : out.set(NaN, NaN, NaN)) };

  function fundir(grupo: THREE.Object3D, k: number, escala: number) {
    grupo.traverse((o) => {
      const un = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms;
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
      inv.girar(pose.quat, cam.quaternion);
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
    cam.quaternion.copy(pose.quat);
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
      // (to the exact beat where it reaches that length, not the next step past it: a wake that grew
      // and shrank by whole steps as the spark changed pace flickered)
      for (; atras < 3; atras += 0.05) {
        if (!chispaEn(b - atras, i, a)) break;
        const tramo = a.distanceTo(z);
        if (largo + tramo > 0.7 * D) {
          atras -= 0.05 * (1 - (0.7 * D - largo) / tramo);
          break;
        }
        largo += tramo;
        z.copy(a);
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
