// Revisión: the whole film checked by itself, so Diego does not have to find the bugs.
//
// It plays the film forward in small steps (the clock still: only the scroll moves things) and reads
// each frame back as 16×9 blocks. Then it looks for:
//   (blocks of 16×9, each the mean of its area: a star crossing one moves nothing)
//   - salto: a block that changes at once in one step while it hardly changed in the steps either side
//     (something popping in or out, a cut, a jump);
//   - parpadeo: a block that goes one way and straight back (a blink);
//   - negro / quemado: a frame much darker or brighter than the ones round it.
// And, from the camera alone: tirón (the gaze's turn speeding up or slowing at once).
// It writes docs/remake/revision/revision.json and a sheet, revision.jpg: each flagged moment as the
// frames before, at and after it, the block that moved boxed in red.
//
//   node tools/revision.mjs [--from 0 --to 449] [--paso 0.05] [--top 40]
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const FROM = arg('from', '0'), TO = arg('to', '1e9'), PASO = arg('paso', '0.05'), TOP = Number(arg('top', 40));
const expr = `(async () => {
  const a = ${FROM}, b = Math.min(${TO}, viaje.total - 0.06), D = ${PASO};
  const c = document.querySelector('#scene');
  const BW = 16, BH = 9, NB = BW * BH;
  const m = document.createElement('canvas'); m.width = 192; m.height = 108;
  const mg = m.getContext('2d');
  const s = document.createElement('canvas'); s.width = BW; s.height = BH;
  const g = s.getContext('2d', { willReadFrequently: true });
  const bs = []; for (let x = a; x <= b + 1e-9; x += D) bs.push(+x.toFixed(3));
  const L = new Float32Array(bs.length * NB);
  viaje.dibujar(Math.max(0, a - D), 1000);
  bs.forEach((x, i) => {
    viaje.dibujar(x, 1000);
    // (in two steps, so each block is the mean of its area, not a few of its pixels)
    mg.drawImage(c, 0, 0, 192, 108);
    g.drawImage(m, 0, 0, BW, BH);
    const d = g.getImageData(0, 0, BW, BH).data;
    for (let k = 0; k < NB; k++) L[i * NB + k] = (d[k * 4] + d[k * 4 + 1] + d[k * 4 + 2]) / 3;
  });
  const ev = [];
  const media = bs.map((_, i) => { let m = 0; for (let k = 0; k < NB; k++) m += L[i * NB + k]; return m / NB; });
  for (let i = 2; i < bs.length - 2; i++) {
    let best = 0, bk = 0, tipo = '';
    for (let k = 0; k < NB; k++) {
      const v = (j) => L[j * NB + k];
      const d0 = v(i) - v(i - 1), dm = v(i - 1) - v(i - 2), dp = v(i + 1) - v(i);
      // (a step: this change, past the bigger of the changes either side)
      const salto = Math.abs(d0) - Math.max(Math.abs(dm), Math.abs(dp));
      // (a blink: there and straight back)
      const ida = d0 * dp < 0 ? Math.min(Math.abs(d0), Math.abs(dp)) - Math.abs(dm) : 0;
      if (salto > best) { best = salto; bk = k; tipo = 'salto'; }
      if (ida > best) { best = ida; bk = k; tipo = 'parpadeo'; }
    }
    if (best > 6) ev.push({ b: bs[i], tipo, f: +best.toFixed(1), x: bk % BW, y: Math.floor(bk / BW) });
    const m0 = media[i], mr = (media[i - 2] + media[i + 2]) / 2;
    if (mr > 4 && (m0 < mr * 0.55 || m0 > mr * 1.8)) ev.push({ b: bs[i], tipo: m0 < mr ? 'negro' : 'quemado', f: +(Math.abs(m0 - mr)).toFixed(1), x: -1, y: -1 });
  }
  // The camera: its turn per step, and where that turn changes at once.
  const r = viaje.trayecto(a, b, D);
  const dir = []; for (let i = 0; i < r.length; i += 12) dir.push([r[i], r[i + 4], r[i + 5], r[i + 6]]);
  const ang = (p, q) => Math.acos(Math.min(1, p[1] * q[1] + p[2] * q[2] + p[3] * q[3])) * 57.3;
  const giro = dir.map((p, i) => i ? ang(dir[i - 1], p) : 0);
  for (let i = 2; i < giro.length - 1; i++) {
    const acc = Math.abs(giro[i] - giro[i - 1]);
    if (acc > 1.5 && acc > 2.5 * Math.max(Math.abs(giro[i - 1] - giro[i - 2]), Math.abs(giro[i + 1] - giro[i]), 0.3)) ev.push({ b: +dir[i][0].toFixed(3), tipo: 'tirón', f: +acc.toFixed(1), x: -1, y: -1 });
  }
  // Merged: one event per moment (within a third of a beat), the strongest.
  ev.sort((p, q) => q.f - p.f);
  const uno = [];
  for (const e of ev) if (!uno.some((u) => Math.abs(u.b - e.b) < 0.34)) uno.push(e);
  const top = uno.slice(0, ${TOP}).sort((p, q) => p.b - q.b);
  // The sheet.
  const tw = 300, th = Math.round(tw * c.height / c.width), cols = 3;
  const out = document.createElement('canvas'); out.width = tw * cols + 150; out.height = th * top.length;
  const o = out.getContext('2d');
  o.fillStyle = '#000'; o.fillRect(0, 0, out.width, out.height);
  const tramos = viaje.tramos();
  const acto = (x) => { let n = tramos[0][0]; for (const t of tramos) if (x >= t[2]) n = t[0]; return n; };
  top.forEach((e, row) => {
    [-D, 0, D].forEach((dx, col) => {
      viaje.dibujar(Math.max(0, e.b - 2 * D), 1000); viaje.dibujar(e.b + dx, 1000);
      o.drawImage(c, 150 + col * tw, row * th, tw, th);
      if (e.x >= 0) { o.strokeStyle = '#ff3b3b'; o.lineWidth = 2; o.strokeRect(150 + col * tw + e.x * tw / BW, row * th + e.y * th / BH, tw / BW, th / BH); }
    });
    o.fillStyle = '#ece7db'; o.font = '600 16px monospace'; o.fillText(e.b.toFixed(2), 10, row * th + 24);
    o.font = '13px monospace'; o.fillText(e.tipo + ' ' + e.f, 10, row * th + 44); o.fillText(acto(e.b), 10, row * th + 62);
  });
  const blob = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.86));
  await fetch('/__guardar?f=' + encodeURIComponent('docs/remake/revision/revision.jpg'), { method: 'POST', body: blob });
  return { muestras: bs.length, eventos: ev.length, top: top.map((e) => ({ ...e, acto: acto(e.b) })) };
})()`;
const r = execFileSync('node', ['tools/eval.mjs', 'viaje', '0', expr], { encoding: 'utf8', maxBuffer: 1 << 26 });
let v = JSON.parse(r); if (typeof v === 'string') v = JSON.parse(v);
writeFileSync('docs/remake/revision/revision.json', JSON.stringify(v, null, 1));
console.log(`${v.muestras} cuadros, ${v.eventos} señales; las ${v.top.length} más fuertes:`);
for (const e of v.top) console.log(`  ${e.b.toFixed(2).padStart(7)}  ${e.acto.padEnd(10)} ${e.tipo.padEnd(9)} ${e.f}`);
