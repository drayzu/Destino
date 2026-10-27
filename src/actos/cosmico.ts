import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { lerp, smoothstep } from '../engine/math';
import { TEAL, cifra, ink, nota, type Muro } from '../engine/placa';
import { texto } from '../engine/lamina';
import { mezcla, type Vista } from '../engine/vista';
import { type Mundo } from '../mundo/mundo';
import { MLY_AU, sondas, universo } from '../mundo/cosmos';
import { frente } from '../mundo/fermi';
import { esferaLamina } from '../mundo/galaxia';
import type { Acto, Cuadro } from './tipos';

/**
 * Act VII · El cosmos (10³⁷ → 10⁴⁶ W). One subject per moment:
 *
 * - La eternidad en seis horas: with the energy of a swarm round one star, in six hours probes can
 *   be launched to every galaxy within reach: from ~10⁸ to ~4 × 10⁹, by how fast they go (Armstrong
 *   & Sandberg 2013). The camera pulls back from the Sun to the cosmic web; the probes leave ours.
 * - La prisa: dark energy carries the galaxies away; those that cross the horizon can never be
 *   reached (~16 billion light years away today).
 * - Las expansivas se tocan: bubbles that spread at almost the speed of light meet (Hanson et al.
 *   2021): other colours, borders where they touch.
 * - Tipo IV: ~10⁴⁶ W, of the order of the observable universe (Gray 2020).
 * - Muro · el horizonte: what dark energy carries away does not come back.
 *
 * Distances are compressed (the web here reaches ~9 billion light years) and the plate says so.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const mly = (v: THREE.Vector3) => v.clone().multiplyScalar(MLY_AU);
/** Our bubble's largest radius (comoving Mly, compressed). */
const R_NUESTRA = 4200;
/** The other expansive civilizations: where they started (comoving Mly) and their colours (the universe's uBC). */
const OTRAS = [V(7600, 1800, -3600), V(-6200, -2600, -5200), V(-1800, 3400, 7800)];
const COLORES = [new THREE.Color(1.0, 0.42, 0.78), new THREE.Color(1.0, 0.72, 0.3), new THREE.Color(0.55, 0.62, 1.0)];
/** The horizon (physical Mly). */
const HOR = 16000;

export function cosmico(): Acto {
  let tl: Timeline;
  let P: (l: string, d?: number) => number;
  const ease = smoothstep;
  let m: Mundo;

  const uni = universo();
  const pr = sondas(uni.metas);
  const group = new THREE.Group();
  group.scale.setScalar(MLY_AU);
  group.add(uni.nube.points, pr.lines);
  const nuestra = frente();
  const otras = COLORES.map((c) => frente(c));
  group.add(nuestra.mesh, ...otras.map((o) => o.mesh));
  const horizonte = esferaLamina(new THREE.Color(1.0, 0.4, 0.3));
  group.add(horizonte.group);

  // ------------------------------------------------------------ the camera
  const dir1 = V(0.55, 0.42, 0.72).normalize();
  const C1: Vista = { pos: mly(dir1.clone().multiplyScalar(17000)), target: V(), up: UP.clone(), fov: 50 };
  const C2: Vista = { pos: mly(V(0.7, 0.5, 0.5).normalize().multiplyScalar(52000)), target: V(), up: UP.clone(), fov: 46 };
  const C3: Vista = { pos: mly(V(-0.3, 0.62, 0.72).normalize().multiplyScalar(90000)), target: mly(V(0, 0, 1500)), up: UP.clone(), fov: 46 };
  const orbitar = (v: Vista, a: number): Vista => ({ ...v, pos: v.target.clone().add(v.pos.clone().sub(v.target).applyAxisAngle(UP, a)) });
  function vista(p: number): Vista {
    const k0 = (p - P('a7')) / (P('a7.prisa') - P('a7'));
    // From the Matrioshka brain (where act VI leaves us), out to the web, the Sun's point the target all along.
    const desde: Vista = { pos: V(0.55, 0.4, 0.73).normalize().multiplyScalar(42), target: V(), up: UP.clone(), fov: 36 };
    if (p < P('a7.prisa')) return mezcla(desde, orbitar(C1, 0.05 * k0), ease(0.02, 0.45, k0));
    const k1 = (p - P('a7.prisa')) / (P('a7.expansivas') - P('a7.prisa'));
    if (p < P('a7.expansivas')) return mezcla(orbitar(C1, 0.05), orbitar(C2, 0.05 * k1), ease(0, 0.5, k1));
    const k2 = (p - P('a7.expansivas')) / (P('a7.fin') - P('a7.expansivas'));
    // (turning slowly all the while, so the last moments never stand still)
    return mezcla(orbitar(C2, 0.05), orbitar(C3, 0.4 * k2), ease(0, 0.3, k2));
  }

  /** Our probes' front and the universe's scale factor, by beat. */
  const frenteK = (p: number) => R_NUESTRA * ease(P('a7', 2.6), P('a7.expansivas', 1.0), p) ** 0.7;
  // After the wall the expansion goes on (to ×4.3): the web streams out through the horizon, which stays put.
  const escala = (p: number) => lerp(1, 2.4, ease(P('a7.prisa', 0.6), P('a7.muro', 2), p)) * lerp(1, 1.8, ease(P('a7.muro', 0.4), P('a7.fin', 0.4), p));

  return {
    id: 'a7',
    numero: 'VII',
    nombre: 'El cosmos',
    regla: false,
    coreografia(t) {
      tl = t;
      P = (l, d = 0) => tl.at(l) + d * tl.escala;
      tl.label('a7');
      tl.set({ 'a7.lp': 37.0, 'a7.ly': 8.7, 'a7.lr': 20.98 });
      tl.caption(7.0, 'La eternidad en seis horas', 'O hacia afuera, a lo grande: con la energía de una sola estrella, en seis horas se pueden lanzar sondas a todas las galaxias alcanzables, entre 100 y 4 000 millones.', { fuente: 'Armstrong y Sandberg, 2013' });
      tl.to(7.0, { 'a7.lp': 41.0, 'a7.ly': 9.6, 'a7.lr': 24.5 });
      tl.label('a7.prisa');
      tl.caption(5.6, 'La prisa', 'Hay que apurarse: la energía oscura aleja las galaxias cada vez más rápido. Las que cruzan el horizonte, hoy a unos 16 000 millones de años luz, ya no se alcanzan nunca.');
      tl.to(5.6, { 'a7.lp': 43.5, 'a7.ly': 10.0, 'a7.lr': 25.6 });
      tl.label('a7.expansivas');
      tl.caption(5.6, 'Las expansivas se tocan', 'Si hay otras civilizaciones que se expanden casi a la velocidad de la luz, nuestras burbujas terminan tocándose, y cada una se queda con su parte del cielo.', { fuente: 'Hanson y otros, 2021' });
      tl.to(5.6, { 'a7.lp': 45.2, 'a7.ly': 10.3, 'a7.lr': 26.1 });
      tl.label('a7.tipo4');
      tl.caption(4.4, 'Tipo IV', 'Unos 10⁴⁶ W, del orden de todo el universo observable: tipo IV. Más allá no hay a dónde ir.', { fuente: 'Gray, 2020' });
      tl.to(4.4, { 'a7.lp': 46.0, 'a7.ly': 10.5 });
      tl.label('a7.muro');
      tl.caption(4.6, 'El horizonte', 'Y lo que la energía oscura se lleva no vuelve. El universo que podemos tocar ya no crece: se vacía.');
      tl.to(4.6, { 'a7.ly': 10.7 });
      tl.label('a7.fin');
    },
    montar(mundo) {
      m = mundo;
      m.root.add(group);
      m.nubes.push(uni.nube, horizonte.nube);
    },
    vista: (p) => vista(p),
    lectura: (p) => ({ lp: tl.get('a7.lp', p), ly: tl.get('a7.ly', p), lr: tl.get('a7.lr', p) }),
    muro(p): Muro | null {
      const a = ease(P('a7.muro', 0.8), P('a7.muro', 1.8), p);
      return a > 0.01 ? { lp: 46.2, label: 'muro · el horizonte', a, choque: ease(45.6, 46.0, tl.get('a7.lp', p)) } : null;
    },
    estado(mundo) {
      const e = mundo.estado;
      e.tierra = 0;
      e.faros = 0;
      e.cielo = 0.25;
    },
    update(f: Cuadro) {
      const { p, time } = f;
      const here = p > P('a7', -0.5) && p < P('a7.fin', 0.7);
      group.visible = here;
      if (!here) return;
      const on = ease(P('a7', 1.2), P('a7', 2.6), p);
      // Type IV: everything in use, every bubble lit.
      const t4 = ease(P('a7.tipo4', 0), P('a7.tipo4', 0.6), p) * (1 - ease(P('a7.muro', -0.2), P('a7.muro', 0.8), p));
      uni.nube.u.uOn.value = on * (1 + 0.5 * t4);
      uni.nube.u.uScale.value = f.k * MLY_AU;
      const a = escala(p);
      uni.nube.u.uA.value = a;
      // Ours: the probes' front (comoving), and the others growing until they touch it.
      const R = frenteK(p);
      const b = uni.nube.u.uB.value as THREE.Vector4[];
      b[0].set(0, 0, 0, R);
      const kx = ease(P('a7.expansivas', -0.4), P('a7.tipo4', 1.6), p);
      OTRAS.forEach((c, i) => {
        // Each grows until it touches ours (its centre's distance minus ours), a little more where they press.
        const r = Math.max(0, (c.length() - R_NUESTRA) * 1.04) * kx;
        b[i + 1].set(c.x, c.y, c.z, r);
        const o = otras[i];
        o.mesh.position.copy(c).multiplyScalar(a);
        o.mesh.scale.setScalar(Math.max(r * a, 1e-6));
        // Carried past the horizon, they go dark: out of reach.
        o.u.uOn.value = 0.6 * ease(0, 0.15, kx) * (1 + 0.6 * t4) * (1 - 0.85 * smoothstep(HOR * 0.9, HOR * 1.4, c.length() * a));
        o.u.uTime.value = time;
        o.mesh.visible = r > 1;
      });
      nuestra.mesh.scale.setScalar(Math.max(R * a, 1e-6));
      nuestra.u.uOn.value = 0.5 * ease(P('a7', 3.0), P('a7', 4.0), p) * (1 + 0.7 * t4);
      nuestra.u.uTime.value = time;
      nuestra.mesh.visible = R > 1;
      pr.u.uProg.value = R;
      pr.u.uA.value = a;
      pr.u.uOn.value = ease(P('a7', 2.6), P('a7', 3.4), p) * (1 - 0.6 * ease(P('a7.expansivas'), P('a7.expansivas', 1), p));
      // The horizon, once the hurry begins.
      const hor = ease(P('a7.prisa', 0.6), P('a7.prisa', 1.6), p);
      uni.nube.u.uHor.value = hor > 0.001 ? HOR : 0;
      horizonte.group.visible = hor > 0.001;
      horizonte.group.scale.setScalar(HOR);
      horizonte.nube.u.uGain.value = 0.5 * hor + 1.1 * ease(P('a7.muro', 0), P('a7.muro', 1.0), p);
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u } = f;
      if (p < P('a7', -0.5) || p > P('a7.fin', 1.5)) return;
      const add = (w: THREE.Vector3, text: string, dx: number, dy: number, a: number) => {
        if (a < 0.01 || !f.lamina) return;
        const q = f.proj(w);
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) nota(g, u, q.x, q.y, text, dx, dy, a);
      };
      // Six hours; then how many galaxies.
      const ei = ease(P('a7', 3.0), P('a7', 3.6), p) * (1 - ease(P('a7.prisa', -0.4), P('a7.prisa', 0.2), p));
      if (ei > 0.01) {
        const late = ease(P('a7', 5.0), P('a7', 5.6), p);
        if (late < 0.5) cifra(g, u, W * 0.76, H * 0.24, '6', '', 64, ei * (1 - late * 2), TEAL, 'horas de la luz de un sol: sondas a todas');
        else cifra(g, u, W * 0.76, H * 0.24, '4 × 10', '9', 58, ei * (late * 2 - 1), TEAL, 'galaxias alcanzables, como mucho');
      }
      const pa = ease(P('a7.prisa', 1.6), P('a7.prisa', 2.2), p) * (1 - ease(P('a7.expansivas'), P('a7.expansivas', 0.6), p));
      cifra(g, u, W * 0.76, H * 0.24, '16 000', '', 58, pa, '#ff9a6a', 'millones de años luz: más allá, inalcanzable');
      add(V(), 'nuestra galaxia', 30, -30, ease(P('a7', 2.4), P('a7', 3.0), p) * (1 - ease(P('a7.prisa'), P('a7.prisa', 0.6), p)));
      const a = escala(p);
      add(mly(V(0, HOR, 0)), 'el horizonte: lo que lo cruza no vuelve', 30, -30, pa);
      OTRAS.forEach((c) => add(mly(c.clone().multiplyScalar(a)), 'otra civilización expansiva', 30, -30, ease(P('a7.expansivas', 1.6), P('a7.expansivas', 2.2), p) * (1 - ease(P('a7.tipo4'), P('a7.tipo4', 0.5), p))));
      // Honest about the scale.
      const esc = ease(P('a7', 2.6), P('a7', 3.2), p) * (1 - ease(P('a7.fin', -0.6), P('a7.fin'), p));
      texto(g, u, W / 2, H - 300 * u, 'distancias comprimidas · ilustrativo', ink(0.5), esc, 9, 'center');
    },
  };
}
