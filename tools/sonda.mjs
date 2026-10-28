// Sonda: how a stretch of Destino feels by hand. For beats [from, to] it measures, every `step` beats
// and with the clock frozen (only the scroll moves things): the camera's zoom and turn per beat, the
// rendered picture's change per beat (mean |Δ luminance| on a 96×54 copy, 0–255), the page pixels the
// pace gives each beat, and so the picture's change per 100 px of scroll — what a hand feels. It also
// saves a contact sheet of frames at equal steps of PAGE (what a steady hand sees), labelled with beat
// and page pixels.
//
//   node tools/sonda.mjs --from 21 --to 27 [--step 0.02] [--frames 24] [--out dir] [--port 9350]
//                  [--extra "&ritmo=plano"] [--server http://localhost:5297] [--w 960 --h 540]
//
// Prints a table (every 0.1 beat) and writes <out>/sonda.json and <out>/hoja.jpg.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const FROM = Number(arg('from')), TO = Number(arg('to'));
const STEP = Number(arg('step', 0.02));
const FRAMES = Number(arg('frames', 24));
const OUT = resolve(arg('out', `sonda-${FROM}-${TO}`));
const PORT = Number(arg('port', 9350));
const EXTRA = arg('extra', '');
const SERVER = arg('server', 'http://localhost:5297');
const W = Number(arg('w', 960)), H = Number(arg('h', 540));
if (!(TO > FROM)) throw new Error('need --from and --to');
mkdirSync(OUT, { recursive: true });

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), `destino-sonda-${PORT}`)}`,
  `--window-size=${W},${H}`, '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });
const fin = (code) => { try { chrome.kill(); } catch {} process.exit(code); };
let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
}
if (!target) { console.error('Chrome did not start'); fin(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') console.error('[page]', (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).split('\n')[0]);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 600000 });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

async function preparar() {
  await send('Page.navigate', { url: `${SERVER}/?debug${EXTRA}` });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try { if (await ev(`typeof destino === 'object' && document.readyState === 'complete' && typeof destino.vista === 'function' && destino.ritmo().res > 0 && (${JSON.stringify(EXTRA)}.includes('plano') || destino.ritmo().res < 1)`)) break; } catch {}
  }
  await sleep(2500);
  await ev(`(() => {
    destino.grabar();
    const c = document.createElement('canvas'); c.width = 96; c.height = 54;
    window.__g = c.getContext('2d', { willReadFrequently: true });
    window.__sonda = 1;
    return 1;
  })()`);
}
// Runs `fn` (an expression); if the dev server reloaded the page meanwhile, prepares again and retries.
async function seguro(expr) {
  for (let k = 0; k < 6; k++) {
    try {
      const v = await ev(`(() => { if (!window.__sonda) return '__reload'; return ${expr}; })()`);
      if (v !== '__reload') return v;
    } catch (e) { if (!/destino is not defined|__sonda/.test(String(e))) throw e; }
    console.error('page reloaded, preparing again');
    await preparar();
  }
  throw new Error('page keeps reloading');
}
await preparar();

const info = await seguro(`(() => { const r = destino.ritmo(); return { length: destino.tl.length, res: r.res, px: Array.from(r.px), flujo: Array.from(r.flujo), tope: Array.from(r.tope), auto: Array.from(r.auto) }; })()`);
// Page position of a beat (as scroll.ts lays it out).
const n = info.px.length;
const inicio = new Float64Array(n + 1);
for (let i = 0; i < n; i++) inicio[i + 1] = inicio[i] + info.px[i] * info.res;
const muestra = (b) => Math.min(n - 1, Math.max(0, Math.floor(b / info.res)));
const aPx = (b) => { b = Math.min(info.length, Math.max(0, b)); const i = muestra(b); return inicio[i] + (b - i * info.res) * info.px[i]; };
const aBeat = (y) => { let lo = 0, hi = n - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (inicio[mid] <= y) lo = mid; else hi = mid - 1; } return Math.min(info.length, Math.max(0, lo * info.res + (y - inicio[lo]) / info.px[lo])); };

// Samples with the clock frozen.
const T = 200000;
const muestras = [];
for (let p = FROM; p <= TO + 1e-9; p = Math.round((p + STEP) * 1e6) / 1e6) {
  const s = await seguro(`(() => {
    const p = ${p};
    destino.seek(p); destino.step(${T});
    const g = window.__g;
    g.drawImage(document.querySelector('#scene'), 0, 0, 96, 54);
    const d = g.getImageData(0, 0, 96, 54).data;
    const lum = new Array(96 * 54);
    for (let i = 0; i < lum.length; i++) lum[i] = Math.round(0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2]);
    const v = destino.vista(p);
    const c = destino.tl.captionAt(p);
    return { lum, pos: v.pos.toArray(), target: v.target.toArray(), fov: v.fov, cap: c ? (c.viaje ? '→ ' : '') + c.name : '' };
  })()`);
  muestras.push({ p, ...s });
}
const filas = [];
for (let i = 1; i < muestras.length; i++) {
  const a = muestras[i - 1], s = muestras[i];
  let sum = 0;
  for (let k = 0; k < s.lum.length; k++) sum += Math.abs(s.lum[k] - a.lum[k]);
  const img = sum / s.lum.length / STEP;
  const dist = (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  const da = dist(a.pos, a.target), db = dist(s.pos, s.target);
  const zoom = Math.abs(Math.log(db / da)) / STEP;
  const ua = a.target.map((x, k) => (x - a.pos[k]) / da), ub = s.target.map((x, k) => (x - s.pos[k]) / db);
  const turn = Math.acos(Math.min(1, Math.max(-1, ua[0] * ub[0] + ua[1] * ub[1] + ua[2] * ub[2]))) / ((s.fov * Math.PI) / 180) / STEP;
  const pm = (a.p + s.p) / 2;
  const px = info.px[muestra(pm)];
  filas.push({ p: +pm.toFixed(3), cap: s.cap, zoom, turn, img, px, flujo: info.flujo[muestra(pm)], tope: info.tope[muestra(pm)], auto: info.auto[muestra(pm)],
    imgPor100px: (img / px) * 100, giroPor100px: (turn / px) * 100, zoomPor100px: (zoom / px) * 100 });
}
// Table every 0.1 beat (max over the bin), so short bursts show.
console.log(`beats ${FROM}–${TO}: page ${Math.round(aPx(FROM))} → ${Math.round(aPx(TO))} px (${Math.round(aPx(TO) - aPx(FROM))} px)${EXTRA ? '  [' + EXTRA + ']' : ''}`);
console.log('  beat | px/beat | zoom/b  turn/b  img/b | per 100 px: img  turn  zoom | caption');
const bin = 0.1;
for (let b0 = FROM; b0 < TO - 1e-9; b0 += bin) {
  const sel = filas.filter((f) => f.p >= b0 && f.p < b0 + bin);
  if (!sel.length) continue;
  const mx = (k) => Math.max(...sel.map((f) => f[k]));
  console.log(`${b0.toFixed(1).padStart(6)} | ${Math.round(mx('px')).toString().padStart(7)} | ${mx('zoom').toFixed(2).padStart(6)} ${mx('turn').toFixed(2).padStart(6)} ${mx('img').toFixed(0).padStart(6)} | ${mx('imgPor100px').toFixed(1).padStart(15)} ${mx('giroPor100px').toFixed(2).padStart(5)} ${mx('zoomPor100px').toFixed(2).padStart(5)} | ${sel[sel.length - 1].cap}`);
}

// Contact sheet: frames at equal steps of page.
const y0 = aPx(FROM), y1 = aPx(TO);
const beats = Array.from({ length: FRAMES }, (_, k) => aBeat(y0 + ((y1 - y0) * k) / (FRAMES - 1)));
const cols = Math.min(6, FRAMES);
const url = await seguro(`(async () => {
  const beats = ${JSON.stringify(beats)};
  const cw = 320, ch = 180, cols = ${cols}, rows = Math.ceil(beats.length / cols);
  const sheet = document.createElement('canvas'); sheet.width = cw * cols; sheet.height = (ch + 18) * rows;
  const g = sheet.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, sheet.width, sheet.height);
  g.font = '12px monospace';
  for (let k = 0; k < beats.length; k++) {
    const b = beats[k];
    for (let w = 0; w < 10; w++) { destino.seek(b); destino.step(${T} + 1000 + k * 400 + w * 33); }
    const x = (k % cols) * cw, y = Math.floor(k / cols) * (ch + 18);
    g.drawImage(document.querySelector('#scene'), x, y, cw, ch);
    g.drawImage(document.querySelector('#placa'), x, y, cw, ch);
    g.fillStyle = '#ccc';
    g.fillText(b.toFixed(2) + ' · ' + Math.round(${y0} + (${y1 - y0}) * k / (beats.length - 1)) + ' px', x + 4, y + ch + 13);
  }
  return sheet.toDataURL('image/jpeg', 0.85);
})()`);
writeFileSync(join(OUT, 'hoja.jpg'), Buffer.from(url.split(',')[1], 'base64'));
writeFileSync(join(OUT, 'sonda.json'), JSON.stringify({ from: FROM, to: TO, step: STEP, extra: EXTRA, pagePx: [y0, y1], filas, hoja: beats }));
console.log(`sheet: ${join(OUT, 'hoja.jpg')} (${FRAMES} frames, every ${Math.round((y1 - y0) / (FRAMES - 1))} px of page)`);
ws.close();
fin(0);
