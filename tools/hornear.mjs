// Hornear: the film's camera baked into keys (CHASIS.md), as Tiempo's is: per act, flowing tracks
// of position, orientation, fov, distance to what it frames, and how much it follows the spark.
//
// From the camera as the page has it now (viaje.muestras: every 0.02 beats), it
// 1. turns no faster than TOPE degrees a beat: where the gaze turns faster, it is smoothed in time
//    (a bell that widens only there), along the whole chain of acts (not across a cut), so a seam
//    stays continuous;
// 2. keeps only the keys it needs: a key every beat, and more where the track rebuilt from them
//    strays from the camera by more than the tolerances (a fraction of a degree, a fraction of a
//    percent of its distance).
// Writes chasis/camaras.json. The positions are not smoothed (they never jumped); only the gaze.
//
//   node tools/hornear.mjs [--muestras file.json] [--tope 110]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const TOPE = Number(arg('tope', '110'));
const H = 0.02;

let actos;
const fichero = arg('muestras', null);
const ficheroCh = arg('chispas', null);
if (fichero) actos = JSON.parse(readFileSync(fichero, 'utf8'));
else {
  const out = execFileSync('node', ['tools/eval.mjs', 'viaje', '0', 'viaje.muestras(0.02)'], { encoding: 'utf8', maxBuffer: 1 << 30 });
  actos = JSON.parse(out.trim().split('\n').pop());
  if (typeof actos === 'string') actos = JSON.parse(actos);
}

const chispas = ficheroCh ? JSON.parse(readFileSync(ficheroCh, 'utf8')) : null;
/** A base bell under every sample (beats): it irons out jitter shorter than a tenth of a beat. */
const BASE = 0.05;

// ---------------------------------------------------------------- small vector helpers
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ang = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * 180) / Math.PI;
/** A rotation's quaternion from the gaze and up (three's camera: looks down −Z, up +Y). */
function quatDe(f, u) {
  const z = norm([-f[0], -f[1], -f[2]]);
  const x = norm(cross(u, z));
  const y = cross(z, x);
  const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2];
  const tr = m00 + m11 + m22;
  let w, qx, qy, qz;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    w = 0.25 / s; qx = (m21 - m12) * s; qy = (m02 - m20) * s; qz = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s; qx = 0.25 * s; qy = (m01 + m10) / s; qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s; qx = (m01 + m10) / s; qy = 0.25 * s; qz = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s; qx = (m02 + m20) / s; qy = (m12 + m21) / s; qz = 0.25 * s;
  }
  return [qx, qy, qz, w];
}
const rotar = (q, v) => {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};

// ---------------------------------------------------------------- 1. the gaze, no faster than TOPE
// The chains: acts between cuts, one continuous series of gazes in time.
const cadenas = new Map();
for (const a of actos) {
  const n = a.s.length / 13;
  a.n = n;
  if (!cadenas.has(a.cadena)) cadenas.set(a.cadena, []);
  cadenas.get(a.cadena).push(a);
}
let antes = 0;
let despues = 0;
for (const lista of cadenas.values()) {
  // (one series: each act's samples, its last one dropped where the next act starts at the same beat)
  const serie = [];
  for (const [k, a] of lista.entries()) {
    const ultimo = k < lista.length - 1 ? a.n - 1 : a.n;
    for (let i = 0; i < ultimo; i++) serie.push({ a, i, t: a.inicio + a.s[i * 13] });
    if (k < lista.length - 1) a.ultimoComparte = true;
  }
  const N = serie.length;
  const F = serie.map(({ a, i }) => [a.s[i * 13 + 4], a.s[i * 13 + 5], a.s[i * 13 + 6]]);
  const U = serie.map(({ a, i }) => [a.s[i * 13 + 7], a.s[i * 13 + 8], a.s[i * 13 + 9]]);
  const vel = (G) => G.map((g, i) => (i + 1 < N ? ang(g, G[i + 1]) / Math.max(1e-6, serie[i + 1].t - serie[i].t) : 0));
  antes = Math.max(antes, ...vel(F));
  // A bell per sample, wider where the gaze turns too fast, widened again until it no longer does.
  let sig = new Float64Array(N).fill(BASE);
  let G = F;
  let V = U;
  for (let pasada = 0; pasada < 14; pasada++) {
    const v = vel(G);
    let algo = pasada === 0;
    for (let i = 0; i < N; i++) {
      if (v[i] > TOPE) {
        algo = true;
        // (around the fast stretch, over about the time the turn would need at TOPE)
        const s = Math.min(1.2, Math.max(sig[i], 0.04) * (1 + Math.min(1.5, (v[i] - TOPE) / TOPE)) + 0.03);
        for (let j = Math.max(0, i - 40); j < Math.min(N, i + 41); j++) sig[j] = Math.max(sig[j], s * Math.exp(-0.5 * ((serie[j].t - serie[i].t) / 0.4) ** 2));
      }
    }
    if (!algo) break;
    const G2 = [];
    const V2 = [];
    for (let i = 0; i < N; i++) {
      const s = sig[i];
      if (s < 0.005) {
        G2.push(F[i]);
        V2.push(U[i]);
        continue;
      }
      const g = [0, 0, 0];
      const u = [0, 0, 0];
      const r = Math.ceil((3 * s) / H);
      for (let j = Math.max(0, i - r); j <= Math.min(N - 1, i + r); j++) {
        const w = Math.exp(-0.5 * ((serie[j].t - serie[i].t) / s) ** 2);
        g[0] += F[j][0] * w; g[1] += F[j][1] * w; g[2] += F[j][2] * w;
        u[0] += U[j][0] * w; u[1] += U[j][1] * w; u[2] += U[j][2] * w;
      }
      const gn = norm(g);
      const un = norm(u.map((x, k) => x - gn[k] * dot(u, gn)));
      G2.push(gn);
      V2.push(un);
    }
    G = G2;
    V = V2;
  }
  // The spark kept in frame where the camera rides it: where the smoothed gaze would leave it near an
  // edge, the gaze turns back just enough (a soft knee per axis), the turns themselves smoothed in
  // time so the spark's own hops are not copied, and let go where it passes the camera.
  if (chispas) {
    const ASPECTO = 16 / 9;
    const gx = new Float64Array(N);
    const gy = new Float64Array(N);
    const rod = (n) => {
      const a = Math.abs(n);
      return a <= 0.5 ? n : Math.sign(n) * (0.5 + 0.25 * Math.tanh((a - 0.5) / 0.25));
    };
    for (let k = 0; k < N; k++) {
      const { a, i } = serie[k];
      const ch = chispas[actos.indexOf(a)];
      const luz = ch[i * 5 + 4];
      const lw = a.s[i * 13 + 12];
      if (luz < 0.05 || lw < 0.05) continue;
      const P = [a.s[i * 13 + 1], a.s[i * 13 + 2], a.s[i * 13 + 3]];
      const d = [ch[i * 5 + 1] - P[0], ch[i * 5 + 2] - P[1], ch[i * 5 + 3] - P[2]];
      const g = G[k];
      const u = V[k];
      const r = norm(cross(g, u));
      const vx = dot(d, r);
      const vy = dot(d, u);
      const vz = dot(d, g);
      if (vz <= 0) continue;
      const ty = Math.tan((a.s[i * 13 + 10] * Math.PI) / 360);
      const tx = ty * ASPECTO;
      const semi = Math.atan(Math.hypot(tx, ty));
      const fuera = Math.acos(Math.max(-1, Math.min(1, vz / Math.hypot(vx, vy, vz))));
      const w = Math.min(1, lw) * (1 - Math.min(1, Math.max(0, (fuera - 1.6 * semi) / 0.5)));
      if (w <= 0) continue;
      const ax = Math.atan2(vx, vz);
      const ay = Math.atan2(vy, vz);
      gx[k] = (ax - Math.atan(rod(Math.tan(ax) / tx) * tx)) * w;
      gy[k] = (ay - Math.atan(rod(Math.tan(ay) / ty) * ty)) * w;
    }
    // (smoothed in time: a bell of 0.25 beats)
    const S = 0.15;
    const R = Math.ceil((3 * S) / H);
    for (let k = 0; k < N; k++) {
      let sx = 0, sy = 0, sw = 0;
      for (let j = Math.max(0, k - R); j <= Math.min(N - 1, k + R); j++) {
        const w = Math.exp(-0.5 * ((serie[j].t - serie[k].t) / S) ** 2);
        sx += gx[j] * w;
        sy += gy[j] * w;
        sw += w;
      }
      const cx = sx / sw;
      const cy = sy / sw;
      if (Math.abs(cx) + Math.abs(cy) < 1e-7) continue;
      // turn the gaze by yaw cx (round up) and pitch cy (round right)
      const g = G[k];
      const u = V[k];
      const r = norm(cross(g, u));
      const cyw = Math.cos(cx), syw = Math.sin(cx);
      let g2 = norm([g[0] * cyw + r[0] * syw, g[1] * cyw + r[1] * syw, g[2] * cyw + r[2] * syw]);
      const r2 = norm(cross(g2, u));
      const cp = Math.cos(cy), sp = Math.sin(cy);
      const g3 = norm([g2[0] * cp + u[0] * sp, g2[1] * cp + u[1] * sp, g2[2] * cp + u[2] * sp]);
      const u3 = norm(cross(r2, g3));
      G[k] = g3;
      V[k] = u3;
    }
  }
  despues = Math.max(despues, ...vel(G));
  for (const [k, { a, i }] of serie.entries()) {
    a.s[i * 13 + 4] = G[k][0]; a.s[i * 13 + 5] = G[k][1]; a.s[i * 13 + 6] = G[k][2];
    a.s[i * 13 + 7] = V[k][0]; a.s[i * 13 + 8] = V[k][1]; a.s[i * 13 + 9] = V[k][2];
  }
  // (an act's last sample is the next act's first: the same gaze)
  for (const [k, a] of lista.entries()) {
    if (k === lista.length - 1) continue;
    const b = lista[k + 1];
    for (let c = 4; c < 10; c++) a.s[(a.n - 1) * 13 + c] = b.s[c];
  }
}

// ---------------------------------------------------------------- 2. the keys
// The page's own interpolation (estudios/timeline.ts): monotone cubic through the keys.
function pendientes(P, Y) {
  const n = P.length;
  const m = new Float64Array(n);
  for (let k = 1; k < n - 1; k++) {
    const h0 = P[k] - P[k - 1];
    const h1 = P[k + 1] - P[k];
    if (h0 <= 0 || h1 <= 0) continue;
    const d0 = (Y[k] - Y[k - 1]) / h0;
    const d1 = (Y[k + 1] - Y[k]) / h1;
    if (d0 * d1 <= 0) continue;
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    m[k] = (w1 + w2) / (w1 / d0 + w2 / d1);
  }
  return m;
}
function evaluar(P, Y, m, p) {
  if (p <= P[0]) return Y[0];
  const n = P.length;
  if (p >= P[n - 1]) return Y[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (P[mid] <= p) lo = mid;
    else hi = mid;
  }
  const h = P[hi] - P[lo];
  const t = (p - P[lo]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * Y[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * Y[hi] + (t3 - t2) * h * m[hi];
}
const CANALES = ['x', 'y', 'z', 'qx', 'qy', 'qz', 'qw', 'fov', 'ld', 'lw'];
const salida = {};
let claves = 0;
for (const a of actos) {
  const n = a.n;
  const ps = [];
  const val = Object.fromEntries(CANALES.map((c) => [c, []]));
  let qPrev = null;
  for (let i = 0; i < n; i++) {
    const o = i * 13;
    ps.push(a.s[o]);
    let q = quatDe([a.s[o + 4], a.s[o + 5], a.s[o + 6]], [a.s[o + 7], a.s[o + 8], a.s[o + 9]]);
    if (qPrev && q[0] * qPrev[0] + q[1] * qPrev[1] + q[2] * qPrev[2] + q[3] * qPrev[3] < 0) q = q.map((x) => -x);
    qPrev = q;
    val.x.push(a.s[o + 1]); val.y.push(a.s[o + 2]); val.z.push(a.s[o + 3]);
    val.qx.push(q[0]); val.qy.push(q[1]); val.qz.push(q[2]); val.qw.push(q[3]);
    val.fov.push(a.s[o + 10]); val.ld.push(Math.log10(Math.max(a.s[o + 11], 1e-300))); val.lw.push(a.s[o + 12]);
  }
  // Keys: one every beat, then more where the rebuilt camera strays.
  const elegidas = new Set([0, n - 1]);
  for (let i = 0; i < n; i++) if (Math.abs(ps[i] - Math.round(ps[i])) < H / 2) elegidas.add(i);
  for (let ronda = 0; ronda < 40; ronda++) {
    const idx = [...elegidas].sort((x, y) => x - y);
    const P = idx.map((i) => ps[i]);
    const recon = {};
    for (const c of CANALES) {
      const Y = idx.map((i) => val[c][i]);
      recon[c] = { Y, m: pendientes(P, Y) };
    }
    const nuevas = [];
    for (let k = 0; k + 1 < idx.length; k++) {
      let peor = 0;
      let donde = -1;
      for (let i = idx[k] + 1; i < idx[k + 1]; i++) {
        const p = ps[i];
        const r = (c) => evaluar(P, recon[c].Y, recon[c].m, p);
        const q = [r('qx'), r('qy'), r('qz'), r('qw')];
        const ql = Math.hypot(...q);
        const qn = q.map((x) => x / ql);
        const qo = [val.qx[i], val.qy[i], val.qz[i], val.qw[i]];
        const eF = ang(rotar(qn, [0, 0, -1]), rotar(qo, [0, 0, -1])) / 0.25;
        const eU = ang(rotar(qn, [0, 1, 0]), rotar(qo, [0, 1, 0])) / 0.5;
        const d = Math.pow(10, val.ld[i]);
        const eP = Math.hypot(r('x') - val.x[i], r('y') - val.y[i], r('z') - val.z[i]) / Math.max(d, 1e-300) / 0.004;
        const eL = Math.abs(r('ld') - val.ld[i]) / 0.004;
        const eV = Math.abs(r('fov') - val.fov[i]) / 0.1;
        const eW = Math.abs(r('lw') - val.lw[i]) / 0.05;
        const e = Math.max(eF, eU, eP, eL, eV, eW);
        if (e > peor) {
          peor = e;
          donde = i;
        }
      }
      if (peor > 1 && donde >= 0) nuevas.push(donde);
    }
    if (!nuevas.length) break;
    for (const i of nuevas) elegidas.add(i);
  }
  const idx = [...elegidas].sort((x, y) => x - y);
  claves += idx.length;
  // (positions with all their digits: a camera a ten-thousandth from a spark a galaxy away)
  const fx = (v, c) => (['x', 'y', 'z'].includes(c) ? Number(v.toPrecision(15)) : Number(v.toPrecision(7)));
  salida[a.id] = { p: idx.map((i) => Number(ps[i].toFixed(4))), ...Object.fromEntries(CANALES.map((c) => [c, idx.map((i) => fx(val[c][i], c))])) };
}
writeFileSync('chasis/camaras.json', JSON.stringify(salida));
console.log(`giro máximo antes ${antes.toFixed(0)}°/compás, después ${despues.toFixed(0)}°/compás (tope ${TOPE}); ${claves} claves en ${actos.length} actos`);
