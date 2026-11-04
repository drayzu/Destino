// Ida y vuelta: the film must look the same at a beat however it was reached. For every beat in
// [from, to] (all of it by default) it compares the camera's gaze and the spark on the screen going
// forward, going backward, and jumping there from far away; prints where they differ.
//   node tools/ida-vuelta.mjs [--from 0 --to 449] [--res 0.1]
import { execFileSync } from 'node:child_process';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const FROM = arg('from', '0'), TO = arg('to', 'viaje.total'), RES = arg('res', '0.1');
const expr = `(() => {
  const a = ${FROM}, b = Math.min(${TO}, viaje.total), res = ${RES};
  const bs = []; for (let x = a; x <= b + 1e-9; x += res) bs.push(+x.toFixed(3));
  const mira = (x) => { const s = viaje.enCuadro(x, x, 1); const t = viaje.trayecto(x, x, 1); return [t[4], t[5], t[6], s[1], s[2]]; };
  const ida = bs.map(mira);
  const vuelta = bs.slice().reverse().map(mira).reverse();
  const salto = bs.map((x, i) => { mira(i % 2 ? 0 : viaje.total); return mira(x); });
  const out = [];
  bs.forEach((x, i) => {
    const d = (u, v) => Math.max(Math.acos(Math.min(1, u[0]*v[0] + u[1]*v[1] + u[2]*v[2])) * 57.3, Math.abs(u[3] - v[3]) * 20, Math.abs(u[4] - v[4]) * 20);
    const m = Math.max(d(ida[i], vuelta[i]), d(ida[i], salto[i]));
    if (m > 0.5) out.push([x, +m.toFixed(1)]);
  });
  return out;
})()`;
const r = execFileSync('node', ['tools/eval.mjs', 'viaje', '0', expr], { encoding: 'utf8', maxBuffer: 1 << 26 });
let v = JSON.parse(r); if (typeof v === 'string') v = JSON.parse(v);
console.log(v.length ? `difieren (compás, grados o 1/20 de pantalla): ${v.map(([x, m]) => `${x}:${m}`).join(' ')}` : 'igual en todos los compases');
