// Side by side: the reference (before) and the new chassis (after), frame by frame, for chosen beats.
// Both folders hold frames named by beat (tools/referencia.mjs). Each row: before | after.
//
//   node tools/comparar.mjs docs/chasis/referencia docs/chasis/nuevo docs/chasis/comparar.jpg 4 8 12 30
//   (--ancho 480 for each frame)
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const i = args.indexOf('--ancho');
const ancho = i < 0 ? 480 : Number(args.splice(i, 2)[1]);
const [a, b, out, ...beats] = args;
const nombre = (d, x) => join(d, `${Number(x).toFixed(2).padStart(7, '0')}.jpg`);
const filas = beats.filter((x) => existsSync(nombre(a, x)) && existsSync(nombre(b, x)));
if (!filas.length) throw new Error('no hay cuadros para esos compases');
const inputs = filas.flatMap((x) => ['-i', nombre(a, x), '-i', nombre(b, x)]);
// (each pair scaled, labelled with its beat on the left, stacked side by side; then the rows stacked)
const partes = filas.map((x, k) => `[${2 * k}:v]scale=${ancho}:-2,drawtext=text='${x}  antes':x=10:y=10:fontcolor=white:fontsize=18:box=1:boxcolor=black@0.5[a${k}];[${2 * k + 1}:v]scale=${ancho}:-2,drawtext=text='después':x=10:y=10:fontcolor=white:fontsize=18:box=1:boxcolor=black@0.5[b${k}];[a${k}][b${k}]hstack[f${k}]`);
const filtro = `${partes.join(';')};${filas.map((_, k) => `[f${k}]`).join('')}vstack=inputs=${filas.length}[o]`;
const script = join(tmpdir(), 'comparar-filtro.txt');
writeFileSync(script, filas.length > 1 ? filtro : filtro.replace(`;[f0]vstack=inputs=1[o]`, '').replace('[f0]', '[o]'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex_script', script, '-map', '[o]', '-frames:v', '1', '-q:v', '3', out]);
console.log(`${filas.length} filas en ${out}`);
