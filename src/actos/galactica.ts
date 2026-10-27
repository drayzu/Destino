import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { lerp, smoothstep } from '../engine/math';
import { TEAL, cifra, nota, rumbo, type Muro } from '../engine/placa';
import { linea, texto } from '../engine/lamina';
import { mezcla, mirar, vuelo, type Vista } from '../engine/vista';
import { CENTRO } from '../mundo/galaxia';
import { LY_AU, type Mundo } from '../mundo/mundo';
import { CALLADAS, RESERVA, RUINAS, SILENCIO, frente, lugares, ruinas } from '../mundo/fermi';
import { estrella } from '../mundo/vecinas';
import { R_SUN } from '../mundo/obras';
import type { Acto, Cuadro } from './tipos';

/**
 * Act V · La galaxia (~10²⁹ → 10³⁷ W). One subject per moment:
 *
 * - La burbuja: probes that copy themselves in every system they reach; slow, helped by the stars'
 *   own motion, they would fill the galaxy in under ~300 million years (Carroll-Nellenback et al.
 *   2019). The camera rides the front: stars turn teal as it passes. Then, from above, the bubble
 *   spreads over the whole disk.
 * - Tipo III: all of a galaxy's light, ~10³⁷ W. From afar it would dim in visible light and glow in
 *   the infrared. We have never seen one: of ~100 000 galaxies, none (Griffith et al. 2015).
 * - The galaxy of possibilities, as places the front found (hypotheses: dotted, authors named):
 *   the zoo (Ball 1973), the silent ones (Brin 1983), the Great Filter (Hanson 1996).
 * - Muro · el borde y el silencio: our bubble reaches the edge; the question of act 0 returns. Some
 *   may sleep, some may have gone inward (act VI), some may be coming (act VII).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const ly = (v: THREE.Vector3) => v.clone().multiplyScalar(LY_AU);
/** The ride: out from the Sun along the stretch where our neighbourhood is dense. */
const OUT = V(2600, 360, 7500).normalize();
const TAN = OUT.clone().cross(UP).normalize();
/** The bubble's radius (ly) along the act. */
const R_FIN = 80000;
/** Above the galaxy, a little tilted. */
const ARRIBA: Vista = { pos: ly(CENTRO.clone().add(V(9000, 118000, 52000))), target: ly(CENTRO.clone().add(V(0, 0, 9000))), up: UP.clone(), fov: 48 };

export function galactica(): Acto {
  let tl: Timeline;
  let P: (l: string, d?: number) => number;
  const ease = smoothstep;
  let m: Mundo;

  const lug = lugares();
  const membrana = frente();
  const ru = ruinas();
  const enana = estrella(new THREE.Color(0.8, 0.88, 1.0), 9);
  const ruinGroup = new THREE.Group();
  ruinGroup.position.copy(ly(RUINAS));
  ruinGroup.add(ru.nube.points);
  enana.group.position.copy(ly(RUINAS));
  enana.group.scale.setScalar(0.0125 * R_SUN);

  /** The bubble's radius by beat. */
  function radio(p: number) {
    const k1 = ease(P('a5', 0.4), P('a5.ola'), p);
    const k2 = ease(P('a5.ola'), P('a5.tipo3', -0.6), p);
    if (p < P('a5.ola')) return Math.exp(lerp(Math.log(50), Math.log(4000), k1));
    return Math.exp(lerp(Math.log(4000), Math.log(R_FIN), k2));
  }

  // ------------------------------------------------------------ the camera
  /** On the front: just outside it, looking along it (inside to the left, untouched to the right). */
  function enFrente(R: number): Vista {
    const pos = OUT.clone().multiplyScalar(R * 1.03).addScaledVector(UP, R * 0.07);
    const target = pos.clone().addScaledVector(TAN, R * 0.6).addScaledVector(OUT, -R * 0.12).addScaledVector(UP, -R * 0.03);
    return { pos: ly(pos), target: ly(target), up: UP.clone(), fov: 58 };
  }
  function camBurbuja(p: number): Vista {
    const k = (p - P('a5')) / (P('a5.ola') - P('a5'));
    // From the galaxy seen whole (where act IV leaves us) down to the front.
    const desde: Vista = { pos: ly(CENTRO.clone().add(V(30000, 62000, 60000))), target: ly(CENTRO.clone().multiplyScalar(0.55)), up: UP.clone(), fov: 46 };
    const front = enFrente(radio(p));
    return mezcla(desde, front, ease(0, 0.35, k));
  }
  function camOla(p: number): Vista {
    const k = (p - P('a5.ola')) / (P('a5.tipo3') - P('a5.ola'));
    return mezcla(enFrente(radio(p)), ARRIBA, ease(0.0, 0.7, k));
  }
  function camTipo3(p: number): Vista {
    const k = (p - P('a5.tipo3')) / (P('a5.zoo') - P('a5.tipo3'));
    const a = 0.05 * k;
    return { ...ARRIBA, pos: ARRIBA.target.clone().add(ARRIBA.pos.clone().sub(ARRIBA.target).applyAxisAngle(UP, a)) };
  }
  /** A place, seen from `d` light years, from a side. */
  const lugar = (c: THREE.Vector3, d: number, az: number, el: number, fov = 50): Vista => ({
    pos: ly(c.clone().add(V(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(d))),
    target: ly(c),
    up: UP.clone(),
    fov,
  });
  const vZoo = (p: number) => lugar(RESERVA, 150, 0.6 + 0.05 * (p - P('a5.zoo')), 0.22);
  const vCallan = (p: number) => lugar(SILENCIO.clone().add(V(0, 0, 20)), 420, 2.3 + 0.04 * (p - P('a5.callan')), 0.3);
  /** At the ruins: an AU from the dead star, the torn rings against the galaxy's glow. */
  const vRuinas = (p: number): Vista => {
    const k = (p - P('a5.filtro')) / (P('a5.muro') - P('a5.filtro'));
    const az = 0.4 + 0.12 * k;
    const c = ly(RUINAS);
    return { pos: c.clone().add(V(Math.sin(az) * 1.7, 0.42, Math.cos(az) * 1.7)), target: c.clone().add(V(0, -0.05, 0)), up: UP.clone(), fov: 52 };
  };
  /** From one place to the next: turn the gaze, then fly (powers of ten). */
  function ir(a: Vista, b: Vista, k: number, d0: number, d1: number): Vista {
    const t = ease(0.15, 1, k);
    const pos = vuelo(a.pos, b.pos, t, d0, d1);
    const target = mirar(pos, a.target, b.target, ease(0, 0.45, k));
    return { pos, target, up: UP.clone(), fov: lerp(a.fov, b.fov, t) };
  }
  function camZoo(p: number): Vista {
    const k = (p - P('a5.zoo')) / (P('a5.callan') - P('a5.zoo'));
    return k < 0.45 ? ir(camTipo3(P('a5.zoo')), vZoo(p), k / 0.45, 3000 * LY_AU, 20 * LY_AU) : vZoo(p);
  }
  function camCallan(p: number): Vista {
    const k = (p - P('a5.callan')) / (P('a5.filtro') - P('a5.callan'));
    return k < 0.45 ? ir(vZoo(P('a5.callan')), vCallan(p), k / 0.45, 60 * LY_AU, 60 * LY_AU) : vCallan(p);
  }
  function camFiltro(p: number): Vista {
    const k = (p - P('a5.filtro')) / (P('a5.muro') - P('a5.filtro'));
    return k < 0.5 ? ir(vCallan(P('a5.filtro')), vRuinas(p), k / 0.5, 60 * LY_AU, 0.3) : vRuinas(p);
  }
  /** Out of it all: the galaxy, lit to its edge, seen from beside the disk. */
  const BORDE: Vista = { pos: ly(CENTRO.clone().add(V(-150000, 42000, 70000))), target: ly(CENTRO.clone()), up: UP.clone(), fov: 44 };
  function camMuro(p: number): Vista {
    const k = (p - P('a5.muro')) / (P('a5.fin') - P('a5.muro'));
    return mezcla(vRuinas(P('a5.muro')), BORDE, ease(0.0, 0.6, k));
  }
  const SEGS: [string, (p: number) => Vista][] = [
    ['a5', camBurbuja],
    ['a5.ola', camOla],
    ['a5.tipo3', camTipo3],
    ['a5.zoo', camZoo],
    ['a5.callan', camCallan],
    ['a5.filtro', camFiltro],
    ['a5.muro', camMuro],
  ];
  function vista(p: number): Vista {
    let fn = SEGS[0][1];
    for (const [l, f] of SEGS) if (p >= P(l)) fn = f;
    return fn(p);
  }

  return {
    id: 'a5',
    numero: 'V',
    nombre: 'La galaxia',
    coreografia(t) {
      tl = t;
      P = (l, d = 0) => tl.at(l) + d * tl.escala;
      tl.label('a5');
      tl.set({ 'a5.lp': 29.0, 'a5.ly': 3.4, 'a5.lr': 17.7 });
      tl.caption(9.6, 'La burbuja', 'Sondas que se copian en cada sistema que tocan. Aunque vayan lentas, el movimiento de las estrellas las reparte, y llenarían la galaxia en menos de 300 millones de años.', { fuente: 'Carroll-Nellenback y otros, 2019' });
      tl.to(4.6, { 'a5.lp': 31.5, 'a5.ly': 5.6, 'a5.lr': 19.6 });
      tl.label('a5.ola').to(5.0, { 'a5.lp': 36.6, 'a5.ly': 8.48, 'a5.lr': 20.98 });
      tl.label('a5.tipo3');
      tl.caption(6.0, 'Tipo III', 'Usar toda la luz de una galaxia, unos 10³⁷ W, es ser tipo III. Se vería apagada en luz visible y brillante en infrarrojo. De unas 100 000 galaxias revisadas, ninguna es así.', { fuente: 'Griffith y otros, 2015' });
      tl.to(6.0, { 'a5.lp': 37.0, 'a5.ly': 8.5 });
      tl.label('a5.zoo');
      tl.caption(4.8, 'El zoológico', 'Entonces, ¿por qué no vemos a nadie? Quizás alguien nos vio y nos dejó en paz, como a una reserva. Al pasar, nosotros también dejamos intacta una estrella con un mundo vivo.', { fuente: 'Ball, 1973', desde: 1.45, viaje: 'Hacia una estrella joven' });
      tl.to(4.8, { 'a5.ly': 8.52 });
      tl.label('a5.callan');
      tl.caption(4.4, 'Los que callan', 'O hay otros que callan a propósito, porque hacerse oír podría ser peligroso.', { fuente: 'Brin, 1983', desde: 1.3, viaje: 'Más lejos en la galaxia' });
      tl.to(4.4, { 'a5.ly': 8.54 });
      tl.label('a5.filtro');
      tl.caption(5.4, 'El Gran Filtro', 'O casi todas se apagan antes de llegar tan lejos, como este enjambre muerto alrededor de una estrella muerta. ¿Ese filtro ya quedó atrás, o nos espera?', { fuente: 'Hanson, 1996', desde: 2.4, viaje: 'Hacia una estrella muerta' });
      tl.to(5.4, { 'a5.ly': 8.56 });
      tl.label('a5.muro');
      tl.caption(6.4, 'El borde y el silencio', 'Nuestra burbuja llega al borde de la galaxia y la pregunta del principio vuelve: ¿dónde están todos? Quizás duermen esperando un universo más frío, o se fueron hacia adentro.', { fuente: 'Sandberg y otros, 2017; Smart, 2012' });
      tl.to(6.4, { 'a5.ly': 8.6 });
      tl.label('a5.fin');
    },
    montar(mundo) {
      m = mundo;
      m.gal.add(lug.nube.points, lug.zoo.group, ...lug.calladas.map((c) => c.group), membrana.mesh);
      m.nubes.push(lug.nube, lug.zoo.nube, ...lug.calladas.map((c) => c.nube), ru.nube);
      m.root.add(ruinGroup, enana.group);
    },
    vista: (p) => vista(p),
    lectura: (p) => ({ lp: tl.get('a5.lp', p), ly: tl.get('a5.ly', p), lr: tl.get('a5.lr', p) }),
    muro(p): Muro | null {
      const a = ease(P('a5.muro', 1.0), P('a5.muro', 2.0), p);
      return a > 0.01 ? { lp: 37.0, label: 'muro · el borde de la galaxia', a, choque: ease(36.6, 36.98, tl.get('a5.lp', p)) } : null;
    },
    estado(mundo) {
      const e = mundo.estado;
      // At galaxy scale the Sun is one star among billions: no beacon.
      e.faros = 0;
      e.solDim = 0.9;
      e.cercanias = 0;
      e.luna = 0;
    },
    update(f: Cuadro) {
      const { p, time, camera, vista: v } = f;
      const here = p > P('a5', -0.5) && p < P('a5.fin', 2);
      lug.nube.points.visible = here;
      ru.nube.points.visible = here;
      // The front itself, while we ride it and while it spreads.
      const mOn = here ? ease(P('a5', 1.2), P('a5', 2.4), p) * (1 - ease(P('a5.tipo3', -1.6), P('a5.tipo3', -0.4), p)) : 0;
      membrana.mesh.visible = mOn > 0.001;
      membrana.u.uOn.value = mOn;
      membrana.u.uTime.value = time;
      membrana.mesh.scale.setScalar(radio(p));
      if (!here) {
        // Leave the galaxy as the other acts expect it.
        m.G.nube.u.uIR.value = 0;
        m.G.luz.u.uIR.value = 0;
        m.G.nube.u.uBubFront.value = 1;
        m.G.nube.u.uHueco.value.w = 0;
        m.G.luz.u.uBubOn.value = 0;
        enana.update(camera, time, 0);
        lug.zoo.group.visible = false;
        for (const c of lug.calladas) c.group.visible = false;
        return;
      }
      // Our bubble: the galaxy's stars and its light take our colour as the front passes.
      const R = radio(p);
      const G = m.G;
      G.nube.u.uBub.value.set(0, 0, 0);
      G.nube.u.uBubR.value = R;
      G.nube.u.uBubOn.value = 1;
      G.nube.u.uBubFront.value = 1 - ease(P('a5.tipo3', -1), P('a5.tipo3'), p);
      G.nube.u.uHueco.value.set(RESERVA.x, RESERVA.y, RESERVA.z, 34);
      G.luz.u.uBub.value.copy(CENTRO).negate();
      G.luz.u.uBubR.value = R;
      G.luz.u.uBubOn.value = ease(P('a5.ola'), P('a5.ola', 2), p);
      // Type III: the curtain sweeps from the right and stays half-way; it lifts afterwards.
      const ir = ease(P('a5.tipo3', 0.8), P('a5.tipo3', 1.2), p) * (1 - ease(P('a5.zoo', -0.4), P('a5.zoo', 0.2), p));
      const wipe = lerp(1.25, 0.5, ease(P('a5.tipo3', 1.0), P('a5.tipo3', 2.6), p));
      for (const u of [G.nube.u, G.luz.u]) {
        u.uIR.value = ir;
        u.uWipePx.value = wipe * f.W;
      }
      G.nube.u.uResX.value = f.W;
      // The places: the reserve and the silent ones while we visit; the ruins up close.
      const zooOn = ease(P('a5.zoo', 0.8), P('a5.zoo', 1.6), p) * (1 - ease(P('a5.filtro', 0.6), P('a5.filtro', 1.4), p));
      const callOn = ease(P('a5.callan', 0.6), P('a5.callan', 1.4), p) * (1 - ease(P('a5.filtro', 0.6), P('a5.filtro', 1.4), p));
      lug.nube.u.uOn.value = Math.max(zooOn, callOn);
      lug.nube.u.uScale.value = f.k * LY_AU;
      lug.zoo.group.visible = zooOn > 0.001;
      lug.zoo.nube.u.uGain.value = zooOn * 1.3;
      for (const c of lug.calladas) {
        c.group.visible = callOn > 0.001;
        c.nube.u.uGain.value = callOn * 0.9;
      }
      const atRuins = v.pos.distanceTo(ly(RUINAS)) < 2000;
      ru.nube.u.uOn.value = atRuins ? 1 : 0;
      enana.update(camera, time, atRuins ? 1 : 0, v.pos.distanceTo(ly(RUINAS)) / (0.0125 * R_SUN));
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u } = f;
      if (p < P('a5', -0.5) || p > P('a5.fin', 1.5)) return;
      const add = (w: THREE.Vector3, text: string, dx: number, dy: number, a: number) => {
        if (a < 0.01 || !f.lamina) return;
        const q = f.proj(w);
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) nota(g, u, q.x, q.y, text, dx, dy, a);
      };
      // On the way to the dead star: where we are going.
      const rm = ease(P('a5.filtro', 0.1), P('a5.filtro', 0.4), p) * (1 - ease(P('a5.filtro', 1.9), P('a5.filtro', 2.3), p));
      if (rm > 0.01) {
        const q = f.proj(RUINAS.clone().multiplyScalar(LY_AU));
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) rumbo(g, u, q.x, q.y, 'una estrella muerta', rm);
      }
      // The bubble: how long it takes, at most.
      const bu = ease(P('a5.ola', 1.0), P('a5.ola', 1.6), p) * (1 - ease(P('a5.tipo3', 0.2), P('a5.tipo3', 0.8), p));
      cifra(g, u, W * 0.76, H * 0.24, '300', '', 58, bu, TEAL, 'millones de años, como mucho, para llenarla');
      add(V(), 'aquí empezó', 30, -30, ease(P('a5.ola', 1.4), P('a5.ola', 2.0), p) * (1 - ease(P('a5.tipo3', -0.4), P('a5.tipo3'), p)));
      if (f.lamina) {
        const ride = ease(P('a5', 3.4), P('a5', 3.9), p) * (1 - ease(P('a5.ola', 0.3), P('a5.ola', 0.8), p));
        texto(g, u, W * 0.3, H * 0.16, 'adentro: los sistemas ya alcanzados', TEAL, ride, 10.5, 'center');
        texto(g, u, W * 0.72, H * 0.16, 'afuera: todavía nadie', '#f2e6cf', ride, 10.5, 'center');
      }
      // Type III: the curtain, and how many we have looked at.
      const t3 = ease(P('a5.tipo3', 1.0), P('a5.tipo3', 1.6), p) * (1 - ease(P('a5.zoo', -0.6), P('a5.zoo'), p));
      if (t3 > 0.01) {
        const x = lerp(1.25, 0.5, ease(P('a5.tipo3', 1.0), P('a5.tipo3', 2.6), p)) * W;
        if (x < W - 10) {
          linea(g, u, [{ x, y: 96 * u }, { x, y: H - 280 * u }], 'rgba(242,236,224,0.6)', t3);
          texto(g, u, x - 12 * u, 112 * u, 'luz visible', 'rgba(242,236,224,0.85)', t3, 10, 'right');
          texto(g, u, x + 12 * u, 112 * u, 'infrarrojo · falso color', '#ff9a6a', t3, 10);
        }
        cifra(g, u, W * 0.76, H * 0.3, '0', '', 58, ease(P('a5.tipo3', 2.6), P('a5.tipo3', 3.2), p) * t3, '#ff9a6a', 'de unas 100 000 galaxias revisadas se ven así');
      }
      // The places.
      add(RESERVA.clone().multiplyScalar(LY_AU), 'una reserva: la dejamos como estaba', 34, -30, ease(P('a5.zoo', 2.2), P('a5.zoo', 2.8), p) * (1 - ease(P('a5.callan'), P('a5.callan', 0.5), p)));
      add(CALLADAS[0].clone().multiplyScalar(LY_AU), 'sistemas que no emiten nada', 34, -30, ease(P('a5.callan', 2.0), P('a5.callan', 2.6), p) * (1 - ease(P('a5.filtro'), P('a5.filtro', 0.5), p)));
      add(RUINAS.clone().multiplyScalar(LY_AU), 'una enana blanca: lo que queda de su estrella', 34, -30, ease(P('a5.filtro', 2.8), P('a5.filtro', 3.4), p) * (1 - ease(P('a5.muro'), P('a5.muro', 0.5), p)));
    },
  };
}
