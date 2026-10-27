// Frames of the journey for the README clip: headless Chrome (with the GPU) against the dev server,
// the film only (no page, no plate), at 1840 × 1035. Each segment glides from beat `b` over `d` beats
// in `n` frames; the frames land in tools/clip/<segment>/0000.png. Segments already captured are kept
// (pass --fresh <name> to redo one).
//
//   npm run dev   (in another terminal)
//   node tools/clip.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const W = 1840;
const H = 1035;
const FPS = 30;
const segmentos = JSON.parse(readFileSync(new URL('./clip.json', import.meta.url), 'utf8'));
const fresh = process.argv.includes('--fresh') ? process.argv[process.argv.indexOf('--fresh') + 1] : null;
const raiz = new URL('./clip/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

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
// The film only.
await ev(`(() => { const s = document.createElement('style'); s.textContent = 'body > *:not(#scene) { display: none !important; }'; document.head.append(s); return 1; })()`);

for (const seg of segmentos) {
  const dir = join(raiz, seg.nombre);
  if (seg.nombre === fresh) rmSync(dir, { recursive: true, force: true });
  if (existsSync(join(dir, `${String(seg.n - 1).padStart(4, '0')}.png`))) {
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
    const r = await ev(`(() => { destino.seek(${b}); destino.step(${t0 + i * (1000 / FPS)}); return document.querySelector('#scene').toDataURL('image/png'); })()`);
    const url = r.result?.result?.value;
    if (typeof url !== 'string') throw new Error(`no frame at ${b}: ${JSON.stringify(r.result).slice(0, 300)}`);
    writeFileSync(join(dir, `${String(i).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('captured', seg.nombre);
}
await send('Browser.close');
chrome.kill();
process.exit(0);
