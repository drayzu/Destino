// Apariciones: things that pop in or out. For every object in the scene, at each step of the film
// (forward, the clock still), how present it is on the screen: drawn at all, how lit (its uOn, uGain,
// uFundido… the light uniforms it has) and how much of the frame it covers (its bounding sphere seen
// from the camera). An object whose presence changes by a lot within a short stretch, while it is big
// on the screen, popped: it goes from under a tenth of its light to over nine tenths too fast. Prints each with the beats, the act and the object (its uniforms, its size).
//   node tools/apariciones.mjs [--from 0 --to 449] [--paso 0.05] [--ventana 0.35] [--umbral 0.02] [--conf 1.5] [--local 8]
import { execFileSync } from 'node:child_process';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const FROM = arg('from', '0'), TO = arg('to', '1e9'), PASO = arg('paso', '0.05'), VENT = arg('ventana', '0.35'), UMB = arg('umbral', '0.02'), CONF = arg('conf', '1.5'), LOCAL = arg('local', '8');
const expr = `(() => {
  const a = ${FROM}, b = Math.min(${TO}, viaje.total - 0.01), D = ${PASO};
  const LUZ = ['uOn', 'uGain', 'uFundido', 'uLoc', 'uPla', 'uSis', 'uRed', 'uGal', 'uSala', 'uTu'];
  const cam = stage.camera;
  const V = cam.position.constructor;
  const w = new V(), sc = new V();
  const objs = new Map();
  let n = 0;
  const tramos = viaje.tramos();
  const acto = (x) => { let r = tramos[0][0]; for (const t of tramos) if (x >= t[2]) r = t[0]; return r; };
  const bs = []; for (let x = a; x <= b + 1e-9; x += D) bs.push(+x.toFixed(3));
  bs.forEach((x, i) => {
    viaje.dibujar(x, 1000);
    const tf = Math.tan((cam.fov * Math.PI) / 360);
    escena.traverse((o) => {
      if (!(o.isPoints || o.isMesh) || !o.material) return;
      let id = objs.get(o);
      if (!id) { id = { o, n: n++, p: new Float32Array(bs.length) }; objs.set(o, id); }
      let vis = true; for (let x2 = o; x2; x2 = x2.parent) if (!x2.visible) vis = false;
      if (!vis || o.material.visible === false) return;
      const u = o.material.uniforms || {};
      let luz = 1;
      for (const k of LUZ) if (u[k] && typeof u[k].value === 'number') luz *= Math.max(0, u[k].value);
      if (!(luz > 0)) return;
      const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      const bsph = g.boundingSphere; if (!bsph || !isFinite(bsph.radius)) return;
      w.copy(bsph.center).applyMatrix4(o.matrixWorld);
      o.getWorldScale(sc);
      const r = bsph.radius * Math.max(sc.x, sc.y, sc.z);
      const d = w.distanceTo(cam.position);
      // (how much of the frame: its apparent radius against the frame's half height, at most 1; in front only)
      // (in the frame only: its centre on the screen, or near enough that its size reaches into it)
      const ndc = w.clone().project(cam);
      const rn = r / Math.max(d, 1e-30) / tf;
      const enCuadro = d < r || (ndc.z < 1 && Math.abs(ndc.x) < 1 + rn / cam.aspect && Math.abs(ndc.y) < 1 + rn);
      const cubre = enCuadro ? Math.min(1, rn) : 0;
      id.p[i] = Math.min(luz, 1.5) * cubre;
    });
  });
  // A pop: going from under a tenth of its light to over nine tenths in less than VENT beats, while it
  // covers enough of the frame to be seen (UMB). (Each way: coming in, going out.)
  const out = [];
  const H = Math.round(2 / D);
  for (const { o, p } of objs.values()) {
    const u = o.material.uniforms || {};
    if (u.uTitila) continue; // (the spark: its relays are their own)
    for (const sentido of [1, -1]) {
      const q = sentido > 0 ? p : p.slice().reverse();
      const at = (i) => (sentido > 0 ? bs[i] : bs[bs.length - 1 - i]);
      for (let i = 1; i < q.length; i++) {
        let M = 0; for (let j = i; j < Math.min(q.length, i + H); j++) M = Math.max(M, q[j]);
        if (M < ${UMB} || !(q[i - 1] < 0.1 * M && q[i] >= 0.1 * M)) continue;
        let j = i; while (j < q.length && q[j] < 0.9 * M) j++;
        const dur = Math.abs(at(Math.min(j, q.length - 1)) - at(i - 1));
        if (dur < ${VENT}) {
          const keys = Object.keys(u).filter((k) => !['uTime','uFocal','uMinPx','uMaxPx','uSizeUnit','uGain','uInk','uK','uSpread','uFog','uFogNear','uFuente','uFundido','uEscalaMundo','uOcc','uBeta','uVelV','uCamL'].includes(k)).slice(0, 5);
          const b0 = Math.min(at(i - 1), at(Math.min(j, q.length - 1)));
          out.push({ o, b: b0, b2: b0 + dur, acto: acto(b0), cambio: sentido, antes: 0, despues: +M.toFixed(3), obj: (o.isMesh ? 'malla ' : 'puntos ') + (o.geometry.attributes.position?.count ?? 0) + ' [' + keys.join(',') + ']' });
          i = j;
        }
      }
    }
  }
  // Then each suspect checked on the picture itself: what it (with whatever changed with it at the
  // same moment, a stand-in swapped for another) adds to the frame, drawn with and without it, over
  // the stretch round the change. A pop only if that changes from under a sixth of its most to over
  // five sixths in less than VENT beats, and its most is enough to see (CONF, mean 0–255 over the
  // frame, or LOCAL in its brightest part).
  out.sort((x, y) => x.b - y.b);
  const grupos = [];
  for (const e of out) {
    const g = grupos.find((q) => Math.abs(q.b - e.b) < 0.12 && q.acto === e.acto);
    if (g) { g.objs.add(e.o); g.b2 = Math.max(g.b2, e.b2); g.desc.push(e.obj); } else grupos.push({ b: e.b, b2: e.b2, acto: e.acto, objs: new Set([e.o]), desc: [e.obj] });
  }
  const c = document.querySelector('#scene');
  const BW = 96, BH = 54;
  const sc2 = document.createElement('canvas'); sc2.width = BW; sc2.height = BH;
  const g2 = sc2.getContext('2d', { willReadFrequently: true });
  const lee = () => { g2.drawImage(c, 0, 0, BW, BH); return g2.getImageData(0, 0, BW, BH).data; };
  const conf = [];
  for (const gr of grupos) {
    const ts = []; for (let t = gr.b - 0.3; t <= gr.b2 + 0.3 + 1e-9; t += D) if (t >= 0 && t <= viaje.total) ts.push(+t.toFixed(3));
    const aporte = [], local = [];
    viaje.dibujar(Math.max(0, ts[0] - D), 1000);
    for (const t of ts) {
      viaje.dibujar(t, 1000); const A = lee();
      for (const o of gr.objs) o.material.visible = false;
      viaje.dibujar(t, 1000); const B = lee();
      for (const o of gr.objs) o.material.visible = true;
      // (the mean over the frame, and over its 6×6-block part where it adds most)
      let s = 0; const blk = new Float32Array(36);
      for (let i = 0; i < BW * BH; i++) { const d = Math.abs(A[i*4] + A[i*4+1] + A[i*4+2] - B[i*4] - B[i*4+1] - B[i*4+2]) / 3; s += d; blk[Math.floor((i % BW) / 16) + 6 * Math.floor(Math.floor(i / BW) / 9)] += d; }
      aporte.push(s / (BW * BH)); local.push(Math.max(...blk) / (16 * 9));
    }
    const M = Math.max(...aporte), ML = Math.max(...local);
    if (M < ${CONF} && ML < ${LOCAL}) continue;
    // (how fast it came or went: from a sixth to five sixths of its most, either way)
    const serie = M >= ${CONF} ? aporte : local, mx = Math.max(...serie);
    let rapido = Infinity;
    for (let i = 0; i < serie.length; i++) for (let j = i + 1; j < serie.length && ts[j] - ts[i] < rapido; j++) {
      const sube = serie[i] < mx / 6 && serie[j] > (mx * 5) / 6, baja = serie[i] > (mx * 5) / 6 && serie[j] < mx / 6;
      if (sube || baja) rapido = ts[j] - ts[i];
    }
    if (rapido < ${VENT}) conf.push({ b: gr.b, b2: gr.b2, acto: gr.acto, en: +rapido.toFixed(2), aporte: +M.toFixed(2), local: +ML.toFixed(1), objs: [...new Set(gr.desc)].slice(0, 4).join(' + ') });
  }
  return { sospechas: grupos.length, conf };
})()`;
const r = execFileSync('node', ['tools/eval.mjs', 'viaje', '0', expr], { encoding: 'utf8', maxBuffer: 1 << 26 });
let v = JSON.parse(r); if (typeof v === 'string') v = JSON.parse(v);
console.log(`${v.sospechas} sospechas; se ven de golpe ${v.conf.length}:`);
for (const e of v.conf) console.log(`${e.b.toFixed(2).padStart(7)}  ${e.acto.padEnd(10)} en ${e.en} compás · aporta ${e.aporte} (en su zona ${e.local})  ${e.objs}`);
