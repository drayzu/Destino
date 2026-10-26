import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';
import { gauss } from '../engine/math';

/**
 * Matter waking up (act I), in its own small space (micro units: a cell's radius is 1), drawn with
 * the camera (`cabina` in the act): the world's coordinates cannot tell micrometres apart.
 *
 * - A cell that reacts: its membrane, its nucleus, its mitochondria; a molecule touches it and a
 *   wave of light runs round the membrane. Deep sea blue.
 * - Nerves: a small net of neurons (soma, branching dendrites, an axon with its beads of myelin),
 *   pulses running along the axons. Violet.
 * - A brain: two hemispheres of folded cortex, in points, with waves of activity crossing them. Ember.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function celula() {
  const b = materiaBuilder(3500);
  const part: number[] = [];
  // The membrane: a wobbly sphere.
  for (let i = 0; i < 6000; i++) {
    const [x, y, z] = b.onSphere();
    const w = 1 + 0.05 * Math.sin(3 * x + 1.1) * Math.cos(2 * y) + 0.03 * Math.sin(5 * z);
    b.push(x * w, y * w, z * w, new THREE.Color(0.55, 0.85, 1.0), 0.012, 0.55);
    part.push(0);
  }
  // Inside: the cytoplasm, faint; the nucleus, warmer; the mitochondria, small orange knots.
  for (let i = 0; i < 2500; i++) {
    const [x, y, z] = b.onSphere();
    const r = Math.cbrt(b.r()) * 0.92;
    b.push(x * r, y * r, z * r, new THREE.Color(0.3, 0.55, 0.85), 0.01, 0.12);
    part.push(1);
  }
  for (let i = 0; i < 1800; i++) {
    const [x, y, z] = b.onSphere();
    const r = 0.34 * (0.94 + 0.06 * b.r());
    b.push(x * r - 0.16, y * r + 0.06, z * r, new THREE.Color(1.0, 0.75, 0.45), 0.012, 0.5);
    part.push(2);
  }
  for (let k = 0; k < 9; k++) {
    const c = V(gauss(b.r), gauss(b.r), gauss(b.r)).normalize().multiplyScalar(0.55 + 0.25 * b.r());
    const d = V(gauss(b.r), gauss(b.r), gauss(b.r)).normalize();
    for (let i = 0; i < 160; i++) {
      const t = (b.r() - 0.5) * 0.28;
      const q = c.clone().addScaledVector(d, t).add(V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(0.025));
      b.push(q.x, q.y, q.z, new THREE.Color(1.0, 0.55, 0.3), 0.012, 0.45);
      part.push(3);
    }
  }
  // The molecule that touches it, coming in from outside along +X.
  b.push(0, 0, 0, new THREE.Color(1.0, 0.95, 0.8), 0.05, 2.0);
  part.push(4);
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute float aPart; uniform float uOn, uToque, uOla;`,
    move: /* glsl */ `
      // Alive: everything trembles a little.
      p += vec3(sin(uTime * 1.3 + seed * 40.0), cos(uTime * 1.1 + seed * 31.0), sin(uTime * 0.9 + seed * 17.0)) * 0.004;
      if (aPart > 3.5) {
        // The molecule: in from far off, to the membrane at +X.
        p = vec3(mix(3.5, 1.04, uToque), 0.1, 0.05);
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

/** A brain (micro units, ~90 across): two hemispheres of folded cortex and the cerebellum, waves of activity. */
export function cerebro() {
  const b = materiaBuilder(86);
  const fold = (x: number, y: number, z: number) => 0.06 * Math.sin(x * 0.9 + 2.0 * Math.sin(z * 0.7)) * Math.cos(y * 1.1 + z * 0.4) + 0.04 * Math.sin(z * 1.7 + y * 0.8);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 26000; i++) {
      const [x, y, z] = b.onSphere();
      if (x * side < -0.15) continue;
      const r = 1 + fold(x * 9, y * 9, z * 9);
      const px = (x * 18 + side * 1.2) * r;
      const py = y * 22 * r;
      const pz = z * 32 * r;
      if (py < -14 && pz < -10) continue;
      b.push(px, py, pz, new THREE.Color(1.0, 0.62, 0.55), 0.18, 0.45);
    }
  }
  // The cerebellum, behind and below.
  for (let i = 0; i < 7000; i++) {
    const [x, y, z] = b.onSphere();
    const r = 1 + 0.04 * Math.sin(y * 40);
    b.push(x * 18 * r, y * 9 * r - 16, z * 11 * r - 24, new THREE.Color(1.0, 0.55, 0.5), 0.16, 0.4);
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
