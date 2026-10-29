// Frames of the journey for the README: headless Chrome (with the GPU) against the dev server, the
// film only (no page, no plate), at 1840 × 1035. Each segment glides from beat `b` over `d` beats in
// `n` frames, or follows its `claves`, [seconds, beat] pairs that set the tempo (eased between them,
// never backwards, so it can linger on a moment and rush through the next flight); the frames land in <out>/<segment>/0000.jpg (quality 0.95: PNG is several times slower), and the power at its middle is printed (the
// exponent of its row). Segments already captured are kept (pass --fresh <name>[,<name>…] to redo some).
// A segment with `sub` (and `shutter`, 0.3 of a frame by default) is drawn with motion blur.
//
//   npm run dev   (in another terminal)
//   node tools/clip.mjs [list = tools/readme.json] [out = tools/readme]
//   python tools/readme_media.py
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const W = 1840;
const H = 1035;
const FPS = 30;
const posicionales = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--fresh');
const lista = posicionales[0] ?? new URL('./readme.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const segmentos = JSON.parse(readFileSync(lista, 'utf8'));
const fresh = process.argv.includes('--fresh') ? process.argv[process.argv.indexOf('--fresh') + 1].split(',') : [];
const raiz = posicionales[1] ?? new URL('./readme/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

/** The beat at frame i from [seconds, beat] keys: a monotone cubic (Fritsch–Carlson), so the speed
 *  changes smoothly between keys and the journey never runs backwards. */
function tempo(claves) {
  const t = claves.map((c) => c[0] * FPS);
  const b = claves.map((c) => c[1]);
  const m = t.length;
  const s = t.slice(0, -1).map((_, k) => (b[k + 1] - b[k]) / (t[k + 1] - t[k]));
  const v = t.map((_, k) => (k === 0 ? s[0] : k === m - 1 ? s[m - 2] : s[k - 1] * s[k] <= 0 ? 0 : (s[k - 1] + s[k]) / 2));
  for (let k = 0; k < m - 1; k++) {
    if (s[k] === 0) { v[k] = v[k + 1] = 0; continue; }
    const a = v[k] / s[k], c = v[k + 1] / s[k];
    const r = Math.hypot(a, c);
    if (r > 3) { v[k] = (3 * a * s[k]) / r; v[k + 1] = (3 * c * s[k]) / r; }
  }
  return (i) => {
    let k = 0;
    while (k < m - 2 && i > t[k + 1]) k++;
    const h = t[k + 1] - t[k];
    const u = Math.min(Math.max((i - t[k]) / h, 0), 1);
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * b[k] + (u3 - 2 * u2 + u) * h * v[k] + (-2 * u3 + 3 * u2) * b[k + 1] + (u3 - u2) * h * v[k + 1];
  };
}

const port = 9335;
const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${join(tmpdir(), 'destino-clip')}`,
  `--window-size=${W},${H}`,
  '--ignore-gpu-blocklist',
  '--hide-scrollbars',
  '--mute-audio',
  'about:blank',
], { stdio: 'ignore' });
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
  } catch {}
}
if (!target) throw new Error('Chrome did not start');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
  if (m.method === 'Runtime.exceptionThrown') console.error('[page]', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 600000 });

await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:5197/?debug&lang=en' });
// Full quality, nothing else drawing: frames come only from our steps; and the film only. A mark on the
// page tells us when the dev server reloads it (an edit elsewhere): then this is done again and the
// segment in progress starts over.
async function preparar() {
  for (let i = 0; i < 120; i++) {
    await sleep(i ? 500 : 9000);
    const r = await ev(`typeof destino === 'object' && document.readyState === 'complete'`);
    if (r.result?.result?.value) break;
  }
  await sleep(3000);
  await ev('destino.grabar(), 1');
  await ev(`(() => { const s = document.createElement('style'); s.textContent = 'body > *:not(#scene) { display: none !important; }'; document.head.append(s); window.__clip = 1; return 1; })()`);
}
await preparar();

for (const seg of segmentos) {
  const dir = join(raiz, seg.nombre);
  if (seg.claves) {
    seg.n = Math.round(seg.claves.at(-1)[0] * FPS) + 1;
    seg.b = seg.claves[0][1];
    seg.d = seg.claves.at(-1)[1] - seg.b;
  }
  const beatAt = seg.claves ? tempo(seg.claves) : (i) => seg.b + (seg.d * i) / (seg.n - 1);
  if (fresh.includes(seg.nombre)) rmSync(dir, { recursive: true, force: true });
  if (existsSync(join(dir, `${String(seg.n - 1).padStart(4, '0')}.jpg`))) {
    console.log('kept', seg.nombre);
    continue;
  }
  mkdirSync(dir, { recursive: true });
  for (let intento = 0; ; intento++) {
    // Settle at the start (a few frames, so damped values arrive), then glide.
    const t0 = seg.b * 1000;
    for (let k = 0; k < 12; k++) await ev(`(() => { destino.seek(${seg.b}); destino.step(${t0 - (12 - k) * (1000 / FPS)}); return 1; })()`);
    let recargada = false;
    for (let i = 0; i < seg.n && !recargada; i++) {
      // `sub` draws the frame that many times across `shutter` of a frame and averages them: motion
      // blur, so what crosses the screen fast glides instead of jumping (a short shutter keeps it sharp).
      const k = seg.sub ?? 1, sh = seg.shutter ?? 0.3;
      const us = Array.from({ length: k }, (_, s) => (k === 1 ? 0 : ((s + 0.5) / k - 0.5) * sh));
      const B = us.map((u) => beatAt(i + u)), T = us.map((u) => t0 + (i + u) * (1000 / FPS));
      const b = B[0];
      // The film's canvas, read in the same task as its frame is drawn (its buffer is not preserved).
      const r = await ev(`(() => { if (!window.__clip) return 'reload'; const sc = document.querySelector('#scene');
        const B = ${JSON.stringify(B)}, T = ${JSON.stringify(T)};
        if (B.length === 1) { destino.seek(B[0]); destino.step(T[0]); return sc.toDataURL('image/jpeg', 0.95); }
        let a = window.__medio; if (!a || a.width !== sc.width || a.height !== sc.height) { a = window.__medio = document.createElement('canvas'); a.width = sc.width; a.height = sc.height; }
        const g = a.getContext('2d');
        for (let s = 0; s < B.length; s++) { destino.seek(B[s]); destino.step(T[s]); g.globalAlpha = 1 / (s + 1); g.drawImage(sc, 0, 0); }
        return a.toDataURL('image/jpeg', 0.95); })()`);
      const url = r.result?.result?.value;
      if (url === 'reload' || /is not defined/.test(r.result?.result?.description ?? '')) recargada = true;
      else if (typeof url !== 'string') throw new Error(`no frame at ${b}: ${JSON.stringify(r.result).slice(0, 300)}`);
      else writeFileSync(join(dir, `${String(i).padStart(4, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    }
    if (!recargada) break;
    if (intento > 5) throw new Error(`the page keeps reloading (${seg.nombre})`);
    console.log('reloaded, again', seg.nombre);
    await preparar();
  }
  // The power at the middle of the segment, as the plate reads it (log10 of the watts in use).
  const lp = (await ev(`(() => { const b = ${seg.b + seg.d / 2}; const a = destino.actos.filter((x) => destino.at(x.id) <= b + 0.5).pop(); const l = a && a.lectura(b); return l ? l.lp : null; })()`)).result?.result?.value;
  console.log('captured', seg.nombre, 'lp', lp);
}
await send('Browser.close');
chrome.kill();
process.exit(0);
