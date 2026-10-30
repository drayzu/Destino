// Evaluates an expression in a study page (headless Chrome, with the GPU) and prints the result.
//   node tools/eval.mjs mercurio 1 "estudio.camara(9.4)"
//   node tools/eval.mjs viaje 0 "viaje.tramos()"  (the journey page)
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const [m, s, expr] = process.argv.slice(2);
const PUERTO = process.env.PUERTO ?? 5211;
const port = 9338;
const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), 'destino-remake-eval')}`, '--window-size=1600,900', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') console.error('[console]', msg.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Page.navigate', { url: m === 'viaje' ? `http://localhost:${PUERTO}/viaje/index.html?debug&cap=1600x900` : `http://localhost:${PUERTO}/estudios/index.html?m=${m}&s=${s}&debug&cap=1600x900` });
await sleep(3000);
const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: m === 'viaje' ? `(async () => { await viaje.listo(); return JSON.stringify(await (${expr})); })()` : `(async () => { await estudio.inst?.listo; return JSON.stringify(await (${expr})); })()` });
console.log(r.result?.result?.value ?? JSON.stringify(r.result?.exceptionDetails ?? r));
await send('Browser.close');
chrome.kill();
