// Parpadeo: where a tiny move of the camera changes the picture a lot (points that fall together in
// a few pixels and burn, aliasing). For beats from..to every `res`, renders at b and b + 0.004 (the
// same clock) and measures the biggest change of one block (40×22 blocks, 0–765); prints the worst.
//   node tools/parpadeo.mjs [--from 0 --to 449] [--res 0.5] [--top 25]
import { execFileSync } from 'node:child_process';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const FROM = arg('from', '0'), TO = arg('to', 'viaje.total'), RES = arg('res', '0.5'), TOP = Number(arg('top', 25));
const expr = `(() => {
  const c = document.querySelector('#scene');
  const s = document.createElement('canvas'); s.width = 40; s.height = 22;
  const g = s.getContext('2d', { willReadFrequently: true });
  const lee = (b) => { for (let k = 0; k < 3; k++) viaje.cuadro(b, 1000); g.drawImage(c, 0, 0, 40, 22); return g.getImageData(0, 0, 40, 22).data; };
  const out = [];
  for (let b = ${FROM}; b <= Math.min(${TO}, viaje.total - 0.01); b += ${RES}) {
    const a = lee(b), z = lee(b + 0.004), a2 = lee(b);
    // (the change a tiny move makes, past what rendering the same beat again already changes)
    let m = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.abs(a[i] + a[i+1] + a[i+2] - z[i] - z[i+1] - z[i+2]) - Math.abs(a[i] + a[i+1] + a[i+2] - a2[i] - a2[i+1] - a2[i+2]);
      m = Math.max(m, d);
    }
    out.push([+b.toFixed(2), m]);
  }
  return out;
})()`;
const r = execFileSync('node', ['tools/eval.mjs', 'viaje', '0', expr], { encoding: 'utf8', maxBuffer: 1 << 26 });
let v = JSON.parse(r); if (typeof v === 'string') v = JSON.parse(v);
v.sort((a, b) => b[1] - a[1]);
console.log(v.slice(0, TOP).map(([b, m]) => `${b}:${m}`).join(' '));
