// Apariciones: things that pop in or out. For every object in the scene, at each step of the film
// (forward, the clock still), how present it is on the screen: drawn at all, how lit (its uOn, uGain,
// uFundido… the light uniforms it has) and how much of the frame it covers (its bounding sphere seen
// from the camera). An object whose presence changes by a lot within a short stretch, while it is big
// on the screen, popped: it goes from under a tenth of its light to over nine tenths too fast. Prints each with the beats, the act and the object (its uniforms, its size).
//   node tools/apariciones.mjs [--from 0 --to 449] [--paso 0.05] [--ventana 0.35] [--umbral 0.02]
import { execFileSync } from 'node:child_process';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const FROM = arg('from', '0'), TO = arg('to', '1e9'), PASO = arg('paso', '0.05'), VENT = arg('ventana', '0.35'), UMB = arg('umbral', '0.02');
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
          out.push({ b: b0, b2: b0 + dur, acto: acto(b0), cambio: sentido, antes: 0, despues: +M.toFixed(3), obj: (o.isMesh ? 'malla ' : 'puntos ') + (o.geometry.attributes.position?.count ?? 0) + ' [' + keys.join(',') + ']' });
          i = j;
        }
      }
    }
  }
  return out.sort((x, y) => x.b - y.b);
})()`;
const r = execFileSync('node', ['tools/eval.mjs', 'viaje', '0', expr], { encoding: 'utf8', maxBuffer: 1 << 26 });
let v = JSON.parse(r); if (typeof v === 'string') v = JSON.parse(v);
if (!v.length) console.log('nada aparece ni desaparece de golpe');
for (const e of v) console.log(`${e.b.toFixed(2).padStart(7)}–${e.b2.toFixed(2).padEnd(7)} ${e.acto.padEnd(10)} ${(e.cambio > 0 ? 'aparece' : 'se va').padEnd(8)} en ${(e.b2 - e.b).toFixed(2)} compás, cubre ${e.despues}  ${e.obj}`);
