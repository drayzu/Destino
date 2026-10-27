// Finds the near-empty stretches of the journey: headless Chrome (with the GPU) against the dev server
// plays the whole timeline at 1 beat per second (sampled every `paso` beats), measures how much of
// the film's canvas is lit, and saves a thumbnail of every frame that is almost black.
//
//   npm run dev   (in another terminal)
//   node tools/vacios.mjs [paso=0.25] [desde=0] [hasta=end]
//
// Writes tools/vacios/medidas.json (beat, moment, lit fraction, mean) and tools/vacios/<beat>.jpg.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const [paso = 0.25, desde = 0, hasta = Infinity] = process.argv.slice(2).map(Number);
const W = 1280;
const H = 720;
const raiz = new URL('./vacios/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
rmSync(raiz, { recursive: true, force: true });
mkdirSync(raiz, { recursive: true });
const port = 9337;
const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${join(tmpdir(), 'destino-vacios')}`,
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
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 600000 })).result?.result?.value;

await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:5197/?debug&lang=es' });
await sleep(9000);
// A small canvas to measure on, and one for thumbnails.
await ev(`(() => {
  window.__m = Object.assign(document.createElement('canvas'), { width: 96, height: 54 }).getContext('2d', { willReadFrequently: true });
  window.__t = Object.assign(document.createElement('canvas'), { width: 320, height: 180 }).getContext('2d');
  return 1;
})()`);

const fin = Math.min(hasta, await ev('destino.tl.length'));
const medidas = [];
for (let b = desde; b <= fin; b += paso) {
  const r = await ev(`(() => {
    destino.seek(${b}); destino.step(${b * 1000});
    const s = document.querySelector('#scene');
    __m.drawImage(s, 0, 0, 96, 54);
    const d = __m.getImageData(0, 0, 96, 54).data;
    let lit = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      sum += l;
      if (l > 0.06) lit++;
    }
    const n = d.length / 4;
    const c = destino.tl.captionAt(${b});
    const out = { b: ${b}, nombre: c ? c.name : '', lit: lit / n, media: sum / n };
    if (lit / n < 0.004) { __t.drawImage(s, 0, 0, 320, 180); out.img = __t.canvas.toDataURL('image/jpeg', 0.8); }
    return out;
  })()`);
  if (!r) continue;
  if (r.img) {
    writeFileSync(join(raiz, `${r.b.toFixed(2)}.jpg`), Buffer.from(r.img.split(',')[1], 'base64'));
    delete r.img;
  }
  medidas.push(r);
}
writeFileSync(join(raiz, 'medidas.json'), JSON.stringify(medidas));
// The empty stretches, merged.
let tramo = null;
for (const m of medidas) {
  if (m.lit < 0.004) {
    if (!tramo) tramo = { desde: m.b, hasta: m.b, nombre: m.nombre, min: m.lit };
    tramo.hasta = m.b;
    tramo.min = Math.min(tramo.min, m.lit);
  } else if (tramo) {
    console.log(`${tramo.desde.toFixed(2)}–${tramo.hasta.toFixed(2)}  ${tramo.nombre}  (min ${(tramo.min * 100).toFixed(2)} %)`);
    tramo = null;
  }
}
if (tramo) console.log(`${tramo.desde.toFixed(2)}–${tramo.hasta.toFixed(2)}  ${tramo.nombre}`);
await send('Browser.close');
chrome.kill();
process.exit(0);
