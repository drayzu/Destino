import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from './motor/materia';

/**
 * Pieces of the opening act's moments (apertura.ts): a string of stars the spark flies past, each
 * with its planets on their orbits («Planetas por todas partes»).
 *
 * Units: thousands of light years (the galaxy's), the systems drawn far larger than they are (a
 * system a light year across, its planets hundreds of times their size) so they read as one goes by.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export interface Sistema {
  /** Where its star is. */
  c: THREE.Vector3;
  /** Its star's colour and size (kly). */
  color: THREE.Color;
  r: number;
  /** Its orbital plane: the normal. */
  n: THREE.Vector3;
  /** Its planets: orbit radius, phase, speed (rad/s of ambient time), planet radius, kind. */
  planetas: { R: number; fase: number; w: number; rp: number; tipo: 'roca' | 'agua' | 'gas' | 'hielo' | 'lava' }[];
}

/**
 * Five systems strung along the way from `desde` to `hasta`, a little to either side of it: an
 * orange star, a red dwarf with close planets, a white star with giants, a yellow one like ours, and
 * another red dwarf. The way (`via`) passes between their planets.
 */
export function sistemas(desde: THREE.Vector3, hasta: THREE.Vector3) {
  const eje = hasta.clone().sub(desde);
  const largo = eje.length();
  eje.normalize();
  const lado = V(0, 1, 0).cross(eje).normalize();
  const arriba = eje.clone().cross(lado).normalize();
  const K = largo / 0.0105;
  const en = (t: number, l: number, a: number) => desde.clone().addScaledVector(eje, t * largo).addScaledVector(lado, l * K).addScaledVector(arriba, a * K);
  const plano = (x: number, y: number, z: number) => V(x, y, z).normalize();
  const S: Sistema[] = [
    {
      c: en(0.12, 0.0024, -0.0003), color: new THREE.Color(1.0, 0.7, 0.42), r: 0.00009 * K, n: plano(0.15, 1, 0.1),
      planetas: [
        { R: 0.00034 * K, fase: 0.3, w: 0.16, rp: 0.000034 * K, tipo: 'roca' },
        { R: 0.00062 * K, fase: 2.4, w: 0.09, rp: 0.000048 * K, tipo: 'agua' },
        { R: 0.00105 * K, fase: 4.4, w: 0.05, rp: 0.00011 * K, tipo: 'gas' },
      ],
    },
    {
      c: en(0.32, -0.0022, 0.0004), color: new THREE.Color(1.0, 0.45, 0.3), r: 0.00006 * K, n: plano(-0.2, 1, 0.25),
      planetas: [
        { R: 0.00018 * K, fase: 1.0, w: 0.3, rp: 0.000026 * K, tipo: 'lava' },
        { R: 0.0003 * K, fase: 3.1, w: 0.2, rp: 0.000032 * K, tipo: 'roca' },
        { R: 0.00044 * K, fase: 5.0, w: 0.13, rp: 0.000038 * K, tipo: 'agua' },
        { R: 0.0006 * K, fase: 0.2, w: 0.09, rp: 0.00003 * K, tipo: 'hielo' },
      ],
    },
    {
      c: en(0.52, 0.0026, 0.0001), color: new THREE.Color(0.85, 0.9, 1.0), r: 0.0001 * K, n: plano(0.3, 1, -0.2),
      planetas: [
        { R: 0.00048 * K, fase: 2.0, w: 0.1, rp: 0.0001 * K, tipo: 'gas' },
        { R: 0.00092 * K, fase: 4.0, w: 0.06, rp: 0.00008 * K, tipo: 'hielo' },
      ],
    },
    {
      c: en(0.71, -0.0024, -0.0003), color: new THREE.Color(1.0, 0.86, 0.6), r: 0.00008 * K, n: plano(-0.1, 1, -0.15),
      planetas: [
        { R: 0.00026 * K, fase: 0.8, w: 0.18, rp: 0.00003 * K, tipo: 'roca' },
        { R: 0.00045 * K, fase: 3.6, w: 0.12, rp: 0.000044 * K, tipo: 'agua' },
        { R: 0.00078 * K, fase: 5.6, w: 0.07, rp: 0.0001 * K, tipo: 'gas' },
        { R: 0.0011 * K, fase: 1.9, w: 0.045, rp: 0.00007 * K, tipo: 'hielo' },
      ],
    },
    {
      c: en(0.88, 0.002, 0.0003), color: new THREE.Color(1.0, 0.5, 0.32), r: 0.00006 * K, n: plano(0.25, 1, 0.3),
      planetas: [
        { R: 0.0002 * K, fase: 4.2, w: 0.26, rp: 0.000028 * K, tipo: 'roca' },
        { R: 0.00034 * K, fase: 0.9, w: 0.17, rp: 0.000036 * K, tipo: 'agua' },
        { R: 0.00052 * K, fase: 2.7, w: 0.11, rp: 0.000032 * K, tipo: 'roca' },
      ],
    },
  ];
  // The way: from `desde` past each star, threading between its planets (inside the outer orbits),
  // to `hasta`.
  const pasos = [desde.clone()];
  S.forEach((s, i) => {
    const fuera = s.c.clone().sub(desde).addScaledVector(eje, -s.c.clone().sub(desde).dot(eje)).normalize();
    const R = s.planetas[s.planetas.length - 1].R;
    pasos.push(s.c.clone().addScaledVector(fuera, -R * 0.55).addScaledVector(arriba, (i % 2 ? 1 : -1) * R * 0.12));
  });
  return { S, pasos };
}

/** The stars: a bright core and a soft halo each. */
export function estrellasDatos(S: Sistema[]): MateriaData {
  const b = materiaBuilder(503);
  for (const s of S) {
    b.push(s.c.x, s.c.y, s.c.z, s.color, s.r * 0.7, 3.2);
    // (a little body of light round the core, so up close it is a ball, not a flat disc)
    for (let i = 0; i < 300; i++) {
      const [x, y, z] = b.onSphere();
      const q = Math.cbrt(b.r()) * s.r * 0.45;
      b.push(s.c.x + x * q, s.c.y + y * q, s.c.z + z * q, s.color, s.r * 0.12, 0.25);
    }
  }
  return b.data();
}

function basePlano(n: THREE.Vector3) {
  const u = V(1, 0, 0).cross(n);
  if (u.lengthSq() < 1e-6) u.set(0, 0, 1);
  u.normalize();
  return [u, n.clone().cross(u).normalize()];
}

/** The orbits: faint dotted rings. */
export function orbitasDatos(S: Sistema[]): MateriaData {
  const b = materiaBuilder(509);
  const col = new THREE.Color(0.55, 0.62, 0.75);
  for (const s of S) {
    const [u, v] = basePlano(s.n);
    for (const p of s.planetas) {
      const n = Math.round(260 + p.R / (s.planetas[0].R) * 60);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const q = s.c.clone().addScaledVector(u, Math.cos(a) * p.R).addScaledVector(v, Math.sin(a) * p.R);
        b.push(q.x, q.y, q.z, col, p.rp * 0.12, 0.16);
      }
    }
  }
  return b.data();
}

/**
 * The planets, each a ball of points lit from its star (a day side and a night side), moving on its
 * orbit with the ambient time. `position`: the point's place on the unit ball; `aC` the star; `aU`,
 * `aV` the orbit's plane; `aO` (radius, phase, speed); `aKind` the planet's radius.
 */
export function planetasDatos(S: Sistema[]) {
  const b = materiaBuilder(521);
  const r = b.r;
  const C: number[] = [];
  const U: number[] = [];
  const W: number[] = [];
  const O: number[] = [];
  const c = new THREE.Color();
  const tonos: Record<string, (y: number, x: number, z: number) => THREE.Color> = {
    roca: (y, x) => c.setRGB(0.62, 0.48, 0.38).multiplyScalar(0.75 + 0.5 * Math.abs(Math.sin(x * 7 + y * 5))),
    lava: (y, x) => (Math.sin(x * 9 + y * 6) > 0.6 ? c.setRGB(1.0, 0.45, 0.15) : c.setRGB(0.35, 0.22, 0.18)),
    agua: (y, x, z) => (Math.abs(y) > 0.85 ? c.setRGB(0.92, 0.95, 1.0) : Math.sin(x * 5 + z * 4) * Math.cos(y * 6) > 0.45 ? c.setRGB(0.48, 0.56, 0.32) : Math.sin(x * 11 + y * 13) > 0.7 ? c.setRGB(0.95, 0.97, 1.0) : c.setRGB(0.18, 0.4, 0.9)),
    gas: (y) => (Math.sin(y * 14) > 0 ? c.setRGB(0.92, 0.8, 0.62) : c.setRGB(0.72, 0.52, 0.36)),
    hielo: (y) => c.setRGB(0.62, 0.82, 0.95).multiplyScalar(0.85 + 0.2 * Math.sin(y * 9)),
  };
  for (const s of S) {
    const [u, v] = basePlano(s.n);
    for (const p of s.planetas) {
      const n = Math.round(THREE.MathUtils.clamp((p.rp / 0.00003) * 900, 700, 2600));
      const ga = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const y = 1 - ((i + 0.5) / n) * 2;
        const rr = Math.sqrt(1 - y * y);
        const th = ga * i;
        const x = Math.cos(th) * rr;
        const z = Math.sin(th) * rr;
        b.push(x, y, z, tonos[p.tipo](y, x, z), p.rp * 0.1, 0.42 + r() * 0.1, { kind: p.rp });
        C.push(s.c.x, s.c.y, s.c.z);
        U.push(u.x, u.y, u.z);
        W.push(v.x, v.y, v.z);
        O.push(p.R, p.fase, p.w);
      }
    }
  }
  return { data: b.data(), C: new Float32Array(C), U: new Float32Array(U), W: new Float32Array(W), O: new Float32Array(O) };
}

/** GLSL for the planets: on their orbits, lit by their stars. */
export const GLSL_PLANETAS = {
  pre: /* glsl */ `attribute vec3 aC, aU, aV, aO; uniform float uSis;`,
  move: /* glsl */ `
    float an = aO.y + aO.z * uTime;
    vec3 centro = aC + (aU * cos(an) + aV * sin(an)) * aO.x;
    vec3 nrm = normalize(position);
    p = centro + nrm * aKind;
    float dia = smoothstep(-0.15, 0.35, dot(nrm, normalize(aC - centro)));
    em *= (0.06 + 0.94 * dia) * uSis;
  `,
};

/**
 * A shell of light like remake's capaLuz (bright at its rim, faint across its face, softly mottled),
 * but safe where its face looks straight at the camera (there the rim's base could fall a hair below
 * zero, and a power of it is not a number on some GPUs: the bloom then spreads it to a black frame).
 */
export function capaSegura(color: THREE.Color, opciones: { cara?: number; grano?: number } = {}) {
  const u = { uOn: { value: 0 }, uFundido: { value: 1 }, uTime: { value: 0 }, uColor: { value: color.clone() }, uCara: { value: opciones.cara ?? 0.06 }, uGrano: { value: opciones.grano ?? 0.35 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vL;
      void main() {
        vL = position;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOn, uFundido, uTime, uCara, uGrano;
      uniform vec3 uColor;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vL;
      float h31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float ruido(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      void main() {
        float c = clamp(abs(dot(normalize(vN), normalize(-vV))), 0.0, 1.0);
        float borde = pow(clamp(1.0 - c, 0.0, 1.0), 2.4);
        vec3 d = normalize(vL);
        float grano = 0.55 * ruido(d * 5.0 + uTime * 0.04) + 0.45 * ruido(d * 13.0 - uTime * 0.03);
        float luz = (borde * 0.9 + uCara) * (1.0 - uGrano + 2.0 * uGrano * grano);
        if (!gl_FrontFacing) luz *= 0.4;
        gl_FragColor = vec4(uColor * luz * uOn * uFundido, 0.0);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat);
  mesh.frustumCulled = false;
  return { mesh, u };
}
