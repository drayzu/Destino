// Frames of the journey for the README: headless Chrome (with the GPU) against the dev server, the
// film only (no page, no plate), at 1840 × 1035. Each segment glides from beat `b` over `d` beats in
// `n` frames; the frames land in <out>/<segment>/0000.jpg (quality 0.95: PNG is several times slower), and the power at its middle is printed (the
// exponent of its row). Segments already captured are kept (pass --fresh <name> to redo one).
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
const fresh = process.argv.includes('--fresh') ? process.argv[process.argv.indexOf('--fresh') + 1] : null;
const raiz = posicionales[1] ?? new URL('./readme/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

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
await sleep(9000);
// Full quality, nothing else drawing: frames come only from our steps.
await ev('destino.grabar(), 1');
// The film only.
await ev(`(() => { const s = document.createElement('style'); s.textContent = 'body > *:not(#scene) { display: none !important; }'; document.head.append(s); return 1; })()`);

for (const seg of segmentos) {
  const dir = join(raiz, seg.nombre);
  if (seg.nombre === fresh) rmSync(dir, { recursive: true, force: true });
  if (existsSync(join(dir, `${String(seg.n - 1).padStart(4, '0')}.jpg`))) {
    console.log('kept', seg.nombre);
    continue;
  }
  mkdirSync(dir, { recursive: true });
  // Settle at the start (a few frames, so damped values arrive), then glide.
  const t0 = seg.b * 1000;
  for (let k = 0; k < 12; k++) await ev(`(() => { destino.seek(${seg.b}); destino.step(${t0 - (12 - k) * (1000 / FPS)}); return 1; })()`);
  for (let i = 0; i < seg.n; i++) {
    const b = seg.b + (seg.d * i) / (seg.n - 1);
    // The film's canvas, read in the same task as its frame is drawn (its buffer is not preserved).
    const r = await ev(`(() => { destino.seek(${b}); destino.step(${t0 + i * (1000 / FPS)}); return document.querySelector('#scene').toDataURL('image/jpeg', 0.95); })()`);
    const url = r.result?.result?.value;
    if (typeof url !== 'string') throw new Error(`no frame at ${b}: ${JSON.stringify(r.result).slice(0, 300)}`);
    writeFileSync(join(dir, `${String(i).padStart(4, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  }
  // The power at the middle of the segment, as the plate reads it (log10 of the watts in use).
  const lp = (await ev(`(() => { const b = ${seg.b + seg.d / 2}; const a = destino.actos.filter((x) => destino.at(x.id) <= b + 0.5).pop(); const l = a && a.lectura(b); return l ? l.lp : null; })()`)).result?.result?.value;
  console.log('captured', seg.nombre, 'lp', lp);
}
await send('Browser.close');
chrome.kill();
process.exit(0);
