// Contact sheets without a window: opens the dev server in headless Chrome (with the GPU), runs an
// expression that uses `destino` (the ?debug handle), and closes. The sheets are saved into the
// project by the dev server, as with `destino.hoja` in the console.
//
//   npm run dev   (in another terminal)
//   node tools/hoja.mjs "await destino.hoja('docs/fase2/x.jpg', [50, 51, 52], 3, 2400)"
//   node tools/hoja.mjs "<expression>" "http://localhost:5197/?debug&lang=en"
//
// Set CHROME to the browser's path if it is not in the usual place.
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const expr = process.argv[2];
const url = process.argv[3] ?? 'http://localhost:5197/?debug&lamina&lang=es';
const port = 9333;
const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${join(tmpdir(), 'destino-hoja')}`,
  '--window-size=1600,900',
  '--ignore-gpu-blocklist',
  '--hide-scrollbars',
  '--mute-audio',
  'about:blank',
], { stdio: 'ignore' });

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
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
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
// The Earth's map and its lights load after the page.
await sleep(6000);
const res = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, timeout: 600000 });
console.log(JSON.stringify(res.result?.result?.value ?? res.result ?? res));
await send('Browser.close');
chrome.kill();
process.exit(0);
