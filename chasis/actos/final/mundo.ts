import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from '../../../estudios/motor/materia';
import { gauss, rng } from '../../../estudios/motor/math';
import { TEAL } from '../../../estudios/remake';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const N_DISCO = V(0.05, 1, 0.12).normalize();
export const MENTE = V(8, 6.5, 9);
/** Where the new universe is born, in the black beside the hole; and its corner where someone thinks. */
export const NACE = V(-14, 4, 10);
export const R_UNI = 9;

export function anilloDatos(): MateriaData {
  const b = materiaBuilder(271);
  const u = V(1, 0, 0).cross(N_DISCO).normalize();
  const w = N_DISCO.clone().cross(u);
  for (let i = 0; i < 16000; i++) {
    const a = b.r() * Math.PI * 2;
    const R = 26 + gauss(b.r) * 0.15;
    const p = u.clone().multiplyScalar(Math.cos(a) * R).addScaledVector(w, Math.sin(a) * R).addScaledVector(N_DISCO, gauss(b.r) * 0.05);
    b.push(p.x, p.y, p.z, TEAL, 0.05, 0.35);
  }
  return b.data();
}

/**
 * The last mind, its thoughts counted (Diego, 31 Oct: a glowing cluster said nothing): a network of
 * nodes, as the forest of neurons the work began in, each node one thought left. Each thought is a
 * flash that runs out along its links, and its node goes dark for good; they come fast at first, then
 * further and further apart, until one is left. `aKind`: when (0..1 of the moment) the node thinks
 * its thought and goes out; above 1, never.
 */
export const N_MENTE = 140;
export const R_MENTE = 1.7;
export function menteNodos() {
  const r = rng(277);
  const nodos: { p: THREE.Vector3; t: number }[] = [];
  for (let i = 0; i < N_MENTE; i++) {
    // (a ball of them, thicker towards the middle, not a shell)
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const q = R_MENTE * Math.pow(r(), 0.6);
    const d = V(Math.sqrt(1 - u * u) * Math.cos(a), u * 0.75, Math.sqrt(1 - u * u) * Math.sin(a));
    nodos.push({ p: MENTE.clone().addScaledVector(d, q), t: 0 });
  }
  // (who goes out when: densely at first, the gaps growing; the last one never)
  const orden = nodos.map((_, i) => i).sort(() => r() - 0.5);
  orden.forEach((k, j) => {
    nodos[k].t = j === orden.length - 1 ? 2 : 0.04 + 0.9 * Math.pow(j / (orden.length - 1), 2);
  });
  return nodos;
}
export function menteDatos(nodos: { p: THREE.Vector3; t: number }[]): MateriaData {
  const b = materiaBuilder(278);
  for (const n of nodos) b.push(n.p.x, n.p.y, n.p.z, b.r() < 0.25 ? 0xffffff : TEAL, 0.05, 0.9, { kind: n.t });
  return b.data();
}
/** Its links: each node to its nearest neighbours, a thought's flash running out along them. */
export function menteEnlaces(nodos: { p: THREE.Vector3; t: number }[]) {
  const pos: number[] = [];
  const t: number[] = [];
  const lado: number[] = [];
  const hecho = new Set<string>();
  nodos.forEach((n, i) => {
    const cerca = nodos
      .map((m, j) => ({ j, d: m.p.distanceTo(n.p) }))
      .filter((x) => x.j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, 3);
    for (const { j } of cerca) {
      const clave = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (hecho.has(clave)) continue;
      hecho.add(clave);
      const m = nodos[j];
      pos.push(n.p.x, n.p.y, n.p.z, m.p.x, m.p.y, m.p.z);
      // (each end carries both nodes' times: the link flashes when either thinks, and is dark once
      // both have gone out)
      t.push(n.t, m.t, m.t, n.t);
      lado.push(0, 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 2));
  g.setAttribute('aLado', new THREE.Float32BufferAttribute(lado, 1));
  const u = { uP: { value: 0 }, uOn: { value: 0 }, uFundido: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      attribute vec2 aT;
      attribute float aLado;
      uniform float uP;
      varying float vLuz;
      float estado(float t) {
        // (lit faintly while it waits, a flash as it thinks, then nothing)
        float flash = exp(-pow((uP - t) / 0.012, 2.0)) * step(t, 1.5);
        return (uP < t ? 0.18 : 0.0) + 2.2 * flash;
      }
      void main() {
        vLuz = max(estado(aT.x), 0.6 * estado(aT.y));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOn, uFundido;
      varying float vLuz;
      void main() {
        gl_FragColor = vec4(vec3(0.45, 0.92, 0.8) * vLuz * 0.35 * uOn * uFundido, 0.0);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const lineas = new THREE.LineSegments(g, mat);
  lineas.frustumCulled = false;
  lineas.renderOrder = 3;
  return { lineas, u };
}

/** The new universe: a bubble of white (its points on a sphere) and the light inside that cools into a web. */
export function burbujaDatos(): MateriaData {
  const b = materiaBuilder(281);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 30000; i++) {
    const y = 1 - ((i + 0.5) / 30000) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i;
    b.push(Math.cos(th) * rr, y, Math.sin(th) * rr, new THREE.Color(1.0, 0.96, 0.9), 0.012, 0.7);
  }
  return b.data();
}

/**
 * The new universe's first light, seen from inside it: the whole sky glowing white, then cooling
 * through gold and red to black, mottled (the faint unevenness that later becomes galaxies).
 */
export function primeraLuz() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uLuz: { value: 0 }, uFrio: { value: 0 }, uFundido: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vD;
      void main() {
        vD = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLuz, uFrio, uFundido, uTime;
      varying vec3 vD;
      float h31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float ruido(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), u.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), u.x), u.y),
                   mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), u.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), u.x), u.y), u.z);
      }
      // (light by temperature, one continuous ramp: dark, deep red, orange, gold, white; in steps it drew
      // red blots ringed in black)
      vec3 calor(float T) {
        vec3 c = mix(vec3(0.0), vec3(0.5, 0.09, 0.035), smoothstep(0.0, 0.35, T));
        c = mix(c, vec3(1.0, 0.5, 0.2), smoothstep(0.25, 0.62, T));
        c = mix(c, vec3(1.0, 0.82, 0.58), smoothstep(0.55, 0.85, T));
        return mix(c, vec3(1.0, 0.96, 0.9), smoothstep(0.82, 1.0, T));
      }
      void main() {
        vec3 d = normalize(vD);
        // (it boils, slowly: fine grain over broad swells, as the first light's own unevenness)
        vec3 q = d + vec3(0.0, uTime * 0.012, 0.0);
        float n = 0.4 * ruido(q * 3.0) + 0.24 * ruido(q * 7.0 + 3.1) + 0.16 * ruido(d * 17.0 + 7.7 - uTime * 0.02)
                + 0.12 * ruido(d * 41.0 + 1.3) + 0.08 * ruido(d * 97.0 + 5.1);
        // The temperature: nearly even at first, the unevenness growing as it cools.
        float T = clamp(1.0 - uFrio + (n - 0.5) * (0.3 + 0.5 * uFrio), 0.0, 1.0);
        // (never a flat white: even at its hottest the swells show, and it stays below a burn)
        vec3 col = calor(T) * (0.62 + 0.76 * n) * uLuz * 0.4;
        gl_FragColor = vec4(col * uFundido, 0.0);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
  m.renderOrder = 1;
  m.frustumCulled = false;
  return { mesh: m, u: mat.uniforms };
}
