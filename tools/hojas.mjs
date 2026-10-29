// Contact sheets of the remake's studies without a window: headless Chrome (with the GPU) against the
// dev server (npm run dev -- --port 5211). Each job is <study> <way> <frames>; the frames are spread
// evenly over the whole way and saved by the page itself into docs/remake/estudios/.
//   node tools/hojas.mjs tierra 1 12 mercurio 2 16
const PUERTO = process.env.PUERTO ?? 5211;
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const port = 9337;
const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), 'destino-remake-hojas')}`, '--window-size=1600,900', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
  if (m.method === 'Runtime.exceptionThrown') console.error('[page]', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
for (let i = 0; i < args.length; i += 3) {
  // Frames: a count spread over the whole way, or «@3.5,8,12» for those beats, large (two per row).
  const [m, s, n] = [args[i], parseInt(args[i + 1], 10), args[i + 2]];
  const lista = n.startsWith('@');
  const beats = lista ? `[${n.slice(1)}]` : `Array.from({ length: ${n} }, (_, i) => +(0.3 + i * (L - 0.6) / ${Number(n) - 1}).toFixed(2))`;
  const out = `docs/remake/estudios/${m}-${s}${lista ? '-cuadros' : ''}.jpg`;
  await send('Page.navigate', { url: `http://localhost:${PUERTO}/estudios/index.html?m=${m}&s=${s}&debug&cap=1600x900` });
  await sleep(3000);
  const r = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => { await estudio.inst?.listo; const L = estudio.length; const b = ${beats}; await estudio.hoja('${out}', b, ${lista ? 2 : 4}, ${lista ? 800 : 480}); return L; })()`,
  });
  console.log(`${m}-${s}: ${r.result?.result?.value ?? JSON.stringify(r.result?.exceptionDetails ?? r)}`);
}
await send('Browser.close');
chrome.kill();
process.exit(0);
