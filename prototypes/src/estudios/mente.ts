import * as THREE from 'three';
import { Timeline } from '../timeline';
import { cielo } from '../cielo';
import { sol } from '../obras';
import { enfocar, materia, materiaBuilder, type Nube } from '../materia';
import { lerp, smoothstep } from '../math';
import { TEAL, cifra, ink, nota, sup } from '../placa';
import { linea, pr, texto } from './lamina';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Study · act VI, «Hacia adentro»: the turn away from matter. A civilization that has its galaxy
 * stops growing outwards and starts thinking inwards: a Matrioshka brain (Bradbury), nested shells
 * of computers around a star, each one running on the waste heat of the one inside, the outermost
 * close to the cold of space. The cold thinks more: erasing a bit costs at least kT ln 2 (Landauer
 * 1961; measured by Bérut et al. 2012), 110 times less at 2.7 K than at 300 K, so a sphere around
 * the Sun goes from ~10⁴⁷ operations per second at 1 AU to ~10⁴⁹ near the coldest limit (Wright 2020,
 * § 4.5). Then the image stops being matter: the civilization becomes computation (post-biological,
 * digital minds) and the scene becomes living lámina. No simulation: the world is not revealed as
 * computed; it is us who turn into computing. The wall: the cold. Thinking costs energy, and energy
 * is paid in heat; nothing gets colder than the background.
 *
 * Three ways of the same turn:
 * 1 · Capas: from outside in. The camera dives through the shells; each one it crosses stops being
 *     matter (points of light) and becomes a drawing (lámina), until only living lámina is left: a
 *     network where thoughts run.
 * 2 · Reordenar: nothing is created, the mind reorders. The planets and the swarm flow into the
 *     shells; then the matter itself lights up as a network, and the camera flies through it.
 * 3 · Calor: the camera rides the heat outwards, shell by shell (1 000 K → 10 K), in false colour;
 *     each shell is a grid of bits being erased, faster where it is colder; then the bits order
 *     themselves into patterns that travel: thought.
 * 4 · Elegida (the mix Diego chose): the shells as matter from outside; their matter turns into
 *     bits; the camera dives in among the bits switching on and off all around; they order
 *     themselves, and the network that thinks (nodes and pulses of 1 and 2) grows out of them.
 *
 * World units: arbitrary, the star at the origin; the shells' radii are compressed (×2 each instead
 * of ×10 for the temperatures drawn) and the lámina says so. A wedge is cut away so the nesting shows.
 */

const RADIOS = [0.55, 1.1, 2.2, 4.4, 8.8];
const TEMPS = [1000, 300, 100, 30, 10];
/** False colour of each shell's temperature (lámina's heat palette, hot to cold). */
const CAL = [
  new THREE.Color(1.0, 0.72, 0.4),
  new THREE.Color(1.0, 0.44, 0.18),
  new THREE.Color(0.86, 0.22, 0.09),
  new THREE.Color(0.56, 0.11, 0.08),
  new THREE.Color(0.34, 0.07, 0.08),
];
const TEAL_C = new THREE.Color(0.43, 0.89, 0.76);
const R_STAR = 0.07;
/** The cut: the wedge 0 < atan2(x, z) < π/2 is removed from every shell. */
const enCorte = (x: number, z: number) => {
  const a = Math.atan2(x, z);
  return a > 0 && a < Math.PI / 2;
};
const AZ = Math.PI / 4;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const coma = (v: number, d: number) => v.toFixed(d).replace('.', ',');

type Vista = { pos: THREE.Vector3; target: THREE.Vector3; fov: number };
const orbita = (d: number, az: number, el: number, target = V(), fov = 42): Vista => ({
  pos: target.clone().add(V(Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d)),
  target,
  fov,
});
const mezcla = (a: Vista, b: Vista, t: number): Vista => {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ta = a.target.clone().lerp(b.target, t);
  const da = a.pos.clone().sub(a.target);
  const db = b.pos.clone().sub(b.target);
  const dir = da.clone().normalize().lerp(db.clone().normalize(), t).normalize();
  const d = Math.exp(lerp(Math.log(da.length()), Math.log(db.length()), t));
  return { pos: ta.clone().addScaledVector(dir, d), target: ta, fov: lerp(a.fov, b.fov, t) };
};

// ---------------------------------------------------------------- the shells as matter

/**
 * One shell of collectors and computers: points of light in the colour of its temperature, a few
 * of them teal (the civilization's own lights). With `desde`, every point starts somewhere else
 * (the old system) and `uK` brings it to the shell, teal while it travels.
 */
function capaMateria(n: number, desde?: (r: () => number) => [number, number, number, number]) {
  const b = materiaBuilder(700 + n);
  const N = [5000, 8000, 12000, 17000, 22000][n];
  const R = RADIOS[n];
  for (let i = 0; i < N; ) {
    const [x, y, z] = b.onSphere();
    if (enCorte(x, z)) continue;
    const j = 1 + (b.r() - 0.5) * 0.012;
    const glint = b.r() < 0.07;
    const src = desde?.(b.r);
    b.push(x * R * j, y * R * j, z * R * j, glint ? TEAL_C : CAL[n], R * 0.0065, glint ? 0.9 : 0.75, { from: src ? [src[0], src[1], src[2]] : undefined, kind: src?.[3] ?? 0, delay: b.r() });
    i++;
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `uniform float uTint;`,
    // While it flows in from the old system it is the swarm's teal; once in place, its heat colour.
    // Before: the swarm in the civilization's teal, the planets in the grey of rock.
    move: /* glsl */ `float arrived = mix(1.0, k, uTint);
      vec3 before = aKind > 0.5 ? vec3(0.62, 0.56, 0.5) * 0.35 : vec3(0.45, 1.0, 0.85) * 0.5;
      em = mix(before, em, arrived) * mix(0.2, 1.0, arrived);`,
    uniforms: { uTint: { value: desde ? 1 : 0 } },
  });
  nube.u.uFuente.value = 1;
  return nube;
}

/** The shell as a drawing: meridians and parallels (the cut left open), in lámina teal. */
function capaLamina(n: number) {
  const R = RADIOS[n];
  const pts: number[] = [];
  const add = (a: THREE.Vector3, c: THREE.Vector3) => {
    const mx = (a.x + c.x) / 2;
    const mz = (a.z + c.z) / 2;
    if (enCorte(mx, mz)) return;
    pts.push(a.x, a.y, a.z, c.x, c.y, c.z);
  };
  const at = (th: number, ph: number) => V(Math.sin(th) * Math.sin(ph) * R, Math.cos(th) * R, Math.sin(th) * Math.cos(ph) * R);
  const step = Math.PI / 8;
  for (let ph = 0; ph < Math.PI * 2 - 1e-6; ph += step) for (let k = 0; k < 48; k++) add(at((k / 48) * Math.PI, ph), at(((k + 1) / 48) * Math.PI, ph));
  for (let th = step; th < Math.PI - 1e-6; th += step) for (let k = 0; k < 120; k++) add(at(th, (k / 120) * Math.PI * 2), at(th, ((k + 1) / 120) * Math.PI * 2));
  // The cut's edges: two half-circles where the wedge was removed.
  for (const ph of [0, Math.PI / 2]) for (let k = 0; k < 48; k++) pts.push(...at((k / 48) * Math.PI, ph).toArray(), ...at(((k + 1) / 48) * Math.PI, ph).toArray());
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color: TEAL_C, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return { lines, mat };
}

// ---------------------------------------------------------------- living lámina: the network

/**
 * Thought as a drawing: nodes on every shell, each tied to its nearest neighbours and to the
 * nearest node of the next shell out (thoughts run on the heat that flows outwards). Pulses run
 * along the links, more often on the colder shells (more bits for the same energy).
 */
function red() {
  const rand = materiaBuilder(31).r;
  const nodes: THREE.Vector3[] = [];
  const shellOf: number[] = [];
  const COUNT = [140, 230, 330, 430, 520];
  COUNT.forEach((c, n) => {
    for (let i = 0; i < c; ) {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const x = Math.cos(a) * s;
      const z = u;
      if (enCorte(x, z)) continue;
      nodes.push(V(x, Math.sin(a) * s, z).multiplyScalar(RADIOS[n]));
      shellOf.push(n);
      i++;
    }
  });
  const pos: number[] = [];
  const at: number[] = [];
  const seed: number[] = [];
  const rate: number[] = [];
  const link = (i: number, j: number, n: number) => {
    const a = nodes[i];
    const c = nodes[j];
    pos.push(a.x, a.y, a.z, c.x, c.y, c.z);
    at.push(0, 1);
    const s = rand();
    seed.push(s, s);
    const r = (0.12 + 0.1 * rand()) * (1 + 0.55 * n);
    rate.push(r, r);
  };
  for (let i = 0; i < nodes.length; i++) {
    const n = shellOf[i];
    const near: [number, number][] = [];
    let out = -1;
    let outD = Infinity;
    for (let j = 0; j < nodes.length; j++) {
      if (j === i) continue;
      const d = nodes[i].distanceToSquared(nodes[j]);
      if (shellOf[j] === n) {
        if (near.length < 3) near.push([d, j]);
        else if (d < near[2][0]) near[2] = [d, j];
        near.sort((x, y) => x[0] - y[0]);
      } else if (shellOf[j] === n + 1 && d < outD) {
        outD = d;
        out = j;
      }
    }
    for (const [, j] of near) if (j > i) link(i, j, n);
    if (out >= 0 && rand() < 0.22) link(i, out, n);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  geo.setAttribute('aRate', new THREE.Float32BufferAttribute(rate, 1));
  const u = { uTime: { value: 0 }, uA: { value: 0 }, uColor: { value: TEAL_C.clone() } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      attribute float aT, aSeed, aRate;
      uniform float uTime;
      varying float vT, vPh;
      void main() {
        vT = aT;
        vPh = fract(uTime * aRate + aSeed) * 1.6 - 0.3;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uA; uniform vec3 uColor;
      varying float vT, vPh;
      void main() {
        float d = vT - vPh;
        float pulse = exp(-d * d * 320.0);
        gl_FragColor = vec4(uColor * (0.09 + 1.7 * pulse) * uA, 1.0);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  // The nodes: small teal sources.
  const b = materiaBuilder(32);
  for (const p of nodes) b.push(p.x, p.y, p.z, TEAL_C, 0.012, 0.9);
  const puntos = materia(b.data());
  puntos.u.uFuente.value = 1;
  return { lines, u, puntos, nodes };
}

// ---------------------------------------------------------------- heat, flowing out

/**
 * Heat: sparks that leave each shell outwards and reach the next one (the star's light to the first
 * shell, the last shell's heat to space), in the colour of where they come from.
 */
function calor() {
  const b = materiaBuilder(55);
  const from = [R_STAR * 1.1, ...RADIOS];
  const to = [RADIOS[0], ...RADIOS.slice(1), RADIOS[4] * 2.6];
  const cols = [new THREE.Color(1.0, 0.86, 0.6), ...CAL];
  for (let n = 0; n < from.length; n++) {
    const N = [700, 900, 1100, 1300, 1500, 1700][n];
    for (let i = 0; i < N; ) {
      const [x, y, z] = b.onSphere();
      if (enCorte(x, z)) continue;
      b.push(x * from[n], y * from[n], z * from[n], cols[n], from[n] * 0.012, 1.0, { kind: to[n] / from[n] });
      i++;
    }
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `uniform float uFlow;`,
    move: /* glsl */ `
      float f = fract(uTime * 0.11 + seed);
      p = position * mix(1.0, aKind, f);
      em *= uFlow * smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.8, 1.0, f));`,
    uniforms: { uFlow: { value: 0 } },
  });
  nube.u.uFuente.value = 1;
  return nube;
}

// ---------------------------------------------------------------- the shells as bits (way 3)

/**
 * A shell as a grid of bits, in false colour: cells that are erased and rewritten at random (more
 * cells and faster where it is colder), and, with `uOrden`, the same bits ordered into patterns that
 * travel across the shell: thought, drawn.
 */
function capaBits(n: number) {
  const u = {
    uTime: { value: 0 },
    uA: { value: 0 },
    uOrden: { value: 0 },
    uCells: { value: [28, 40, 56, 76, 100][n] },
    uRate: { value: 1.5 * Math.sqrt(TEMPS[0] / TEMPS[n]) },
    uHeat: { value: CAL[n].clone() },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(RADIOS[n], 160, 96),
    new THREE.ShaderMaterial({
      uniforms: u,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vP;
        void main() { vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uA, uOrden, uCells, uRate; uniform vec3 uHeat;
        varying vec2 vUv; varying vec3 vP;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          float az = atan(vP.x, vP.z);
          if (az > 0.0 && az < 1.5708) discard;
          float lat = abs(vUv.y - 0.5) * 2.0;
          if (lat > 0.9) discard;
          vec2 g = vec2(vUv.x * uCells * 2.0, vUv.y * uCells);
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5;
          // Bits erased and rewritten at random.
          float tick = floor(uTime * uRate + h(id) * 9.0);
          float rnd = step(0.6, h(id + vec2(tick * 0.37, tick * 0.11)));
          // The same bits, ordered: patterns that travel.
          float w = sin(id.x * 0.23 + id.y * 0.17 - uTime * 1.4) + sin(id.x * 0.09 - id.y * 0.31 + uTime * 0.9)
                  + 0.8 * sin(length(id - vec2(uCells, uCells * 0.5)) * 0.42 - uTime * 2.2);
          float ord = step(1.05, w);
          float on = mix(rnd, ord, uOrden);
          float m = max(abs(f.x), abs(f.y));
          float cell = 1.0 - smoothstep(0.28, 0.38, m);
          float grid = smoothstep(0.42, 0.5, m) * 0.12;
          vec3 col = mix(uHeat, vec3(0.43, 0.89, 0.76), uOrden);
          vec3 c = col * (on * cell * 1.5 + grid + 0.04);
          c *= gl_FrontFacing ? 1.0 : 0.4;
          gl_FragColor = vec4(c * uA, 1.0);
        }`,
    }),
  );
  mesh.frustumCulled = false;
  return { mesh, u };
}

// ---------------------------------------------------------------- the old system (way 2)

/** Where the shells' matter was before: the swarm (a thin ring) and the planets (clumps). */
const PLANETAS = [
  { r: 0.38, a: 2.1, s: 0.025 },
  { r: 0.72, a: 4.0, s: 0.05 },
  { r: 1.0, a: 5.3, s: 0.05 },
  { r: 1.52, a: 0.9, s: 0.035 },
  { r: 5.2, a: 3.3, s: 0.32 },
  { r: 9.5, a: 4.7, s: 0.26 },
];
function sistemaViejo(r: () => number): [number, number, number, number] {
  if (r() < 0.45) {
    const a = r() * Math.PI * 2;
    const R = 0.92 + (r() - 0.5) * 0.18;
    return [Math.sin(a) * R, (r() - 0.5) * 0.03, Math.cos(a) * R, 0];
  }
  const pl = PLANETAS[Math.floor(r() * PLANETAS.length)];
  const u = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u) * pl.s * Math.cbrt(r());
  return [Math.sin(pl.a) * pl.r + Math.cos(a) * s, u * pl.s * 0.8, Math.cos(pl.a) * pl.r + Math.sin(a) * s, 1];
}

// ---------------------------------------------------------------- the study

export const mente: Escena = {
  id: 'mente',
  nombre: 'Dejar de ser materia',
  estilos: [
    { key: '1', nombre: 'Capas', nota: 'De fuera hacia dentro: la cámara cruza las capas del cerebro Matrioshka y cada una deja de ser materia y se vuelve dibujo, hasta que solo queda la lámina viva donde corren los pensamientos.' },
    { key: '2', nombre: 'Reordenar', nota: 'Nada se crea: los planetas y el enjambre fluyen hasta formar las capas; después esa misma materia se enciende como una red que piensa, y la cámara vuela por ella.' },
    { key: '3', nombre: 'Calor', nota: 'La cámara viaja con el calor que sale, de capa en capa, de 1 000 K a 10 K; cada capa es una cuadrícula de bits que se borran, más rápido donde hace más frío, y al final los bits se ordenan en pensamientos.' },
    { key: '4', nombre: 'Elegida', nota: 'La mezcla que eligió Diego: la materia de las capas se vuelve bits; la cámara entra entre cuadros que se encienden y se apagan, los bits se ordenan y de ellos nace la red que piensa.' },
  ],
  montar(stage, estilo): Instancia {
    const s = estilo + 1;
    stage.bloom.strength = 0.6;
    stage.bloom.radius = 0.45;
    stage.bloom.threshold = 0.5;
    stage.renderer.toneMappingExposure = 1.0;
    const root = new THREE.Group();
    stage.root.add(root);
    const sky = cielo(0.7);
    stage.root.add(sky.mesh);

    const star = sol();
    star.group.scale.setScalar(R_STAR);
    root.add(star.group);
    const mat = s !== 3 ? RADIOS.map((_, n) => capaMateria(n, s === 2 ? sistemaViejo : undefined)) : [];
    for (const c of mat) root.add(c.points);
    const lam = s === 1 || s === 2 ? RADIOS.map((_, n) => capaLamina(n)) : [];
    for (const c of lam) root.add(c.lines);
    const bits = s >= 3 ? RADIOS.map((_, n) => capaBits(n)) : [];
    for (const c of bits) root.add(c.mesh);
    const net = s !== 3 ? red() : null;
    if (net) root.add(net.lines, net.puntos.points);
    const heat = calor();
    root.add(heat.points);
    const nubes: Nube[] = [...mat, heat, ...(net ? [net.puntos] : [])];

    // ------------------------------------------------------------ the journey
    const tl = new Timeline({ k: 0, cam: 0, frio: 0, lam: 0, red: 0, flow: 0, orden: 0, muro: 0 });
    tl.caption(2.8, 'Pensar con una estrella', 'Un cerebro Matrioshka: capas de computadoras, una dentro de otra, alrededor de una estrella. Cada capa piensa con el calor que suelta la de adentro.');
    tl.label('estrella').to(2.8, { cam: 1, k: 1 });
    tl.caption(2.8, 'El frío piensa más', 'Borrar un bit cuesta al menos kT ln 2: a 3 K, 110 veces menos que a 300 K. Con la luz de un sol, de 10⁴⁷ a 10⁴⁹ operaciones por segundo.');
    tl.label('frio').to(2.8, { cam: 2, frio: 1, flow: 1 });
    tl.caption(4.2, 'Dejar de ser materia', 'Una civilización así ya no necesita cuerpos: sus mentes son cálculo. Lo que queda de nosotros es la forma en que corre la información.');
    tl.label('mente').to(0.4, { frio: 0 }).to(3.8, { cam: 3, lam: 1, red: 1, orden: 1 });
    tl.caption(2.8, 'El frío', 'Pensar cuesta energía, y la energía se paga en calor. Nada se enfría por debajo del fondo del universo: cada pensamiento tiene su precio.');
    tl.label('muro').to(2.8, { cam: 4, muro: 1 });
    tl.to(0.6, {});
    const P = (l: string) => tl.at(l);
    const ease = smoothstep;

    // ------------------------------------------------------------ cameras
    const fuera = orbita(30, AZ + 0.75, 0.32, V(), 40);
    function camara(p: number, time: number): Vista {
      const c = tl.get('cam', p);
      const drift = 0.02 * Math.sin(time * 0.1);
      if (s === 1) {
        // Outside → into the cut → through the shells to the star → far away.
        const a = orbita(lerp(34, 26, ease(0, 1, c)), AZ + 0.75 - 0.1 * c + drift, lerp(0.55, 0.36, ease(0, 1, c)), V(), 40);
        const b = orbita(15, AZ + 0.22 + drift, 0.24, V(), 44);
        const kD = ease(2, 3, c);
        const d = orbita(Math.exp(lerp(Math.log(15), Math.log(0.34), kD)), AZ + 0.22 + 0.6 * kD + drift, lerp(0.24, 0.05, kD), V(), lerp(44, 70, kD));
        // Inside, looking along the shells rather than at the star.
        if (kD > 0.6) d.target = V(0, 0, 0).lerp(orbita(1.2, AZ + 0.82 + 1.3, 0.25).pos, ease(0.6, 1, kD));
        const e = orbita(70, AZ + 0.9 + drift, 0.4, V(), 36);
        if (c < 1) return a;
        if (c < 2) return mezcla(a, b, ease(1, 2, c));
        if (c < 3) return d;
        return mezcla(d, e, ease(3, 4, c));
      }
      if (s === 2) {
        // Outside while the system reorders → into the cut → skimming the third shell among the nodes → far.
        const a = orbita(lerp(30, 24, ease(0, 1, c)), AZ + 1.2 - 0.4 * c + drift, lerp(0.62, 0.36, ease(0, 1, c)), V(), 40);
        const b = orbita(14, AZ + 0.25 + drift, 0.22, V(), 44);
        const kF = ease(2, 3, c);
        const R = lerp(14, RADIOS[2] * 1.12, ease(0, 0.5, kF));
        const az = AZ + 0.25 + lerp(0, 2.2, kF);
        const pos = orbita(R, az, lerp(0.22, 0.18, kF)).pos;
        const ahead = orbita(RADIOS[2] * 1.02, az + 0.55, 0.12).pos;
        const f: Vista = { pos, target: V().lerp(ahead, ease(0.25, 0.6, kF)), fov: lerp(44, 66, kF) };
        const e = orbita(70, AZ + 0.9 + drift, 0.4, V(), 36);
        if (c < 1) return a;
        if (c < 2) return mezcla(a, b, ease(1, 2, c));
        if (c < 3) return f;
        return mezcla(f, e, ease(3, 4, c));
      }
      if (s === 4) {
        // Outside → into the cut → swooping in through the bits of the outer shells → skimming the
        // inside of the fourth shell, among bits and then the network → far away.
        const a = orbita(lerp(34, 26, ease(0, 1, c)), AZ + 0.75 - 0.1 * c + drift, lerp(0.55, 0.36, ease(0, 1, c)), V(), 40);
        const b = orbita(16, AZ + 0.3 + drift, 0.24, V(), 44);
        const kF = ease(2, 3, c);
        const R = Math.exp(lerp(Math.log(16), Math.log(RADIOS[3] * 0.86), ease(0, 0.4, kF)));
        const az = AZ + 0.3 + lerp(0, 1.0, ease(0, 0.25, kF)) + 1.3 * ease(0.35, 1, kF);
        const pos = orbita(R, az, lerp(0.24, 0.1, ease(0, 0.4, kF))).pos;
        const ahead = orbita(RADIOS[3] * 0.97, az + 0.5, 0.15).pos;
        const fl: Vista = { pos, target: V().lerp(ahead, ease(0.18, 0.45, kF)), fov: lerp(44, 68, ease(0, 0.5, kF)) };
        const e = orbita(70, AZ + 0.9 + drift, 0.4, V(), 36);
        if (c < 1) return a;
        if (c < 2) return mezcla(a, b, ease(1, 2, c));
        if (c < 3) return fl;
        return mezcla(fl, e, ease(3, 4, c));
      }
      // 3: outside → down to the star → riding the heat out to the fourth shell → out to space.
      const a = orbita(lerp(32, 24, ease(0, 1, c)), AZ + 0.6 + drift, 0.3, V(), 40);
      const kR = ease(1, 2, c);
      const r = kR < 0.25 ? Math.exp(lerp(Math.log(24), Math.log(0.16), ease(0, 0.25, kR))) : Math.exp(lerp(Math.log(0.16), Math.log(RADIOS[3] * 0.82), ease(0.25, 1, kR)));
      const ride = orbita(r, AZ + 0.6 + 0.35 * kR, 0.12, V(), lerp(40, 62, ease(0, 0.3, kR)));
      // Near the star the camera turns round (sideways, never through itself) and rides the heat out.
      const inward = ride.pos.clone().negate().normalize();
      const side = V(0, 1, 0).cross(inward).normalize();
      const turn = Math.PI * ease(0.16, 0.4, kR);
      const dir = inward.multiplyScalar(Math.cos(turn)).addScaledVector(side, Math.sin(turn)).add(V(0, 0.12 * ease(0.3, 0.6, kR), 0)).normalize();
      ride.target = ride.pos.clone().addScaledVector(dir, Math.max(r, 0.2));
      const look = orbita(RADIOS[3] * 0.8, AZ + 0.95 + 0.25 * ease(2, 3, c), 0.12, V(), 62);
      look.target = orbita(RADIOS[3], AZ + 1.55 + 0.3 * ease(2, 3, c), 0.2).pos;
      const e = orbita(80, AZ + 1.0 + drift, 0.35, V(), 36);
      if (c < 1) return a;
      if (c < 2) return mezcla(a, ride, ease(1, 1.25, c));
      if (c < 3) return mezcla(ride, look, ease(2, 2.4, c));
      return mezcla(look, e, ease(3, 4, c));
    }

    const tmp = V();
    const lectura = { lp: 37.0, ly: 8.5, lr: Math.log10(1e5 * 9.4607e15) };
    return {
      tl,
      lectura: () => lectura,
      rotulo: (p) => tl.captionAt(p),
      muro: (p) => {
        const m = tl.get('muro', p);
        return m > 0.01 ? { lp: 37.25, label: 'muro · el frío', a: ease(0, 0.3, m), choque: ease(0.4, 0.9, m) } : null;
      },
      update(f: Frame) {
        const { camera, p, time } = f;
        const v = camara(p, time);
        camera.position.copy(v.pos);
        camera.up.set(0, 1, 0);
        camera.lookAt(v.target);
        camera.fov = v.fov;
        camera.near = 1e-3;
        camera.far = 1e4;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        const focal = f.H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const dist = v.pos.length();
        const lamK = tl.get('lam', p);
        const flow = tl.get('flow', p);
        const muroK = tl.get('muro', p);
        // Way 4: matter → bits (late in «El frío piensa más»), the bits ordered, then the network.
        const bitsK = s === 4 ? ease(P('frio') + 1.0, P('frio') + 2.4, p) : 1;
        // Inside, the bits flicker at random for a while (the immersion), then order themselves.
        const ordenK = s === 4 ? ease(P('mente') + 2.4, P('mente') + 3.2, p) : tl.get('orden', p);
        const redK = s === 4 ? ease(P('mente') + 2.8, P('mente') + 4.0, p) : tl.get('red', p);
        // The sky dims as the image stops being matter.
        sky.u.uBrillo.value = 0.7 * (1 - 0.75 * lamK) * (s === 3 ? 0.6 : 1);
        // The star: hidden by the shells, seen through the cut; drawn (dimmed) once all is lámina.
        star.update(camera, time, s === 3 ? 0.55 : lerp(0.35, 0.96, lamK));
        star.group.children[1].visible = s === 3 || (lamK < 0.35 && (s !== 4 || dist > 5));
        // Matter → drawing: way 1 shell by shell as the camera crosses it; way 2 all at once.
        mat.forEach((c, n) => {
          const crossed = s === 1 ? ease(RADIOS[n] * 1.25, RADIOS[n] * 0.85, dist) * ease(0, 0.15, lamK) : ease(0.15, 0.7, lamK);
          const gone = s === 4 ? 0.88 * bitsK : 0.85 * crossed;
          c.u.uGain.value = (s === 2 ? 0.3 + 0.7 * ease(0, 0.12, tl.get('k', p)) : 1) * (1 - gone) * (1 - 0.5 * muroK * (s === 2 ? 1 : 0));
          c.u.uK.value = s === 2 ? tl.get('k', p) : 1;
          if (lam[n]) lam[n].mat.opacity = (s === 1 ? 0.24 * crossed : 0.16 * ease(0.3, 0.9, lamK)) * (n === 4 ? 0.7 : 1);
        });
        if (net) {
          net.u.uTime.value = time;
          net.u.uA.value = 0.8 * redK * (1 - 0.35 * muroK);
          net.puntos.u.uGain.value = redK;
        }
        bits.forEach((c, n) => {
          c.u.uTime.value = time;
          c.u.uOrden.value = ordenK;
          // Bright when the camera is near it, so crossing one flashes its grid.
          const near = 1 - ease(0.0, 0.6, Math.abs(Math.log(dist / RADIOS[n])));
          // Way 4: no white-out when the camera leaves through a shell close up.
          const flash = s === 4 ? 0.9 - 0.5 * ordenK : 0.9;
          c.u.uA.value = (0.55 + flash * near) * (n === 4 ? 0.85 : 1) * bitsK * (s === 4 ? (1 - 0.45 * redK) * (1 - 0.7 * ease(0, 0.3, muroK)) : 1);
          c.mesh.visible = bitsK > 0.003;
        });
        heat.u.uFlow.value = s === 3 ? 0.35 + 0.65 * Math.max(flow, ease(1, 1.3, tl.get('cam', p))) : 0.9 * flow * (1 - lamK * 0.6);
        for (const n of nubes) {
          enfocar(n, focal, f.dpr, time);
          n.u.uSizeUnit.value = 1;
          n.u.uMinPx.value = 1.2 * f.dpr;
        }
        if (net) net.puntos.u.uMinPx.value = 1.6 * f.dpr;
        heat.u.uMinPx.value = 1.3 * f.dpr;
        heat.u.uMaxPx.value = 5 * f.dpr;
      },
      placa(g: CanvasRenderingContext2D, f: Frame) {
        const { p, W, H, u, camera, time } = f;
        const proj = (w: THREE.Vector3) => pr(w, camera, W, H);
        const cam = tl.get('cam', p);
        const lamK = tl.get('lam', p);
        // The temperature of each shell, on the cut's edge (lámina).
        const ta = ease(P('estrella') + 1.2, P('estrella') + 1.8, p) * (1 - ease(P('mente') + 0.4, P('mente') + 1.0, p));
        if (ta > 0.01) {
          RADIOS.forEach((R, n) => {
            const q = proj(orbita(R, AZ - 0.02, 0.16 + 0.04 * n).pos);
            if (!q) return;
            const per = coma(TEMPS[0] / TEMPS[n], 0);
            const label = tl.get('frio', p) > 0.3 ? `${TEMPS[n]} K · bits por julio ×${per}` : `${TEMPS[n]} K`;
            nota(g, u, q.x, q.y, label, 30 + 6 * n, -22 - 8 * n, ta, `#${CAL[n].getHexString()}`);
          });
          texto(g, u, W / 2, H - 300 * u, 'radios comprimidos · tamaño ilustrativo · colores: temperatura (falso color)', ink(0.5), ta, 9, 'center', false);
        }
        // The numbers are the show: from 10⁴⁷ to 10⁴⁹ operations per second with the light of one sun.
        const fr = tl.get('frio', p);
        if (fr > 0.01) {
          const late = ease(P('frio') + 1.3, P('frio') + 2.0, p);
          cifra(g, u, W * 0.74, H * 0.24, '10', late > 0.5 ? '49' : '47', 64, fr * (late > 0.5 ? 1 : 1 - 0.6 * ease(0.3, 0.5, late)), late > 0.5 ? TEAL : ink(0.95), late > 0.5 ? 'operaciones/s · cerca del frío del fondo' : 'operaciones/s · una esfera a 1 UA');
        }
        // Way 1: the star, drawn, once everything is lámina.
        if (s !== 3 && lamK > 0.3) {
          const c = proj(V());
          const e = proj(camera.position.clone().sub(V()).normalize().cross(V(0, 1, 0)).normalize().multiplyScalar(R_STAR * 1.6));
          const rr = c && e ? Math.max(6 * u, Math.hypot(e.x - c.x, e.y - c.y)) : 0;
          if (c && e && rr < 0.2 * H) {
            const a = ease(0.3, 0.8, lamK) * (1 - ease(P('muro'), P('muro') + 1.2, p));
            g.save();
            g.globalAlpha = a;
            g.strokeStyle = '#ffe0a0';
            g.lineWidth = Math.max(1, 1.2 * u);
            g.beginPath();
            g.arc(c.x, c.y, rr, 0, Math.PI * 2);
            g.stroke();
            for (let k = 0; k < 12; k++) {
              const ang = (k / 12) * Math.PI * 2 + time * 0.05;
              linea(g, u, [{ x: c.x + Math.cos(ang) * rr * 1.25, y: c.y + Math.sin(ang) * rr * 1.25 }, { x: c.x + Math.cos(ang) * rr * 1.7, y: c.y + Math.sin(ang) * rr * 1.7 }], '#ffe0a0', a * 0.7, [], 1);
            }
            g.restore();
            if (s === 1) nota(g, u, c.x + rr * 0.7, c.y - rr * 0.7, 'la estrella', 30, -30, a * (1 - ease(P('mente') + 2.4, P('mente') + 3.0, p)), '#ffe0a0');
          }
        }
        // Way 3: what each shell pays per bit, as we cross it.
        if (s === 3) {
          const dist = camera.position.length();
          RADIOS.forEach((R, n) => {
            const near = (1 - ease(0.0, 0.35, Math.abs(Math.log(dist / R)))) * ease(1.1, 1.4, cam) * (1 - ease(2.0, 2.3, cam));
            if (near < 0.01) return;
            const J = 1.380649e-23 * TEMPS[n] * Math.LN2;
            const e = Math.floor(Math.log10(J));
            texto(g, u, W / 2, H * 0.2, `${TEMPS[n]} K`, `#${CAL[n].getHexString()}`, near, 22, 'center', false);
            texto(g, u, W / 2, H * 0.2 + 30 * u, `borrar un bit: ${coma(J / 10 ** e, 1)} × 10${sup(e)} J`, ink(0.8), near, 11, 'center');
          });
        }
        // Way 2: what the shells were made of.
        if (s === 2) {
          const a = ease(0.1, 0.4, p) * (1 - ease(1.2, 1.8, p));
          const pl = proj(V(Math.sin(PLANETAS[4].a) * PLANETAS[4].r, 0, Math.cos(PLANETAS[4].a) * PLANETAS[4].r));
          if (pl) nota(g, u, pl.x, pl.y, 'un planeta gigante · materia para las capas', 30, -34, a);
          const sw = proj(V(Math.sin(2.6) * 0.92, 0, Math.cos(2.6) * 0.92));
          if (sw) nota(g, u, sw.x, sw.y, 'el enjambre', -40, 34, a);
          texto(g, u, W / 2, H * 0.2, 'nada se crea: la mente reordena', ink(0.85), ease(0.9, 1.4, p) * (1 - ease(2.2, 2.8, p)), 12, 'center');
        }
        // Thought, named.
        const fin = 1 - ease(P('muro') + 0.2, P('muro') + 0.8, p);
        if (s === 4) {
          texto(g, u, W / 2, H * 0.2, 'cada cuadro, un bit que se borra y se reescribe', ink(0.85), ease(P('mente') + 1.3, P('mente') + 1.7, p) * (1 - ease(P('mente') + 2.2, P('mente') + 2.5, p)), 12, 'center');
          texto(g, u, W / 2, H * 0.2, 'los bits se ordenan: un pensamiento', TEAL, ease(P('mente') + 2.6, P('mente') + 2.9, p) * (1 - ease(P('mente') + 3.3, P('mente') + 3.6, p)), 12, 'center');
          texto(g, u, W / 2, H * 0.2, 'cada pulso, un mensaje entre mentes', TEAL, ease(P('mente') + 3.6, P('mente') + 4.0, p) * fin, 12, 'center');
        } else {
          const ra = tl.get('red', p) * ease(P('mente') + 1.6, P('mente') + 2.2, p) * fin;
          texto(g, u, W / 2, H * 0.2, s === 3 ? 'los mismos bits, ordenados: un pensamiento' : 'cada pulso, un mensaje entre mentes', TEAL, s === 3 ? tl.get('orden', p) * ease(P('mente') + 1.4, P('mente') + 2.0, p) * fin : ra, 12, 'center');
        }
        // The wall: the cold. A thermometer down to the floor of the universe.
        const m = tl.get('muro', p);
        if (m > 0.01) termometro(g, f, ease(0.15, 0.5, m), ease(0.45, 0.9, m));
      },
      dispose() {},
    };

    /** The wall drawn: temperatures on a log bar, from the star to the cosmic background; below, nothing. */
    function termometro(g: CanvasRenderingContext2D, f: Frame, a: number, hit: number) {
      const { W, H, u } = f;
      const x0 = W * 0.24;
      const x1 = W * 0.76;
      const y = H * 0.22;
      const X = (T: number) => x0 + ((Math.log10(5800) - Math.log10(T)) / (Math.log10(5800) - Math.log10(1))) * (x1 - x0);
      g.save();
      g.globalAlpha = a;
      g.fillStyle = 'rgba(4,6,8,0.6)';
      g.beginPath();
      g.roundRect(x0 - 24 * u, y - 46 * u, x1 - x0 + 48 * u, 96 * u, 8 * u);
      g.fill();
      g.restore();
      linea(g, u, [{ x: x0, y }, { x: X(2.725), y }], ink(0.7), a, [], 2);
      linea(g, u, [{ x: X(2.725), y }, { x: x1, y }], 'rgba(255,106,74,0.9)', a, [3, 3], 2);
      const tick = (T: number, label: string, col: string, up: boolean) => {
        const x = X(T);
        linea(g, u, [{ x, y: y - 6 * u }, { x, y: y + 6 * u }], col, a, [], 1.4);
        texto(g, u, x, y + (up ? -18 : 20) * u, label, col, a, 9.5, 'center', false);
      };
      tick(5800, 'la estrella · 5 800 K', '#ffe0a0', true);
      tick(1000, '1 000 K', `#${CAL[0].getHexString()}`, false);
      tick(300, '300 K · nosotros', ink(0.8), true);
      tick(30, '30 K', `#${CAL[3].getHexString()}`, false);
      tick(10, '10 K', `#${CAL[4].getHexString()}`, false);
      tick(2.725, '2,7 K · el fondo del universo', TEAL, true);
      // The wall: past the background, no colder sink; it glows when we press on it.
      const xw = X(2.725);
      g.save();
      g.globalAlpha = a;
      g.strokeStyle = `rgba(255,106,74,${0.6 + 0.4 * hit})`;
      g.lineWidth = Math.max(1, (1.4 + 1.6 * hit) * u);
      g.shadowColor = '#ff5b4a';
      g.shadowBlur = 12 * hit * u;
      g.beginPath();
      g.moveTo(xw, y - 30 * u);
      g.lineTo(xw, y + 30 * u);
      g.stroke();
      g.restore();
      texto(g, u, (xw + x1) / 2, y + 22 * u, 'más frío no hay', 'rgba(255,140,110,0.95)', a * hit, 9.5, 'center', false);
      texto(g, u, W / 2, y + 62 * u, 'kT ln 2 > 0: ningún pensamiento es gratis', ink(0.85), a * hit, 11, 'center');
    }
  },
};
