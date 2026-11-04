import * as THREE from 'three';
import type { Stage } from '../estudios/stage';
import { toma, type Toma } from '../estudios/rig';
import { crearChispa } from '../estudios/chispa';
import type { Acto, EscenaChasis, Film, FrameActo } from './tipos';

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
  /** (for the guards) the rig's gaze and the ride's, before they are blended */
  dirRig?: THREE.Vector3;
  dirRide?: THREE.Vector3;
}

// The ride's smoothing: samples of the way every PASO beats, VENTANA beats either side at most;
// its place over ±LUGAR·dist of way, its gaze over ±MIRA·dist, both within a bell of SIGMA beats.
// (an act may widen or narrow them with its `suave` and `suaveMira` tracks)
const PASO = 0.025;
const VENTANA = 2.4;
const LUGAR = 2.5;
const MIRA = 1.0;
const SIGMA = 0.7;
/** Ahead of the spark the bell is shorter: the camera does not peek down the way the spark has not taken yet
 * (a resting spark is ridden from the way it came; the way out opens as it takes it). */
const SIGMA_ANTES = 0.3;
const TIEMPO_MIN = 0.45;
const N = Math.round(VENTANA / PASO);

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
  const pts = Array.from({ length: 2 * N + 1 }, () => V());
  const ok = new Uint8Array(2 * N + 1);
  const arco = new Float64Array(2 * N + 1);
  const paso = new Float64Array(2 * N + 1);
  const tmA = (): Toma => ({ pos: V(), dir: V(), up: V(), fov: 40, r: V(), e: V(), n: V() });
  const rig = tmA();
  const m4 = new THREE.Matrix4();
  const tq = V();

  /**
   * Which way the spark goes at beat b while it rests (j's units): the way it came (a camera riding
   * a resting spark does not peek down the way it will take; that way opens as it takes it). Only a
   * spark that has not moved yet in this shot looks the way it will leave.
   */
  function rumbo(b: number, j: number, aqui: THREE.Vector3, D: number, out: THREE.Vector3) {
    const pl = planoDe[j];
    // (on a grid of beats that does not move with b: the same rest reads the same way all through it)
    const G = 0.05;
    const g0 = Math.floor(b / G);
    for (const sentido of [-1, 1]) {
      for (let q = 1; q <= 800; q++) {
        const bb = (g0 + (sentido < 0 ? 1 - q : q)) * G;
        if (bb < pl.desde - G || bb > pl.hasta + G) break;
        if (!chispaEn(bb, j, tq)) continue;
        if (tq.distanceTo(aqui) <= 1e-4 * D) continue;
        // (it moved here: the way it went is from a little before that to where it rests)
        const a = V();
        if (!chispaEn(bb + sentido * 0.25, j, a)) a.copy(tq);
        if (a.distanceTo(aqui) < 1e-9 * D) return null;
        return sentido < 0 ? out.copy(aqui).sub(a).normalize() : out.copy(a).sub(aqui).normalize();
      }
    }
    return null;
  }

  /**
   * A track of act i at its beat p, as the camera reads it. Across a seam through the spark, the
   * ride's own tracks start where the last act left them (the distance in its units) and go over
   * to this act's in the first RELEVO beats: the camera simply goes on.
   */
  function pista(i: number, p: number, nombre: string, defecto = 0) {
    const tl = tramos[i].acto.tl;
    const v = tl.get(nombre, p) || defecto;
    if (tramos[i].costura !== 'chispa' || p >= RELEVO) return v;
    let a = tramos[i - 1].acto.tl.get(nombre, tramos[i - 1].largo) || defecto;
    if (nombre === 'mLd') a -= Math.log10(aPrev[i]!.s);
    return a + (v - a) * smooth(clamp(p / RELEVO, 0, 1));
  }

  /** Each act's last pose (the camera as it leaves it), for a seam through a world. */
  const finales = new Map<number, Pose>();
  function camara(b: number): Pose {
    const pose = camaraActo(b);
    const { i, p } = pose;
    if (tramos[i].costura !== 'mundo' || p >= RELEVO) return pose;
    // Through a world: from where the last act left the camera (in this act's units) to this act's
    // own, turning round the world they meet at and through distance in logarithm, the roll that is
    // left between them spread over the seam. The one blend in the film, and only here.
    let fin = finales.get(i - 1);
    if (!fin) {
      fin = camaraActo(tramos[i].inicio - 1e-7);
      finales.set(i - 1, fin);
    }
    const sim = sims[i - 1][i];
    const p0 = sim.aplicar(fin.pos, V());
    const k = smooth(clamp(p / RELEVO, 0, 1));
    const ancla = tramos[i].acto.entrada!.pos;
    const v0 = p0.clone().sub(ancla);
    const v1 = pose.pos.clone().sub(ancla);
    const l0 = Math.max(v0.length(), 1e-300);
    const l1 = Math.max(v1.length(), 1e-300);
    const q = new THREE.Quaternion().setFromUnitVectors(v0.clone().divideScalar(l0), v1.clone().divideScalar(l1));
    const dir = v0.clone().divideScalar(l0).applyQuaternion(new THREE.Quaternion().slerp(q, k));
    const quatB = pose.quat.clone();
    pose.pos.copy(ancla).addScaledVector(dir, Math.exp(Math.log(l0) + (Math.log(l1) - Math.log(l0)) * k));
    const twist = q.clone().multiply(fin.quat).invert().multiply(quatB);
    pose.quat.copy(new THREE.Quaternion().slerp(q, k).multiply(fin.quat).multiply(new THREE.Quaternion().slerp(twist, k)));
    pose.fov = fin.fov + (pose.fov - fin.fov) * k;
    pose.dist = Math.exp(Math.log(fin.dist * sim.s) * (1 - k) + Math.log(pose.dist) * k);
    return pose;
  }

  function camaraActo(b: number): Pose {
    const { i, p } = enTramo(b);
    const A = tramos[i].acto;
    const tl = A.tl;
    toma(tl, p, rig);
    const lw0 = clamp(pista(i, p, 'lw'), 0, 1);
    const chispa = V();
    const hay = chispaEn(b, i, chispa);
    const pose: Pose = { i, p, pos: rig.pos.clone(), quat: new THREE.Quaternion(), fov: rig.fov, chispa: hay ? chispa : null, dist: Math.pow(10, tl.get('ld', p)), lw: hay ? lw0 : 0 };
    m4.lookAt(rig.pos, rig.pos.clone().add(rig.dir), rig.up);
    pose.quat.setFromRotationMatrix(m4);
    const propio = A.rig ? A.rig(p, null, tiempo) : null;
    if (!hay || (lw0 <= 0 && !A.rig) || propio?.propio) return conRig(pose, propio);

    // The ride: the way round the spark, sampled; its length from the spark either way.
    const D = Math.pow(10, pista(i, p, 'mLd'));
    const LUG = pista(i, p, 'mSuave', LUGAR);
    const MIR = pista(i, p, 'mSuaveMira', MIRA);
    for (let k = -N; k <= N; k++) ok[k + N] = chispaEn(b + k * PASO, i, pts[k + N]) ? 1 : 0;
    arco[N] = 0;
    for (let k = 1; k <= N; k++) {
      arco[N + k] = arco[N + k - 1] + (ok[N + k] && ok[N + k - 1] ? pts[N + k].distanceTo(pts[N + k - 1]) : 0);
      arco[N - k] = arco[N - k + 1] - (ok[N - k] && ok[N - k + 1] ? pts[N - k].distanceTo(pts[N - k + 1]) : 0);
    }
    // (each sample weighs the stretch of way it stands for, not one per beat: a spark slowing down
    // leaves its samples bunched, and counted one each they pulled the camera ahead of it)
    for (let k = -N; k <= N; k++) {
      const a = k > -N ? Math.abs(arco[k + N] - arco[k + N - 1]) : 0;
      const b2 = k < N ? Math.abs(arco[k + N + 1] - arco[k + N]) : 0;
      paso[k + N] = 0.5 * (a + b2);
    }
    const lugar = V();
    const mira = V();
    let wl = 0;
    let wm = 0;
    let rl = 0;
    let rm = 0;
    for (let k = -N; k <= N; k++) {
      if (!ok[k + N]) continue;
      const tb = Math.exp(-0.5 * ((k * PASO) / (k > 0 ? SIGMA_ANTES : SIGMA)) ** 2) * (paso[k + N] + 0.02 * D);
      const ul = arco[k + N] / (LUG * D);
      const um = arco[k + N] / (MIR * D);
      const a = ul * ul < 1 ? (1 - ul * ul) ** 2 * tb : 0;
      const c = um * um < 1 ? (1 - um * um) ** 2 * tb : 0;
      lugar.addScaledVector(pts[k + N], a);
      mira.addScaledVector(pts[k + N], c);
      rl += pts[k + N].length() * a;
      rm += pts[k + N].length() * c;
      wl += a;
      wm += c;
    }
    lugar.divideScalar(wl);
    mira.divideScalar(wm);
    // (a way over a sphere round the act's origin: the average cuts under its surface; back up to the
    // way's own height there)
    const radial = A.radial ? A.radial(p) : 0;
    if (radial > 0) {
      lugar.setLength(lugar.length() + (rl / wl - lugar.length()) * radial);
      mira.setLength(mira.length() + (rm / wm - mira.length()) * radial);
    }
    // Which way it goes: the slope of the way (a line fitted through it by its length), over a stretch
    // never shorter than the way covered in TIEMPO_MIN beats (a fast spark that turns sharply turns the
    // camera over at least that long, never at once); where the spark rests, the way it last came by.
    const vel = (arco[Math.min(2 * N, N + 4)] - arco[Math.max(0, N - 4)]) / (8 * PASO);
    const LUGd = Math.max(LUG * D, vel * TIEMPO_MIN);
    let wr = 0;
    let am = 0;
    const pm = V();
    const pesoR = (k: number) => {
      const tb = Math.exp(-0.5 * ((k * PASO) / (k > 0 ? SIGMA_ANTES : SIGMA)) ** 2) * (paso[k + N] + 0.02 * D);
      const ul = arco[k + N] / LUGd;
      return ul * ul < 1 ? (1 - ul * ul) ** 2 * tb : 0;
    };
    for (let k = -N; k <= N; k++) {
      if (!ok[k + N]) continue;
      const a = pesoR(k);
      am += arco[k + N] * a;
      pm.addScaledVector(pts[k + N], a);
      wr += a;
    }
    am /= wr;
    pm.divideScalar(wr);
    let den = 0;
    const num = V();
    const media = V();
    for (let k = -N; k <= N; k++) {
      if (!ok[k + N]) continue;
      const a = pesoR(k);
      const da = arco[k + N] - am;
      media.copy(pts[k + N]).sub(pm);
      num.addScaledVector(media, a * da);
      den += a * da * da;
    }
    // (how much way the fit had: next to nothing where the spark rests)
    const extension = Math.min(Math.sqrt(den / wr), 1e300);
    const dir = den > 0 ? num.divideScalar(den) : V();
    const firme = smooth(clamp((extension - 0.02 * D) / (0.1 * D), 0, 1));
    if (firme < 1) {
      const r = rumbo(b, i, chispa, D, V()) ?? rig.dir.clone();
      // (turned from the way it came to the way it goes, never through nothing: two ways far apart
      // blended straight would pass by zero and flip)
      if (dir.lengthSq() < 1e-20) dir.copy(r);
      else girar(r, dir.clone().normalize(), firme, rig.up, dir);
    }
    if (dir.lengthSq() < 1e-20) dir.copy(rig.dir);
    dir.normalize();
    // Up: the act's (the world's vertical by default), square to the way.
    const arriba = A.arriba ? A.arriba(p, chispa, V()) : V(0, 1, 0);
    const upP = arriba.clone().addScaledVector(dir, -arriba.dot(dir));
    if (upP.lengthSq() < 1e-12) upP.copy(rig.up);
    upP.normalize();
    const alto = THREE.MathUtils.degToRad(pista(i, p, 'mAlto'));
    const pos = lugar.clone().addScaledVector(dir, -D * Math.cos(alto)).addScaledVector(upP, D * Math.sin(alto));
    const blanco = mira.clone().addScaledVector(dir, pista(i, p, 'mAde') * D);
    const mirada = blanco.clone().sub(pos).normalize();
    // The spark stays in frame by construction: where looking ahead of it would leave it (the
    // smoothed one, so its own jolts are not copied) near the edge, the gaze turns back to it softly.
    const aSpark = mira.clone().sub(pos).normalize();
    const semi = THREE.MathUtils.degToRad(rig.fov / 2);
    const fuera = mirada.angleTo(aSpark);
    const SEG = 0.45 * semi;
    const BOR = 0.75 * semi;
    if (fuera > SEG) {
      const queda = SEG + (BOR - SEG) * Math.tanh((fuera - SEG) / (BOR - SEG));
      girar(mirada.clone(), aSpark, (fuera - queda) / fuera, upP, mirada);
      const lejos = blanco.distanceTo(pos);
      blanco.copy(pos).addScaledVector(mirada, lejos);
    }
    // (looking steeply down or up, «up» would spin: the way ahead takes over as the frame's top)
    const empinado = smooth(clamp((Math.abs(mirada.dot(upP)) - 0.6) / 0.35, 0, 1));
    const ref = upP.clone().addScaledVector(dir, 1.6 * empinado * Math.sign(-mirada.dot(upP) || 1));
    const up = ref.addScaledVector(mirada, -ref.dot(mirada)).normalize();
    const roll = THREE.MathUtils.degToRad(pista(i, p, 'roll'));
    if (roll) up.applyAxisAngle(mirada, roll);
    m4.lookAt(pos, blanco, up);
    const qRide = new THREE.Quaternion().setFromRotationMatrix(m4);
    pose.dirRig = rig.dir.clone();
    pose.dirRide = mirada.clone();
    (pose as unknown as Record<string, unknown>).dbg = { dir: dir.toArray(), firme, ext: extension / D, mira: blanco.toArray(), lugar: lugar.toArray() };

    // From the rig to the ride: the rig's own blend (rig.ts), which turns round what it looks at and
    // through distance in logarithm, and levels the horizon on the ride's «up».
    // (an act with a rig of its own blends it with the ride itself, in its own frame)
    if (A.rig) {
      const r = A.rig(p, { lugar: pos, mira: blanco, arriba: upP, delante: dir, quat: qRide }, tiempo);
      if (r) {
        pose.pos.copy(r.pos);
        m4.lookAt(r.pos, r.pos.clone().add(r.dir), r.up);
        pose.quat.setFromRotationMatrix(m4);
        pose.fov = r.fov;
        pose.lw = r.lw;
        pose.dist = Math.exp(Math.log(pose.dist) * (1 - r.lw) + Math.log(D) * r.lw);
        return pose;
      }
    }
    if (lw0 <= 0) return pose;
    const w = smooth(lw0);
    if (w >= 1) {
      pose.pos.copy(pos);
      pose.quat.copy(qRide);
    } else {
      const t2 = toma(tl, p, tmA(), { punto: blanco, peso: w, arriba: upP, delante: dir }, { punto: pos, peso: w });
      pose.pos.copy(t2.pos);
      m4.lookAt(t2.pos, t2.pos.clone().add(t2.dir), t2.up);
      pose.quat.setFromRotationMatrix(m4);
      pose.fov = t2.fov;
    }
    void qRide;
    pose.dist = Math.exp(Math.log(pose.dist) * (1 - w) + Math.log(D) * w);
    return pose;
  }

  /** The pose from an act's own rig, where it has one now. */
  function conRig(pose: Pose, r: ReturnType<NonNullable<Acto['rig']>>) {
    if (!r) return pose;
    pose.pos.copy(r.pos);
    m4.lookAt(r.pos, r.pos.clone().add(r.dir), r.up);
    pose.quat.setFromRotationMatrix(m4);
    pose.fov = r.fov;
    pose.lw = r.lw;
    if (pose.chispa && r.lw > 0) encuadrar(pose, r.lw);
    return pose;
  }

  /**
   * An act's own chase keeps the spark in frame as the ride does: near the middle it is left alone;
   * towards an edge the camera turns just enough to keep it inside a soft border (a knee per axis, by
   * the frame's own width and height). Pure: the spark and the pose at this beat, nothing measured.
   */
  function encuadrar(pose: Pose, peso: number) {
    const v = pose.chispa!.clone().sub(pose.pos).applyQuaternion(pose.quat.clone().invert());
    if (v.z >= 0) return;
    // (let go where the spark passes the camera: far off the axis, it cannot be followed without a lurch)
    const ty = Math.tan(THREE.MathUtils.degToRad(pose.fov / 2));
    const tx = ty * stage.camera.aspect;
    const semi = Math.atan(Math.hypot(tx, ty));
    const fuera = Math.acos(clamp(-v.z / v.length(), -1, 1));
    const w = peso * (1 - smooth(clamp((fuera - 1.15 * semi) / 0.44, 0, 1)));
    if (w <= 0) return;
    const rodilla = (n: number) => {
      const a = Math.abs(n);
      if (a <= 0.55) return n;
      return Math.sign(n) * (0.55 + 0.27 * Math.tanh((a - 0.55) / 0.27));
    };
    const ax = Math.atan2(v.x, -v.z);
    const ay = Math.atan2(v.y, -v.z);
    const gx = (ax - Math.atan(rodilla(Math.tan(ax) / tx) * tx)) * w;
    const gy = (ay - Math.atan(rodilla(Math.tan(ay) / ty) * ty)) * w;
    pose.quat.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -gx)).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), gy));
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
    const on = pose.chispa ? A.tl.get('on', p) : 0;
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

/** `a` turned a fraction `w` of the way to `b` (unit vectors), round `eje` when they are opposite. */
function girar(a: THREE.Vector3, b: THREE.Vector3, w: number, eje: THREE.Vector3, out: THREE.Vector3) {
  const ang = a.angleTo(b);
  const ax = new THREE.Vector3().crossVectors(a, b);
  if (ax.lengthSq() < 1e-12) ax.copy(eje);
  return out.copy(a).applyAxisAngle(ax.normalize(), ang * w);
}

/**
 * Moves `pos` a fraction `w` of the way to `hacia`, turning round `pivote` and through its distance
 * to it in logarithm (rig.ts's). False where that has no meaning.
 */
function girarHacia(pos: THREE.Vector3, hacia: THREE.Vector3, pivote: THREE.Vector3, w: number) {
  const v0 = pos.clone().sub(pivote);
  const v1 = hacia.clone().sub(pivote);
  const l0 = v0.length();
  const l1 = v1.length();
  if (l0 < 1e-300 || l1 < 1e-300) return false;
  v0.divideScalar(l0);
  v1.divideScalar(l1);
  const ang = v0.angleTo(v1);
  if (ang > Math.PI - 1e-4) return false;
  if (ang > 1e-9) v0.applyAxisAngle(new THREE.Vector3().crossVectors(v0, v1).normalize(), ang * w);
  pos.copy(pivote).addScaledVector(v0, Math.exp(Math.log(l0) + (Math.log(l1) - Math.log(l0)) * w));
  return true;
}
