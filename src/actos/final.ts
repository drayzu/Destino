import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { gauss, lerp, smoothstep } from '../engine/math';
import { TEAL, cifra, nota, rumbo, sup, type Muro } from '../engine/placa';
import { mezcla, mirar, type Vista } from '../engine/vista';
import { crearAgujero } from '../engine/agujero';
import { materia, materiaBuilder } from '../engine/materia';
import { type Mundo } from '../mundo/mundo';
import { MLY_AU } from '../mundo/cosmos';
import { frente } from '../mundo/fermi';
import { crearTu } from '../engine/tu';
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
 * - Adentro: the camera goes inside and watches a new universe begin.
 * - The closing (GUION.md 56–57, «Alguien va a mirar» in drayzu.github.io/RELEVOS.md): the young
 *   light cools and gathers into a web; down in a corner of it a point lights, someone who will think
 *   for the first time, as you do now, and the clock comes back down to your twenty watts. «¿Y si
 *   alguien hizo también el nuestro?»: the web goes out and only the point is left, breathing in the
 *   middle of the black, which is where Infinito begins. The card hands on to it (track `relevo`).
 *
 * In «Pensamientos contados» (a pause) you are beside the last mind: it goes out, you do not.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
/** The hole's horizon radius (AU): ~10⁹ Suns. */
const RS = 20;
const NORMAL = V(0.12, 1, 0.22).normalize();
/** Where the new universe starts (AU from the hole). */
const SEMILLA = V(150, 26, 70);
/** The knot of the new universe's web where someone will think (in the bubble's radii, from its seed). */
const NODO = V(-0.12, 0.04, -0.45);

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
  // Later the light cools and gathers into a web: knots inside the bubble, each tied to its nearest
  // three, and every grain on a thread or round a knot. The first knot is where someone will think.
  const nodos: THREE.Vector3[] = [NODO.clone()];
  // (and a few close round it, so threads leave its corner in every direction)
  while (nodos.length < 8) {
    const [x, y, z] = b.onSphere();
    nodos.push(NODO.clone().add(V(x, y, z).multiplyScalar(0.08 + 0.12 * b.r())));
  }
  while (nodos.length < 40) {
    const [x, y, z] = b.onSphere();
    const r = 0.85 * Math.cbrt(b.r());
    nodos.push(V(x * r, y * r, z * r));
  }
  const hilos: [number, number][] = [];
  nodos.forEach((a, i) => {
    const cerca = nodos
      .map((c, j) => [a.distanceTo(c), j] as const)
      .filter(([, j]) => j !== i)
      .sort((x, y) => x[0] - y[0])
      .slice(0, 3);
    for (const [, j] of cerca) if (!hilos.some(([x, y]) => (x === i && y === j) || (x === j && y === i))) hilos.push([i, j]);
  });
  const web = new Float32Array(9000 * 3);
  const jit = (s: number) => V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(s);
  for (let i = 0; i < 9000; i++) {
    let q: THREE.Vector3;
    if (b.r() < 0.3) q = nodos[Math.floor(b.r() * nodos.length)].clone().add(jit(0.025));
    else {
      const [a, c] = hilos[Math.floor(b.r() * hilos.length)];
      q = nodos[a].clone().lerp(nodos[c], b.r()).add(jit(0.01));
    }
    web.set([q.x, q.y, q.z], i * 3);
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `uniform float uOn, uRed; attribute vec3 aWeb;`,
    move: /* glsl */ `
      float f = fract(uTime * 0.12 + seed);
      vec3 flujo = position * (0.02 + 1.4 * f * f);
      // Brighter as they fly out, gone at the edge.
      float brillo = (1.0 - smoothstep(0.6, 1.0, f)) * (0.4 + 2.0 * f);
      // Then cooler, gathered into the web (uRed 0 → 1).
      float w = smoothstep(0.0, 1.0, uRed);
      p = mix(flujo, aWeb, w);
      // (fine grains: up close, the size of the young light's made a blur)
      sz *= mix(1.0, 0.5, w);
      em = mix(em, vec3(0.55, 0.68, 1.0) * 0.9, 0.55 * w);
      em *= uOn * mix(brillo, 1.5, w);
      fuente = 1.0;`,
    uniforms: { uOn: { value: 0 }, uRed: { value: 0 } },
    extra: { aWeb: [web, 3] },
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
  // Warmer than Tiempo's (this moment's colour is gold), but hot at its inner edge: warm white there,
  // going orange outward (at 5 200 K all of it read as a dull brown, a disk with nothing left to give).
  bh.u.uDiskT.value = 6600;
  const pen = penrose();
  const penG = new THREE.Group();
  penG.scale.setScalar(RS);
  penG.add(pen.points);
  const burbuja = frente(new THREE.Color(0.8, 0.95, 1.0));
  const nuevo = comienzo();
  const nuevoG = new THREE.Group();
  // Dyson's last mind: a shell of computers beside the hole, thinking in ever rarer bursts (each sleep
  // longer than the last, each waking dimmer), until the counter stops.
  // (off the disc, above its plane to the right of the hole: on its edge it read as a lump on the disc)
  const MENTE = V(0.9, 0.16, 0.42).normalize().cross(UP).normalize().multiplyScalar(-130).add(V(0, 30, 0));
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
  // You: beside the last mind (a pause), and at the end the someone in the new universe.
  const tu = crearTu();
  const JUNTO = MENTE.clone().add(V(20, -10, 8));
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
    const kc = (p - P('a8.crear')) / (P('a8.alguien') - P('a8.crear'));
    const fuera = orbitaBH(p, 270);
    const R = radio(p);
    const enSemilla: Vista = { pos: SEMILLA.clone().add(V(0.35, 0.12, 1).normalize().multiplyScalar(Math.max(R * 2.6, 3))), target: SEMILLA.clone(), up: UP.clone(), fov: 50 };
    const dentro: Vista = { pos: SEMILLA.clone().add(V(0.35, 0.12, 1).normalize().multiplyScalar(R * 0.3)), target: SEMILLA.clone().add(V(-0.2, 0, -1).multiplyScalar(R)), up: UP.clone(), fov: 70 };
    if (kc >= 1) {
      // Down to a corner of the web: the gaze turns to its knot by angle, then we go to it, and stay,
      // drifting a little round it.
      const nodo = SEMILLA.clone().addScaledVector(NODO, R);
      const t = ease(P('a8.alguien', 0.8), P('a8.alguien', 4.2), p);
      const dir = V(0.25, 0.1, 0.9).normalize().applyAxisAngle(UP, 0.04 * (p - P('a8.alguien')));
      const pos = dentro.pos.clone().lerp(nodo.clone().addScaledVector(dir, R * 0.16), t);
      return { pos, target: mirar(pos, dentro.target, nodo, ease(P('a8.alguien', 0.2), P('a8.alguien', 2.0), p)), up: UP.clone(), fov: lerp(70, 46, t) };
    }
    // First turn from the hole to the seed (a point of light beside it), then fly to it: the path
    // never crosses the hole, and the seed stays in the middle of the view.
    if (kc < 0.55) {
      const tgt = mirar(fuera.pos, fuera.target, SEMILLA, ease(0.0, 0.12, kc));
      // Closing in round the seed by angle and in powers of ten (a straight line shrank the distance
      // evenly: the last of it rushed, and the hole swept into the frame as the seed jumped aside).
      const s = ease(0.1, 0.4, kc);
      const da = fuera.pos.clone().sub(SEMILLA);
      const db = enSemilla.pos.clone().sub(SEMILLA);
      const la = da.length();
      const lb = db.length();
      const q = new THREE.Quaternion().setFromUnitVectors(da.divideScalar(la), db.divideScalar(lb));
      const pos = SEMILLA.clone().addScaledVector(da.applyQuaternion(new THREE.Quaternion().slerp(q, s)), Math.exp(lerp(Math.log(la), Math.log(lb), s)));
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
      tl.caption(6.6, 'Las últimas centrales', 'Cuando las estrellas se apagan, quedan los agujeros negros. Todavía se puede sacar energía de su giro.', { ficha: 'hasta el 29 % de la masa de un agujero que gira al máximo; después, su débil radiación de Hawking', fuente: 'Penrose, 1969', desde: 2.0, viaje: 'Billones de años después' });
      tl.to(6.6, { 'a8.lp': 38.0, 'a8.ly': 14.0 });
      tl.label('a8.contados');
      tl.caption(6.4, 'Pensamientos contados', 'Al universo le quedan pensamientos contados. Este que tienes ahora es uno de ellos.', { ficha: 'sin aceleración, la vida podría pensar para siempre; con ella, el número es finito', fuente: 'Dyson, 1979; Krauss y Starkman, 2000' });
      tl.to(6.4, { 'a8.lp': 22.0, 'a8.ly': 100.0 });
      tl.label('a8.crear');
      tl.caption(6.0, 'Crear un universo', 'La última obra posible: una burbuja que crece hasta ser un universo propio. Hoy no sabemos hacerlo.', { ficha: 'una burbuja de falso vacío', fuente: 'Farhi y Guth, 1987; Ansoldi y Guendelman, 2006' });
      tl.to(6.0, {});
      tl.label('a8.relevo');
      tl.caption(5.4, 'Adentro', 'Adentro, un universo empieza.');
      tl.to(5.4, {});
      // The closing (GUION.md 56–57): the light gathers into a web, and in a corner of it, someone.
      tl.label('a8.alguien');
      tl.caption(6.6, 'Alguien', 'En miles de millones de años, en algún rincón de ahí adentro, algo va a pensar por primera vez. Como tú, ahora.');
      tl.with(3.0, { 'a8.red': 1 });
      tl.with(4.4, { 'a8.baja': 1 });
      tl.to(6.6, {});
      // And ours? The web goes out and you are left, breathing in the black: Infinito's first frame.
      tl.label('a8.nuestro');
      tl.caption(7.0, '¿Y el nuestro?', '¿Y si alguien hizo también el nuestro?', { fuente: 'Linde, 1992' });
      tl.with(2.4, { 'a8.red': 2 });
      tl.wait(1.2);
      tl.with(1.6, { cromo: 0 });
      tl.wait(1.2);
      tl.with(1.6, { relevo: 1 });
      tl.wait(4.6);
      tl.label('a8.fin');
    },
    montar(mundo) {
      m = mundo;
      m.root.parent!.add(bh.mesh);
      m.root.add(penG, nuevoG, mente.points, tu.points);
      m.nubes.push(pen, nuevo.nube, mente);
    },
    vista: (p) => vista(p),
    lectura: (p) => (p < P('a8.alguien') ? { lp: tl.get('a8.lp', p), ly: tl.get('a8.ly', p), lr: 26.1 } : null),
    // In the new universe the clock comes back down to your twenty watts, as in the opening.
    libre(p) {
      const baja = tl.get('a8.baja', p);
      return { lp: lerp(22.0, Math.log10(20), baja), linea: 'algo que piensa, adentro', cifra: { valor: '20', unidad: 'W', linea: 'tú, pensando', a: ease(0.85, 1, baja) } };
    },
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
      const red = tl.get('a8.red', p);
      const apaga = 1 - ease(1, 2, red);
      const enMente = p < P('a8.crear');
      const tuOn = enMente
        ? ease(P('a8.contados', 1.6), P('a8.contados', 2.2), p) * (1 - ease(P('a8.crear', -0.6), P('a8.crear', 0.2), p))
        : ease(P('a8.alguien', 2.6), P('a8.alguien', 3.4), p);
      tu.update(enMente ? JUNTO : SEMILLA.clone().addScaledVector(NODO, radio(p)), here ? tuOn : 0, time, f.dpr);
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
      bh.u.uDiskL.value = 1.2 * disco;
      bh.u.uHawk.value = 0.02 * ease(P('a8.contados', 2.0), P('a8.contados', 4.4), p) * (1 - ease(P('a8.relevo'), P('a8.relevo', 1), p));
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
      burbuja.u.uOn.value = sem * 0.9 * (1 - 0.8 * ease(P('a8.relevo', -0.4), P('a8.relevo', 0.6), p)) * apaga;
      burbuja.u.uTime.value = time;
      burbuja.mesh.visible = sem > 0.001;
      nuevo.nube.points.scale.setScalar(R);
      // The first light pours out, then thins: the new universe goes on, dark, for the last words.
      // Then it gathers into the web, which goes out at the end.
      const luz = sem * (0.35 + 0.4 * ease(P('a8.relevo'), P('a8.relevo', 1.5), p)) * (1 - 0.8 * ease(P('a8.relevo', 1.8), P('a8.relevo', 3.0), p));
      nuevo.nube.u.uOn.value = lerp(luz, 0.9, Math.min(red, 1)) * apaga;
      nuevo.nube.u.uRed.value = Math.min(red, 1);
      nuevo.nube.points.visible = sem > 0.001;
      nuevo.fill.scale.setScalar(R);
      (nuevo.fill.material as THREE.ShaderMaterial).uniforms.uOn.value = ease(P('a8.relevo', 0.4), P('a8.relevo', 2.0), p) * apaga;
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
      // (always, with or without the plate: without its words it was a mystery)
      if (co > 0.01) {
        const q = f.proj(MENTE);
        if (q) nota(g, u, q.x, q.y, 'la última mente: piensa a ratos, cada vez más lento', -40, -48, co);
      }
    },
  };
}
