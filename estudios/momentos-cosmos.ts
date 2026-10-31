import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from './motor/materia';

/**
 * Pieces for the cosmos act's moments (cosmos.ts).
 *
 * `espiralHuida`: one galaxy the probe chases, a spiral that reads as one (a warm bulge, two arms of
 * blue-white points with pink knots), its disc facing `hacia` a little tilted, radius `R`, round the
 * origin (the act places it, and carries it off as space swells). Its light reddens and fades as it
 * slips past the horizon (`uRojo`, `uOn`).
 */
export function espiralHuida(n: number, R: number, hacia: THREE.Vector3, seed = 401): MateriaData {
  const b = materiaBuilder(seed);
  const r = b.r;
  const g = () => (r() + r() + r() + r() - 2) * 0.866;
  const eje = hacia.clone().normalize().add(new THREE.Vector3(0.25, 0.4, -0.1)).normalize();
  const t1 = new THREE.Vector3(0, 1, 0).cross(eje).normalize();
  const t2 = eje.clone().cross(t1).normalize();
  const en = (a: number, c: number, h: number, col: THREE.Color, s: number, luz: number) => {
    const p = t1.clone().multiplyScalar(a).addScaledVector(t2, c).addScaledVector(eje, h);
    b.push(p.x, p.y, p.z, col, s, luz);
  };
  const calido = new THREE.Color(1.0, 0.84, 0.62);
  const azul = new THREE.Color(0.76, 0.86, 1.0);
  const rosa = new THREE.Color(1.0, 0.6, 0.72);
  const giro = r() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    if (k < n * 0.2) {
      en(g() * R * 0.13, g() * R * 0.13, g() * R * 0.08, calido, R * 0.012, 1.1);
      continue;
    }
    const brazo = k % 2;
    const q0 = Math.sqrt(r());
    const q = (0.12 + 0.88 * q0) * R;
    const fase = brazo * Math.PI + giro + Math.log(q / R + 0.05) * 2.6;
    const a = fase + g() * 0.3 * (0.5 + q0);
    const knot = r() < 0.06;
    en(Math.cos(a) * q, Math.sin(a) * q, g() * R * 0.03, knot ? rosa : q0 < 0.3 ? calido : azul, R * (knot ? 0.012 : 0.008), knot ? 1.0 : 0.6);
  }
  return b.data();
}

/**
 * The seam where two bubbles touch: a wall of light on the plane between them (normal `eje`), a disc
 * of points brightest at its rim (the ring where the two fronts meet) and shimmering across its face.
 * Unit radius round the origin; the act places it (`uCentro`) and grows it (`uRho`).
 */
export function costuraDatos(n: number, eje: THREE.Vector3) {
  const b = materiaBuilder(431);
  const r = b.r;
  const u = eje.clone().normalize();
  const t1 = new THREE.Vector3(0, 1, 0).cross(u).normalize();
  const t2 = u.clone().cross(t1).normalize();
  const col = new THREE.Color(1.0, 0.93, 0.82);
  for (let i = 0; i < n; i++) {
    const borde = r() < 0.45;
    const q = borde ? 1 - 0.06 * Math.pow(r(), 2) : Math.sqrt(r());
    const a = r() * Math.PI * 2;
    const p = t1.clone().multiplyScalar(Math.cos(a) * q).addScaledVector(t2, Math.sin(a) * q).addScaledVector(u, (r() - 0.5) * 0.012);
    b.push(p.x, p.y, p.z, col, 0.0016, borde ? 0.55 : 0.12 + 0.1 * r(), { kind: q });
  }
  return b.data();
}

export const COSTURA_MOVE = /* glsl */ `
  p = uCentro + p * uRho;
  em *= uOn * (0.75 + 0.45 * sin(uTime * 2.3 + seed * 40.0 + aKind * 9.0));
`;

/**
 * The horizon's shell: remake.ts's `capaLuz`, the same light, with its rim term clamped: seen almost
 * exactly face-on, `1 - c` came out a hair below zero and its power was NaN, which the bloom spread
 * into a whole black frame (at the end of this act and through the relay into the next).
 */
export function capaLuzSegura(color: THREE.Color, opciones: { cara?: number; grano?: number } = {}) {
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
        float c = abs(dot(normalize(vN), normalize(-vV)));
        float borde = pow(max(1.0 - c, 0.0), 2.4);
        vec3 d = normalize(vL);
        float grano = 0.55 * ruido(d * 5.0 + uTime * 0.04) + 0.45 * ruido(d * 13.0 - uTime * 0.03);
        float luz = (borde * 0.9 + uCara) * (1.0 - uGrano + 2.0 * uGrano * grano);
        // (its far side, seen through it, fainter)
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
