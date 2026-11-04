// Evaluates an expression on the new chassis's page (headless Chrome with the GPU), after it is ready.
//   node tools/chasis.mjs "viaje.costuras()"      (PUERTO=5213 by default; CDP=93xx for a second one)
import { execFileSync } from 'node:child_process';
const expr = process.argv[2];
process.stdout.write(execFileSync('node', [new URL('./eval.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), 'viaje', '0', expr], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, PUERTO: process.env.PUERTO ?? '5213' } }));
