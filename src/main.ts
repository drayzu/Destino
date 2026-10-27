import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './style.css';
import * as THREE from 'three';
import { damp, smoothstep } from './engine/math';
import { Timeline } from './engine/timeline';
import { createPost } from './engine/post';
import { createScroll } from './engine/scroll';
import { FONDOS } from './engine/pantalla';
import { ambiente } from './engine/ambiente';
import { escalera, hud, hudLibre, idioma, regla } from './engine/placa';
import { aplicar, mezcla, proyectarMundo, type Vista } from './engine/vista';
import { contactos } from './engine/contactos';
import { crearSonido } from './engine/sonido';
import { crearMundo } from './mundo/mundo';
import { crearActos } from './actos';
import type { Cuadro } from './actos/tipos';
import { lang, switchLang, tx } from './i18n';

/**
 * Destino. One journey with the scroll, from «¿hay alguien más?» to the last possible work of a
 * civilization; the rule is energy (the power in watts and its Kardashev type). The acts share one
 * world and follow each other without cuts; the camera rides the civilization's own things.
 *
 * Keys as in the series: A autoplay, S sound, I plate, L language. URL: `?p=beat` starts there,
 * `?ver=beat` freezes the journey there, `?lamina` opens with the plate on, `?debug` leaves `destino`
 * in the console (contact sheets: `destino.hoja('docs/…/x.jpg', [beats], cols, width)`).
 */

const params = new URLSearchParams(location.search);
const post = createPost(document.querySelector<HTMLCanvasElement>('#scene')!);
const { renderer, scene, camera } = post;
// Points of light on black: a high threshold keeps the glow to what is really bright (the Sun, a
// city's core), so the lights stay lights and the heat does not burn out.
post.bloom.strength = 0.55;
post.bloom.radius = 0.4;
post.bloom.threshold = 0.6;
renderer.toneMappingExposure = 1.0;

// ---------------------------------------------------------------- the world and the acts

const mundo = crearMundo(scene);
// Each moment's colour: a faint nebula behind everything, and the chapter's label.
const amb = ambiente();
scene.add(amb.mesh);
const actos = crearActos();
const tl = new Timeline({});
// The acts are written at their own pace; the journey breathes slower, so each moment can be read
// and looked at (about ten minutes with autoplay, as Espacio and Tiempo).
tl.escala = 1.38;
const tramos = actos.map((a) => {
  const desde = tl.length;
  a.coreografia(tl);
  return { a, desde, hasta: tl.length };
});
// A last breath on the final act, for the closing line.
tl.wait(1.2);
const listo = Promise.all([mundo.listo, ...actos.map((a) => a.montar(mundo))]);

const scroll = createScroll(document.querySelector<HTMLElement>('#spacer')!, tl.length);
const sound = crearSonido();

// ---------------------------------------------------------------- the page's words

document.documentElement.lang = lang;
idioma(tx, lang === 'en');
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
  const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
  if (text) text.textContent = tx(text.textContent!.trim());
}
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) el.setAttribute('aria-label', tx(el.getAttribute('aria-label')!));
document.querySelector('meta[name="description"]')?.setAttribute('content', tx(document.querySelector('meta[name="description"]')!.getAttribute('content')!));
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const langBtn = $<HTMLButtonElement>('#lang');
langBtn.querySelector('.chip-t')!.textContent = lang === 'en' ? 'Español' : 'English';
langBtn.querySelector('.chip-k')!.textContent = lang === 'en' ? 'ES' : 'EN';
langBtn.setAttribute('aria-label', lang === 'en' ? 'Ver en español' : 'View in English');
langBtn.addEventListener('click', switchLang);

// ---------------------------------------------------------------- the chrome

const intro = $('#intro');
const outro = $('#outro');
const leer = $('#leer');
const provisional = $('#provisional');
const playBtn = $<HTMLButtonElement>('#play');
const soundBtn = $<HTMLButtonElement>('#sound');
const plateBtn = $<HTMLButtonElement>('#plate');
let plateOn = params.has('lamina');
const showToggle = (b: HTMLButtonElement, on: boolean) => {
  b.classList.toggle('is-on', on);
  b.setAttribute('aria-pressed', String(on));
};
showToggle(plateBtn, plateOn);
playBtn.addEventListener('click', () => scroll.togglePlay());
soundBtn.addEventListener('click', () => showToggle(soundBtn, sound.toggle()));
plateBtn.addEventListener('click', () => showToggle(plateBtn, (plateOn = !plateOn)));
addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (k === 'a') scroll.togglePlay();
  if (k === 's') showToggle(soundBtn, sound.toggle());
  if (k === 'i') showToggle(plateBtn, (plateOn = !plateOn));
  if (k === 'l') switchLang();
});

const plate = $<HTMLCanvasElement>('#placa');
const g = plate.getContext('2d')!;
addEventListener('resize', () => post.resize());

const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
addEventListener('pointermove', (ev) => mouseTarget.set((ev.clientX / innerWidth) * 2 - 1, -((ev.clientY / innerHeight) * 2 - 1)));
const calm = matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------- the frame

const tramoEn = (p: number) => {
  let i = 0;
  tramos.forEach((t, k) => {
    if (p >= t.desde) i = k;
  });
  return i;
};

let last = performance.now();
let prevP = 0;
let pace = 0;
let push = 0;
let lastCap = '';

function step(now: number) {
  // (never backwards: a clock that runs behind would turn every damped value into NaN)
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
  last = now;
  const time = calm.matches ? 0 : now / 1000;
  const p = scroll.update(dt);
  // The hand on the wheel is felt: the faster the journey goes, the more the camera leans into it.
  const jumped = Math.abs(p - prevP) > 3;
  pace = jumped ? 0 : damp(pace, (p - prevP) / Math.max(dt, 1e-3), 7, dt);
  prevP = p;
  push = calm.matches ? 0 : Math.tanh(Math.abs(pace) / 2.6);

  // The act we are in sets the world's state and says where the camera is; the first beats of an act
  // glide from where the last one left it.
  const i = tramoEn(p);
  const { a: acto, desde } = tramos[i];
  mundo.reset();
  acto.estado?.(mundo, p);
  let v: Vista = acto.vista(p, time);
  if (i > 0 && p < desde + 0.8) {
    const prev = tramos[i - 1];
    v = mezcla(prev.a.vista(prev.hasta, time), v, smoothstep(desde, desde + 0.8, p));
  }
  v = { ...v, fov: v.fov * (1 + 0.16 * push * Math.sign(pace || 1)) };
  const k = aplicar(mundo.root, camera, v);
  // A little of the pointer.
  if (!calm.matches) {
    mouse.x = damp(mouse.x, mouseTarget.x, 3, dt);
    mouse.y = damp(mouse.y, mouseTarget.y, 3, dt);
    camera.rotateY(-mouse.x * 0.025);
    camera.rotateX(mouse.y * 0.018);
    camera.updateMatrixWorld();
  }
  const W = renderer.domElement.width;
  const H = renderer.domElement.height;
  const focal = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  mundo.update(camera, v.pos, k, time, focal, post.dpr);
  const f: Cuadro = { time, dt, p, W, H, u: Math.min(H / 860, W / 540), dpr: post.dpr, focal, camera, vista: v, k, lamina: plateOn, proj: (w) => proyectarMundo(w, v, k, camera, W, H, { x: 0, y: 0 }) };
  for (const t of tramos) t.a.update?.(f, mundo);
  for (const s of FONDOS) {
    s.seguir(camera);
    s.u.uTime.value = time;
    (s.u.uRes.value as THREE.Vector2).set(W, H);
  }
  post.render(time, 0, push);

  // ---- the plate
  if (plate.width !== W || plate.height !== H) {
    plate.width = W;
    plate.height = H;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const u = f.u;
  for (const t of tramos) t.a.placa?.(g, f);
  const introOut = Math.min(1, Math.max(0, (p - 0.05) / 0.55));
  const c = tl.captionAt(p);
  // The moment's caption under its chapter; its source only with the plate. Each caption fades in
  // and out at its edges, so one gives way to the next instead of jumping.
  if (jumped) amb.saltar(c?.name);
  amb.update(c?.name, dt, 1);
  const tono = `rgb(${amb.color.toArray().map((x) => Math.round(255 * Math.min(1, 0.35 + 0.75 * x))).join(',')})`;
  const cap = c ? { name: tx(c.name), fact: c.fact ? tx(c.fact) : '', fuente: plateOn ? c.fuente : undefined, capitulo: `${acto.numero} · ${tx(acto.nombre)}`, viaje: c.viaje, tono } : null;
  const capFade = c ? Math.min(1, (p - c.from) / 0.45, (c.to - p) / 0.45) : 0;
  const l = acto.lectura(p);
  if (l) {
    hud(g, u, W, H, l, cap, introOut * capFade);
    escalera(g, u, W, H, l.lp, acto.muro?.(p) ?? null);
  } else {
    const lb = acto.libre?.(p);
    if (lb) {
      hudLibre(g, u, H, lb.lp, lb.linea, cap, introOut * capFade, introOut, lb.tipo);
      g.globalAlpha = introOut;
      escalera(g, u, W, H, lb.lp, null, 1);
      g.globalAlpha = 1;
    }
  }
  // How wide the view is, where the world is drawn to scale (fading in with the journey).
  if (typeof acto.regla === 'function' ? acto.regla(p) : acto.regla !== false) {
    const dAU = v.pos.distanceTo(v.target);
    const ancho = 2 * dAU * 1.495978707e11 * Math.tan(THREE.MathUtils.degToRad(v.fov / 2)) * (W / H);
    regla(g, u, W, H, ancho, introOut);
  }
  if (cap && cap.name !== lastCap && p > 0.3) {
    if (!cap.viaje) sound.campana();
    leer.textContent = `${cap.name}. ${cap.fact}`;
  }
  lastCap = cap?.name ?? '';

  intro.style.opacity = String(1 - introOut);
  intro.style.transform = `translateY(${-introOut * 40}px)`;
  provisional.classList.toggle('is-in', !!acto.provisional && p > desde + 0.2);
  outro.classList.toggle('is-in', p > tl.length - 0.9);
  playBtn.classList.toggle('is-on', scroll.playing);
  sound.update(l?.lp ?? acto.libre?.(p)?.lp ?? 13, pace, cap?.name === tx('El silencio') ? 1 : 0, i, mundo.estado.beta);
}

/** Adaptive quality, as in Potencias and Tiempo: fewer pixels when frames run slow, more when there is room. */
let quality = 1;
let avg = 1 / 60;
let slow = 0;
let fast = 0;
let lastRaw = performance.now();
let fijo = false;
function adapt(now: number) {
  const raw = (now - lastRaw) / 1000;
  lastRaw = now;
  if (fijo || now < 4000 || raw > 0.1 || document.visibilityState !== 'visible') return;
  avg += (raw - avg) * 0.05;
  if (avg > 1 / 40) {
    slow += raw;
    fast = 0;
  } else if (avg < 1 / 57) {
    fast += raw;
    slow = 0;
  } else slow = fast = 0;
  if (slow > 2 && quality > 0.6) {
    quality = Math.max(0.6, quality * 0.85);
    post.setQuality(quality);
    slow = 0;
    avg = 1 / 50;
  } else if (fast > 8 && quality < 1) {
    quality = Math.min(1, quality * 1.12);
    post.setQuality(quality);
    fast = 0;
  }
}

function frame(now: number) {
  if (!fijo) {
    adapt(now);
    step(now);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// `?debug`: the journey in the console, and contact sheets saved into the project.
if (params.has('debug')) {
  const sheets = contactos({
    freeze: (b) => scroll.freeze(b),
    held: () => scroll.held,
    step: (now) => {
      fijo = true;
      step(now);
    },
    canvases: [renderer.domElement, plate],
    labelOf: (b) => {
      const c = tl.captionAt(b);
      return c ? c.name : tramos[tramoEn(b)].a.nombre;
    },
    listo,
  });
  const liberar = () => (fijo = false);
  Object.assign(window, {
    destino: {
      tl,
      actos,
      mundo,
      camera,
      post,
      step,
      at: (l: string) => tl.at(l),
      seek: (b: number | null) => scroll.freeze(b),
      hoja: async (...a: Parameters<typeof sheets.hoja>) => {
        try {
          return await sheets.hoja(...a);
        } finally {
          liberar();
        }
      },
      foto: async (...a: Parameters<typeof sheets.foto>) => {
        try {
          return await sheets.foto(...a);
        } finally {
          liberar();
        }
      },
    },
  });
}
