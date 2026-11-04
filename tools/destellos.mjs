// Destellos: the guard on the picture itself (CHASIS.md). Over the whole film every 0.05 beats it
// draws a small frame and measures how much it changed from the one before; with the camera baked
// smooth, a change much bigger than its neighbours' is something that pops in or out, a flash or a
// black frame. Prints each one with its beat, worst first. (Dev server on 5213; a few minutes.)
//
//   node tools/destellos.mjs [--desde 0 --hasta 449] [--paso 0.05] [--umbral 3.5]
import { execFileSync } from 'node:child_process';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const DESDE = Number(arg('desde', '0'));
const PASO = Number(arg('paso', '0.05'));
const UMBRAL = Number(arg('umbral', '3.5'));
const total = (() => {
  const r = execFileSync('node', ['tools/eval.mjs', 'viaje', '0', 'viaje.total'], { encoding: 'utf8' });
  return Number(JSON.parse(r.trim().split('\n').pop()));
})();
const HASTA = Math.min(Number(arg('hasta', String(total))), total - 0.01);
const datos = [];
// (in stretches of 60 beats: each a page load, so none runs too long)
for (let a = DESDE; a < HASTA; a += 60) {
  const b = Math.min(HASTA, a + 60);
  const r = execFileSync('node', ['tools/eval.mjs', 'viaje', '0', `viaje.imagen(${a}, ${b}, ${PASO})`], { encoding: 'utf8', maxBuffer: 1 << 28 });
  let v = JSON.parse(r.trim().split('\n').pop());
  if (typeof v === 'string') v = JSON.parse(v);
  for (let i = 0; i < v.length; i += 3) if (!(datos.length && Math.abs(datos[datos.length - 1][0] - v[i]) < 1e-6)) datos.push([v[i], v[i + 1], v[i + 2]]);
  process.stderr.write(`${b.toFixed(0)} `);
}
process.stderr.write('\n');
const n = datos.length;
const fallos = [];
for (let i = 2; i < n; i++) {
  const [b, d, luz] = datos[i];
  const vecinos = [];
  for (let j = Math.max(1, i - 8); j <= Math.min(n - 1, i + 8); j++) if (Math.abs(j - i) > 1) vecinos.push(datos[j][1]);
  vecinos.sort((x, y) => x - y);
  const mediana = vecinos[vecinos.length >> 1] ?? 0;
  if (d > UMBRAL * Math.max(mediana, 0.4) && d > 1.5) fallos.push([b, d, mediana, 'cambia de golpe']);
  if (luz < 0.5 && datos[i - 1][2] > 4) fallos.push([b, luz, datos[i - 1][2], 'cuadro negro']);
}
fallos.sort((x, y) => y[1] / Math.max(y[2], 0.4) - x[1] / Math.max(x[2], 0.4));
console.log(`${n} cuadros cada ${PASO} compases`);
if (!fallos.length) console.log('nada aparece ni se apaga de golpe');
for (const [b, d, m, que] of fallos) console.log(`${b.toFixed(2).padStart(8)}  ${que}  ${d.toFixed(1)} (alrededor ${m.toFixed(1)})`);
process.exit(fallos.length ? 1 : 0);
