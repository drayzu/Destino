// Cámara: jumps in the camera, over the whole film. Every `paso` beats (the camera alone, fast) it
// takes the camera's move and its turn, and flags a step that is much bigger than the steps either
// side (a jump of place or of gaze), or a gaze that speeds up or slows at once (a jolt).
//   node tools/camara.mjs [--from 0 --to 449] [--paso 0.025]
import { execFileSync } from 'node:child_process';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const FROM = arg('from', '0'), TO = arg('to', '1e9'), PASO = arg('paso', '0.025');
const expr = `(() => {
  const a = ${FROM}, b = Math.min(${TO}, viaje.total), D = ${PASO};
  const r = viaje.trayecto(a, b, D);
  const n = r.length / 12;
  const at = (i) => r[i * 12];
  const mov = [0], giro = [0];
  for (let i = 1; i < n; i++) {
    const o = (i - 1) * 12, q = i * 12;
    mov.push(Math.hypot(r[q + 1] - r[o + 1], r[q + 2] - r[o + 2], r[q + 3] - r[o + 3]) / Math.max(r[q + 11], 1e-30));
    giro.push(Math.acos(Math.min(1, r[q + 4] * r[o + 4] + r[q + 5] * r[o + 5] + r[q + 6] * r[o + 6])) * 57.2958);
  }
  const tramos = viaje.tramos();
  const acto = (x) => { let s = tramos[0][0]; for (const t of tramos) if (x >= t[2]) s = t[0]; return s; };
  const out = [];
  for (let i = 2; i < n - 2; i++) {
    // (a move: relative to the distance to the rig's centre, so worlds of any size compare)
    const m = mov[i], mv = Math.max(mov[i - 1], mov[i + 1], mov[i - 2], mov[i + 2]);
    if (m > 2.2 * mv && m > 0.004) out.push([+at(i).toFixed(3), acto(at(i)), 'salto de lugar', +(m / Math.max(mv, 1e-9)).toFixed(1)]);
    const g = giro[i], gv = Math.max(giro[i - 1], giro[i + 1], giro[i - 2], giro[i + 2]);
    if (g > 2.2 * gv && g > 0.4) out.push([+at(i).toFixed(3), acto(at(i)), 'salto de mirada', +(g / Math.max(gv, 1e-9)).toFixed(1)]);
    const acc = Math.abs(giro[i] - giro[i - 1]);
    if (acc > 1.2 && acc > 3 * Math.max(Math.abs(giro[i - 1] - giro[i - 2]), Math.abs(giro[i + 1] - giro[i]), 0.15)) out.push([+at(i).toFixed(3), acto(at(i)), 'tirón de mirada', +acc.toFixed(1)]);
  }
  return out;
})()`;
const r = execFileSync('node', ['tools/eval.mjs', 'viaje', '0', expr], { encoding: 'utf8', maxBuffer: 1 << 26 });
let v = JSON.parse(r); if (typeof v === 'string') v = JSON.parse(v);
const uno = [];
for (const e of v) if (!uno.some((u) => Math.abs(u[0] - e[0]) < 0.1 && u[2] === e[2])) uno.push(e);
console.log(uno.length ? uno.map((e) => `${String(e[0]).padStart(8)}  ${e[1].padEnd(10)} ${e[2].padEnd(16)} ${e[3]}`).join('\n') : 'la cámara no salta en ningún compás');
