import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { lerp, smoothstep } from '../engine/math';
import { TEAL, nota } from '../engine/placa';
import { texto } from '../engine/lamina';
import { mezcla, type Vista } from '../engine/vista';
import { materia, materiaBuilder } from '../engine/materia';
import { pantalla } from '../engine/pantalla';
import { E, deriva, noche, type Mundo } from '../mundo/mundo';
import { R_E } from '../mundo/obras';
import { HORIZONTE, SPHERE_PRE, esfera } from '../mundo/tierra';
import { DATOS, celula, cerebro, neuronas } from '../mundo/vida';
import type { Acto, Cuadro } from './tipos';

/**
 * Act I · La materia despierta. Short, as an origin: how the matter of a planet began to notice,
 * in one continuous gesture that follows minds, not the Earth's history (that is Tiempo's). The clock
 * counts the watts of thinking (one rule from end to end: energy):
 *
 * - Una célula que reacciona: life, at least ~3 500 million years ago; a cell lives on about a
 *   picowatt. The camera dives into the dark sea, among cells.
 * - Nervios: the first nervous systems, some 600–500 million years ago: pulses along axons.
 * - Un cerebro: ~86 000 million neurons (Azevedo et al. 2009) thinking on ~20 W.
 * - Ocho mil millones de cerebros: ~1.6 × 10¹¹ W [calc]; the brain becomes a point, and the point
 *   is the Earth at night: where we are, in the civilization's colour.
 * - Las máquinas que piensan: data centres, ~415 TWh in 2024 ≈ 47 GW (IEA, Energy and AI, 2025).
 *
 * The cell, the neurons and the brain are drawn in their own small space that rides with the camera:
 * the world's coordinates cannot tell micrometres apart.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
/** Scene units per micro unit (in front of everything in the world). */
const SIGMA = 2e-3;

export function despertar(): Acto {
  let tl: Timeline;
  let P: (l: string, d?: number) => number;
  const ease = smoothstep;
  let m: Mundo;

  // ------------------------------------------------------------ the small space
  const cabina = new THREE.Group();
  const micro = new THREE.Group();
  micro.matrixAutoUpdate = false;
  cabina.add(micro);
  const cel = celula();
  const neu = neuronas();
  const cer = cerebro();
  micro.add(cel.points, neu.points, cer.points);
  // Its background: the dark sea (the cell), violet dark (the nerves).
  const fondo = pantalla(
    /* glsl */ `
    uniform vec3 uColor; uniform float uOn;
    void main() {
      vec3 d = normalize(vDir);
      float g = 0.6 + 0.4 * smoothstep(-0.6, 0.8, d.y);
      gl_FragColor = vec4(uColor * g * uOn, 1.0);
    }`,
    { uColor: { value: new THREE.Color(0.02, 0.06, 0.1) }, uOn: { value: 0 } },
  );
  const fm = fondo.mesh.material as THREE.ShaderMaterial;
  fm.transparent = true;
  fm.blending = THREE.AdditiveBlending;
  fondo.mesh.renderOrder = -99;

  // The machines that think: data centres, on the Earth (its own frame, radii).
  const db = materiaBuilder(2025);
  for (const [la, lo] of DATOS) {
    for (let k = 0; k < 40; k++) {
      const [x, y, z] = esfera(la + (db.r() - 0.5) * 0.6, lo + (db.r() - 0.5) * 0.6, 1.002);
      db.push(x, y, z, new THREE.Color(0.75, 0.88, 1.0), k === 0 ? 0.012 : 0.006, k === 0 ? 4.0 : 1.5);
    }
  }
  const datos = materia(db.data(), {
    pre: `${SPHERE_PRE}\nuniform float uOn;`,
    move: /* glsl */ `
      em *= uOn * (0.7 + 0.3 * sin(uTime * 3.0 + seed * 20.0));
      fuente = 1.0;
      ${HORIZONTE}`,
    uniforms: { uSun: { value: V(1, 0, 0) }, uCamL: { value: V(0, 0, 5) }, uOn: { value: 0 } },
  });
  datos.u.uSpread.value = 0;

  // ------------------------------------------------------------ the camera
  // Where the opening left the camera (the Earth's night side, the Sun behind it), and where «Hoy» wants it.
  const desde = (): Vista => ({ pos: E.clone().addScaledVector(E.clone().normalize(), 4.2 * R_E), target: E.clone(), up: UP.clone(), fov: 40 });
  const hacia = (p: number): Vista => noche(4.6, deriva(p));
  /** Down into the sea: the world camera dives to the ocean while the small space opens. */
  const mar = (): Vista => ({ pos: E.clone().addScaledVector(E.clone().normalize(), 1.03 * R_E), target: E.clone(), up: UP.clone(), fov: 40 });
  function vista(p: number): Vista {
    if (p < P('a1.todos')) return mezcla(desde(), mar(), ease(P('a1'), P('a1', 1.6), p));
    return mezcla(mar(), hacia(p), ease(P('a1.todos'), P('a1.todos', 1.6), p));
  }
  /** The camera in the small space (micro units): the cell, out to the nerves, out to the brain, away. */
  function micro0(p: number): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const t = time0;
    const a = 0.6 + 0.05 * Math.sin(t * 0.1);
    // Distance from the centre, in logarithm: 3 (a cell) → 30 (the nerves) → 140 (the brain) → 4000 (a point).
    const d1 = ease(P('a1', 0.2), P('a1', 1.8), p);
    const d2 = ease(P('a1.nervios', -0.2), P('a1.nervios', 1.6), p);
    const d3 = ease(P('a1.cerebro', -0.2), P('a1.cerebro', 1.8), p);
    const d4 = ease(P('a1.todos', -0.4), P('a1.todos', 1.4), p);
    const L = lerp(lerp(lerp(lerp(Math.log(60), Math.log(3.1), d1), Math.log(26), d2), Math.log(150), d3), Math.log(6000), d4);
    const d = Math.exp(L);
    const az = a + 0.25 * (p - P('a1')) * 0.1 + 0.8 * d2 + 0.6 * d3;
    const el = 0.18 + 0.15 * d3;
    return { pos: V(Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d), target: V() };
  }
  let time0 = 0;
  const vm = new THREE.Matrix4();
  const vq = new THREE.Quaternion();

  return {
    id: 'a1',
    numero: 'I',
    nombre: 'La materia despierta',
    coreografia(t) {
      tl = t;
      P = (l, d = 0) => tl.at(l) + d * tl.escala;
      tl.label('a1');
      tl.set({ 'a1.lp': -12, 'a1.ly': 9.54 });
      tl.caption(4.4, 'Una célula que reacciona', 'Hace al menos 3 500 millones de años, en ese planeta, la materia empezó a reaccionar. Una célula vive con una billonésima de vatio.');
      tl.to(4.4, { 'a1.lp': -12 });
      tl.label('a1.nervios');
      tl.caption(3.6, 'Nervios', 'Hace unos 600 millones de años aparecieron los primeros nervios: células que se pasan señales, más rápido que cualquier otra cosa viva.');
      tl.to(3.6, { 'a1.lp': -12 });
      tl.label('a1.cerebro');
      tl.caption(3.6, 'Un cerebro', 'Unos 86 000 millones de neuronas, lo más complejo que conocemos, piensan con unos 20 vatios: lo que gasta una bombilla.');
      tl.to(0.9, { 'a1.lp': Math.log10(20) }).to(2.7, {});
      tl.label('a1.todos');
      tl.caption(3.4, 'Ocho mil millones de cerebros', 'Todos nuestros cerebros juntos, pensando a la vez: una central eléctrica grande. Están ahí, donde de noche hay luz.');
      tl.to(0.9, { 'a1.lp': Math.log10(8.2e9 * 20) }).to(2.5, {});
      tl.label('a1.maquinas');
      tl.caption(3.2, 'Las máquinas que piensan', 'Hoy los centros de datos ya gastan casi un tercio de lo que gastan todos nuestros cerebros. Y crecen.');
      tl.to(0.9, { 'a1.lp': Math.log10(4.7e10) }).to(2.3, {});
      tl.label('a1.fin');
    },
    montar(mundo) {
      m = mundo;
      m.root.parent!.add(cabina, fondo.mesh);
      m.nubes.push(cel, neu, cer);
      m.body.add(datos.points);
      m.nubes.push(datos);
    },
    vista: (p) => vista(p),
    lectura: () => null,
    libre(p) {
      const lp = tl.get('a1.lp', p);
      const linea =
        p < P('a1.nervios') ? 'una célula · alrededor de un picovatio' : p < P('a1.cerebro') ? 'los primeros nervios' : p < P('a1.todos') ? 'un cerebro humano · unos 20 W' : p < P('a1.maquinas') ? 'todos los cerebros humanos · 1,6 × 10¹¹ W' : 'centros de datos · unos 47 GW (2024)';
      return { lp, linea, tipo: 'vatios de pensar' };
    },
    estado(mundo, p) {
      const e = mundo.estado;
      // In the small space the world steps back; then the Earth at night, its people as minds.
      const enMicro = ease(P('a1', 0.8), P('a1', 1.8), p) * (1 - ease(P('a1.todos', -0.2), P('a1.todos', 0.8), p));
      e.tierra = enMicro > 0.98 ? 0 : 1;
      e.galaxia = 1 - enMicro;
      e.cielo = 0.8 * (1 - enMicro);
      e.faros = 1 - enMicro;
      e.sol = 1 - enMicro;
      e.luces = 0.36 * ease(P('a1.todos', 0.4), P('a1.todos', 1.6), p) * (1 - ease(P('a1.fin', -0.4), P('a1.fin', 0.4), p));
      // Minds in the civilization's colour; dimmer when the machines light up.
      e.mentes = 1;
      e.luces *= 1 - 0.6 * ease(P('a1.maquinas', 0.3), P('a1.maquinas', 1.2), p);
    },
    update(f: Cuadro) {
      const { p, time, camera } = f;
      time0 = time;
      const here = p > P('a1', -0.5) && p < P('a1.fin', 0.6);
      cabina.visible = here;
      fondo.mesh.visible = here;
      datos.points.visible = here;
      if (!here) return;
      // What the small space shows, moment by moment.
      const celOn = ease(P('a1', 0.6), P('a1', 1.4), p) * (1 - ease(P('a1.nervios', 0.4), P('a1.nervios', 1.4), p));
      const neuOn = ease(P('a1.nervios', 0.2), P('a1.nervios', 1.2), p) * (1 - ease(P('a1.cerebro', 0.4), P('a1.cerebro', 1.6), p));
      const cerOn = ease(P('a1.cerebro', 0.4), P('a1.cerebro', 1.6), p) * (1 - ease(P('a1.todos', 0.2), P('a1.todos', 1.2), p));
      cel.u.uOn.value = celOn;
      neu.u.uOn.value = neuOn;
      cer.u.uOn.value = cerOn;
      cel.points.visible = celOn > 0.001;
      neu.points.visible = neuOn > 0.001;
      cer.points.visible = cerOn > 0.001;
      // The cell is touched; its membrane answers.
      cel.u.uToque.value = ease(P('a1', 2.0), P('a1', 2.8), p);
      cel.u.uOla.value = ease(P('a1', 2.8), P('a1', 4.0), p);
      // The background: sea blue for the cell, violet for the nerves, dark for the brain.
      const c1 = new THREE.Color(0.02, 0.07, 0.12);
      const c2 = new THREE.Color(0.06, 0.02, 0.1);
      (fondo.u.uColor.value as THREE.Color).copy(c1).lerp(c2, ease(P('a1.nervios'), P('a1.nervios', 1.2), p));
      fondo.u.uOn.value = ease(P('a1', 0.6), P('a1', 1.6), p) * (1 - ease(P('a1.cerebro', 0.4), P('a1.cerebro', 1.8), p));
      // Place the small space so that its own camera looks through the real one.
      const mc = micro0(p);
      vm.lookAt(mc.pos, mc.target, UP);
      vq.setFromRotationMatrix(vm);
      const view = new THREE.Matrix4().compose(mc.pos, vq, new THREE.Vector3(1, 1, 1)).invert();
      const real = new THREE.Matrix4().makeRotationFromQuaternion(camera.quaternion);
      micro.matrix.copy(real).multiply(new THREE.Matrix4().makeScale(SIGMA, SIGMA, SIGMA)).multiply(view);
      micro.matrixWorldNeedsUpdate = true;
      // Data centres: they light at the end.
      const dOn = ease(P('a1.maquinas', 0.3), P('a1.maquinas', 1.2), p) * (1 - ease(P('a1.fin', -0.2), P('a1.fin', 0.6), p));
      datos.u.uOn.value = dOn;
      m.body.worldToLocal(datos.u.uCamL.value.set(0, 0, 0));
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u } = f;
      if (p < P('a1', -0.5) || p > P('a1.fin', 0.5)) return;
      if (!f.lamina) return;
      const t1 = ease(P('a1', 3.0), P('a1', 3.4), p) * (1 - ease(P('a1.nervios'), P('a1.nervios', 0.4), p));
      texto(g, u, W / 2, H * 0.2, 'una molécula la toca: la membrana responde', TEAL, t1, 11, 'center');
      const t2 = ease(P('a1.nervios', 1.4), P('a1.nervios', 1.8), p) * (1 - ease(P('a1.cerebro'), P('a1.cerebro', 0.4), p));
      texto(g, u, W / 2, H * 0.2, 'una señal corre por el axón', '#d8b8ff', t2, 11, 'center');
      const t3 = ease(P('a1.maquinas', 1.2), P('a1.maquinas', 1.6), p) * (1 - ease(P('a1.fin', -0.3), P('a1.fin'), p));
      const q = f.proj(m.tierraAMundo(V(...esfera(39, -77.5, 1.0))));
      if (q) nota(g, u, q.x, q.y, 'centros de datos', 34, -30, t3);
    },
  };
}
