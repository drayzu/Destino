import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';
import { gauss } from '../engine/math';

/**
 * The cosmos (act VII), in millions of light years (Mly; a group scaled to AU), our galaxy at the
 * origin:
 *
 * - The galaxies on the cosmic web: knots (clusters), the threads between them, few in the voids.
 *   Their light falls with distance, softened, with a floor (the web's texture from afar).
 * - Up to four bubbles (`uB`: centre and radius, comoving Mly; `uBC`: colour): the galaxies inside
 *   take the bubble's colour. Ours is the first (teal); the others are other expansive civilizations.
 * - The expansion: positions are comoving and `uA` scales them; past the horizon (`uHor`, physical
 *   Mly) galaxies dim and redden: they can no longer be reached.
 * - The probes: lines from our galaxy to galaxies, drawn as far as their front (`uProg`, Mly).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** AU in a million light years. */
export const MLY_AU = 63241.077 * 1e6;
const R_WEB = 9000;

export function universo() {
  const b = materiaBuilder(2013);
  const lum: number[] = [];
  // The knots: our Local Group at the origin, then clusters across the volume.
  const nodes: THREE.Vector3[] = [V()];
  while (nodes.length < 260) {
    const v = V(b.r() * 2 - 1, b.r() * 2 - 1, b.r() * 2 - 1).multiplyScalar(R_WEB);
    if (v.length() > R_WEB) continue;
    if (nodes.some((n) => n.distanceTo(v) < 700)) continue;
    nodes.push(v);
  }
  // The threads: each knot to its two or three nearest.
  const edges: [number, number][] = [];
  nodes.forEach((n, i) => {
    const near = nodes.map((m, j) => ({ j, d: n.distanceTo(m) })).filter((x) => x.j !== i).sort((a, c) => a.d - c.d);
    for (const { j } of near.slice(0, 2 + (b.r() < 0.4 ? 1 : 0))) if (!edges.some(([x, y]) => (x === i && y === j) || (x === j && y === i))) edges.push([i, j]);
  });
  const col = new THREE.Color();
  const put = (p: THREE.Vector3, l: number) => {
    const k = b.r();
    if (k < 0.4) col.setRGB(1.0, 0.86, 0.64);
    else if (k < 0.85) col.setRGB(0.78, 0.86, 1.0);
    else col.setRGB(1.0, 0.95, 0.88);
    b.push(p.x, p.y, p.z, col, 2.0, 1);
    lum.push(l);
  };
  for (const n of nodes) for (let k = 0; k < 110; k++) put(n.clone().add(V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(90 * (0.4 + b.r()))), 0.35 + 0.6 * b.r());
  for (const [i, j] of edges) {
    const a = nodes[i];
    const c = nodes[j];
    const n = Math.round(a.distanceTo(c) / 5);
    // A thread: thick and soft, bowed, thinner in the middle.
    const bow = V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(a.distanceTo(c) * 0.12);
    for (let k = 0; k < n; k++) {
      const t = b.r();
      const w = 70 + 130 * Math.abs(t - 0.5);
      put(a.clone().lerp(c, t).addScaledVector(bow, 4 * t * (1 - t)).add(V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(w)), 0.15 + 0.45 * b.r());
    }
  }
  for (let k = 0; k < 9000; k++) {
    const p = V(b.r() * 2 - 1, b.r() * 2 - 1, b.r() * 2 - 1).multiplyScalar(R_WEB);
    if (p.length() < R_WEB) put(p, 0.08 + 0.2 * b.r());
  }
  const data = b.data();
  const nube = materia(data, {
    pre: /* glsl */ `attribute float aLumU;
      uniform float uScale, uA, uHor, uOn;
      uniform vec4 uB[4];
      uniform vec3 uBC[4];`,
    move: /* glsl */ `
      p = position * uA;
      vec4 mq = modelViewMatrix * vec4(p, 1.0);
      float d = length(mq.xyz) / uScale;
      // What it sends to where we are: softened near, a floor far away (the web's texture).
      float f = aLumU * (1.0 / (1.0 + d * d / 4.0e6) + 0.035);
      em = color * f;
      // Inside a bubble, a civilization's colour.
      for (int i = 0; i < 4; i++) {
        if (uB[i].w > 0.0) {
          float inside = 1.0 - smoothstep(uB[i].w * 0.97, uB[i].w, distance(position, uB[i].xyz));
          em = mix(em, uBC[i] * (dot(em, vec3(0.33)) * 1.7 + 0.004), inside);
        }
      }
      // Past the horizon: out of reach, dimmer and redder.
      if (uHor > 0.0) {
        float out1 = smoothstep(uHor * 0.98, uHor * 1.06, length(p));
        em = mix(em, vec3(1.0, 0.35, 0.22) * dot(em, vec3(0.33)) * 0.45, out1);
      }
      em *= uOn;
      sz = max(size, d * 0.0022);
      fuente = 1.0;`,
    uniforms: {
      uScale: { value: 1 },
      uA: { value: 1 },
      uHor: { value: 0 },
      uOn: { value: 0 },
      uB: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
      uBC: { value: [new THREE.Color(0.4, 1.0, 0.82), new THREE.Color(1.0, 0.42, 0.78), new THREE.Color(1.0, 0.72, 0.3), new THREE.Color(0.55, 0.62, 1.0)] },
    },
    extra: { aLumU: [new Float32Array(lum), 1] },
  });
  nube.u.uSpread.value = 0;
  // Galaxies the probes head for: a few hundred, from near to the far edge.
  const metas: THREE.Vector3[] = [];
  for (let k = 0; k < 520; k++) {
    const i = Math.floor(b.r() * (data.position.length / 3));
    metas.push(V(data.position[i * 3], data.position[i * 3 + 1], data.position[i * 3 + 2]));
  }
  return { nube, metas, nodes };
}

/** The probes: a line from our galaxy to each target, drawn up to their front (`uProg`, comoving Mly). */
export function sondas(metas: THREE.Vector3[]) {
  const pos: number[] = [];
  const len: number[] = [];
  const t: number[] = [];
  for (const m of metas) {
    pos.push(0, 0, 0, m.x, m.y, m.z);
    const L = m.length();
    len.push(L, L);
    t.push(0, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aLen', new THREE.Float32BufferAttribute(len, 1));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  const u = { uProg: { value: 0 }, uA: { value: 1 }, uOn: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      attribute float aLen, aT;
      uniform float uA;
      varying float vD;
      void main() { vD = aT * aLen; gl_Position = projectionMatrix * modelViewMatrix * vec4(position * uA, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uProg, uOn;
      varying float vD;
      void main() {
        if (vD > uProg) discard;
        // Brightest at the head, where the probes are now.
        float hd = (vD - uProg) / max(uProg * 0.06, 20.0);
        float head = exp(-hd * hd);
        gl_FragColor = vec4(vec3(0.4, 1.0, 0.82) * (0.08 + 0.9 * head) * uOn, 1.0);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return { lines, u };
}
