import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { gauss, lerp, smoothstep } from '../engine/math';
import { TEAL, cifra, nota, rumbo, sup, type Muro } from '../engine/placa';
import { texto } from '../engine/lamina';
import { mezcla, mirar, type Vista } from '../engine/vista';
import { crearAgujero } from '../engine/agujero';
import { materia, materiaBuilder } from '../engine/materia';
import { type Mundo } from '../mundo/mundo';
import { MLY_AU } from '../mundo/cosmos';
import { frente } from '../mundo/fermi';
import type { Acto, Cuadro } from './tipos';

/**
 * Act VIII · El final y el relevo. One subject per moment:
 *
 * - Las últimas centrales: when the stars have gone out (~10¹⁴ years), black holes remain. Up to 29 %
 *   of the mass of one spinning as fast as it can is extractable (the Penrose process: 1 − 1/√2;
 *   not the 20.7 % of a single event), then its Hawking radiation. A supermassive hole (~10⁹ Suns),
 *   ray traced (Tiempo's), with the civilization's matter thrown in and coming out with more energy.
 * - Pensamientos contados: Dyson (1979) showed life could think for ever with finite energy in an
 *   open universe; accelerating expansion forbids it: the number of thoughts is finite (Krauss &
 *   Starkman 2000). The counter runs and stops. The wall: the heat death.
 * - Crear un universo: the last possible work. A bubble of false vacuum that inflates into a universe
 *   of its own (Farhi & Guth 1987 show the obstacle; Ansoldi & Guendelman 2006 review ways out).
 * - El relevo: the camera goes inside and watches a new universe begin. What is outside the bubble
 *   is Infinito's question.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
/** The hole's horizon radius (AU): ~10⁹ Suns. */
const RS = 20;
const NORMAL = V(0.12, 1, 0.22).normalize();
/** Where the new universe starts (AU from the hole). */
const SEMILLA = V(150, 26, 70);

/** Matter thrown in, round and down into the ergosphere; half falls in, half comes out with more energy. */
function penrose() {
  const b = materiaBuilder(1969);
  const kind: number[] = [];
  for (let i = 0; i < 5000; i++) {
    const a = b.r() * Math.PI * 2;
    b.push(Math.cos(a), gauss(b.r) * 0.02, Math.sin(a), i % 2 ? new THREE.Color(1.0, 0.85, 0.5) : new THREE.Color(0.45, 1.0, 0.85), 0.06, 1.0);
    kind.push(i % 2);
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute float aOut; uniform float uOn; uniform vec3 uN;`,
    move: /* glsl */ `
      float f = fract(uTime * 0.07 + seed);
      vec3 e1 = normalize(cross(uN, vec3(0.31, 0.83, 0.47)));
      vec3 e2 = cross(uN, e1);
      float a0 = atan(position.z, position.x);
      float r; float ang;
      if (f < 0.6) {
        // In: a spiral from far out to the ergosphere, turning with the hole.
        float t = f / 0.6;
        r = mix(14.0, 1.7, t * t);
        ang = a0 + 5.0 * t * t;
        em = vec3(0.45, 1.0, 0.85) * 0.5;
      } else {
        float t = (f - 0.6) / 0.4;
        ang = a0 + 5.0 + 2.5 * t;
        if (aOut < 0.5) {
          // This half falls in, with negative energy.
          r = mix(1.7, 0.98, t);
          em = vec3(0.45, 1.0, 0.85) * 0.5 * (1.0 - t);
        } else {
          // The other half comes out with more than was thrown in.
          r = mix(1.7, 18.0, t * t);
          em = vec3(1.0, 0.86, 0.5) * 1.6 * (1.0 - smoothstep(0.7, 1.0, t));
        }
      }
      p = (e1 * cos(ang) + e2 * sin(ang)) * r + uN * position.y * r;
      // Near the horizon (r in Schwarzschild radii) its light is pulled redder and dimmer: what
      // reaches us from the ergosphere is faint, and nothing from the horizon itself.
      float g = sqrt(max(1.0 - 1.0 / max(r, 1.0), 0.0));
      em *= g * g;
      em = mix(em * vec3(1.0, 0.3, 0.12), em, g);
      em *= uOn;
      fuente = 1.0;`,
    uniforms: { uOn: { value: 0 }, uN: { value: NORMAL.clone() } },
    extra: { aOut: [new Float32Array(kind), 1] },
  });
  nube.u.uSpread.value = 0;
  return nube;
}

/** A universe beginning: light pouring out from a point, in every direction (radius 1, scaled). */
function comienzo() {
  const b = materiaBuilder(1987);
  for (let i = 0; i < 9000; i++) {
    const [x, y, z] = b.onSphere();
    const warm = b.r();
    b.push(x, y, z, warm < 0.5 ? new THREE.Color(1.0, 0.9, 0.75) : warm < 0.85 ? new THREE.Color(1.0, 0.98, 0.95) : new THREE.Color(0.7, 0.85, 1.0), 0.0012, 1.4);
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `uniform float uOn;`,
    move: /* glsl */ `
      float f = fract(uTime * 0.12 + seed);
      p = position * (0.02 + 1.4 * f * f);
      // Brighter as they fly out, gone at the edge.
      em *= uOn * (1.0 - smoothstep(0.6, 1.0, f)) * (0.4 + 2.0 * f);
      fuente = 1.0;`,
    uniforms: { uOn: { value: 0 } },
  });
  nube.u.uSpread.value = 0;
  // Inside, the young universe's light fills everything.
  const fill = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 32),
    new THREE.ShaderMaterial({
      uniforms: { uOn: { value: 0 } },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vP;
        void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform float uOn; varying vec3 vP;
        void main() {
          #include <logdepthbuf_fragment>
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * 0.03 * uOn, 1.0);
        }`,
    }),
  );
  fill.frustumCulled = false;
  return { nube, fill };
}

export function final(): Acto {
  let tl: Timeline;
  let P: (l: string, d?: number) => number;
  const ease = smoothstep;
  let m: Mundo;

  const bh = crearAgujero();
  bh.u.uStars.value = 0;
  bh.u.uBand.value = 0;
  bh.u.uDiskIn.value = 3;
  bh.u.uDiskOut.value = 16;
  // A warmer disk than Tiempo's: this moment's colour is gold.
  bh.u.uDiskT.value = 5200;
  const pen = penrose();
  const penG = new THREE.Group();
  penG.scale.setScalar(RS);
  penG.add(pen.points);
  const burbuja = frente(new THREE.Color(0.8, 0.95, 1.0));
  const nuevo = comienzo();
  const nuevoG = new THREE.Group();
  // Dyson's last mind: a shell of computers beside the hole, thinking in ever rarer bursts (each sleep
  // longer than the last, each waking dimmer), until the counter stops.
  const MENTE = V(0.9, 0.16, 0.42).normalize().cross(UP).normalize().multiplyScalar(-92).add(V(0, 16, 0));
  const uPulso = { value: 0 };
  const mente = (() => {
    const b = materiaBuilder(808);
    for (let i = 0; i < 2600; i++) {
      const [x, y, z] = b.onSphere();
      const r = 8 * (0.9 + 0.1 * b.r());
      b.push(x * r, y * r, z * r, new THREE.Color(0.45, 1.0, 0.84), 0.45, 1);
    }
    return materia(b.data(), { pre: 'uniform float uPulso;', move: 'em *= 0.06 + uPulso * (0.6 + 0.4 * fract(seed * 7.13)); fuente = 1.0;', uniforms: { uPulso } });
  })();
  mente.u.uSpread.value = 0;
  mente.points.position.copy(MENTE);
  nuevoG.position.copy(SEMILLA);
  nuevoG.add(burbuja.mesh, nuevo.nube.points, nuevo.fill);

  // ------------------------------------------------------------ the camera
  const lado = V(0.9, 0.16, 0.42).normalize();
  const orbitaBH = (p: number, d: number): Vista => {
    // While the last power plants are told: in closer, down towards the disc and round it, then
    // back out to where the count of thoughts begins.
    const cerca = ease(P('a8', 1.0), P('a8', 4.2), p) * (1 - ease(P('a8.contados', -2.2), P('a8.contados', 0.2), p));
    const giro = 0.03 * (p - P('a8')) + 0.55 * ease(P('a8', 1.0), P('a8.contados', 0.2), p);
    const eje = lado.clone().cross(UP).normalize();
    const dir = lado.clone().applyAxisAngle(eje, 0.1 * cerca).applyAxisAngle(UP, giro);
    return { pos: dir.multiplyScalar(d * (1 - 0.32 * cerca)), target: V(), up: UP.clone(), fov: 46 };
  };
  /** The bubble's radius (AU) by beat: a seed, then inflating past everything. */
  const radio = (p: number) => Math.exp(lerp(Math.log(0.02), Math.log(4000), ease(P('a8.crear', 1.2), P('a8.relevo', 2.4), p) ** 1.4));
  function vista(p: number): Vista {
    // From the cosmos (where act VII leaves us), down to a black hole: the stars have gone out.
    const desde: Vista = { pos: V(-0.3, 0.62, 0.72).normalize().multiplyScalar(90000 * MLY_AU), target: V(), up: UP.clone(), fov: 46 };
    const k0 = (p - P('a8')) / (P('a8.contados') - P('a8'));
    if (p < P('a8.contados')) return mezcla(desde, orbitaBH(p, 270), ease(0.02, 0.3, k0));
    if (p < P('a8.crear')) return orbitaBH(p, 270);
    // Turn to the seed beside the hole, and as it inflates, go in.
    const kc = (p - P('a8.crear')) / (P('a8.fin') - P('a8.crear'));
    const fuera = orbitaBH(p, 270);
    const R = radio(p);
    const enSemilla: Vista = { pos: SEMILLA.clone().add(V(0.35, 0.12, 1).normalize().multiplyScalar(Math.max(R * 2.6, 3))), target: SEMILLA.clone(), up: UP.clone(), fov: 50 };
    const dentro: Vista = { pos: SEMILLA.clone().add(V(0.35, 0.12, 1).normalize().multiplyScalar(R * 0.3)), target: SEMILLA.clone().add(V(-0.2, 0, -1).multiplyScalar(R)), up: UP.clone(), fov: 70 };
    // First turn from the hole to the seed (a point of light beside it), then fly to it: the path
    // never crosses the hole, and the seed stays in the middle of the view.
    if (kc < 0.55) {
      const tgt = mirar(fuera.pos, fuera.target, SEMILLA, ease(0.0, 0.12, kc));
      const s = ease(0.1, 0.35, kc);
      const pos = fuera.pos.clone().lerp(enSemilla.pos, s);
      return { pos, target: mirar(pos, tgt, SEMILLA, ease(0.08, 0.14, kc)), up: UP.clone(), fov: lerp(fuera.fov, enSemilla.fov, s) };
    }
    return mezcla(enSemilla, dentro, ease(0.55, 0.85, kc));
  }

  return {
    id: 'a8',
    numero: 'VIII',
    nombre: 'El final',
    regla: false,
    coreografia(t) {
      tl = t;
      P = (l, d = 0) => tl.at(l) + d * tl.escala;
      tl.label('a8');
      tl.set({ 'a8.lp': 46.0, 'a8.ly': 10.7 });
      tl.caption(6.6, 'Las últimas centrales', 'Cuando las estrellas se apagan, quedan los agujeros negros. De uno que gira al máximo se puede sacar hasta el 29 % de su masa; después, solo su débil radiación de Hawking.', { fuente: 'Penrose, 1969', desde: 2.0, viaje: 'Billones de años después' });
      tl.to(6.6, { 'a8.lp': 38.0, 'a8.ly': 14.0 });
      tl.label('a8.contados');
      tl.caption(5.6, 'Pensamientos contados', 'Si el universo se expandiera sin acelerar, la vida podría pensar para siempre. Pero se acelera: los pensamientos posibles son un número finito.', { fuente: 'Dyson, 1979; Krauss y Starkman, 2000' });
      tl.to(5.6, { 'a8.lp': 22.0, 'a8.ly': 100.0 });
      tl.label('a8.crear');
      tl.caption(6.0, 'Crear un universo', 'La última obra posible: una burbuja de falso vacío que crece hasta ser un universo propio. Hoy no sabemos hacerlo, pero hay ideas para intentarlo.', { fuente: 'Farhi y Guth, 1987; Ansoldi y Guendelman, 2006' });
      tl.to(6.0, {});
      tl.label('a8.relevo');
      tl.caption(5.4, 'El relevo', 'Adentro, un universo empieza. Lo que hay afuera de la burbuja, otros universos con otras leyes, es la pregunta de la próxima obra: Infinito.');
      tl.to(5.4, {});
      tl.label('a8.fin');
    },
    montar(mundo) {
      m = mundo;
      m.root.parent!.add(bh.mesh);
      m.root.add(penG, nuevoG, mente.points);
      m.nubes.push(pen, nuevo.nube, mente);
    },
    vista: (p) => vista(p),
    lectura: (p) => ({ lp: tl.get('a8.lp', p), ly: tl.get('a8.ly', p), lr: 26.1 }),
    muro(p): Muro | null {
      const a = ease(P('a8.contados', 1.4), P('a8.contados', 2.4), p) * (1 - ease(P('a8.relevo'), P('a8.relevo', 1.0), p));
      return a > 0.01 ? { lp: 21.5, label: 'muro · la muerte térmica', a, choque: ease(P('a8.contados', 2.4), P('a8.contados', 4.0), p) } : null;
    },
    estado(mundo, p) {
      const e = mundo.estado;
      // The stars have gone out: no sky, no galaxy, no Sun.
      const apaga = ease(P('a8', 1.4), P('a8', 3.2), p);
      e.tierra = 0;
      e.faros = 0;
      e.cielo = 0.5 * (1 - apaga);
      e.galaxia = 1 - apaga;
      e.sol = 1 - apaga;
      // The hole hides what is behind its shadow.
      e.oclusor = { c: V(), r: 2.6 * RS, propias: [] };
    },
    update(f: Cuadro) {
      const { p, time, camera, vista: v, k } = f;
      const here = p > P('a8', -0.5) && p < P('a8.fin', 2);
      penG.visible = here;
      // The last mind: bursts at s_k = (1.55^k − 1) / (1.55^8 − 1) of the count, crowded at first
      // (it still thinks fast), then rarer and dimmer; the last one is where the counter stops.
      // (in beats, like the counter: from P(contados, 1.0) to P(contados, 3.6))
      const t0 = P('a8.contados', 1.0);
      const span = P('a8.contados', 3.6) - t0;
      const vis = ease(P('a8.contados', 0.2), P('a8.contados', 0.8), p) * (1 - ease(P('a8.crear', -0.4), P('a8.crear', 0.4), p));
      let pulso = 0;
      for (let k = 0; k < 9; k++) {
        const s = (Math.pow(1.55, k) - 1) / (Math.pow(1.55, 8) - 1);
        const d = (p - (t0 + s * span)) / 0.09;
        if (d > -0.3 && d < 4) pulso = Math.max(pulso, Math.exp(-Math.max(d, 0) * 1.6) * smoothstep(-0.3, 0, d) * (1 - 0.085 * k));
      }
      uPulso.value = p < t0 - 0.3 ? 0.6 : pulso * 2.2;
      // After the last burst it goes dark: no more thoughts.
      mente.u.uGain.value = here ? vis * (1 - 0.8 * ease(t0 + span + 0.3, t0 + span + 1.4, p)) : 0;
      mente.points.visible = here && vis > 0.001;
      nuevoG.visible = here;
      bh.mesh.visible = here;
      if (!here) return;
      // The hole: its disk while there is matter; its Hawking glow at the end.
      const disco = ease(P('a8', 0.7), P('a8', 2.2), p) * (1 - ease(P('a8.contados', 0.6), P('a8.contados', 3.4), p));
      bh.u.uDiskL.value = disco;
      bh.u.uHawk.value = 0.07 * ease(P('a8.contados', 2.0), P('a8.contados', 4.4), p) * (1 - ease(P('a8.relevo'), P('a8.relevo', 1), p));
      const center = V().sub(v.pos).multiplyScalar(k);
      bh.update({ camera, center, normal: NORMAL, rs: RS * k, sky: new THREE.Matrix3(), time, alpha: 1 - ease(P('a8.relevo', 0.6), P('a8.relevo', 1.6), p) });
      // Penrose: the civilization's matter, in and out.
      pen.u.uOn.value = ease(P('a8', 3.2), P('a8', 4.2), p) * (1 - ease(P('a8.contados', 0.4), P('a8.contados', 1.6), p));
      pen.points.visible = pen.u.uOn.value > 0.001;
      // The new universe: a seed, the bubble inflating, inside the light pouring out.
      const R = radio(p);
      const sem = ease(P('a8.crear', 0.6), P('a8.crear', 1.4), p);
      burbuja.mesh.scale.setScalar(R);
      // From inside, the membrane is only a faint veil.
      burbuja.u.uOn.value = sem * 0.9 * (1 - 0.8 * ease(P('a8.relevo', -0.4), P('a8.relevo', 0.6), p));
      burbuja.u.uTime.value = time;
      burbuja.mesh.visible = sem > 0.001;
      nuevo.nube.points.scale.setScalar(R);
      // The first light pours out, then thins: the new universe goes on, dark, for the last words.
      nuevo.nube.u.uOn.value = sem * (0.35 + 0.4 * ease(P('a8.relevo'), P('a8.relevo', 1.5), p)) * (1 - 0.8 * ease(P('a8.relevo', 1.8), P('a8.relevo', 3.0), p));
      nuevo.nube.points.visible = sem > 0.001;
      nuevo.fill.scale.setScalar(R);
      (nuevo.fill.material as THREE.ShaderMaterial).uniforms.uOn.value = ease(P('a8.relevo', 0.4), P('a8.relevo', 2.0), p);
      nuevo.fill.visible = p > P('a8.relevo');
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u } = f;
      if (p < P('a8', -0.5) || p > P('a8.fin', 1.5)) return;
      // On the way down from the cosmos: where we are going.
      const rb = ease(P('a8', 0.4), P('a8', 0.7), p) * (1 - ease(P('a8', 1.4), P('a8', 1.65), p));
      if (rb > 0.01) {
        const q = f.proj(V());
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) rumbo(g, u, q.x, q.y, 'un agujero negro', rb);
      }
      // 29 %.
      const ce = ease(P('a8', 3.6), P('a8', 4.2), p) * (1 - ease(P('a8.contados', -0.4), P('a8.contados', 0.2), p));
      cifra(g, u, W * 0.76, H * 0.24, '29 %', '', 58, ce, TEAL, 'de su masa, como mucho, de un agujero que gira al máximo');
      if (f.lamina && ce > 0.01) {
        const q = f.proj(V(0, 0, 0));
        if (q) nota(g, u, q.x, q.y, 'ergosfera: la materia entra y sale con más energía', 60, -60, ce);
      }
      // The thoughts, counted: the counter runs and stops.
      const co = ease(P('a8.contados', 0.8), P('a8.contados', 1.4), p) * (1 - ease(P('a8.crear'), P('a8.crear', 0.6), p));
      if (co > 0.01) {
        const run = ease(P('a8.contados', 1.0), P('a8.contados', 3.6), p);
        const e = Math.round(lerp(30, 70, Math.sqrt(run)));
        const stop = run > 0.995;
        cifra(g, u, W * 0.76, H * 0.24, '10', sup(e), 58, co, stop ? '#ff9a6a' : TEAL, stop ? 'pensamientos posibles, y no más · ilustrativo' : 'pensamientos posibles · ilustrativo');
      }
      // The seed, while it is still a point: what we are going to.
      const rs = ease(P('a8.crear', 0.1), P('a8.crear', 0.4), p) * (1 - ease(P('a8.crear', 3.3), P('a8.crear', 3.7), p));
      if (rs > 0.01) {
        const q = f.proj(SEMILLA);
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) rumbo(g, u, q.x, q.y, 'una semilla de falso vacío', rs);
      }
      // The last mind.
      if (f.lamina && co > 0.01) {
        const q = f.proj(MENTE);
        if (q) nota(g, u, q.x, q.y, 'la última mente: piensa a ratos, cada vez más lento', -40, -48, co);
      }
      // The relay.
      const re = ease(P('a8.relevo', 2.0), P('a8.relevo', 3.0), p);
      if (re > 0.01) {
        texto(g, u, W / 2, H * 0.42, 'continúa en', 'rgba(242,236,224,0.7)', re, 11, 'center');
        g.save();
        g.globalAlpha = re;
        g.fillStyle = '#f2ece0';
        g.font = `italic ${46 * u}px "Instrument Serif", serif`;
        g.textAlign = 'center';
        g.fillText('Infinito', W / 2, H * 0.42 + 56 * u);
        g.restore();
        texto(g, u, W / 2, H * 0.42 + 84 * u, 'pronto', TEAL, re, 10.5, 'center');
      }
    },
  };
}
