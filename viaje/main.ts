import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../estudios/style.css';
import * as THREE from 'three';
import { clamp, damp } from '../estudios/motor/math';
import { FONDOS } from '../estudios/motor/pantalla';
import { createStage, type Stage } from '../estudios/stage';
import { cuenta, escalera, FONT, ink, VIOLETA } from '../estudios/placa';
import type { Ancla, Escena, Frame, Instancia } from '../estudios/tipos';
import { apertura } from '../estudios/apertura';
import { despierta } from '../estudios/despierta';
import { tierraNoche } from '../estudios/tierra';
import { sistema } from '../estudios/sistema';
import { mercurio } from '../estudios/mercurio';
import { solTrabajado } from '../estudios/sol';
import { vela } from '../estudios/vela';
import { galaxia } from '../estudios/galaxia';
import { estrella } from '../estudios/estrella';
import { cosmos } from '../estudios/cosmos';
import { final } from '../estudios/final';

/**
 * Destino, the remake: the journey. One scroll through the scenes of ESCALETA.md, built with the
 * ways Diego chose in the studies (29 Oct 2026: A 1, B 1, C 2). Infinito's journey engine: each act
 * builds into its own group and owns the camera while it is on; acts hand over through a shared
 * image (the relay below), never through black.
 *
 * The relay between two acts: for the first RELEVO beats of an act, the act before it is still
 * drawn, its world placed so that its `salida` lands on this act's `entrada` (same place, same
 * size). The camera starts exactly where the last act left it and slides into this act's own way;
 * the last act's light fades as this one's comes up.
 *
 * URL: ?p=beat (start there) &ver=beat (freeze) &cap=1600x900 (render at that size) &debug (leaves
 * `viaje` in the console: `viaje.hoja('docs/remake/viaje/x.jpg', beats, cols, width)`).
 */

const ACTOS: [Escena, number][] = [
  [apertura, 0],
  [despierta, 0],
  [tierraNoche, 0],
  [sistema, 0],
  [mercurio, 0],
  [solTrabajado, 0],
  [vela, 0],
  [galaxia, 0],
  [estrella, 1],
  [cosmos, 0],
  [final, 0],
];
/** Beats before the first act (the title is inside act I now). */
const PORTADA = 0;
/** Beats of black between two acts: none, the acts hand over through a shared image (GUION.md). */
const FUNDIDO = 0;
const PX_PER_BEAT = 520;

const params = new URLSearchParams(location.search);
const capMatch = /^(\d+)x(\d+)$/.exec(params.get('cap') ?? '');
const fixed = capMatch ? { w: Number(capMatch[1]), h: Number(capMatch[2]) } : null;
if (fixed) document.body.classList.add('is-cap');

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const plate = document.querySelector<HTMLCanvasElement>('#placa')!;
const g = plate.getContext('2d')!;
const stage = createStage(canvas, fixed);
const spacer = document.querySelector<HTMLElement>('#spacer')!;

// ---------------------------------------------------------------- the acts

interface Tramo {
  escena: Escena;
  estilo: number;
  inicio: number;
  largo: number;
  grupo: THREE.Group;
  inst: Instancia | null;
  /** The film settings the act chose when it was built (re-applied when it comes on). */
  film: { strength: number; radius: number; threshold: number; exposure: number } | null;
}

/** An act builds into its own group: a stage whose root is that group. */
function montar(t: Tramo) {
  if (t.inst) return t.inst;
  const s = Object.create(stage, { root: { value: t.grupo } }) as Stage;
  stage.reset();
  t.inst = t.escena.montar(s, t.estilo, true);
  t.film = { strength: stage.bloom.strength, radius: stage.bloom.radius, threshold: stage.bloom.threshold, exposure: stage.renderer.toneMappingExposure };
  t.grupo.visible = false;
  return t.inst;
}

// The length of each act comes from its own timeline: build them all once to measure (cheap enough
// for now; the heavy ones load their maps in the background).
const tramos: Tramo[] = [];
let cursor = PORTADA;
for (const [escena, estilo] of ACTOS) {
  const grupo = new THREE.Group();
  stage.root.add(grupo);
  const t: Tramo = { escena, estilo, inicio: cursor, largo: 0, grupo, inst: null, film: null };
  montar(t);
  t.largo = t.inst!.tl.length;
  cursor += t.largo + FUNDIDO;
  tramos.push(t);
}
const TOTAL = cursor;
spacer.style.height = `${TOTAL * PX_PER_BEAT + innerHeight}px`;

// Every act's shaders compile once, at the start: otherwise the first frame of each act compiles
// them and the page stalls right at the change of act. Hidden things are shown for it (three only
// compiles what is visible), then put back.
async function precompilar() {
  await Promise.all(tramos.map((t) => t.inst?.listo));
  const ocultos: THREE.Object3D[] = [];
  stage.scene.traverse((o) => {
    if (!o.visible) {
      ocultos.push(o);
      o.visible = true;
    }
  });
  // Into a target like the film's (half float): the programs three builds for an off-screen target
  // differ from those for the canvas (no tone mapping, linear output), and the film draws off screen.
  // One draw of everything afterwards also uploads every point cloud to the GPU now, not mid-journey.
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const antes = stage.renderer.getRenderTarget();
  stage.renderer.setRenderTarget(rt);
  await stage.renderer.compileAsync(stage.scene, stage.camera);
  stage.renderer.render(stage.scene, stage.camera);
  stage.renderer.setRenderTarget(antes);
  rt.dispose();
  for (const o of ocultos) o.visible = false;
}
const calentado = precompilar();
// Then every part of every act draws once, unseen: a few beats each frame, each frame ending with the
// real one, so only the real one reaches the screen. The first draw of some things (a body close up,
// a patch of finer points) stalls a frame; better while the opening's point is on than mid-journey.
const porCalentar: number[] = [];
let calentarListo: () => void = () => {};
const calentadoTodo = new Promise<void>((r) => (calentarListo = r));
void calentado.then(() => {
  for (let b = 0; b < TOTAL; b += 0.5) porCalentar.push(b);
});

/** The act on at beat P, and the beat inside it. */
function enTramo(P: number) {
  let t = tramos[0];
  for (const x of tramos) if (P >= x.inicio - FUNDIDO / 2) t = x;
  return { t, p: clamp(P - t.inicio, 0, t.largo) };
}

// ---------------------------------------------------------------- scroll and autoplay

let P = clamp(Number(params.get('p') ?? 0), 0, TOTAL);
let target = P;
let autoplay = false;
const frozen: number | null = params.has('ver') ? Number(params.get('ver')) : null;
scrollTo(0, P * PX_PER_BEAT);
addEventListener('scroll', () => (target = clamp(scrollY / PX_PER_BEAT, 0, TOTAL)));
addEventListener('wheel', () => (autoplay = false), { passive: true });
addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (ev.key.toLowerCase() === 'a') autoplay = !autoplay;
});
const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
addEventListener('pointermove', (ev) => mouseTarget.set((ev.clientX / innerWidth) * 2 - 1, -((ev.clientY / innerHeight) * 2 - 1)));
const calm = matchMedia('(prefers-reduced-motion: reduce)');

/** Beats at the start of an act during which the last one is still there and the camera slides on. */
const RELEVO = 1.8;

/** Shows `k` of a group's light (the points' uFundido, the black hole's alpha, the backgrounds on or
 * off) and tells its points the world's scale `escala` (their sizes follow it). */
function fundir(grupo: THREE.Object3D, k: number, escala = 1) {
  grupo.traverse((o) => {
    const un = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms;
    if (o.renderOrder === -100) o.visible = k > 0.3;
    if (!un) return;
    if (un.uEscalaMundo) un.uEscalaMundo.value = escala;
    if (un.uFundido) un.uFundido.value = k;
    else if (un.uAlpha) un.uAlpha.value *= k;
  });
}

/** The matrix that takes act B's world into act A's, so that B's `entrada` lands on A's `salida`. */
function mapa(a: Ancla, b: Ancla) {
  const k = a.escala / b.escala;
  return new THREE.Matrix4()
    .makeTranslation(a.pos.x, a.pos.y, a.pos.z)
    .multiply(new THREE.Matrix4().makeScale(k, k, k))
    .multiply(new THREE.Matrix4().makeTranslation(-b.pos.x, -b.pos.y, -b.pos.z));
}
const mapas = new Map<Tramo, { m: THREE.Matrix4; escala: number }>();

const smooth = (x: number) => x * x * (3 - 2 * x);
const camA = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 40 };

/** One frame at journey beat `at`, ambient time `now` (ms), step `dt` (s). */
function step(now: number, dt: number, at: number) {
  const { camera } = stage;
  const W = stage.W;
  const H = stage.H;
  const { t, p } = enTramo(at);
  const inst = montar(t);
  const i = tramos.indexOf(t);
  const prev = i > 0 ? tramos[i - 1] : null;
  // The relay is on while this act is young and both acts know where they meet.
  const enRelevo = !!(prev && p < RELEVO && prev.inst?.salida && inst.entrada);
  for (const x of tramos) {
    if (x === t || (enRelevo && x === prev)) continue;
    if (x.grupo.visible || !x.grupo.matrixAutoUpdate) {
      x.grupo.visible = false;
      x.grupo.matrixAutoUpdate = true;
      x.grupo.matrix.identity();
      x.grupo.position.set(0, 0, 0);
      x.grupo.scale.setScalar(1);
    }
  }
  // An act that was the last one in a relay (placed inside the next act's world) and is on again,
  // because the scroll went back across the change: back to its own place.
  if (!t.grupo.matrixAutoUpdate) {
    t.grupo.matrixAutoUpdate = true;
    t.grupo.matrix.identity();
    t.grupo.position.set(0, 0, 0);
    t.grupo.scale.setScalar(1);
  }
  t.grupo.visible = true;
  const time = calm.matches ? 0 : now / 1000;
  const f: Frame = { time, dt, p, W, H, u: H / 860, dpr: stage.dpr, focal: H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), camera };
  let k = 1;
  let escalaPrev = 1;
  if (enRelevo && prev) {
    // The last act, at its last beat, in its own frame: where its camera was.
    const pi = prev.inst!;
    prev.grupo.visible = true;
    prev.grupo.matrixAutoUpdate = false;
    prev.grupo.matrix.identity();
    prev.grupo.updateMatrixWorld(true);
    pi.update({ ...f, p: prev.largo });
    camA.pos.copy(camera.position);
    camA.quat.copy(camera.quaternion);
    camA.fov = camera.fov;
    // Its world, placed in this act's: its `salida` on our `entrada`.
    let mp = mapas.get(t);
    if (!mp) {
      mp = { m: mapa(pi.salida!, inst.entrada!).invert(), escala: inst.entrada!.escala / pi.salida!.escala };
      mapas.set(t, mp);
    }
    prev.grupo.matrix.copy(mp.m);
    prev.grupo.updateMatrixWorld(true);
    camA.pos.applyMatrix4(mp.m);
    escalaPrev = mp.escala;
    k = smooth(clamp(p / RELEVO, 0, 1));
  }
  inst.update(f);
  if (enRelevo && prev) {
    // The camera: from where the last act left it to where this act wants it, turning round our
    // entrada and moving through distance in log (worlds of very different sizes meet here).
    const ancla = inst.entrada!.pos;
    const v0 = camA.pos.clone().sub(ancla);
    const v1 = camera.position.clone().sub(ancla);
    const l0 = Math.max(v0.length(), 1e-9);
    const l1 = Math.max(v1.length(), 1e-9);
    const q = new THREE.Quaternion().setFromUnitVectors(v0.clone().divideScalar(l0), v1.clone().divideScalar(l1));
    const dir = v0.clone().divideScalar(l0).applyQuaternion(new THREE.Quaternion().slerp(q, k));
    camera.position.copy(ancla).addScaledVector(dir, Math.exp(Math.log(l0) + (Math.log(l1) - Math.log(l0)) * k));
    // Orientation: the same turn as the position (so the anchor stays where it was on the screen),
    // plus the roll that is left between the two views, spread over the relay.
    const qB = camera.quaternion.clone();
    const twist = q.clone().multiply(camA.quat).invert().multiply(qB);
    camera.quaternion.copy(new THREE.Quaternion().slerp(q, k).multiply(camA.quat).multiply(new THREE.Quaternion().slerp(twist, k)));
    camera.fov = camA.fov + (camera.fov - camA.fov) * k;
    // The light: the last act's fades as this one's comes up (they add, so the sum holds).
    const c = smooth(clamp((p - 0.05) / (RELEVO * 0.8), 0, 1));
    fundir(prev.grupo, 1 - c, escalaPrev);
    fundir(t.grupo, c);
    const fa = prev.film!;
    const fb = t.film!;
    stage.bloom.strength = fa.strength + (fb.strength - fa.strength) * k;
    stage.bloom.radius = fa.radius + (fb.radius - fa.radius) * k;
    stage.bloom.threshold = fa.threshold + (fb.threshold - fa.threshold) * k;
    stage.renderer.toneMappingExposure = fa.exposure + (fb.exposure - fa.exposure) * k;
  } else {
    fundir(t.grupo, 1);
    if (t.film) {
      stage.bloom.strength = t.film.strength;
      stage.bloom.radius = t.film.radius;
      stage.bloom.threshold = t.film.threshold;
      if (!enRelevo && t.escena.id !== 'agujero') stage.renderer.toneMappingExposure = t.film.exposure;
    }
  }
  if (!fixed && !calm.matches) {
    mouse.x = damp(mouse.x, mouseTarget.x, 3, dt);
    mouse.y = damp(mouse.y, mouseTarget.y, 3, dt);
    camera.rotateY(-mouse.x * 0.025);
    camera.rotateX(mouse.y * 0.018);
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  f.focal = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  for (const s of FONDOS) {
    s.seguir(camera);
    s.u.uTime.value = f.time;
    (s.u.uRes.value as THREE.Vector2).set(W, H);
  }
  stage.render(f.time);

  // ---- The plate.
  if (plate.width !== W || plate.height !== H) {
    plate.width = W;
    plate.height = H;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const u = f.u;
  // The dip between acts, and the title before the first.
  const negro = FUNDIDO > 0 ? Math.max(1 - clamp((at - (t.inicio - FUNDIDO / 2)) / (FUNDIDO / 2), 0, 1), clamp((at - (t.inicio + t.largo)) / (FUNDIDO / 2), 0, 1)) : 0;
  const portada = PORTADA > 0 ? 1 - clamp((at - PORTADA * 0.35) / (PORTADA * 0.6), 0, 1) : 0;
  const tapa = Math.max(negro, t === tramos[0] ? portada : 0);
  if (tapa > 0.001) {
    g.fillStyle = `rgba(0,0,0,${tapa})`;
    g.fillRect(0, 0, W, H);
  }
  if (portada > 0.01) {
    g.save();
    g.globalAlpha = portada;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = FONT.serif(118 * u);
    g.fillStyle = ink(0.96);
    g.fillText('Destino', W / 2, H * 0.44);
    g.font = FONT.italic(30 * u);
    g.fillStyle = ink(0.75);
    g.fillText('¿Adónde podemos llegar?', W / 2, H * 0.44 + 84 * u);
    g.font = FONT.mono(11 * u);
    g.letterSpacing = `${1.8 * u}px`;
    g.fillStyle = VIOLETA;
    g.fillText('HORIZONTES · 03', W / 2, H * 0.44 - 92 * u);
    g.restore();
    return;
  }
  const vis = 1 - negro;
  g.save();
  g.globalAlpha = vis;
  inst.placa?.(g, f);
  // The brand, top left.
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.8)';
  g.shadowBlur = 10 * u;
  g.font = FONT.serif(27 * u);
  g.fillStyle = ink();
  g.fillText('Destino', 40 * u, 54 * u);
  g.restore();
  const c = inst.cuenta(p);
  g.save();
  g.globalAlpha = vis;
  cuenta(g, u, H, c, inst.rotulo(p));
  g.restore();
  if (c && inst.escalera !== false) escalera(g, u, W, H, c.h, (c.a ?? 1) * vis);
}

let last = performance.now();
/** Recording (tools/clip.mjs): the page stops drawing by itself; frames come only from `cuadro`. */
let grabando = false;
let medio: HTMLCanvasElement | undefined;
function frame(now: number) {
  if (grabando) return;
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (autoplay) {
    const next = Math.min(TOTAL, target + dt * 0.45);
    scrollTo(0, next * PX_PER_BEAT);
    target = next;
    if (next >= TOTAL) autoplay = false;
  }
  P = frozen ?? damp(P, target, 4.2, dt);
  if (porCalentar.length) {
    for (let k = 0; k < 3 && porCalentar.length; k++) step(now, dt, porCalentar.shift()!);
    if (!porCalentar.length) calentarListo();
  }
  step(now, dt, P);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- captures (?debug)

async function save(path: string, c: HTMLCanvasElement, q = 0.88) {
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', q));
  await fetch(`/__guardar?f=${encodeURIComponent(path)}`, { method: 'POST', body: blob });
}
function shot(b: number, warm = 40) {
  const t0 = performance.now();
  for (let k = 0; k < warm; k++) step(t0 + k * 16.7, 1 / 60, b);
  const out = document.createElement('canvas');
  out.width = stage.W;
  out.height = stage.H;
  const o = out.getContext('2d')!;
  o.drawImage(canvas, 0, 0);
  o.drawImage(plate, 0, 0);
  return out;
}
const api = {
  grabar() {
    grabando = true;
  },
  /** One frame of the film at beat b, ambient time `now` (ms), as a JPEG data URL (needs ?cap=WxH). */
  cuadro(b: number, now: number, q = 0.95) {
    step(now, 1 / 30, b);
    return canvas.toDataURL('image/jpeg', q);
  },
  /** The same with motion blur: the film drawn at each beat `bs[k]`, time `ts[k]`, and averaged. */
  cuadroMedio(bs: number[], ts: number[], q = 0.95) {
    const out = (medio ??= document.createElement('canvas'));
    if (out.width !== canvas.width || out.height !== canvas.height) {
      out.width = canvas.width;
      out.height = canvas.height;
    }
    const o = out.getContext('2d')!;
    bs.forEach((b, k) => {
      step(ts[k], 1 / 30 / bs.length, b);
      o.globalAlpha = 1 / (k + 1);
      o.drawImage(canvas, 0, 0);
    });
    return out.toDataURL('image/jpeg', q);
  },
  /** Debug: one frame at beat b: the act, the camera, the frame's time (with the read back) and the film's mean brightness (0..765). */
  sonda(b: number, now = 0) {
    const t0 = performance.now();
    step(now, 1 / 60, b);
    const s = document.createElement('canvas');
    s.width = 32;
    s.height = 18;
    const x = s.getContext('2d')!;
    x.drawImage(canvas, 0, 0, 32, 18);
    const d = x.getImageData(0, 0, 32, 18).data;
    let l = 0;
    for (let i = 0; i < d.length; i += 4) l += d[i] + d[i + 1] + d[i + 2];
    const ms = performance.now() - t0;
    const { t, p } = enTramo(b);
    const c = stage.camera;
    return { acto: t.escena.id, p: +p.toFixed(2), pos: c.position.toArray(), q: c.quaternion.toArray(), fov: c.fov, ms, lum: l / (32 * 18) };
  },
  get total() {
    return TOTAL;
  },
  tramos: () => tramos.map((t) => [t.escena.id, t.estilo + 1, +t.inicio.toFixed(2), +t.largo.toFixed(2)]),
  async listo() {
    await Promise.all(tramos.map((t) => t.inst?.listo));
    await calentado;
    await calentadoTodo;
    await document.fonts.ready;
  },
  async hoja(path: string, beats: number[], cols = 5, tw = 384) {
    await api.listo();
    const th = Math.round((tw * stage.H) / stage.W);
    const out = document.createElement('canvas');
    out.width = cols * tw;
    out.height = Math.ceil(beats.length / cols) * th;
    const o = out.getContext('2d')!;
    for (const [k, b] of beats.entries()) {
      o.drawImage(shot(b), (k % cols) * tw, Math.floor(k / cols) * th, tw, th);
      o.font = `500 ${Math.round(12 * (tw / 640))}px "Geist Mono Variable"`;
      o.fillStyle = 'rgba(0,0,0,0.6)';
      o.fillRect((k % cols) * tw + 6, Math.floor(k / cols) * th + 6, 54 * (tw / 384), 18 * (tw / 384));
      o.fillStyle = '#ece7db';
      o.fillText(b.toFixed(1), (k % cols) * tw + 10, Math.floor(k / cols) * th + 19 * (tw / 384));
    }
    await save(path, out);
    return [out.width, out.height];
  },
};
if (params.has('debug')) Object.assign(window, { viaje: api });
