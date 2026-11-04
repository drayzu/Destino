// Evaluates an expression on Destino's page (headless Chrome with the GPU), once it is ready, and
// prints the result. `viaje` is the page's debug handle, `peli` the film.
//   node tools/eval.mjs viaje 0 "viaje.costuras()"
//   (PUERTO=5213 by default; CDP=93xx for a second one at once; EXTRA="&x" more of the URL)
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

// (the first two arguments are kept for the tools that pass them: the page is always the film)
const expr = process.argv[4] ?? process.argv[2];
const PUERTO = process.env.PUERTO ?? 5213;
const port = Number(process.env.CDP ?? 9338);
const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), `destino-eval-${port}`)}`, '--window-size=1600,900', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
await send('Page.navigate', { url: `http://localhost:${PUERTO}/?debug&cap=1600x900${process.env.EXTRA ?? ''}` });
await sleep(3000);
const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => { await viaje.listo(); return JSON.stringify(await (${expr})); })()` });
console.log(r.result?.result?.value ?? JSON.stringify(r.result?.exceptionDetails ?? r));
await send('Browser.close');
