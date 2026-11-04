// Hoja de eventos: for a list of beats [b, b2], a sheet of each one's frames just before, during and
// just after (b − 0.15, b, (b + b2) / 2, b2, b2 + 0.15), labelled. Played up to each from a little before.
//   node tools/hoja-eventos.mjs <out.jpg> "b:b2,b:b2,…"
import { execFileSync } from 'node:child_process';
const [out, lista] = process.argv.slice(2);
const ev = lista.split(',').map((x) => x.split(':').map(Number));
const expr = `(async () => {
  const ev = ${JSON.stringify(ev)};
  const c = document.querySelector('#scene');
  const tw = 256, th = Math.round(tw * c.height / c.width);
  const o2 = document.createElement('canvas'); o2.width = tw * 5 + 90; o2.height = th * ev.length;
  const o = o2.getContext('2d'); o.fillStyle = '#000'; o.fillRect(0, 0, o2.width, o2.height);
  ev.forEach(([b, b2], r) => {
    const ts = [b - 0.15, b, (b + b2) / 2, b2, b2 + 0.15];
    viaje.dibujar(Math.max(0, b - 0.4), 1000);
    for (let t = b - 0.35; t < b - 0.15; t += 0.05) viaje.dibujar(Math.max(0, t), 1000);
    ts.forEach((t, k) => { viaje.dibujar(Math.max(0, t), 1000); o.drawImage(c, 90 + k * tw, r * th, tw, th); });
    o.fillStyle = '#ece7db'; o.font = '600 15px monospace'; o.fillText(b.toFixed(2), 8, r * th + 22);
  });
  const blob = await new Promise((res) => o2.toBlob(res, 'image/jpeg', 0.85));
  await fetch('/__guardar?f=' + encodeURIComponent(${JSON.stringify(out)}), { method: 'POST', body: blob });
  return [o2.width, o2.height];
})()`;
console.log(execFileSync('node', ['tools/eval.mjs', 'viaje', '0', expr], { encoding: 'utf8' }));
