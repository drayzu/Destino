// Frames of a journey page, one JPEG per beat step, for comparing two versions of the film (the
// reference: the journey as it was before the new chassis). Headless Chrome with the GPU against a
// running dev server; frames land in <out>/<beat>.jpg, and a sheet of all of them in <out>.jpg.
//
//   node tools/referencia.mjs --desde 0 --hasta 72 --paso 0.5 --out docs/chasis/nuevo
//   (--puerto 5213, --ruta for another page (the old journey was viaje/index.html), --ancho 960, --alto 540; --cdp 9351 for a second one at once)
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const PUERTO = arg('puerto', '5213');
const RUTA = arg('ruta', '');
const DESDE = Number(arg('desde', '0'));
const HASTA = Number(arg('hasta', '72'));
const PASO = Number(arg('paso', '0.5'));
const OUT = arg('out', 'docs/chasis/referencia');
const W = Number(arg('ancho', '960'));
const H = Number(arg('alto', '540'));
const port = Number(arg('cdp', '9350'));

const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), `destino-ref-${port}`)}`, `--window-size=${W},${H}`, '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === 'Runtime.exceptionThrown') console.error('[page]', msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
await send('Runtime.enable');
await send('Page.navigate', { url: `http://localhost:${PUERTO}/${RUTA}?debug&cap=${W}x${H}${process.env.EXTRA ?? ''}` });
await sleep(3000);
await ev('viaje.listo()');
mkdirSync(OUT, { recursive: true });
const hechos = [];
for (let b = DESDE; b <= HASTA + 1e-9; b += PASO) {
  // (a few frames at the beat first: whatever loads or settles on its first draw)
  const url = await ev(`(() => { for (let k = 0; k < 3; k++) viaje.dibujar(${b}, 0); return viaje.cuadro(${b}, 0, 0.9); })()`);
  const f = join(OUT, `${b.toFixed(2).padStart(7, '0')}.jpg`);
  writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  hechos.push(f);
}
await send('Browser.close');
chrome.kill();
// The sheet: every frame, ten to a row, with its beat.
try {
  const cols = 10;
  const filas = Math.ceil(hechos.length / cols);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', `${OUT}/*.jpg`, '-vf', `scale=320:-1,tile=${cols}x${filas}`, '-frames:v', '1', '-q:v', '3', `${OUT}.jpg`]);
} catch {
  // (ffmpeg on Windows has no glob: a list instead)
  const lista = join(tmpdir(), 'ref-lista.txt');
  writeFileSync(lista, hechos.map((f) => `file '${f.replace(/\\/g, '/').replace(/^(?![A-Z]:)/, process.cwd().replace(/\\/g, '/') + '/')}'`).join('\n'));
  const cols = 10;
  const filas = Math.ceil(hechos.length / cols);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-vf', `scale=320:-1,tile=${cols}x${filas}`, '-frames:v', '1', '-q:v', '3', `${OUT}.jpg`]);
}
console.log(`${hechos.length} cuadros en ${OUT}`);
