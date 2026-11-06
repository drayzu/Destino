// Huella: the whole film's fingerprint, to check a refactor changed nothing. The camera every 0.05
// beats (exact numbers) and a 96 × 54 thumbnail of the picture every `paso` beats (the clock fixed),
// into a JSON. With a second file, compares: the camera's biggest difference and the beats whose
// picture differs by more than a few levels.
//   node tools/huella.mjs guardar docs/chasis/huella-antes.json [--paso 0.5]
//   node tools/huella.mjs comparar docs/chasis/huella-antes.json docs/chasis/huella-despues.json
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const [modo, a, b] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };

if (modo === 'guardar') {
  const PASO = arg('paso', '0.5');
  const expr = `(() => {
    const cam = viaje.trayecto(0, viaje.total - 0.01, 0.05);
    const c = document.querySelector('#scene');
    const s = document.createElement('canvas'); s.width = 96; s.height = 54;
    const g = s.getContext('2d', { willReadFrequently: true });
    const fotos = [];
    for (let x = 0; x < viaje.total - 0.01; x += ${PASO}) {
      for (let k = 0; k < 3; k++) viaje.dibujar(x, 1000);
      g.drawImage(c, 0, 0, 96, 54);
      const d = g.getImageData(0, 0, 96, 54).data;
      let t = '';
      for (let i = 0; i < d.length; i += 4) t += String.fromCharCode(d[i], d[i + 1], d[i + 2]);
      fotos.push([+x.toFixed(3), btoa(t)]);
    }
    return { total: viaje.total, cam, fotos };
  })()`;
  const url = new URL('./chasis.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const out = execFileSync('node', [url, expr], { encoding: 'utf8', maxBuffer: 1 << 30 });
  const j = JSON.parse(out.trim().split('\n').pop());
  writeFileSync(a, JSON.stringify(j));
  console.log(`total ${j.total}, ${j.cam.length / 12} cámaras, ${j.fotos.length} cuadros → ${a}`);
} else if (modo === 'comparar') {
  const A = JSON.parse(readFileSync(a, 'utf8'));
  const B = JSON.parse(readFileSync(b, 'utf8'));
  if (A.total !== B.total) console.log(`largo distinto: ${A.total} → ${B.total}`);
  let peor = 0, en = 0;
  for (let i = 0; i < Math.min(A.cam.length, B.cam.length); i++) {
    const d = Math.abs(A.cam[i] - B.cam[i]) / Math.max(1e-12, Math.abs(A.cam[i]), Math.abs(B.cam[i]));
    if (d > peor) { peor = d; en = A.cam[i - (i % 12)]; }
  }
  console.log(`cámara: diferencia relativa máx ${peor.toExponential(2)} (compás ${en})`);
  const fb = new Map(B.fotos);
  const malos = [];
  for (const [x, f] of A.fotos) {
    const g = fb.get(x);
    if (!g) continue;
    const p = Buffer.from(f, 'base64'), q = Buffer.from(g, 'base64');
    let m = 0, s = 0;
    for (let i = 0; i < p.length; i++) { const d = Math.abs(p[i] - q[i]); m = Math.max(m, d); s += d; }
    if (m > 6) malos.push([x, m, +(s / p.length).toFixed(2)]);
  }
  console.log(`cuadros distintos (>6 niveles): ${malos.length} de ${A.fotos.length}`);
  for (const [x, m, s] of malos.slice(0, 40)) console.log(`  ${x}: máx ${m}, medio ${s}`);
  process.exitCode = peor > 1e-6 || malos.length ? 1 : 0;
}
