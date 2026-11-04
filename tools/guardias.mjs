// The guards (CHASIS.md): what every change must pass before it is committed. Against the chassis's
// dev server (5213), headless; no drawing for most of it (the camera is a function of the beat).
//
//   node tools/guardias.mjs [--desde 0 --hasta 74] [--paso 0.02]
//
// 1. The camera: no jumps of place or gaze (a step much bigger than the steps either side), no jolts
//    (the turn speeding up or slowing at once), no turn faster than TOPE_GIRO degrees per beat.
// 2. The spark in frame while the camera rides it.
// 3. What each act shows and hides comes and goes no faster than FUNDIDO_MIN beats.
// 4. The seams: a cut only under the last act's full cover.
// Exit code 1 if any fails.
import { execFileSync } from 'node:child_process';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const DESDE = arg('desde', '0');
const HASTA = arg('hasta', '1e9');
const PASO = Number(arg('paso', '0.02'));
const TOPE_GIRO = 150; // degrees per beat (the old film reached ~200 in places)
const run = (expr) => {
  const out = execFileSync('node', [new URL('./chasis.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), expr], { encoding: 'utf8', maxBuffer: 1 << 28 });
  let v = JSON.parse(out.trim().split('\n').pop());
  if (typeof v === 'string') v = JSON.parse(v);
  return v;
};
const r = run(`(() => ({
  total: viaje.total,
  mov: viaje.movimiento(${DESDE}, Math.min(${HASTA}, viaje.total), ${PASO}),
  cuadro: viaje.enCuadro(${DESDE}, Math.min(${HASTA}, viaje.total), 0.05),
  pres: viaje.presencias(),
  cost: viaje.costuras(),
  tramos: viaje.tramos(),
}))()`);
const fallos = [];
const acto = (b) => {
  let s = r.tramos[0][0];
  for (const t of r.tramos) if (b >= t[2]) s = t[0];
  return s;
};
// 1. The camera.
const m = r.mov;
const n = m.length / 5;
const at = (i) => m[i * 5];
const mov = (i) => m[i * 5 + 1];
const giro = (i) => m[i * 5 + 2];
const cortes = r.cost.filter((c) => c.tipo === 'corte').map((c) => c.en);
const enCorte = (b) => cortes.some((c) => Math.abs(b - c) < PASO * 1.5);
let maxGiro = 0;
let dondeMax = 0;
for (let i = 2; i < n - 2; i++) {
  const b = at(i);
  if (enCorte(b)) continue;
  const g = giro(i) / PASO;
  if (g > maxGiro) {
    maxGiro = g;
    dondeMax = b;
  }
  const mv = Math.max(mov(i - 1), mov(i + 1), mov(i - 2), mov(i + 2));
  if (mov(i) > 2.2 * mv && mov(i) > 0.004) fallos.push([b, acto(b), 'salto de lugar', +(mov(i) / Math.max(mv, 1e-9)).toFixed(1)]);
  const gv = Math.max(giro(i - 1), giro(i + 1), giro(i - 2), giro(i + 2));
  if (giro(i) > 2.2 * gv && giro(i) > 0.4) fallos.push([b, acto(b), 'salto de mirada', +(giro(i) / Math.max(gv, 1e-9)).toFixed(1)]);
  const acc = Math.abs(giro(i) - giro(i - 1));
  if (acc > 1.2 && acc > 3 * Math.max(Math.abs(giro(i - 1) - giro(i - 2)), Math.abs(giro(i + 1) - giro(i)), 0.15)) fallos.push([b, acto(b), 'tirón de mirada', +acc.toFixed(1)]);
  if (g > TOPE_GIRO) fallos.push([b, acto(b), 'giro muy rápido (°/compás)', +g.toFixed(0)]);
}
// 2. The spark in frame while ridden.
const c = r.cuadro;
let montados = 0;
let fuera = 0;
for (let i = 0; i < c.length; i += 4) {
  if (c[i + 3] < 0.9 || !Number.isFinite(c[i + 1])) continue;
  montados++;
  if (Math.abs(c[i + 1]) > 0.92 || Math.abs(c[i + 2]) > 0.92) {
    fuera++;
    fallos.push([c[i], acto(c[i]), 'chispa fuera de cuadro (montada)', `${c[i + 1]},${c[i + 2]}`]);
  }
}
// 3. Presences.
for (const [a, nombre, b, pend] of r.pres) fallos.push([b, a, `«${nombre}» aparece o se va de golpe`, pend]);
// 4. Seams.
for (const s of r.cost) if (s.tipo === 'corte' && s.tapa < 0.98) fallos.push([s.en, s.a, 'corte sin tapa', s.tapa]);

// (one report per place and kind)
const uno = [];
for (const e of fallos) if (!uno.some((u) => Math.abs(u[0] - e[0]) < 0.1 && u[2] === e[2])) uno.push(e);
console.log(`cámara: ${n} pasos de ${PASO}; giro máximo ${maxGiro.toFixed(1)}°/compás en ${dondeMax.toFixed(2)} (${acto(dondeMax)})`);
console.log(`chispa: ${montados} muestras montada, ${fuera} fuera de cuadro`);
console.log(`costuras: ${r.cost.map((s) => `${s.de}→${s.a} ${s.tipo} en ${s.en}`).join(' · ')}`);
if (uno.length) {
  console.log(`\n${uno.length} fallo(s):`);
  for (const e of uno) console.log(`${String(e[0]).padStart(8)}  ${e[1].padEnd(10)} ${e[2]}  ${e[3]}`);
  process.exit(1);
}
console.log('\ntodo en orden');
