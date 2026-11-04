// Plano: a stretch of an act's baked camera (chasis/camaras.json) replaced by a shot of its own,
// written as Tiempo's rig is: a centre it looks at, and where it stands round it (azimuth and
// elevation in degrees, distance as log10), from one pose to another over the stretch. At both ends
// it blends into the camera that was there over `--mezcla` beats, so nothing jumps.
//
//   node tools/plano.mjs despierta 5.6 9.8 --centro 0.6,-0.1,0.5 --az 45 --el 25 --ld 0.25
//        [--az2 60 --el2 20 --ld2 0.2 --centro2 x,y,z] [--fov 40] [--mezcla 0.8]
//
// The act's own units and beats (p inside the act). Keeps a key every 0.25 beats in the shot.
import { readFileSync, writeFileSync } from 'node:fs';

const [acto, desdeS, hastaS] = process.argv.slice(2);
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const desde = Number(desdeS);
const hasta = Number(hastaS);
const v3 = (s) => s.split(',').map(Number);
const C0 = v3(arg('centro', '0,0,0'));
const C1 = v3(arg('centro2', arg('centro', '0,0,0')));
const az0 = Number(arg('az', '0')), az1 = Number(arg('az2', arg('az', '0')));
const el0 = Number(arg('el', '0')), el1 = Number(arg('el2', arg('el', '0')));
const ld0 = Number(arg('ld', '0')), ld1 = Number(arg('ld2', arg('ld', '0')));
const fov = arg('fov', null);
const MEZCLA = Number(arg('mezcla', '0.8'));

const ruta = 'chasis/camaras.json';
const todas = JSON.parse(readFileSync(ruta, 'utf8'));
const c = todas[acto];
if (!c) throw new Error(`no hay cámara para ${acto}`);

// ---- the track as it is (the page's monotone cubic)
function pendientes(P, Y) {
  const n = P.length;
  const m = new Float64Array(n);
  for (let k = 1; k < n - 1; k++) {
    const h0 = P[k] - P[k - 1], h1 = P[k + 1] - P[k];
    if (h0 <= 0 || h1 <= 0) continue;
    const d0 = (Y[k] - Y[k - 1]) / h0, d1 = (Y[k + 1] - Y[k]) / h1;
    if (d0 * d1 <= 0) continue;
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    m[k] = (w1 + w2) / (w1 / d0 + w2 / d1);
  }
  return m;
}
function evaluar(P, Y, m, p) {
  const n = P.length;
  if (p <= P[0]) return Y[0];
  if (p >= P[n - 1]) return Y[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (P[mid] <= p) lo = mid;
    else hi = mid;
  }
  const h = P[hi] - P[lo], t = (p - P[lo]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * Y[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * Y[hi] + (t3 - t2) * h * m[hi];
}
const CANALES = ['x', 'y', 'z', 'qx', 'qy', 'qz', 'qw', 'fov', 'ld', 'lw'];
const M = Object.fromEntries(CANALES.map((k) => [k, pendientes(c.p, c[k])]));
const antes = (p) => Object.fromEntries(CANALES.map((k) => [k, evaluar(c.p, c[k], M[k], p)]));

// ---- the shot
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function quatDe(f, u) {
  const z = norm(f.map((x) => -x)), x = norm(cross(u, z)), y = cross(z, x);
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
  const tr = m00 + m11 + m22;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]; }
  if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11); return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}
const sm = (x) => x * x * (3 - 2 * x);
const D = Math.PI / 180;
function toma(p) {
  const k = sm(Math.min(1, Math.max(0, (p - desde) / (hasta - desde))));
  const C = C0.map((x, i) => x + (C1[i] - x) * k);
  const az = (az0 + (az1 - az0) * k) * D, el = (el0 + (el1 - el0) * k) * D, ld = ld0 + (ld1 - ld0) * k;
  const d = Math.pow(10, ld);
  const pos = [C[0] + Math.sin(az) * Math.cos(el) * d, C[1] + Math.sin(el) * d, C[2] + Math.cos(az) * Math.cos(el) * d];
  const f = norm(C.map((x, i) => x - pos[i]));
  const u = norm([0, 1, 0].map((x, i) => x - f[i] * dot([0, 1, 0], f)));
  const q = quatDe(f, u);
  return { x: pos[0], y: pos[1], z: pos[2], qx: q[0], qy: q[1], qz: q[2], qw: q[3], fov: fov ? Number(fov) : antes(p).fov, ld, lw: 0 };
}
// (the blend at each end: position straight, orientation by slerp, the rest straight)
function mezclar(a, b, w) {
  const out = {};
  for (const k of ['x', 'y', 'z', 'fov', 'ld', 'lw']) out[k] = a[k] + (b[k] - a[k]) * w;
  let qa = [a.qx, a.qy, a.qz, a.qw], qb = [b.qx, b.qy, b.qz, b.qw];
  let d = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3];
  if (d < 0) { qb = qb.map((x) => -x); d = -d; }
  let q;
  if (d > 0.9995) q = qa.map((x, i) => x + (qb[i] - x) * w);
  else {
    const th = Math.acos(d), s = Math.sin(th);
    q = qa.map((x, i) => (x * Math.sin((1 - w) * th) + qb[i] * Math.sin(w * th)) / s);
  }
  const l = Math.hypot(...q);
  [out.qx, out.qy, out.qz, out.qw] = q.map((x) => x / l);
  return out;
}
const pose = (p) => {
  if (p <= desde - MEZCLA || p >= hasta + MEZCLA) return antes(p);
  if (p < desde) return mezclar(antes(p), toma(desde), sm((p - (desde - MEZCLA)) / MEZCLA));
  if (p > hasta) return mezclar(toma(hasta), antes(p), sm((p - hasta) / MEZCLA));
  return toma(p);
};

// ---- the new keys: the old ones outside, the shot's (and its blends) inside
const a0 = desde - MEZCLA, a1 = hasta + MEZCLA;
const ps = c.p.filter((p) => p < a0 || p > a1);
for (let p = a0; p <= a1 + 1e-9; p += 0.1) ps.push(Number(p.toFixed(4)));
ps.sort((x, y) => x - y);
const nuevo = { p: ps };
for (const k of CANALES) nuevo[k] = [];
let prev = null;
for (const p of ps) {
  const v = pose(p);
  if (prev && v.qx * prev.qx + v.qy * prev.qy + v.qz * prev.qz + v.qw * prev.qw < 0) for (const k of ['qx', 'qy', 'qz', 'qw']) v[k] = -v[k];
  prev = v;
  for (const k of CANALES) nuevo[k].push(['x', 'y', 'z'].includes(k) ? Number(v[k].toPrecision(15)) : Number(v[k].toPrecision(7)));
}
todas[acto] = nuevo;
writeFileSync(ruta, JSON.stringify(todas));
console.log(`${acto}: plano en ${desde}–${hasta} (mezcla ${MEZCLA}), ${ps.length} claves`);
