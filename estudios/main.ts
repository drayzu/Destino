import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './style.css';
import * as THREE from 'three';
import { clamp, damp } from './motor/math';
import { FONDOS } from './motor/pantalla';
import { createStage, liberar } from './stage';
import { cuenta, escalera, marca } from './placa';
import type { Escena, Frame, Instancia } from './tipos';
import { textoAnio } from './remake';
import { mente } from './mente';
import { apertura } from './apertura';
import { despierta } from './despierta';
import { tierraNoche } from './tierra';
import { sistema } from './sistema';
import { mercurio } from './mercurio';
import { solTrabajado } from './sol';
import { vela } from './vela';
import { galaxia } from './galaxia';
import { estrella } from './estrella';
import { cosmos } from './cosmos';
import { final } from './final';

/**
 * Destino's remake, phase 0: three studies of the new look (BIBLIA.md, ESCALETA.md, 29 Oct 2026),
 * each in two or three ways so Diego can choose. The bench is Infinito's. The page scroll is time;
 * nothing else moves the camera.
 *
 * URL: ?m=apertura|tierra|mercurio|estrella &s=1..3 (the way) &p=beat (start there) &ver=beat (freeze)
 * &cap=1600x900 (render at that size, for captures) &clean. `?debug` leaves `estudio` in the
 * console: `estudio.hoja('docs/estudios/x.jpg', [beats], cols, width)` saves a contact sheet.
 */

// In the order of the journey (ESCALETA.md: scenes 6–7, 11–12, 18–19).
const ESCENAS: Escena[] = [mente, apertura, despierta, tierraNoche, sistema, mercurio, solTrabajado, vela, galaxia, estrella, cosmos, final];
const PX_PER_BEAT = 520;

const params = new URLSearchParams(location.search);
const capMatch = /^(\d+)x(\d+)$/.exec(params.get('cap') ?? '');
const fixed = capMatch ? { w: Number(capMatch[1]), h: Number(capMatch[2]) } : null;
if (fixed) document.body.classList.add('is-cap');
if (params.has('clean')) document.body.classList.add('is-clean');

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const plate = document.querySelector<HTMLCanvasElement>('#placa')!;
const g = plate.getContext('2d')!;
const stage = createStage(canvas, fixed);
const spacer = document.querySelector<HTMLElement>('#spacer')!;
const momentos = document.querySelector<HTMLElement>('#momentos')!;
const estilos = document.querySelector<HTMLElement>('#estilos')!;
const blurb = document.querySelector<HTMLElement>('#blurb')!;

let escena = ESCENAS.find((e) => e.id === params.get('m')) ?? ESCENAS[0];
let estilo = clamp(Number(params.get('s') ?? 1) - 1, 0, escena.estilos.length - 1);
let inst: Instancia | null = null;

function tabs() {
  momentos.replaceChildren(
    ...ESCENAS.map((e) => {
      const b = document.createElement('button');
      b.className = `tab${e === escena ? ' is-on' : ''}`;
      b.textContent = e.nombre;
      b.addEventListener('click', () => montar(e, 0, 0));
      return b;
    }),
  );
  estilos.replaceChildren(
    ...(escena.estilos.length > 1
      ? escena.estilos.map((s, i) => {
          const b = document.createElement('button');
          b.className = `tab${i === estilo ? ' is-on' : ''}`;
          b.innerHTML = `<span class="tab-k">${s.key}</span>${s.nombre}`;
          b.addEventListener('click', () => montar(escena, i, p));
          return b;
        })
      : []),
  );
  blurb.textContent = escena.estilos[estilo].nota;
}

let p = 0;
let target = 0;
let autoplay = false;
let frozen: number | null = params.has('ver') ? Number(params.get('ver')) : null;

function montar(e: Escena, s: number, at: number) {
  if (inst) inst.dispose();
  for (const c of [...stage.root.children]) liberar(c);
  FONDOS.length = 0;
  stage.reset();
  stage.camera.near = 1e-6;
  stage.camera.far = 1e6;
  escena = e;
  estilo = clamp(s, 0, e.estilos.length - 1);
  inst = e.montar(stage, estilo, params.has('viaje'));
  spacer.style.height = `${inst.tl.length * PX_PER_BEAT + innerHeight}px`;
  p = target = clamp(at, 0, inst.tl.length);
  scrollTo(0, p * PX_PER_BEAT);
  const url = new URL(location.href);
  url.searchParams.set('m', e.id);
  url.searchParams.set('s', String(estilo + 1));
  history.replaceState(null, '', url);
  tabs();
}

montar(escena, estilo, params.has('p') ? Number(params.get('p')) : 0);

addEventListener('scroll', () => {
  if (!inst) return;
  target = clamp(scrollY / PX_PER_BEAT, 0, inst.tl.length);
});
addEventListener('wheel', () => (autoplay = false), { passive: true });
addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (k === 'a') autoplay = !autoplay;
  const n = Number(k);
  if (n >= 1 && n <= escena.estilos.length) montar(escena, n - 1, p);
});

const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
addEventListener('pointermove', (ev) => mouseTarget.set((ev.clientX / innerWidth) * 2 - 1, -((ev.clientY / innerHeight) * 2 - 1)));
const calm = matchMedia('(prefers-reduced-motion: reduce)');

/** One frame at progress `at` (beats), ambient time `now` (ms), step `dt` (s). */
function step(now: number, dt: number, at: number) {
  if (!inst) return;
  const { camera } = stage;
  const W = stage.W;
  const H = stage.H;
  const f: Frame = { time: calm.matches ? 0 : now / 1000, dt, p: at, W, H, u: H / 860, dpr: stage.dpr, focal: 1, camera };
  // The focal length before the scene moves the camera (the scene may change the fov; it is read again below).
  f.focal = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  inst.update(f);
  const ef = inst.efectos?.(at) ?? {};
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

  if (plate.width !== W || plate.height !== H) {
    plate.width = W;
    plate.height = H;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const u = f.u;
  marca(g, u, `estudio · ${escena.nombre}`, escena.estilos.length > 1 ? `${escena.estilos[estilo].key} · ${escena.estilos[estilo].nombre}` : 'fase 0');
  inst.placa?.(g, f);
  const c = inst.cuenta(at);
  const anio = inst.anio?.(at);
  if (c && anio != null) c.anio = textoAnio(anio);
  cuenta(g, u, H, c, inst.rotulo(at));
  if (c && inst.escalera !== false) escalera(g, u, W, H, c.h, c.a ?? 1);
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (inst) {
    if (autoplay) {
      const next = Math.min(inst.tl.length, target + dt * 0.45);
      scrollTo(0, next * PX_PER_BEAT);
      target = next;
      if (next >= inst.tl.length) autoplay = false;
    }
    p = frozen ?? damp(p, target, 4.2, dt);
  }
  step(now, dt, p);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- captures (?debug)

async function save(path: string, c: HTMLCanvasElement, q = 0.9) {
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', q));
  await fetch(`/__guardar?f=${encodeURIComponent(path)}`, { method: 'POST', body: blob });
}

/** Renders one frame at beat `b` into a 2D canvas (film + plate), after `warm` simulated frames. */
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

function rotular(o: CanvasRenderingContext2D, x: number, y: number, text: string, scale: number) {
  o.save();
  o.font = `500 ${Math.round(13 * scale)}px "Geist Mono Variable"`;
  o.letterSpacing = `${1.2 * scale}px`;
  const w = o.measureText(text).width;
  o.fillStyle = 'rgba(0,0,0,0.62)';
  o.fillRect(x + 8 * scale, y + 8 * scale, w + 16 * scale, 24 * scale);
  o.fillStyle = '#ece7db';
  o.textBaseline = 'middle';
  o.fillText(text, x + 16 * scale, y + 20.5 * scale);
  o.restore();
}

async function preparar(m: string, s: number, b: number) {
  const e = ESCENAS.find((x) => x.id === m) ?? escena;
  if (e !== escena || s - 1 !== estilo || !inst) montar(e, s - 1, b);
  await inst?.listo;
  await document.fonts.ready;
}

const api = {
  stage,
  get inst() {
    return inst;
  },
  get length() {
    return inst?.tl.length ?? 0;
  },
  seek(b: number | null) {
    frozen = b;
  },
  montar(m: string, s = 1, b = 0) {
    montar(ESCENAS.find((e) => e.id === m) ?? escena, s - 1, b);
  },
  /** A contact sheet of the current moment and way at these beats. */
  async hoja(path: string, beats: number[], cols = 4, tw = 640) {
    await inst?.listo;
    await document.fonts.ready;
    const was = frozen;
    const th = Math.round((tw * stage.H) / stage.W);
    const out = document.createElement('canvas');
    out.width = cols * tw;
    out.height = Math.ceil(beats.length / cols) * th;
    const o = out.getContext('2d')!;
    for (const [k, b] of beats.entries()) {
      frozen = b;
      const x = (k % cols) * tw;
      const y = Math.floor(k / cols) * th;
      o.drawImage(shot(b), x, y, tw, th);
      rotular(o, x, y, b.toFixed(2), tw / 640);
    }
    frozen = was;
    await save(path, out, 0.88);
    return [out.width, out.height];
  },
  /** Frames from any moment and way, in a grid: items are [moment, way (1..3), beat, label]. */
  async mosaico(path: string, items: [string, number, number, string][], cols: number, tw = 640) {
    const was = frozen;
    let th = 0;
    let out: HTMLCanvasElement | null = null;
    let o: CanvasRenderingContext2D | null = null;
    for (const [k, [m, s, b, label]] of items.entries()) {
      await preparar(m, s, b);
      if (!out) {
        th = Math.round((tw * stage.H) / stage.W);
        out = document.createElement('canvas');
        out.width = cols * tw;
        out.height = Math.ceil(items.length / cols) * th;
        o = out.getContext('2d')!;
      }
      frozen = b;
      const x = (k % cols) * tw;
      const y = Math.floor(k / cols) * th;
      o!.drawImage(shot(b), x, y, tw, th);
      if (label) rotular(o!, x, y, label, tw / 640);
    }
    frozen = was;
    await save(path, out!, 0.9);
    return [out!.width, out!.height];
  },
  /** Debug: where the camera is and looks at beat b (after a few frames). */
  camara(b: number) {
    const was = frozen;
    frozen = b;
    const t0 = performance.now();
    for (let k = 0; k < 4; k++) step(t0 + k * 16.7, 1 / 60, b);
    frozen = was;
    const c = stage.camera;
    const d = c.getWorldDirection(new THREE.Vector3());
    const r = (v: THREE.Vector3) => v.toArray().map((x) => +x.toFixed(3));
    return { pos: r(c.position), dir: r(d), up: r(c.up), fov: c.fov };
  },
  /** Debug: mean brightness (0..765) of the film at beat b. */
  lum(b: number) {
    const was = frozen;
    frozen = b;
    shot(b, 6);
    frozen = was;
    const s = document.createElement('canvas');
    s.width = 64;
    s.height = 36;
    const x = s.getContext('2d')!;
    x.drawImage(canvas, 0, 0, 64, 36);
    const d = x.getImageData(0, 0, 64, 36).data;
    let t = 0;
    for (let i = 0; i < d.length; i += 4) t += d[i] + d[i + 1] + d[i + 2];
    return Math.round((t / (64 * 36)) * 10) / 10;
  },
};
if (params.has('debug')) Object.assign(window, { estudio: api });
