import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';

/**
 * A Matrioshka brain (act VI), from the study Diego chose («Dejar de ser materia», way 4): nested
 * shells of computers round a star, each running on the waste heat of the one inside, the outermost
 * close to the cold of space (Bradbury). Its matter turns into bits that switch on and off, the bits
 * order themselves, and a network that thinks grows out of them.
 *
 * Units: the study's (the star at the origin; the shells' radii compressed, ×2 each instead of ×10
 * for the temperatures drawn, and the plate says so). The act scales the group to AU. A wedge is cut
 * away from every shell so the nesting shows.
 */

export const RADIOS = [0.55, 1.1, 2.2, 4.4, 8.8];
export const TEMPS = [1000, 300, 100, 30, 10];
/** False colour of each shell's temperature (lámina's heat palette, hot to cold). */
export const CAL = [
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
export const AZ = Math.PI / 4;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);


// ---------------------------------------------------------------- the shells as matter

/**
 * One shell of collectors and computers: points of light in the colour of its temperature, a few
 * of them teal (the civilization's own lights). With `desde`, every point starts somewhere else
 * (the old system) and `uK` brings it to the shell, teal while it travels.
 */
export function capaMateria(n: number, desde?: (r: () => number) => [number, number, number, number]) {
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
export function capaLamina(n: number) {
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
export function red() {
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
export function calor() {
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
export function capaBits(n: number) {
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

