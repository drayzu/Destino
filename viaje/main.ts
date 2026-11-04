import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../estudios/style.css';
import './chasis.css';
import * as THREE from 'three';
import { clamp, damp } from '../estudios/motor/math';
import { FONDOS } from '../estudios/motor/pantalla';
import { createStage, type Stage } from '../estudios/stage';
import { cuenta, escalera, FONT, ink, VIOLETA } from '../estudios/placa';
import type { Ancla, Escena, Frame, Instancia } from '../estudios/tipos';
import { textoAnio } from '../estudios/remake';
import { mente } from '../estudios/mente';
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
import { AJUSTE, Pagina, RES, cambio, ritmoDe, type Ritmo, type Vista } from './ritmo';
import { agregar, diccionario, lang, switchLang, tx } from '../src/i18n';
import { tr, usarIdioma } from '../estudios/idioma';
import { lamina } from './lamina';
import { chispasEn, dibujarEstelas } from '../estudios/chispa';
import { EXTRA } from './textos';

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
  [mente, 0],
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

// ---------------------------------------------------------------- the language
agregar(EXTRA);
usarIdioma(lang === 'en', diccionario());
document.documentElement.lang = lang;
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
  const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
  if (text) text.textContent = tx(text.textContent!.trim());
}
document.querySelector('meta[name="description"]')?.setAttribute('content', tx(document.querySelector('meta[name="description"]')!.getAttribute('content')!));

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
/** Frames during which scroll events are the page being re-laid, not the hand. */
let reubicando = 0;
addEventListener('scroll', () => {
  if (reubicando > 0) return;
  target = clamp(pagina ? pagina.pDe(scrollY) : scrollY / PX_PER_BEAT, 0, TOTAL);
});
addEventListener('wheel', () => setAutoplay(false), { passive: true });

// ---------------------------------------------------------------- the chrome (Destino's icons)
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const playBtn = $<HTMLButtonElement>('#play');
const soundBtn = $<HTMLButtonElement>('#sound');
const plateBtn = $<HTMLButtonElement>('#plate');
const langBtn = $<HTMLButtonElement>('#lang');
const outroEl = $('#outro');
const leer = $('#leer');
const showToggle = (b: HTMLButtonElement, on: boolean) => {
  b.classList.toggle('is-on', on);
  b.setAttribute('aria-pressed', String(on));
};
function setAutoplay(on: boolean) {
  autoplay = on;
  showToggle(playBtn, on);
  playBtn.querySelector('.chip-t')!.textContent = tx(on ? 'Pausa' : 'Reproducir');
}
let plateOn = params.has('lamina');
showToggle(plateBtn, plateOn);
// The sound is not ready: its icon stays, faint, and says it comes soon.
let told = 0;
soundBtn.classList.add('is-soon');
soundBtn.setAttribute('aria-disabled', 'true');
soundBtn.querySelector('.chip-t')!.textContent = tx('Sonido · pronto');
const toggleSound = () => {
  soundBtn.classList.add('is-told');
  clearTimeout(told);
  told = window.setTimeout(() => soundBtn.classList.remove('is-told'), 1800);
};
langBtn.querySelector('.chip-t')!.textContent = lang === 'en' ? 'Español' : 'English';
langBtn.querySelector('.chip-k')!.textContent = lang === 'en' ? 'ES' : 'EN';
langBtn.setAttribute('aria-label', lang === 'en' ? 'Ver en español' : 'View in English');
langBtn.addEventListener('click', switchLang);
playBtn.addEventListener('click', () => setAutoplay(!autoplay));
soundBtn.addEventListener('click', toggleSound);
plateBtn.addEventListener('click', () => showToggle(plateBtn, (plateOn = !plateOn)));
addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.target instanceof HTMLInputElement) return;
  const k = ev.key.toLowerCase();
  if (k === 'a') setAutoplay(!autoplay);
  if (k === 's') toggleSound();
  if (k === 'i') showToggle(plateBtn, (plateOn = !plateOn));
  if (k === 'l') switchLang();
});
let leido = '';
let marcaOn = params.has('marca');
addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement) return;
  if (!ev.metaKey && !ev.ctrlKey && !ev.altKey && ev.key.toLowerCase() === 'm') marcaOn = !marcaOn;
});
// The beat counter is a field: click it, type a beat, Enter goes there (Escape leaves it as it was).
const marcaEl = document.createElement('input');
marcaEl.type = 'text';
marcaEl.inputMode = 'decimal';
marcaEl.spellcheck = false;
marcaEl.setAttribute('aria-label', 'Compás');
Object.assign(marcaEl.style, {
  position: 'fixed', zIndex: '20', display: 'none', width: '6ch', padding: '2px 4px', textAlign: 'right',
  background: 'transparent', border: '0', borderBottom: '1px solid transparent', outline: 'none',
  color: ink(0.5), textShadow: '0 0 8px rgba(0,0,0,0.9)', cursor: 'text',
});
marcaEl.addEventListener('focus', () => {
  marcaEl.style.color = ink(0.95);
  marcaEl.style.borderBottomColor = ink(0.4);
  marcaEl.select();
});
marcaEl.addEventListener('blur', () => {
  marcaEl.style.color = ink(0.5);
  marcaEl.style.borderBottomColor = 'transparent';
});
marcaEl.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') marcaEl.blur();
  if (ev.key !== 'Enter') return;
  const b = Number(marcaEl.value.replace(',', '.'));
  if (Number.isFinite(b)) irA(b);
  marcaEl.blur();
});
document.body.appendChild(marcaEl);
/** Straight to beat b: the film is there at once, the page scrolled to it. */
function irA(b: number) {
  const x = clamp(b, 0, TOTAL);
  setAutoplay(false);
  P = x;
  target = x;
  scrollTo(0, pagina ? pagina.yDe(x) : x * PX_PER_BEAT);
}
const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
addEventListener('pointermove', (ev) => mouseTarget.set((ev.clientX / innerWidth) * 2 - 1, -((ev.clientY / innerHeight) * 2 - 1)));
const calm = matchMedia('(prefers-reduced-motion: reduce)');

/** Beats at the start of an act during which the last one is still there and the camera slides on. */
const RELEVO = 1.8;

/** Shows `k` of a group's light (the points' uFundido, the black hole's alpha, the backgrounds on or
 * off) and tells its points the world's scale `escala` (their sizes follow it). */
function fundir(grupo: THREE.Object3D, k: number, escala = 1, maxPx = 0) {
  grupo.traverse((o) => {
    const un = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms;
    if (o.renderOrder === -100) o.visible = k > 0.3;
    if (!un) return;
    if (maxPx > 0 && un.uMaxPx) un.uMaxPx.value = Math.min(un.uMaxPx.value, maxPx * stage.dpr);
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
/** Sparks moved during a relay (to start where the last act's was), and their own place. */
const corridas = new Map<THREE.Object3D, THREE.Vector3>();
/** Each act's spark at its first beat (its world), for the relay into it. */
const inicioChispa = new Map<Tramo, THREE.Vector3 | null>();

const smooth = (x: number) => x * x * (3 - 2 * x);
const camA = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 40 };
/** This act's own camera through a relay, before it is blended with the last act's. */
const camB = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };

// The framing: whatever an act's camera does, the spark we follow stays in the picture. Near the
// middle it is left alone; towards the edge the camera turns just enough to keep it inside a soft
// border (a knee, so nothing is felt as a stop). The turn each beat wants is measured once over the
// whole film (the camera alone, in the background as the page starts) and smoothed over the beats
// round it, so the camera never copies the spark's own jolts (a hop between neurons, a pass close
// by); it is the beat's own, so scrolling back shows the same. It lets go where the spark is far off
// the axis (passing the camera, behind it) or sweeps across the view, as a turn could not follow it
// without a lurch.
const sinEncuadre = new URLSearchParams(location.search).has('sinEncuadre');
const SEGURO = 0.55;
const BORDE = 0.82;
/** The most the framing turns, in radians (reached softly). */
const TOPE_ENC = 0.2;
const RES_ENC = 0.05;
/** Its smoothing: a gaussian of this many beats. */
const SIGMA_ENC = 0.22;
const camV = new THREE.Vector3();
function rodilla(n: number) {
  const a = Math.abs(n);
  if (a <= SEGURO) return n;
  return Math.sign(n) * (SEGURO + (BORDE - SEGURO) * Math.tanh((a - SEGURO) / (BORDE - SEGURO)));
}
/** The turn (yaw, pitch; radians) that would bring the spark back inside the border from the camera
 * as it is now, and the spark's direction from the camera (its own frame; zero if there is none). */
function giroEncuadre(peso: number, out: Float32Array, o: number) {
  out.fill(0, o, o + 5);
  if (peso <= 0) return;
  const camera = stage.camera;
  camera.updateMatrixWorld();
  let on = 0;
  for (const c of chispasEn(stage.scene)) {
    if (c.on < 0.05 || c.on <= on) continue;
    let vis = true;
    for (let x: THREE.Object3D | null = c.nube.points; x; x = x.parent) if (!x.visible) vis = false;
    if (!vis) continue;
    c.nube.points.updateWorldMatrix(true, false);
    camV.set(c.estela[0], c.estela[1], c.estela[2]).applyMatrix4(c.nube.points.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    on = c.on;
  }
  if (!on) return;
  const v = camV.normalize();
  out[o + 2] = v.x;
  out[o + 3] = v.y;
  out[o + 4] = v.z;
  const ty = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tx = ty * camera.aspect;
  // (off the axis: full hold within 40°, none past 65°)
  const fuera = Math.acos(clamp(-v.z, -1, 1));
  const w = peso * smooth(clamp((on - 0.05) / 0.4, 0, 1)) * (1 - smooth(clamp((fuera - 0.7) / 0.44, 0, 1)));
  if (w <= 0 || v.z >= 0) return;
  const ax = Math.atan2(v.x, -v.z);
  const ay = Math.atan2(v.y, -v.z);
  out[o] = (ax - Math.atan(rodilla(Math.tan(ax) / tx) * tx)) * w;
  out[o + 1] = (ay - Math.atan(rodilla(Math.tan(ay) / ty) * ty)) * w;
}
let encCrudo: Float32Array | null = null;
let encTabla: Float32Array | null = null;
let encMedido = 0;
/** When the table came in (ms): it comes in over half a second, not at once. */
let encDesde = 0;
let midiendoEnc = false;
let encEn = 0;
/** Measures the framing's turns for a while (ms), and smooths them once all are in. */
function medirEncuadre(presupuesto: number) {
  if (encTabla || sinEncuadre) return;
  const n = Math.ceil(TOTAL / RES_ENC) + 1;
  encCrudo ??= new Float32Array(n * 5);
  const t0 = performance.now();
  midiendoEnc = true;
  while (encMedido < n && performance.now() - t0 < presupuesto) {
    encEn = encMedido * 5;
    step(0, 1 / 60, Math.min(TOTAL, encMedido * RES_ENC), true);
    encMedido++;
  }
  midiendoEnc = false;
  if (encMedido < n) return;
  // (none while the spark sweeps fast across the view, a hop or a pass close by: its speed on the
  // screen, from its direction a sample either side; full under 1 radian a beat, none over 2)
  const c = encCrudo;
  const giro = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1) * 5;
    const b = Math.min(n - 1, i + 1) * 5;
    const da = Math.hypot(c[a + 2], c[a + 3], c[a + 4]);
    const db = Math.hypot(c[b + 2], c[b + 3], c[b + 4]);
    let w = 0;
    if (da > 0.5 && db > 0.5) {
      const vel = Math.acos(clamp(c[a + 2] * c[b + 2] + c[a + 3] * c[b + 3] + c[a + 4] * c[b + 4], -1, 1)) / ((b - a) / 5 * RES_ENC || 1);
      w = 1 - smooth(clamp(vel - 1, 0, 1));
    }
    giro[i * 2] = c[i * 5] * w;
    giro[i * 2 + 1] = c[i * 5 + 1] * w;
  }
  const tabla = new Float32Array(n * 2);
  const r = Math.ceil((SIGMA_ENC * 3) / RES_ENC);
  const g = Array.from({ length: 2 * r + 1 }, (_, k) => Math.exp(-0.5 * (((k - r) * RES_ENC) / SIGMA_ENC) ** 2));
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, sw = 0;
    for (let k = -r; k <= r; k++) {
      const j = i + k;
      if (j < 0 || j >= n) continue;
      sx += giro[j * 2] * g[k + r];
      sy += giro[j * 2 + 1] * g[k + r];
      sw += g[k + r];
    }
    tabla[i * 2] = sx / sw;
    tabla[i * 2 + 1] = sy / sw;
  }
  encTabla = tabla;
  encDesde = performance.now();
}
/** The framing at beat `at`: the camera turned by the smoothed table (nothing until it is measured). */
function encuadrar(at: number) {
  if (!encTabla) return;
  const x = clamp(at / RES_ENC, 0, encTabla.length / 2 - 1);
  const i = Math.min(Math.floor(x), encTabla.length / 2 - 2);
  const f = x - i;
  const gx = encTabla[i * 2] * (1 - f) + encTabla[i * 2 + 2] * f;
  const gy = encTabla[i * 2 + 1] * (1 - f) + encTabla[i * 2 + 3] * f;
  const entra = smooth(clamp((performance.now() - encDesde) / 500, 0, 1));
  const camera = stage.camera;
  camera.rotateY(-TOPE_ENC * Math.tanh(gx / TOPE_ENC) * entra);
  camera.rotateX(TOPE_ENC * Math.tanh(gy / TOPE_ENC) * entra);
  camera.updateMatrixWorld();
}

/** One frame at journey beat `at`, ambient time `now` (ms), step `dt` (s). `soloCamara`: place the
 * acts and the camera, and stop there (the pace measures the camera this way). */
function step(now: number, dt: number, at: number, soloCamara = false) {
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
  const f: Frame = { time, dt, p, W, H, u: Math.min(H / 860, W / 540), dpr: stage.dpr, focal: H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), camera, chasis: !fixed };
  let k = 1;
  let escalaPrev = 1;
  if (enRelevo && prev) {
    // The last act, at its last beat, in its own frame: where its camera was.
    const pi = prev.inst!;
    prev.grupo.visible = true;
    prev.grupo.matrixAutoUpdate = false;
    prev.grupo.matrix.identity();
    prev.grupo.updateMatrixWorld(true);
    pi.update({ ...f, p: prev.largo, fundido: 1 - smooth(clamp((p - 0.05) / (RELEVO * 0.8), 0, 1)), saliente: !!inst.continuo });
    // (one spark through a relay: the one going out leaves it to the one coming in, which takes it up
    // where it was, the acts meeting at the spark)
    for (const c of chispasEn(prev.grupo)) {
      c.on = 0;
      c.nube.u.uOn.value = 0;
    }
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
  // (taking a flight on in mid air, this act is all there from the first beat: what it shares with
  // the last act, that act no longer draws)
  if (enRelevo) f.fundido = inst.continuo ? 1 : smooth(clamp((p - 0.05) / (RELEVO * 0.8), 0, 1));
  // (where this act's spark is at its first beat, once: the relay's spark keeps its gap to it)
  if (enRelevo && !inicioChispa.has(t)) {
    for (const [pts, o] of corridas) {
      pts.position.copy(o);
      pts.updateMatrixWorld();
    }
    inst.update({ ...f, p: 0 });
    const c = chispasEn(t.grupo)[0];
    if (c) c.nube.points.updateWorldMatrix(true, false);
    inicioChispa.set(t, c ? new THREE.Vector3(c.estela[0], c.estela[1], c.estela[2]).applyMatrix4(c.nube.points.matrixWorld) : null);
  }
  inst.update(f);
  if (enRelevo && prev) {
    // The camera: from where the last act left it to where this act wants it, turning round our
    // entrada and moving through distance in log (worlds of very different sizes meet here). (Not
    // when the last act hands over in mid flight: this act's camera is already there.)
    camB.pos.copy(camera.position);
    camB.quat.copy(camera.quaternion);
    if (!inst.continuo) {
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
    }
    // The light: the last act's fades as this one's comes up (they add, so the sum holds).
    const c = smooth(clamp((p - 0.05) / (RELEVO * 0.8), 0, 1));
    fundir(prev.grupo, 1 - c, escalaPrev, prev.inst!.relevoMaxPx ?? 0);
    fundir(t.grupo, inst.continuo ? 1 : c);
    for (const ch of chispasEn(t.grupo)) ch.nube.u.uFundido.value = 1;
    // (and it takes the spark up where the last act left it, sliding onto its own way over the relay)
    const sale = chispasEn(prev.grupo)[0];
    const entra = chispasEn(t.grupo)[0];
    if (sale && entra) {
      const pts = entra.nube.points;
      if (!corridas.has(pts)) corridas.set(pts, pts.position.clone());
      pts.position.copy(corridas.get(pts)!);
      pts.updateMatrixWorld();
      // (the gap between the two sparks at the relay's first beat, closed over it while the spark
      // keeps its own speed: nothing to close where the acts meet exactly at the spark. Measured at
      // that beat, so it is the same however the relay was reached, scrolling on or back)
      const p0 = new THREE.Vector3(sale.estela[0], sale.estela[1], sale.estela[2]).applyMatrix4(sale.nube.points.matrixWorld);
      const p1 = new THREE.Vector3(entra.estela[0], entra.estela[1], entra.estela[2]).applyMatrix4(pts.matrixWorld);
      const ini = inicioChispa.get(t);
      const lleva = 1 - smooth(clamp(p / RELEVO, 0, 1));
      if (pts.parent && ini && Number.isFinite(p0.x)) {
        const enPadre = pts.parent.worldToLocal(p1.clone().addScaledVector(p0.clone().sub(ini), lleva)).sub(pts.parent.worldToLocal(p1.clone()));
        pts.position.add(enPadre);
        pts.updateMatrixWorld();
      }
      // (and through the relay the spark is seen where it would be between the two cameras, the last
      // act's and this act's, mixed as the relay goes: the cameras' turns no longer throw it about
      // between, while its own way is left as it is)
      if (!sinEncuadre) {
        camera.updateMatrixWorld();
        const pc = new THREE.Vector3(entra.estela[0], entra.estela[1], entra.estela[2]).applyMatrix4(pts.matrixWorld);
        const dA = pc.clone().sub(camA.pos).applyQuaternion(camA.quat.clone().invert()).normalize();
        const dB = pc.clone().sub(camB.pos).applyQuaternion(camB.quat.clone().invert()).normalize();
        const dc = pc.applyMatrix4(camera.matrixWorldInverse).normalize();
        // (only while it is well ahead of the three, letting go gradually: behind one, it has no
        // straight way across)
        const delante = (d: THREE.Vector3) => smooth(clamp((-d.z - 0.25) / 0.35, 0, 1));
        const w = delante(dA) * delante(dB) * delante(dc);
        if (w > 0 && Number.isFinite(dc.x + dA.x + dB.x)) {
          const dt = dA.lerp(dB, smooth(clamp(p / RELEVO, 0, 1))).normalize();
          camera.quaternion.multiply(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(dt, dc), w));
          camera.updateMatrixWorld();
        }
      }
    }
    const fa = prev.film!;
    const fb = t.film!;
    stage.bloom.strength = fa.strength + (fb.strength - fa.strength) * k;
    stage.bloom.radius = fa.radius + (fb.radius - fa.radius) * k;
    stage.bloom.threshold = fa.threshold + (fb.threshold - fa.threshold) * k;
    stage.renderer.toneMappingExposure = fa.exposure + (fb.exposure - fa.exposure) * k;
  } else {
    fundir(t.grupo, 1);
    // (a spark moved for a relay goes back to its own place)
    for (const [pts, o] of corridas) {
      pts.position.copy(o);
      pts.updateMatrixWorld();
    }
    corridas.clear();
    if (t.film) {
      stage.bloom.strength = t.film.strength;
      stage.bloom.radius = t.film.radius;
      stage.bloom.threshold = t.film.threshold;
      if (!enRelevo && t.escena.id !== 'agujero') stage.renderer.toneMappingExposure = t.film.exposure;
    }
  }
  if (midiendoEnc) giroEncuadre(inst.encuadre?.(p) ?? 1, encCrudo!, encEn);
  else if (!sinEncuadre) encuadrar(at);
  if (soloCamara) return;
  const ef = inst.efectos?.(p) ?? {};
  stage.finish.uniforms.uCalor.value = ef.calor ?? 0;
  stage.finish.uniforms.uVel.value = ef.vel ?? 0;
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
  // The sparks' wakes, over the film.
  dibujarEstelas(g, camera, W, H);
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
  const anio = inst.anio?.(p);
  if (c && anio != null) c.anio = textoAnio(anio);
  const rot = inst.rotulo(p);
  g.save();
  g.globalAlpha = vis;
  cuenta(g, u, H, c, rot);
  g.restore();
  if (plateOn && rot) lamina(g, u, W, H, rot.name, vis);
  // For screen readers, the moment's words once each.
  const dicho = rot ? `${tr(rot.name)}. ${tr(rot.fact)}` : '';
  if (dicho !== leido) {
    leido = dicho;
    leer.textContent = dicho;
  }
  outroEl.classList.toggle('is-in', !fixed && (inst.outro?.(p) ?? 0) > 0.5);
  // For reviewing: the beat, small, bottom right, so a moment can be named by its number («193.4»).
  // Off unless ?marca; M toggles it.
  // (a field over the film, so it can be clicked and changed: see irA)
  const verMarca = marcaOn && !fixed;
  marcaEl.style.display = verMarca ? 'block' : 'none';
  if (verMarca) {
    marcaEl.style.font = FONT.mono(11 * u);
    marcaEl.style.letterSpacing = `${1 * u}px`;
    marcaEl.style.right = `${30 * u - 4}px`;
    marcaEl.style.bottom = `${24 * u - 6}px`;
    if (document.activeElement !== marcaEl) marcaEl.value = at.toFixed(1);
  }
  if (c && inst.escalera !== false) escalera(g, u, W, H, c.h, (c.a ?? 1) * vis);
}

// ---------------------------------------------------------------- the pace (ritmo.ts)

let ritmo: Ritmo | null = null;
let pagina: Pagina | null = null;
const crudo = new Float32Array(Math.ceil(TOTAL / RES) + 1);
let medido = 0;
let vistaAnt: Vista | null = null;
const dirV = new THREE.Vector3();
/** Where the camera looks at journey beat `at`, and how far it is from what it frames (its rig's centre). */
function vistaEn(at: number): Vista {
  step(0, 1 / 60, at, true);
  const c = stage.camera;
  dirV.set(0, 0, -1).applyQuaternion(c.quaternion);
  const { t, p } = enTramo(at);
  const tl = t.inst!.tl;
  const d = Math.hypot(c.position.x - tl.get('cx', p), c.position.y - tl.get('cy', p), c.position.z - tl.get('cz', p));
  return { dir: { x: dirV.x, y: dirV.y, z: dirV.z }, lz: Math.log(Math.max(d, 1e-12)), fov: c.fov };
}
/** Every caption of every act, in journey beats. */
function momentos() {
  return tramos.flatMap((t) => (t.inst?.tl.momentos ?? []).map((c) => ({ ...c, from: c.from + t.inicio, to: c.to + t.inicio })));
}
/** Measures the camera for `presupuesto` ms (a little each frame, after the warm-up); then lays out the page. */
function medir(presupuesto: number) {
  const t0 = performance.now();
  const n = crudo.length;
  while (medido < n && performance.now() - t0 < presupuesto) {
    const v = vistaEn(Math.min(TOTAL, medido * RES));
    if (vistaAnt) crudo[medido - 1] = cambio(vistaAnt, v) / RES;
    vistaAnt = v;
    medido++;
  }
  if (medido < n || ritmo) return;
  crudo[n - 1] = crudo[n - 2];
  ritmo = ritmoDe(crudo, momentos(), AJUSTE);
  pagina = new Pagina(ritmo);
  // The page gets its new length; the film stays where it is.
  reubicando = 3;
  spacer.style.height = `${pagina.alto + innerHeight}px`;
  scrollTo(0, pagina.yDe(target));
}

let last = performance.now();
/** Recording (tools/clip.mjs): the page stops drawing by itself; frames come only from `cuadro`. */
let grabando = false;
let medio: HTMLCanvasElement | undefined;
function frame(now: number) {
  if (grabando) return;
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (reubicando > 0) reubicando--;
  if (autoplay) {
    const v = ritmo && pagina ? pagina.en(ritmo.auto, target) : 0.45;
    const next = Math.min(TOTAL, target + dt * v);
    scrollTo(0, pagina ? pagina.yDe(next) : next * PX_PER_BEAT);
    target = next;
    if (next >= TOTAL) setAutoplay(false);
  }
  if (frozen !== null) P = frozen;
  else {
    let siguiente = damp(P, target, 4.2, dt);
    // By hand, the film follows a flick no faster than it can be seen; but when the hand has gone far
    // ahead (the scrollbar dragged, a long fling), it gives way more and more, so it never lags long.
    if (ritmo && pagina && !autoplay) {
      const lejos = Math.max(0, Math.abs(target - P) - 1.5);
      const tope = pagina.en(ritmo.tope, P) * (1 + lejos * lejos * 0.6) * dt;
      siguiente = P + clamp(siguiente - P, -tope, tope);
    }
    P = siguiente;
  }
  if (porCalentar.length) {
    for (let k = 0; k < 3 && porCalentar.length; k++) step(now, dt, porCalentar.shift()!);
    if (!porCalentar.length) calentarListo();
  } else if (!ritmo && !grabando) medir(6);
  else if (!encTabla && !grabando) medirEncuadre(5);
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
  /** Debug: where the film is (beats) and where the hand wants it. */
  get P() {
    return { P, target, alto: spacer.style.height };
  },
  /** Debug: measures the whole pace now; the scroll it takes, the autoplay's minutes, and where the camera changes most. */
  ritmo() {
    while (!ritmo) medir(1000);
    const r = ritmo;
    let s = 0;
    for (const a of r.auto) s += RES / a;
    const picos: [number, number][] = [];
    for (let i = 1; i < crudo.length - 1; i++) if (crudo[i] > 1.2 && crudo[i] >= crudo[i - 1] && crudo[i] >= crudo[i + 1]) picos.push([+(i * RES).toFixed(2), +crudo[i].toFixed(2)]);
    picos.sort((a, b) => b[1] - a[1]);
    return { px: Math.round(pagina!.alto), pantallas: +(pagina!.alto / 900).toFixed(1), minutosAuto: +(s / 60).toFixed(1), picos: picos.slice(0, 40).map(([b, v]) => [b, v, enTramo(b).t.escena.id, +enTramo(b).p.toFixed(1)]) };
  },
  tramos: () => tramos.map((t) => [t.escena.id, t.estilo + 1, +t.inicio.toFixed(2), +t.largo.toFixed(2)]),
  /** Debug: every act's labels, in journey beats. */
  etiquetas: () => tramos.map((t) => [t.escena.id, Object.fromEntries([...(t.inst!.tl as unknown as { labels: Map<string, number> }).labels].map(([k, v]) => [k, +(v + t.inicio).toFixed(2)]))]),
  /** Debug: the camera from beat a to b every `res` beats: position, gaze, up, fov and distance to its rig's centre, flat. */
  trayecto(a: number, b: number, res = 0.02) {
    const out: number[] = [];
    const c = stage.camera;
    for (let at = a; at <= b + 1e-9; at += res) {
      step(0, 1 / 60, at, true);
      dirV.set(0, 0, -1).applyQuaternion(c.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(c.quaternion);
      const { t, p } = enTramo(at);
      const tl = t.inst!.tl;
      const d = Math.hypot(c.position.x - tl.get('cx', p), c.position.y - tl.get('cy', p), c.position.z - tl.get('cz', p));
      out.push(at, c.position.x, c.position.y, c.position.z, dirV.x, dirV.y, dirV.z, up.x, up.y, up.z, c.fov, d);
    }
    return out;
  },
  /** Debug: where the spark is on the screen from beat a to b: beat, x, y (−1..1 is in frame, z > 1 behind), how lit; flat. */
  enCuadro(a: number, b: number, res = 0.05) {
    const out: number[] = [];
    const v = new THREE.Vector3();
    for (let at = a; at <= b + 1e-9; at += res) {
      step(0, 1 / 60, at);
      let x = NaN, y = NaN, on = 0;
      for (const c of chispasEn(stage.scene)) {
        let vis = true;
        for (let o: THREE.Object3D | null = c.nube.points; o; o = o.parent) if (!o.visible) vis = false;
        if (!vis || c.on <= on) continue;
        v.set(c.estela[0], c.estela[1], c.estela[2]).applyMatrix4(c.nube.points.matrixWorld).project(stage.camera);
        const atras = v.z > 1 ? 1 : 0;
        x = atras ? 9 : v.x;
        y = atras ? 9 : v.y;
        on = c.on;
      }
      out.push(+at.toFixed(2), +x.toFixed(2), +y.toFixed(2), +on.toFixed(2));
    }
    return out;
  },
  async listo() {
    await Promise.all(tramos.map((t) => t.inst?.listo));
    await calentado;
    await calentadoTodo;
    await document.fonts.ready;
    while (!encTabla && !sinEncuadre) medirEncuadre(1000);
    encDesde = -1e9;
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
if (params.has('debug')) Object.assign(window, { viaje: api, escena: stage.scene, stage });
