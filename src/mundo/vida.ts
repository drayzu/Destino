import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';
import { gauss } from '../engine/math';

/**
 * Matter waking up (act I), in its own small space (micro units: a cell's radius is 1), drawn with
 * the camera (`cabina` in the act): the world's coordinates cannot tell micrometres apart.
 *
 * - A cell that reacts: a microbe (no nucleus): its membrane and wall, its DNA folded in the middle,
 *   ribosomes, plasmids, hairs and a turning flagellum; a molecule touches it and a wave of light
 *   runs round the membrane. Deep sea blue.
 * - Nerves: a small net of neurons (soma, branching dendrites, an axon with its beads of myelin),
 *   pulses running along the axons. Violet.
 * - A brain: two hemispheres of folded cortex, in points, with waves of activity crossing them. Ember.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function celula() {
  // 3 500 million years ago life was microbes: a cell with no nucleus, a rod a few micrometres long.
  const b = materiaBuilder(3500);
  const part: number[] = [];
  const R = 0.8;
  const L = 0.7;
  /** A point on the rod's surface (a capsule along Z, laid along X when pushed) at radius r, and its outward normal. */
  const capsula = (r: number): [THREE.Vector3, THREE.Vector3] => {
    const cyl = 4 * Math.PI * r * L;
    const sph = 4 * Math.PI * r * r;
    if (b.r() < cyl / (cyl + sph)) {
      const a = b.r() * Math.PI * 2;
      const n = V(Math.cos(a), Math.sin(a), 0);
      return [n.clone().multiplyScalar(r).setZ((b.r() * 2 - 1) * L), n];
    }
    const [x, y, z] = b.onSphere();
    const n = V(x, y, z);
    return [n.clone().multiplyScalar(r).add(V(0, 0, Math.sign(z) * L)), n];
  };
  const wob = (q: THREE.Vector3) => 1 + 0.025 * Math.sin(3 * q.x + 1.1) * Math.cos(2 * q.z) + 0.015 * Math.sin(5 * q.y);
  // Its membrane, and the wall just outside it.
  for (let i = 0; i < 9000; i++) {
    const [q, n] = capsula(R);
    q.addScaledVector(n, R * (wob(q) - 1));
    b.push(q.z, q.y, -q.x, new THREE.Color(0.55, 0.85, 1.0), 0.011, 0.5);
    part.push(0);
  }
  for (let i = 0; i < 5000; i++) {
    const [q, n] = capsula(R + 0.06);
    q.addScaledVector(n, R * (wob(q) - 1));
    b.push(q.z, q.y, -q.x, new THREE.Color(0.45, 0.95, 0.85), 0.009, 0.2);
    part.push(6);
  }
  // Inside, the cytoplasm, faint.
  for (let i = 0; i < 2600; i++) {
    const [q] = capsula(R * Math.cbrt(b.r()) * 0.92);
    b.push(q.z, q.y, -q.x, new THREE.Color(0.3, 0.55, 0.85), 0.01, 0.1);
    part.push(1);
  }
  // Its DNA, no nucleus around it: one long loop folded on itself in the middle (the nucleoid).
  const d = V(0, 0, 0);
  const v = V(1, 0, 0);
  for (let i = 0; i < 4200; i++) {
    v.add(V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(0.35)).normalize();
    d.addScaledVector(v, 0.018);
    // (held in an ellipsoid round the middle of the rod)
    const out = (d.x / 0.42) ** 2 + (d.y / 0.42) ** 2 + (d.z / 0.85) ** 2;
    if (out > 1) v.addScaledVector(d.clone().multiply(V(1 / 0.42, 1 / 0.42, 1 / 0.85)).normalize(), -0.6).normalize();
    b.push(d.z, d.y, -d.x, new THREE.Color(1.0, 0.75, 0.45), 0.009, 0.45);
    part.push(2);
  }
  // Ribosomes, where proteins are made: grains all through it; and two small rings of DNA (plasmids).
  for (let k = 0; k < 700; k++) {
    const [q] = capsula(R * (0.3 + 0.62 * Math.cbrt(b.r())));
    for (let j = 0; j < 2; j++) {
      b.push(q.z + gauss(b.r) * 0.008, q.y + gauss(b.r) * 0.008, -q.x + gauss(b.r) * 0.008, new THREE.Color(1.0, 0.9, 0.72), 0.01, 0.55);
      part.push(3);
    }
  }
  for (const [c, r] of [[V(0.45, 0.2, 0.9), 0.1], [V(-0.4, -0.25, -0.75), 0.08]] as [THREE.Vector3, number][]) {
    const ax = V(gauss(b.r), gauss(b.r), gauss(b.r)).normalize();
    const e1 = ax.clone().cross(V(0, 1, 0)).normalize();
    const e2 = ax.clone().cross(e1);
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const q = c.clone().addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r);
      b.push(q.z, q.y, -q.x, new THREE.Color(1.0, 0.6, 0.35), 0.011, 0.6);
      part.push(3);
    }
  }
  // Short hairs (pili) all over it.
  for (let k = 0; k < 70; k++) {
    const [q, n] = capsula(R + 0.06);
    const len = 0.12 + 0.18 * b.r();
    for (let j = 0; j < 6; j++) {
      const t = (j / 6) * len;
      b.push(q.z + n.z * t, q.y + n.y * t, -(q.x + n.x * t), new THREE.Color(0.5, 0.85, 0.95), 0.007, 0.25);
      part.push(7);
    }
  }
  // The flagellum at the other end (−X): a long helix that turns and pushes it (drawn in the shader; x is how far along).
  for (let i = 0; i < 700; i++) {
    b.push(i / 700, 0, 0, new THREE.Color(0.55, 0.9, 1.0), 0.009, 0.45);
    part.push(5);
  }
  // The molecule that touches it, coming in from outside along +X.
  b.push(0, 0, 0, new THREE.Color(1.0, 0.95, 0.8), 0.05, 2.0);
  part.push(4);
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute float aPart; uniform float uOn, uToque, uOla;`,
    move: /* glsl */ `
      // Alive: everything trembles a little.
      p += vec3(sin(uTime * 1.3 + seed * 40.0), cos(uTime * 1.1 + seed * 31.0), sin(uTime * 0.9 + seed * 17.0)) * 0.004;
      if (aPart > 4.5 && aPart < 5.5) {
        float t = position.x;
        float amp = 0.16 * smoothstep(0.0, 0.12, t);
        float ph = t * 22.0 - uTime * 7.0;
        p = vec3(-(${(L + R).toFixed(2)} + 0.04) - t * 3.2, amp * cos(ph), amp * sin(ph));
      }
      if (aPart > 3.5 && aPart < 4.5) {
        // The molecule: in from far off, to the wall at the rod's end (+X).
        p = vec3(mix(4.6, ${(L + R + 0.08).toFixed(2)}, uToque), 0.1, 0.05);
        em *= step(0.001, uToque) * (1.0 - smoothstep(0.98, 1.0, uOla));
      }
      if (aPart < 0.5) {
        // The membrane answers: a wave of light from where it was touched, round both ways.
        float ang = acos(clamp(normalize(position).x, -1.0, 1.0));
        float da = ang - uOla * 3.2;
        float w = exp(-da * da / 0.02) * step(0.001, uOla);
        em = mix(em, vec3(0.6, 1.0, 0.95) * 2.4, w);
      }
      em *= uOn;
      fuente = 1.0;`,
    uniforms: { uOn: { value: 0 }, uToque: { value: 0 }, uOla: { value: 0 } },
    extra: { aPart: [new Float32Array(part), 1] },
  });
  nube.u.uSpread.value = 0;
  return nube;
}

/** A small net of neurons (micro units, ~25 across), pulses along their axons. */
export function neuronas() {
  const b = materiaBuilder(600);
  const along: number[] = [];
  const phase: number[] = [];
  const somas: THREE.Vector3[] = [];
  for (let n = 0; n < 9; n++) {
    const s = V(gauss(b.r), gauss(b.r) * 0.6, gauss(b.r)).multiplyScalar(6);
    somas.push(s);
  }
  somas.forEach((s, n) => {
    const ph = b.r();
    // The soma.
    for (let i = 0; i < 260; i++) {
      const [x, y, z] = b.onSphere();
      const r = 0.45 * Math.cbrt(b.r());
      b.push(s.x + x * r, s.y + y * r, s.z + z * r, new THREE.Color(0.85, 0.6, 1.0), 0.03, 0.8);
      along.push(-1);
      phase.push(ph);
    }
    // Dendrites: branching, shorter each time.
    const branch = (o: THREE.Vector3, d: THREE.Vector3, len: number, depth: number) => {
      const steps = Math.round(len * 26);
      const p = o.clone();
      const dir = d.clone();
      for (let k = 0; k < steps; k++) {
        dir.add(V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(0.08)).normalize();
        p.addScaledVector(dir, len / steps);
        b.push(p.x, p.y, p.z, new THREE.Color(0.7, 0.45, 1.0), 0.016, 0.35);
        along.push(-1);
        phase.push(ph);
      }
      if (depth > 0) for (let j = 0; j < 2; j++) branch(p, dir.clone().add(V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(0.7)).normalize(), len * 0.62, depth - 1);
    };
    for (let j = 0; j < 5; j++) branch(s, V(gauss(b.r), gauss(b.r), gauss(b.r)).normalize(), 1.6, 2);
    // The axon: towards the next neuron, beaded with myelin, branching at its end.
    const to = somas[(n + 1) % somas.length].clone().add(V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(0.8));
    const steps = 420;
    const bend = V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(1.5);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const q = s.clone().lerp(to, t).addScaledVector(bend, 4 * t * (1 - t));
      const bead = Math.sin(t * 60) > 0.6;
      b.push(q.x, q.y, q.z, bead ? new THREE.Color(0.95, 0.8, 1.0) : new THREE.Color(0.65, 0.45, 1.0), bead ? 0.03 : 0.018, bead ? 0.55 : 0.3);
      along.push(t);
      phase.push(ph);
    }
  });
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute float aAlong, aPhase; uniform float uOn;`,
    move: /* glsl */ `
      // A pulse runs down each axon; the soma flashes as it leaves.
      float f = fract(uTime * 0.35 + aPhase);
      if (aAlong >= 0.0) {
        float d = (aAlong - f) / 0.03;
        em += vec3(0.9, 0.85, 1.0) * 3.0 * exp(-d * d);
      } else {
        em *= 1.0 + 2.0 * exp(-f * 30.0);
      }
      em *= uOn;
      fuente = 1.0;`,
    uniforms: { uOn: { value: 0 } },
    extra: { aAlong: [new Float32Array(along), 1], aPhase: [new Float32Array(phase), 1] },
  });
  nube.u.uSpread.value = 0;
  return nube;
}

/**
 * A brain (micro units, ~65 long): two hemispheres split by the deep midline, their cortex folded into
 * gyri (bright ridges) and sulci (dark grooves, a little deeper); the lateral fissure setting the
 * temporal lobe apart and the central sulcus across the top; under the back, the striped cerebellum
 * and the brain stem. Waves of activity cross it. Front is +Z, up is +Y.
 */
export function cerebro() {
  const b = materiaBuilder(86);
  // Value noise and its fBm, to fold the cortex.
  const h = (x: number, y: number, z: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const n3 = (x: number, y: number, z: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    const l = (a: number, c: number, t: number) => a + (c - a) * t;
    return l(
      l(l(h(ix, iy, iz), h(ix + 1, iy, iz), ux), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), ux), uy),
      l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), ux), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), ux), uy),
      uz,
    );
  };
  const warm = new THREE.Color(1.0, 0.62, 0.55);
  const deep = new THREE.Color(0.55, 0.22, 0.2);
  const col = new THREE.Color();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 80000; i++) {
      const [x, y, z] = b.onSphere();
      // One hemisphere: the half facing out, its flat inner face set back from the midline.
      if (x * side < -0.05) continue;
      const lado = Math.abs(x);
      // The shape: longer than tall, rounder on top, flatter beneath the front, the temporal lobe
      // bulging low on the side.
      let rx = 17;
      let ry = y > 0 ? 21 : 15;
      const rz = 31;
      const temporal = Math.exp(-(((y + 0.45) / 0.25) ** 2) - (((z - 0.1) / 0.4) ** 2));
      rx *= 1 + 0.14 * temporal;
      if (y < -0.25 && z > 0.35) ry *= 0.75;
      // The folds: gyri and sulci from the zero lines of a warped noise.
      const w = n3(x * 2.2 + 3, y * 2.2, z * 2.2) * 1.4;
      const f = n3(x * 4.2 + w + side * 9, y * 4.2 + w, z * 4.2 + w) - 0.5;
      let surco = 1 - Math.min(1, Math.abs(f) / 0.06);
      // The lateral fissure (temporal lobe below it) and the central sulcus over the top.
      const sylvio = lado > 0.4 && z > -0.5 && z < 0.6 ? 1 - Math.min(1, Math.abs(y - (-0.22 - 0.28 * z)) / 0.035) : 0;
      const central = y > -0.15 ? 1 - Math.min(1, Math.abs(z - (0.02 + 0.16 * y)) / 0.025) : 0;
      surco = Math.max(surco, sylvio * 1.0, central * 0.9);
      const r = 1 - 0.1 * surco;
      const px = (x * rx + side * 1.8) * r;
      const py = y * ry * r;
      const pz = z * rz * r;
      // The medial face is dim (seen through the midline gap); the sulci are dark.
      const med = lado < 0.25 ? 0.4 : 1;
      col.copy(warm).lerp(deep, surco);
      b.push(px, py, pz, col, 0.2, (0.58 - 0.54 * surco) * med);
    }
  }
  // The cerebellum, under the back: two lobes in fine horizontal folia.
  for (let i = 0; i < 12000; i++) {
    const [x, y, z] = b.onSphere();
    const folia = Math.abs(Math.sin(y * 34 + z * 6));
    const r = 1 - 0.05 * (1 - folia);
    const lobe = Math.sign(x) * 1.5;
    b.push((x * 12 + lobe) * r, y * 6 * r - 12, z * 8 * r - 19, new THREE.Color(1.0, 0.55, 0.5), 0.15, 0.2 + 0.35 * folia);
  }
  // The brain stem.
  for (let i = 0; i < 2500; i++) {
    const a = b.r() * Math.PI * 2;
    const t = b.r();
    const rr = 3.4 - 0.8 * t;
    b.push(Math.cos(a) * rr, -9 - t * 14, Math.sin(a) * rr * 0.9 - 9 - t * 3, new THREE.Color(0.9, 0.5, 0.45), 0.14, 0.25);
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `uniform float uOn;`,
    move: /* glsl */ `
      // Waves of activity crossing the cortex.
      float w = sin(dot(position, vec3(0.08, 0.05, 0.11)) - uTime * 1.6) + sin(dot(position, vec3(-0.06, 0.1, 0.04)) - uTime * 1.1);
      em *= 0.55 + 0.9 * smoothstep(0.9, 1.9, w);
      em *= uOn;
      fuente = 1.0;`,
    uniforms: { uOn: { value: 0 } },
  });
  nube.u.uSpread.value = 0;
  return nube;
}

/** Where today's data centres cluster (latitude, longitude): the machines that think. */
export const DATOS: [number, number][] = [
  [39.0, -77.5], [37.4, -122.0], [33.4, -112.0], [41.6, -93.6], [32.8, -96.8], [45.6, -121.2], [41.9, -87.6], [33.7, -84.4],
  [53.3, -6.3], [52.4, 4.9], [50.1, 8.7], [51.5, -0.1], [48.9, 2.3], [59.3, 18.1], [1.35, 103.8], [35.7, 139.7], [37.6, 127.0],
  [22.3, 114.2], [31.2, 121.5], [39.9, 116.4], [19.1, 72.9], [-23.5, -46.6], [-33.9, 151.2], [25.2, 55.3],
];
