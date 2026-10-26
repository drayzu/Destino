import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './style.css';
import * as THREE from 'three';
import { clamp, damp, lerp, smoothstep } from './math';
import { createStage } from './stage';
import { FONDOS } from './pantalla';
import { cielo } from './cielo';
import { FONT, TEAL, escalera, hud, ink, marca, nota, proyectar } from './placa';
import { cieloUniforms, sistema, type Frame, type Sitio, type Vista } from './sistema';

/**
 * Prototype · the Solar System at work. The scroll is time; the camera rides the civilization's
 * routes. E (or the button) stops the journey to explore: drag to look around, the wheel to get
 * closer or farther, a click on a work to fly there and read what it is.
 *
 * URL: ?p=beat (start there) &ver=beat (freeze) &cap=1600x900 (fixed size, for captures) &clean.
 * `?debug` leaves `civ` in the console: `civ.hoja('docs/conceptos/x.jpg', [beats], cols, width)`.
 */

const PX_PER_BEAT = 520;
const AI = 'https://drayzu.github.io/AstroIngenieria/#obra-';

const params = new URLSearchParams(location.search);
const capMatch = /^(\d+)x(\d+)$/.exec(params.get('cap') ?? '');
const fixed = capMatch ? { w: Number(capMatch[1]), h: Number(capMatch[2]) } : null;
if (fixed) document.body.classList.add('is-cap');
if (params.has('clean')) document.body.classList.add('is-clean');

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const plate = document.querySelector<HTMLCanvasElement>('#placa')!;
const g = plate.getContext('2d')!;
const stage = createStage(canvas, fixed);
stage.bloom.strength = 0.6;
stage.bloom.radius = 0.35;
stage.bloom.threshold = 0.65;
stage.renderer.toneMappingExposure = 1.0;
const spacer = document.querySelector<HTMLElement>('#spacer')!;
const ficha = document.querySelector<HTMLElement>('#ficha')!;
const botonExplorar = document.querySelector<HTMLButtonElement>('#explorar')!;

const sky = cielo(1);
stage.scene.add(sky.mesh);
const S = sistema(stage.root);
cieloUniforms(sky.u as never);
spacer.style.height = `${S.tl.length * PX_PER_BEAT + innerHeight}px`;

let p = clamp(Number(params.get('p') ?? 0), 0, S.tl.length);
let target = p;
let autoplay = false;
let frozen: number | null = params.has('ver') ? Number(params.get('ver')) : null;
scrollTo(0, p * PX_PER_BEAT);

addEventListener('scroll', () => {
  if (explorando) return;
  target = clamp(scrollY / PX_PER_BEAT, 0, S.tl.length);
});
addEventListener('wheel', () => (autoplay = false), { passive: true });

// ---------------------------------------------------------------- explore

let explorando = false;
const ex = { target: new THREE.Vector3(), dist: 1, yaw: 0, pitch: 0, fov: 50 };
let vuelo: { from: THREE.Vector3; to: THREE.Vector3; d0: number; d1: number; t: number } | null = null;
let regreso = 0;
let ultimaVista: Vista | null = null;
let sitioActivo: Sitio | null = null;

function explorar(on: boolean) {
  if (on === explorando) return;
  explorando = on;
  document.body.classList.toggle('is-explore', on);
  botonExplorar.textContent = on ? 'Volver al viaje (E)' : 'Explorar (E)';
  if (on && ultimaVista) {
    autoplay = false;
    ex.target.copy(ultimaVista.target);
    const d = ultimaVista.pos.clone().sub(ultimaVista.target);
    ex.dist = d.length();
    d.normalize();
    ex.yaw = Math.atan2(d.x, d.z);
    ex.pitch = Math.asin(clamp(d.y, -1, 1));
    ex.fov = ultimaVista.fov;
    document.body.style.overflow = 'hidden';
  } else {
    regreso = 1;
    vuelo = null;
    mostrarFicha(null);
    document.body.style.overflow = '';
  }
}
botonExplorar.addEventListener('click', () => explorar(!explorando));

let drag: { x: number; y: number; moved: number } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!explorando) return;
  drag = { x: e.clientX, y: e.clientY, moved: 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = e.clientX;
  drag.y = e.clientY;
  ex.yaw -= dx * 0.005;
  ex.pitch = clamp(ex.pitch + dy * 0.005, -1.45, 1.45);
});
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const click = drag.moved < 5;
  drag = null;
  if (click) elegir(e.clientX, e.clientY);
});
addEventListener(
  'wheel',
  (e) => {
    if (!explorando) return;
    e.preventDefault();
    ex.dist *= Math.exp(e.deltaY * 0.0012);
  },
  { passive: false },
);

const marcas: { s: Sitio; x: number; y: number }[] = [];
function elegir(cx: number, cy: number) {
  const k = stage.W / canvas.clientWidth;
  let best: Sitio | null = null;
  let bd = 26 * k;
  for (const m of marcas) {
    const d = Math.hypot(m.x - cx * k, m.y - cy * k);
    if (d < bd) {
      bd = d;
      best = m.s;
    }
  }
  if (!best) return;
  const to = best.pos(new THREE.Vector3());
  vuelo = { from: ex.target.clone(), to, d0: ex.dist, d1: best.dist, t: 0 };
  mostrarFicha(best);
}

const CERTEZA = { O: 'observado', T: 'la física lo permite', E: 'especulación' };
function mostrarFicha(s: Sitio | null) {
  sitioActivo = s;
  if (!s) {
    ficha.classList.remove('is-on');
    return;
  }
  ficha.innerHTML = `
    <p class="ficha-c">${CERTEZA[s.certeza]}</p>
    <h2>${s.nombre}</h2>
    <p>${s.frase}</p>
    ${s.obra ? `<a href="${AI}${s.obra}" target="_blank" rel="noopener">Leer en AstroIngeniería →</a>` : ''}`;
  ficha.classList.add('is-on');
}

addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (k === 'a') autoplay = !autoplay;
  if (k === 'e') explorar(!explorando);
  if (k === 'escape') explorar(false);
});

const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
addEventListener('pointermove', (ev) => mouseTarget.set((ev.clientX / innerWidth) * 2 - 1, -((ev.clientY / innerHeight) * 2 - 1)));
const calm = matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------- one frame

const exVista = (): Vista => {
  const d = new THREE.Vector3(Math.cos(ex.pitch) * Math.sin(ex.yaw), Math.sin(ex.pitch), Math.cos(ex.pitch) * Math.cos(ex.yaw));
  return { pos: ex.target.clone().addScaledVector(d, ex.dist), target: ex.target.clone(), up: new THREE.Vector3(0, 1, 0), fov: ex.fov };
};

function step(now: number, dt: number, at: number) {
  const { camera } = stage;
  const W = stage.W;
  const H = stage.H;
  const route = S.ruta(at);
  let v = route;
  if (explorando) {
    if (vuelo) {
      vuelo.t = Math.min(1, vuelo.t + dt / 1.8);
      const k = smoothstep(0, 1, vuelo.t);
      ex.target.copy(vuelo.from).lerp(vuelo.to, k);
      ex.dist = Math.exp(lerp(Math.log(vuelo.d0), Math.log(vuelo.d1), k));
      if (vuelo.t >= 1) vuelo = null;
    }
    v = exVista();
  } else if (regreso > 0 && ultimaVista) {
    regreso = Math.max(0, regreso - dt / 1.2);
    const k = smoothstep(0, 1, regreso);
    v = { pos: route.pos.clone().lerp(ultimaVista.pos, k), target: route.target.clone().lerp(ultimaVista.target, k), up: route.up.clone().lerp(ultimaVista.up, k).normalize(), fov: lerp(route.fov, ultimaVista.fov, k) };
  }
  if (!explorando && regreso <= 0) ultimaVista = route;
  else if (explorando) ultimaVista = v;

  camera.position.copy(v.pos);
  camera.up.copy(v.up);
  camera.lookAt(v.target);
  camera.fov = v.fov;
  if (!fixed && !calm.matches && !explorando) {
    mouse.x = damp(mouse.x, mouseTarget.x, 3, dt);
    mouse.y = damp(mouse.y, mouseTarget.y, 3, dt);
    camera.rotateY(-mouse.x * 0.03);
    camera.rotateX(mouse.y * 0.02);
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const focal = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const f: Frame = { time: calm.matches ? 0 : now / 1000, dt, p: at, W, H, u: H / 860, dpr: stage.dpr, focal, camera };
  S.update(f);
  for (const s of FONDOS) {
    s.seguir(camera);
    s.u.uTime.value = f.time;
    (s.u.uRes.value as THREE.Vector2).set(W, H);
  }
  stage.render(f.time);

  // The plate.
  if (plate.width !== W || plate.height !== H) {
    plate.width = W;
    plate.height = H;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const u = f.u;
  marca(g, u, 'prototipo', explorando ? 'explorando · arrastra para mirar · toca una obra' : 'el sistema solar trabaja · tipo I → II');
  const l = S.lectura(at);
  const cap = explorando ? null : S.rotulo(at);
  hud(g, u, W, H, l, cap, 1);
  escalera(g, u, W, H, l.lp);
  if (!explorando) {
    for (const n of S.notas(at)) {
      const P = proyectar(n.pos, camera, W, H);
      if (P.z > 1 || P.x < 20 * u || P.x > W - 140 * u || P.y < 60 * u || P.y > H - 60 * u) continue;
      nota(g, u, P.x, P.y, n.text, n.dx, n.dy, n.a);
    }
    S.taller(g, f);
  }
  marcas.length = 0;
  if (explorando) {
    const tmp = new THREE.Vector3();
    for (const s of S.sitios) {
      const P = proyectar(s.pos(tmp), camera, W, H);
      if (P.z > 1 || P.x < 0 || P.x > W || P.y < 0 || P.y > H) continue;
      marcas.push({ s, x: P.x, y: P.y });
      const on = s === sitioActivo;
      g.save();
      g.strokeStyle = on ? TEAL : ink(0.7);
      g.lineWidth = Math.max(1, 1.2 * u);
      g.beginPath();
      g.arc(P.x, P.y, (on ? 11 : 8) * u, 0, Math.PI * 2);
      g.stroke();
      g.font = FONT.mono(10 * u);
      g.letterSpacing = `${1.1 * u}px`;
      g.fillStyle = on ? TEAL : ink(0.8);
      g.shadowColor = 'rgba(0,0,0,0.9)';
      g.shadowBlur = 8 * u;
      g.fillText(s.nombre.toUpperCase(), P.x + 14 * u, P.y + 4 * u);
      g.restore();
    }
    // In captures the HTML card is not in the image: draw it on the plate.
    if (fixed && sitioActivo) fichaEnPlaca(g, u, sitioActivo);
  }
}

function fichaEnPlaca(g: CanvasRenderingContext2D, u: number, s: Sitio) {
  const x = 40 * u;
  const y = 110 * u;
  const w = 380 * u;
  g.save();
  g.font = FONT.sans(14 * u);
  const words = s.frase.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > w - 40 * u && line) {
      lines.push(line);
      line = word;
    } else line = t;
  }
  if (line) lines.push(line);
  const h = (110 + lines.length * 21) * u;
  g.fillStyle = 'rgba(6,8,10,0.78)';
  g.strokeStyle = 'rgba(111,227,193,0.35)';
  g.lineWidth = Math.max(1, u);
  g.beginPath();
  g.roundRect(x, y, w, h, 10 * u);
  g.fill();
  g.stroke();
  g.font = FONT.mono(10 * u);
  g.letterSpacing = `${1.4 * u}px`;
  g.fillStyle = TEAL;
  g.fillText(CERTEZA[s.certeza].toUpperCase(), x + 20 * u, y + 28 * u);
  g.letterSpacing = '0px';
  g.font = FONT.italic(28 * u);
  g.fillStyle = ink();
  g.fillText(s.nombre, x + 20 * u, y + 60 * u);
  g.font = FONT.sans(14 * u);
  g.fillStyle = ink(0.75);
  lines.forEach((l, i) => g.fillText(l, x + 20 * u, y + 86 * u + i * 21 * u));
  if (s.obra) {
    g.font = FONT.mono(12 * u);
    g.fillStyle = TEAL;
    g.fillText('Leer en AstroIngeniería →', x + 20 * u, y + h - 18 * u);
  }
  g.restore();
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (autoplay && !explorando) {
    const next = Math.min(S.tl.length, target + dt * 0.5);
    scrollTo(0, next * PX_PER_BEAT);
    target = next;
    if (next >= S.tl.length) autoplay = false;
  }
  if (!explorando) p = frozen ?? damp(p, target, 4.2, dt);
  step(now, dt, p);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- captures (?debug)

async function save(path: string, c: HTMLCanvasElement, q = 0.9) {
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', q));
  await fetch(`/__guardar?f=${encodeURIComponent(path)}`, { method: 'POST', body: blob });
}
function shot(b: number, warm = 30) {
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
  const w = o.measureText(text).width;
  o.fillStyle = 'rgba(0,0,0,0.62)';
  o.fillRect(x + 8 * scale, y + 8 * scale, w + 16 * scale, 24 * scale);
  o.fillStyle = '#ece7db';
  o.textBaseline = 'middle';
  o.fillText(text, x + 16 * scale, y + 20.5 * scale);
  o.restore();
}
const api = {
  stage,
  S,
  seek(b: number | null) {
    frozen = b;
  },
  /** A contact sheet of the journey at these beats. */
  async hoja(path: string, beats: number[], cols = 4, tw = 640) {
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
      rotular(o, x, y, b.toFixed(1), tw / 640);
    }
    frozen = was;
    await save(path, out, 0.88);
    return [out.width, out.height];
  },
  async foto(path: string, b: number) {
    await document.fonts.ready;
    const was = frozen;
    frozen = b;
    const c = shot(b);
    frozen = was;
    await save(path, c);
    return path;
  },
  explorar,
  /** Debug: mean brightness (0..765) of the film at beat b. */
  lum(b: number, warm = 4) {
    const was = frozen;
    frozen = b;
    const c = shot(b, warm);
    frozen = was;
    const s = document.createElement('canvas');
    s.width = 64;
    s.height = 36;
    const x = s.getContext('2d')!;
    x.drawImage(canvas, 0, 0, 64, 36);
    const d = x.getImageData(0, 0, 64, 36).data;
    let t = 0;
    for (let i = 0; i < d.length; i += 4) t += d[i] + d[i + 1] + d[i + 2];
    void c;
    return Math.round((t / (64 * 36)) * 10) / 10;
  },
  /** Debug: which object writes NaN or Inf at beat b (renders each top-level object alone into a float target). */
  nan(b: number) {
    const was = frozen;
    frozen = b;
    step(performance.now(), 1 / 60, b);
    frozen = was;
    const w = 320;
    const h = 180;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
    const buf = new Float32Array(w * h * 4);
    const r = stage.renderer;
    const kids = [...stage.root.children];
    const out: Record<string, number> = {};
    const count = () => {
      r.setRenderTarget(rt);
      r.clear();
      r.render(stage.scene, stage.camera);
      r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      r.setRenderTarget(null);
      let n = 0;
      let mx = 0;
      for (let i = 0; i < buf.length; i++) {
        if (!Number.isFinite(buf[i])) n++;
        else if (i % 4 !== 3) mx = Math.max(mx, buf[i]);
      }
      return n > 0 ? -n : Math.round(mx);
    };
    sky.mesh.visible = false;
    out.all = count();
    for (const [i, k] of kids.entries()) {
      kids.forEach((o, j) => (o.visible = j === i));
      out[`${i}:${k.type}:${k.name || k.children.map((c) => c.type).join(',')}`] = count();
    }
    kids.forEach((o) => (o.visible = true));
    sky.mesh.visible = true;
    rt.dispose();
    return out;
  },
  ir(id: string) {
    const s = S.sitios.find((x) => x.id === id);
    if (!s) return;
    explorar(true);
    const to = s.pos(new THREE.Vector3());
    ex.target.copy(to);
    ex.dist = s.dist;
    mostrarFicha(s);
  },
  ex,
};
if (params.has('debug')) Object.assign(window, { civ: api });
