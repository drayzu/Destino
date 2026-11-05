import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../estudios/style.css';
import '../viaje/chasis.css';
import * as THREE from 'three';
import { clamp, damp } from '../estudios/motor/math';
import { FONDOS } from '../estudios/motor/pantalla';
import { createStage } from '../estudios/stage';
import { cuenta, escalera, FONT, ink } from '../estudios/placa';
import { textoAnio } from '../estudios/remake';
import { AJUSTE, Pagina, RES, cambio, ritmoDe, type Ritmo, type Vista } from '../viaje/ritmo';
import { agregar, diccionario, lang, switchLang, tx } from '../src/i18n';
import { tr, usarIdioma } from '../estudios/idioma';
import { lamina } from '../viaje/lamina';
import { dibujarEstelas } from '../estudios/chispa';
import { EXTRA } from '../viaje/textos';
import { crearPelicula, FUNDIDO_MIN } from './pelicula';
import { final } from './actos/final';
import { cosmos } from './actos/cosmos';
import { estrella } from './actos/estrella';
import { galaxia } from './actos/galaxia';
import { vela } from './actos/vela';
import { solTrabajado } from './actos/sol';
import { mente } from './actos/mente';
import { apertura } from './actos/apertura';
import { despierta } from './actos/despierta';
import { tierraNoche } from './actos/tierra';
import { sistema } from './actos/sistema';
import { mercurio } from './actos/mercurio';

/**
 * Destino on the new chassis (CHASIS.md): the page. It scrolls the film, draws the plate and the
 * chrome; the film itself (camera, acts, spark) is pelicula.ts, a pure function of the beat.
 *
 * URL: ?p=beat (start there) &ver=beat (freeze) &cap=1600x900 (render at that size) &debug (leaves
 * `viaje` in the console, with the guards' measures) &marca (the beat counter; M toggles it).
 */

const PX_PER_BEAT = 520;

// ---------------------------------------------------------------- the language
agregar(EXTRA);
usarIdioma(lang === 'en', diccionario());
document.documentElement.lang = lang;
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
  const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
  if (text) text.textContent = tx(text.textContent!.trim());
}

const params = new URLSearchParams(location.search);
const capMatch = /^(\d+)x(\d+)$/.exec(params.get('cap') ?? '');
const fixed = capMatch ? { w: Number(capMatch[1]), h: Number(capMatch[2]) } : null;
if (fixed) document.body.classList.add('is-cap');

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const plate = document.querySelector<HTMLCanvasElement>('#placa')!;
const g = plate.getContext('2d')!;
const stage = createStage(canvas, fixed);
const spacer = document.querySelector<HTMLElement>('#spacer')!;

// ---------------------------------------------------------------- the film
const peli = crearPelicula(stage, [mente, apertura, despierta, tierraNoche, sistema, mercurio, solTrabajado, vela, galaxia, estrella, cosmos, final]);
const { tramos, TOTAL } = peli;
spacer.style.height = `${TOTAL * PX_PER_BEAT + innerHeight}px`;

// Every act's shaders compile once, at the start (otherwise each act stalls the page as it comes on).
async function precompilar() {
  await Promise.all(tramos.map((t) => t.acto.listo));
  const ocultos: THREE.Object3D[] = [];
  stage.scene.traverse((o) => {
    if (!o.visible) {
      ocultos.push(o);
      o.visible = true;
    }
  });
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
// Then every part of the film draws once, unseen (the first draw of some things stalls a frame).
const porCalentar: number[] = [];
let calentarListo: () => void = () => {};
const calentadoTodo = new Promise<void>((r) => (calentarListo = r));
void calentado.then(() => {
  for (let b = 0; b < TOTAL; b += 0.5) porCalentar.push(b);
});

// ---------------------------------------------------------------- scroll and autoplay
let P = clamp(Number(params.get('p') ?? 0), 0, TOTAL);
/** How fast the film follows the scroll (beats/s, the spring's speed) and its rate. */
let V = 0;
const RESORTE = 9;
let target = P;
let autoplay = false;
const frozen: number | null = params.has('ver') ? Number(params.get('ver')) : null;
scrollTo(0, P * PX_PER_BEAT);
let reubicando = 0;
addEventListener('scroll', () => {
  if (reubicando > 0) return;
  target = clamp(pagina ? pagina.pDe(scrollY) : scrollY / PX_PER_BEAT, 0, TOTAL);
});
addEventListener('wheel', () => setAutoplay(false), { passive: true });

// ---------------------------------------------------------------- the chrome
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
langBtn.addEventListener('click', switchLang);
playBtn.addEventListener('click', () => setAutoplay(!autoplay));
soundBtn.addEventListener('click', toggleSound);
plateBtn.addEventListener('click', () => showToggle(plateBtn, (plateOn = !plateOn)));
let marcaOn = params.has('marca');
addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.target instanceof HTMLInputElement) return;
  const k = ev.key.toLowerCase();
  if (k === 'a') setAutoplay(!autoplay);
  if (k === 's') toggleSound();
  if (k === 'i') showToggle(plateBtn, (plateOn = !plateOn));
  if (k === 'l') switchLang();
  if (k === 'm') marcaOn = !marcaOn;
});
// The beat counter is a field: click it, type a beat, Enter goes there.
const marcaEl = document.createElement('input');
marcaEl.type = 'text';
marcaEl.inputMode = 'decimal';
marcaEl.spellcheck = false;
marcaEl.setAttribute('aria-label', 'Compás');
Object.assign(marcaEl.style, { position: 'fixed', zIndex: '20', display: 'none', width: '6ch', padding: '2px 4px', textAlign: 'right', background: 'transparent', border: '0', outline: 'none', color: ink(0.5), textShadow: '0 0 8px rgba(0,0,0,0.9)', cursor: 'text' });
marcaEl.addEventListener('focus', () => marcaEl.select());
marcaEl.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') marcaEl.blur();
  if (ev.key !== 'Enter') return;
  const b = Number(marcaEl.value.replace(',', '.'));
  if (Number.isFinite(b)) irA(b);
  marcaEl.blur();
});
document.body.appendChild(marcaEl);
function irA(b: number) {
  const x = clamp(b, 0, TOTAL);
  setAutoplay(false);
  P = x;
  V = 0;
  target = x;
  scrollTo(0, pagina ? pagina.yDe(x) : x * PX_PER_BEAT);
}
const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
addEventListener('pointermove', (ev) => mouseTarget.set((ev.clientX / innerWidth) * 2 - 1, -((ev.clientY / innerHeight) * 2 - 1)));
const calm = matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------- a frame
let leido = '';
/** One frame at film beat `at`, ambient time `now` (ms), step `dt` (s). */
function step(now: number, dt: number, at: number) {
  const W = stage.W;
  const H = stage.H;
  const time = calm.matches ? 0 : now / 1000;
  const u = Math.min(H / 860, W / 540);
  const { pose, frame } = peli.poner(at, { time, dt, W, H, u, dpr: stage.dpr, chasis: !fixed });
  const f = frame!;
  const acto = tramos[pose.i].acto;
  const p = pose.p;
  const camera = stage.camera;
  const ef = acto.efectos?.(p) ?? {};
  stage.finish.uniforms.uCalor.value = ef.calor ?? 0;
  stage.finish.uniforms.uVel.value = ef.vel ?? 0;
  // (the hand's small parallax: the only thing on top of the film's camera, and only on screen)
  if (!fixed && !calm.matches) {
    mouse.x = damp(mouse.x, mouseTarget.x, 3, dt);
    mouse.y = damp(mouse.y, mouseTarget.y, 3, dt);
    camera.rotateY(-mouse.x * 0.025);
    camera.rotateX(mouse.y * 0.018);
    camera.updateMatrixWorld();
  }
  for (const s of FONDOS) {
    s.seguir(camera);
    s.u.uTime.value = time;
    (s.u.uRes.value as THREE.Vector2).set(W, H);
  }
  stage.render(time);

  // ---- The plate.
  if (plate.width !== W || plate.height !== H) {
    plate.width = W;
    plate.height = H;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  dibujarEstelas(g, camera, W, H);
  g.save();
  acto.placa?.(g, f);
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.8)';
  g.shadowBlur = 10 * u;
  g.font = FONT.serif(27 * u);
  g.fillStyle = ink();
  g.fillText('Destino', 40 * u, 54 * u);
  g.restore();
  const c = acto.cuenta(p);
  const anio = acto.anio?.(p);
  if (c && anio != null) c.anio = textoAnio(anio);
  const rot = acto.rotulo(p);
  cuenta(g, u, H, c, rot);
  if (plateOn && rot) lamina(g, u, W, H, rot.name, 1);
  const dicho = rot ? `${tr(rot.name)}. ${tr(rot.fact)}` : '';
  if (dicho !== leido) {
    leido = dicho;
    leer.textContent = dicho;
  }
  outroEl.classList.toggle('is-in', !fixed && (acto.outro?.(p) ?? 0) > 0.5);
  const verMarca = marcaOn && !fixed;
  marcaEl.style.display = verMarca ? 'block' : 'none';
  if (verMarca) {
    marcaEl.style.font = FONT.mono(11 * u);
    marcaEl.style.right = `${30 * u - 4}px`;
    marcaEl.style.bottom = `${24 * u - 6}px`;
    if (document.activeElement !== marcaEl) marcaEl.value = at.toFixed(1);
  }
  if (c && acto.escalera !== false) escalera(g, u, W, H, c.h, c.a ?? 1);
}

// ---------------------------------------------------------------- the pace (ritmo.ts)
let ritmo: Ritmo | null = null;
let pagina: Pagina | null = null;
const crudo = new Float32Array(Math.ceil(TOTAL / RES) + 1);
let medido = 0;
let vistaAnt: Vista | null = null;
const dirV = new THREE.Vector3();
/** Where the camera looks at film beat `at`, and how far it is from what it frames: the camera alone, no drawing. */
function vistaEn(at: number): Vista {
  const pose = peli.camara(at);
  // (the gaze in the units of the first act of its chain: across a seam through the frame they turn)
  dirV.set(0, 0, -1).applyQuaternion(pose.quat).applyQuaternion(aCadena[pose.i].q);
  // (the distance in a unit the whole film shares: across a seam the units change, the picture not)
  return { dir: { x: dirV.x, y: dirV.y, z: dirV.z }, lz: Math.log(Math.max(pose.dist, 1e-300)) + escalaLog[pose.i], fov: pose.fov };
}
/** Each act's units in the first act's of its shot, as a log (so distances compare across seams). */
const aCadena = tramos.map((_, i) => peli.sims[i][tramos.findIndex((t) => t.cadena === tramos[i].cadena)]);
const escalaLog = aCadena.map((m) => Math.log(m.s));
function momentos() {
  return tramos.flatMap((t) => t.acto.tl.momentos.map((c) => ({ ...c, from: c.from + t.inicio, to: c.to + t.inicio })));
}
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
  reubicando = 3;
  spacer.style.height = `${pagina.alto + innerHeight}px`;
  scrollTo(0, pagina.yDe(target));
}

let last = performance.now();
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
    // A critically damped spring, not a plain glide: a glide's speed jumps at every notch of the
    // wheel, and a small light moving across the frame showed each jump as a tremor. The spring's
    // speed never jumps; it settles as fast as the glide did.
    const x = P - target;
    const e = Math.exp(-RESORTE * dt);
    const k = (V + RESORTE * x) * dt;
    V = (V - RESORTE * k) * e;
    let siguiente = target + (x + k) * e;
    if (ritmo && pagina && !autoplay) {
      const lejos = Math.max(0, Math.abs(target - P) - 1.5);
      const tope = pagina.en(ritmo.tope, P) * (1 + lejos * lejos * 0.6);
      V = clamp(V, -tope, tope);
      siguiente = P + clamp(siguiente - P, -tope * dt, tope * dt);
    }
    P = siguiente;
  }
  if (porCalentar.length) {
    for (let k = 0; k < 3 && porCalentar.length; k++) step(now, dt, porCalentar.shift()!);
    if (!porCalentar.length) calentarListo();
  } else if (!ritmo && !grabando) medir(6);
  step(now, dt, P);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- measures and captures (?debug)
async function save(path: string, c: HTMLCanvasElement, q = 0.88) {
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', q));
  await fetch(`/__guardar?f=${encodeURIComponent(path)}`, { method: 'POST', body: blob });
}
function shot(b: number, warm = 3) {
  for (let k = 0; k < warm; k++) step(0, 1 / 60, b);
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
  dibujar(b: number, now: number) {
    step(now, 1 / 30, b);
  },
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
  /** The camera from beat a to b every `res` beats (no drawing): beat, position, gaze, up, fov and its
   * distance to what it frames, flat (each in the units of the act that holds that beat). */
  trayecto(a: number, b: number, res = 0.02) {
    const out: number[] = [];
    const d = new THREE.Vector3();
    const u = new THREE.Vector3();
    for (let at = a; at <= b + 1e-9; at += res) {
      const pose = peli.camara(at);
      d.set(0, 0, -1).applyQuaternion(pose.quat);
      u.set(0, 1, 0).applyQuaternion(pose.quat);
      out.push(at, pose.pos.x, pose.pos.y, pose.pos.z, d.x, d.y, d.z, u.x, u.y, u.z, pose.fov, pose.dist);
    }
    return out;
  },
  /**
   * The camera as the film has it now, every `h` beats of each act (tools/hornear.mjs bakes it into
   * keys): per act its name, where it starts, how long it is, its chain (acts that map into each
   * other) and, flat, p, position (3), gaze (3), up (3), fov, distance to what it frames, how much it
   * rides the spark.
   */
  muestras(h = 0.02) {
    const f = new THREE.Vector3();
    const u = new THREE.Vector3();
    return tramos.map((t) => {
      const out: number[] = [];
      for (let p = 0; p < t.largo - 1e-9; p += h) {
        const pose = peli.camara(t.inicio + p);
        f.set(0, 0, -1).applyQuaternion(pose.quat);
        u.set(0, 1, 0).applyQuaternion(pose.quat);
        out.push(p, pose.pos.x, pose.pos.y, pose.pos.z, f.x, f.y, f.z, u.x, u.y, u.z, pose.fov, pose.dist, pose.lw);
      }
      // (and its very end, just before the next act takes over)
      const pose = peli.camara(t.inicio + t.largo - 1e-7);
      f.set(0, 0, -1).applyQuaternion(pose.quat);
      u.set(0, 1, 0).applyQuaternion(pose.quat);
      out.push(t.largo, pose.pos.x, pose.pos.y, pose.pos.z, f.x, f.y, f.z, u.x, u.y, u.z, pose.fov, pose.dist, pose.lw);
      return { id: t.acto.id, inicio: t.inicio, largo: t.largo, cadena: t.cadena, costura: t.costura, s: out };
    });
  },
  /** Where the spark is, every `h` beats of each act (its units) and how lit: p, x, y, z, light; flat. */
  chispas(h = 0.02) {
    const c = new THREE.Vector3();
    return tramos.map((t, i) => {
      const out: number[] = [];
      const poner1 = (p: number) => {
        const b = t.inicio + p;
        const hay = peli.chispaEn(b, i, c);
        const luz = hay ? (t.acto.luz ? t.acto.luz(p) : t.acto.tl.get('on', p)) : 0;
        out.push(p, hay ? c.x : 0, hay ? c.y : 0, hay ? c.z : 0, luz);
      };
      for (let p = 0; p < t.largo - 1e-9; p += h) poner1(p);
      poner1(t.largo - 1e-7);
      return out;
    });
  },
  /**
   * The picture over [a, b] every `res` beats, small (48 × 27, luminance): for each beat, how much it
   * changed from the one before (mean, 0..255) and how bright it is. The guard looks for a change
   * much bigger than its neighbours' (something that pops in or out, a flash). Flat: beat, change, light.
   */
  imagen(a: number, b: number, res = 0.05) {
    const w = 48;
    const h = 27;
    const c = (medio ??= document.createElement('canvas'));
    c.width = w;
    c.height = h;
    const o = c.getContext('2d', { willReadFrequently: true })!;
    const out: number[] = [];
    let prev: Float32Array | null = null;
    for (let at = a; at <= b + 1e-9; at += res) {
      step(0, 1 / 60, at);
      // (as the viewer sees it: the film and the plate over it, its light that covers a cut included)
      o.drawImage(canvas, 0, 0, w, h);
      o.drawImage(plate, 0, 0, w, h);
      const d = o.getImageData(0, 0, w, h).data;
      const l = new Float32Array(w * h);
      let luz = 0;
      for (let i = 0; i < w * h; i++) {
        l[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
        luz += l[i];
      }
      let dif = 0;
      if (prev) for (let i = 0; i < w * h; i++) dif += Math.abs(l[i] - prev[i]);
      out.push(+at.toFixed(3), prev ? +(dif / (w * h)).toFixed(3) : 0, +(luz / (w * h)).toFixed(2));
      prev = l;
    }
    return out;
  },
  /** The film with the plate, as the page shows it (JPEG data URL). */
  cuadroPlaca(b: number, now: number, q = 0.9) {
    return shot(b).toDataURL('image/jpeg', q);
  },
  get total() {
    return TOTAL;
  },
  get P() {
    return { P, target };
  },
  ritmo() {
    while (!ritmo) medir(1000);
    let s = 0;
    for (const a of ritmo.auto) s += RES / a;
    return { px: Math.round(pagina!.alto), minutosAuto: +(s / 60).toFixed(1) };
  },
  /** Each act: its name, 1 (the way, as the studies had it), where it starts and how long it is, in beats. */
  tramos: () => tramos.map((t) => [t.acto.id, 1, +t.inicio.toFixed(2), +t.largo.toFixed(2)]),
  etiquetas: () => tramos.map((t) => [t.acto.id, Object.fromEntries([...(t.acto.tl as unknown as { labels: Map<string, number> }).labels].map(([k, v]) => [k, +(v + t.inicio).toFixed(2)]))]),
  /**
   * The guards' measure of the camera (no drawing): every `res` beats, how far it moved relative to
   * its distance from what it frames, how much its gaze turned and its horizon rolled (degrees), all
   * in one act's units across a seam. Flat: beat, move, turn, roll, lw.
   */
  movimiento(a: number, b: number, res = 0.02) {
    const out: number[] = [];
    let prev: ReturnType<typeof peli.camara> | null = null;
    const f0 = new THREE.Vector3();
    const f1 = new THREE.Vector3();
    const u0 = new THREE.Vector3();
    const u1 = new THREE.Vector3();
    for (let at = a; at <= b + 1e-9; at += res) {
      const pose = peli.camara(at);
      if (prev) {
        // (the last pose in this act's units)
        const m = peli.sims[prev.i][pose.i];
        const pp = m.aplicar(prev.pos, new THREE.Vector3());
        const mov = pp.distanceTo(pose.pos) / Math.max(pose.dist, 1e-300);
        const qp = m.girar(prev.quat);
        f0.set(0, 0, -1).applyQuaternion(qp);
        f1.set(0, 0, -1).applyQuaternion(pose.quat);
        u0.set(0, 1, 0).applyQuaternion(qp);
        u1.set(0, 1, 0).applyQuaternion(pose.quat);
        const giro = THREE.MathUtils.radToDeg(f0.angleTo(f1));
        u0.addScaledVector(f1, -u0.dot(f1)).normalize();
        const alabeo = THREE.MathUtils.radToDeg(u0.angleTo(u1));
        out.push(+at.toFixed(3), mov, giro, alabeo, pose.lw);
      }
      prev = pose;
    }
    return out;
  },
  /** Where the spark is on the screen: beat, x, y (−1..1 in frame; 9 behind). Flat. No drawing. */
  enCuadro(a: number, b: number, res = 0.05) {
    const out: number[] = [];
    const cam = new THREE.PerspectiveCamera(40, stage.camera.aspect, 1e-9, 1e9);
    for (let at = a; at <= b + 1e-9; at += res) {
      const pose = peli.camara(at);
      let x = NaN;
      let y = NaN;
      if (pose.chispa && (tramos[pose.i].acto.luz?.(pose.p) ?? tramos[pose.i].acto.tl.get('on', pose.p)) > 0.05) {
        cam.position.copy(pose.pos);
        cam.quaternion.copy(pose.quat);
        cam.fov = pose.fov;
        cam.near = pose.dist * 1e-6;
        cam.far = pose.dist * 1e6;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
        const v = pose.chispa.clone().project(cam);
        x = v.z > 1 ? 9 : v.x;
        y = v.z > 1 ? 9 : v.y;
      }
      out.push(+at.toFixed(2), +x.toFixed(3), +y.toFixed(3), +pose.lw.toFixed(2));
    }
    return out;
  },
  /**
   * The spark on the screen, precise, every `res` beats: beat, x, y (pixels of a 1600 × 900 frame; NaN
   * where unlit or behind), its light.
   */
  pantalla(a: number, b: number, res = 0.01) {
    const out: number[] = [];
    const cam = new THREE.PerspectiveCamera(40, 16 / 9, 1e-9, 1e9);
    const c = new THREE.Vector3();
    for (let at = a; at <= b + 1e-9; at += res) {
      const pose = peli.camara(at);
      const acto = tramos[pose.i].acto;
      const luz = pose.chispa ? (acto.luz?.(pose.p) ?? acto.tl.get('on', pose.p)) : 0;
      let x = NaN;
      let y = NaN;
      if (luz > 0.05 && peli.chispaEn(at, pose.i, c)) {
        cam.position.copy(pose.pos);
        cam.quaternion.copy(pose.quat);
        cam.fov = pose.fov;
        cam.near = pose.dist * 1e-6;
        cam.far = pose.dist * 1e6;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
        const v = c.project(cam);
        if (v.z < 1) {
          x = (v.x * 0.5 + 0.5) * 1600;
          y = (0.5 - v.y * 0.5) * 900;
        }
      }
      out.push(at, x, y, luz);
    }
    return out;
  },
  /** The fastest each act's own lights come and go (their `presencias`), against FUNDIDO_MIN. */
  presencias(res = 0.01) {
    const out: [string, string, number, number][] = [];
    for (const t of tramos) {
      for (const n of t.acto.presencias ?? []) {
        let peor = 0;
        let donde = 0;
        for (let p = 0; p < t.largo; p += res) {
          const d = Math.abs(t.acto.tl.get(n, p + res) - t.acto.tl.get(n, p)) / res;
          if (d > peor) {
            peor = d;
            donde = p;
          }
        }
        // (a full change in FUNDIDO_MIN beats is the fastest allowed: a slope of 1 / FUNDIDO_MIN, eased ×1.5)
        if (peor > 1.5 / FUNDIDO_MIN) out.push([t.acto.id, n, +(donde + t.inicio).toFixed(2), +peor.toFixed(2)]);
      }
    }
    return out;
  },
  /** Each seam: what the spark's ride does across it (the camera's own move there, no drawing). */
  costuras() {
    return tramos.slice(1).map((t, k) => ({ de: tramos[k].acto.id, a: t.acto.id, en: t.inicio, tipo: t.costura, tapa: +(tramos[k].acto.tapa?.(tramos[k].largo) ?? 0).toFixed(2) }));
  },
  async listo() {
    await Promise.all(tramos.map((t) => t.acto.listo));
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
if (params.has('debug')) Object.assign(window, { viaje: api, peli, escena: stage.scene, stage });
