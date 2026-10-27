import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';
import { lerp } from '../engine/math';

/**
 * The neighbouring stars (act IV) and the sails that reach them.
 *
 * - The stars, in light years from the Sun in the galaxy's frame (its centre towards −Z, galactic
 *   longitude 90° towards +X, its north pole +Y), from their galactic coordinates (approximate) and
 *   distances. Their light is what they would send us from where the camera is.
 * - A near star: a disc with its limb darkened and its glow (as the Sun, with its own colour).
 * - The sails: Breakthrough Starshot's (a few metres, a few grams, billowed like a parachute) and
 *   the larger, slower one that brakes with the light of α Centauri A and B (Heller & Hippke 2017).
 *   Both are drawn in the camera's own space (see `cabina` in the act): at light years from the Sun
 *   the world's coordinates no longer tell metres apart.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const LOG_V = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>`;
const LOG_F = /* glsl */ `#include <logdepthbuf_pars_fragment>`;

/** A direction in the galaxy's frame from galactic longitude and latitude (degrees). */
export function galDir(l: number, b: number) {
  return V(Math.sin(l * D2R) * Math.cos(b * D2R), Math.sin(b * D2R), -Math.cos(l * D2R) * Math.cos(b * D2R));
}

export interface Vecina {
  nombre: string;
  l: number;
  b: number;
  /** Light years. */
  d: number;
  /** Luminosity (Suns) and colour. */
  L: number;
  color: THREE.Color;
}

const C = {
  O: new THREE.Color(0.66, 0.78, 1.0),
  A: new THREE.Color(0.78, 0.86, 1.0),
  F: new THREE.Color(1.0, 0.97, 0.9),
  G: new THREE.Color(1.0, 0.9, 0.74),
  K: new THREE.Color(1.0, 0.74, 0.48),
  M: new THREE.Color(1.0, 0.5, 0.32),
};

/** The nearest stars and the brightest near ones (galactic coordinates and distances, rounded). */
export const VECINAS: Vecina[] = [
  { nombre: 'Alfa Centauri A', l: 315.73, b: -0.68, d: 4.37, L: 1.52, color: C.G },
  { nombre: 'Alfa Centauri B', l: 315.73, b: -0.68, d: 4.37, L: 0.5, color: C.K },
  { nombre: 'Próxima Centauri', l: 313.94, b: -1.93, d: 4.24, L: 0.0017, color: C.M },
  { nombre: 'Estrella de Barnard', l: 31.0, b: 14.1, d: 5.96, L: 0.0035, color: C.M },
  { nombre: 'Wolf 359', l: 244.0, b: 56.1, d: 7.86, L: 0.001, color: C.M },
  { nombre: 'Lalande 21185', l: 185.1, b: 65.4, d: 8.31, L: 0.02, color: C.M },
  { nombre: 'Sirio', l: 227.2, b: -8.9, d: 8.6, L: 25.4, color: C.A },
  { nombre: 'Ross 154', l: 11.3, b: -10.3, d: 9.7, L: 0.004, color: C.M },
  { nombre: 'Épsilon Eridani', l: 195.8, b: -48.1, d: 10.5, L: 0.34, color: C.K },
  { nombre: '61 Cygni', l: 82.3, b: -5.8, d: 11.4, L: 0.15, color: C.K },
  { nombre: 'Procyon', l: 213.7, b: 13.0, d: 11.5, L: 6.9, color: C.F },
  { nombre: 'Tau Ceti', l: 173.1, b: -73.4, d: 11.9, L: 0.52, color: C.G },
  { nombre: 'Épsilon Indi', l: 336.2, b: -48.0, d: 11.9, L: 0.22, color: C.K },
  { nombre: 'Altair', l: 47.7, b: -8.9, d: 16.7, L: 10.6, color: C.A },
  { nombre: 'Vega', l: 67.4, b: 19.2, d: 25.0, L: 40, color: C.A },
  { nombre: 'Fomalhaut', l: 20.5, b: -64.9, d: 25.1, L: 16.6, color: C.A },
  { nombre: 'Pólux', l: 192.2, b: 23.4, d: 33.8, L: 43, color: C.K },
  { nombre: 'Arturo', l: 15.1, b: 69.1, d: 36.7, L: 170, color: C.K },
  { nombre: 'Capella', l: 162.6, b: 4.6, d: 42.9, L: 79, color: C.G },
  { nombre: 'Aldebarán', l: 181.0, b: -20.2, d: 65, L: 440, color: C.K },
  { nombre: 'Régulo', l: 226.4, b: 48.9, d: 79, L: 300, color: C.O },
];

/** Where a neighbour is (light years, galaxy frame). α Cen A and B are a pair ~17 AU apart. */
export function dondeVecina(v: Vecina) {
  return galDir(v.l, v.b).multiplyScalar(v.d);
}

/** The neighbours as points of light (light years; the group goes into the galaxy's group). */
export function vecinas(extra: { pos: THREE.Vector3; L: number; color: THREE.Color }[] = []) {
  const b = materiaBuilder(4242);
  const lum: number[] = [];
  const all = [...VECINAS.map((v) => ({ pos: dondeVecina(v), L: v.L, color: v.color })), ...extra];
  for (const s of all) {
    b.push(s.pos.x, s.pos.y, s.pos.z, s.color, 0.00003, 1);
    lum.push(s.L);
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute float aLumV; uniform float uScale, uOn, uCerca, uBubR, uPiso;`,
    move: /* glsl */ `
      vec4 mq = modelViewMatrix * vec4(p, 1.0);
      float dly = length(mq.xyz) / uScale;
      // What it sends to where we are: L / d², bounded, never quite gone.
      em = color * clamp(aLumV / max(dly * dly, 1e-12) * 0.5, uPiso, 40.0) * uOn;
      // When they are the subject, a few pixels wide whatever the distance (a point under a pixel is lost).
      sz = max(size, dly * 0.012 * uPiso);
      // Close enough to be a disc of its own: the point steps aside.
      em *= smoothstep(uCerca * 0.5, uCerca, dly);
      // Inside our bubble (light years around the Sun), they shine with the civilization's colour.
      float inside = 1.0 - smoothstep(uBubR * 0.97, uBubR, length(position));
      em = mix(em, vec3(0.4, 1.0, 0.82) * (dot(em, vec3(0.33)) * 1.6 + 0.02), inside * step(0.001, uBubR));
      fuente = 1.0;`,
    uniforms: { uScale: { value: 1 }, uOn: { value: 1 }, uCerca: { value: 0.002 }, uBubR: { value: 0 }, uPiso: { value: 0.006 } },
    extra: { aLumV: [new Float32Array(lum), 1] },
  });
  nube.u.uSpread.value = 0;
  return nube;
}

/** Routes from the Sun to each neighbour: thin lines of the civilization's colour (light years). */
export function rutasVecinas() {
  const pts: number[] = [];
  for (const v of VECINAS) {
    if (v.d > 50) continue;
    const q = dondeVecina(v);
    pts.push(0, 0, 0, q.x, q.y, q.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.35, 0.8, 0.68), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return { lines, mat };
}

/** A near star: its disc (limb-darkened, granulated) and its glow. Radius 1 (scale the group). */
export function estrella(color: THREE.Color, brillo = 18) {
  const group = new THREE.Group();
  const uni = { uTime: { value: 0 }, uColor: { value: color.clone() }, uBrillo: { value: brillo }, uOn: { value: 1 }, uGlow: { value: 1 } };
  const disk = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vP; varying float vMu;
        void main() {
          vP = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vMu = max(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)), 0.0);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform float uTime, uBrillo, uOn; uniform vec3 uColor; varying vec3 vP; varying float vMu;
        float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main() {
          #include <logdepthbuf_fragment>
          float g = n3(vP * 14.0 + uTime * 0.05) * 0.6 + n3(vP * 40.0 - uTime * 0.08) * 0.4;
          float limb = 0.3 + 0.7 * sqrt(max(vMu, 0.0));
          gl_FragColor = vec4(uColor * (0.85 + 0.3 * g) * limb * uBrillo * uOn, 1.0);
        }`,
    }),
  );
  group.add(disk);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec2 vUv;
        void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform float uOn, uGlow; uniform vec3 uColor; varying vec2 vUv;
        void main() {
          #include <logdepthbuf_fragment>
          float r = length(vUv) * 40.0;
          if (r < 1.0) discard;
          float a = 0.9 / (r * r) + 0.06 * exp(-r * 0.12);
          a *= 1.0 - smoothstep(30.0, 40.0, r);
          gl_FragColor = vec4(uColor * a * 6.0 * uOn * uGlow, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.scale.setScalar(40);
  group.add(glow);
  return {
    group,
    uni,
    /** `cerca`: the camera's distance in the star's radii (its glow fades close by). */
    update(camera: THREE.Camera, time: number, on = 1, cerca = 1e9) {
      uni.uTime.value = time;
      uni.uOn.value = on;
      const lejos = Math.min(1, Math.max(0, (cerca - 8) / 90));
      uni.uGlow.value = 0.12 + 0.88 * lejos;
      // Up close, a golden disc you can look at (its grain and its darker rim), not a white blur.
      uni.uBrillo.value = lerp(0.75, brillo, lejos * lejos);
      group.visible = on > 0.001;
      glow.quaternion.copy(camera.quaternion);
    },
  };
}

/**
 * A light sail (radius 1, its face towards local +Z, billowed back like a parachute), with its chip
 * at the centre. `uCalor`: how hot the beam makes it (a dull red glow); `uLuz`, `uLuzDir` (view
 * space, towards the star): a star's light on its face, which it reflects.
 */
export function vela(rejilla = 10) {
  const group = new THREE.Group();
  const uni = { uCalor: { value: 0 }, uLuz: { value: 0 }, uLuzDir: { value: V(0, 0, 1) }, uLuzCol: { value: new THREE.Color(1, 0.9, 0.7) } };
  const geo = new THREE.CircleGeometry(1, 96, 0, Math.PI * 2);
  // The billow: the edge lies a little behind the centre.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const r2 = pos.getX(i) ** 2 + pos.getY(i) ** 2;
    pos.setZ(i, -0.18 * r2);
  }
  geo.computeVertexNormals();
  const sail = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms: uni,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vP; varying vec3 vN; varying vec3 vV;
        void main() { vP = position; vN = normalMatrix * normal;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform float uCalor, uLuz; uniform vec3 uLuzDir, uLuzCol;
        varying vec3 vP; varying vec3 vN; varying vec3 vV;
        void main() {
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          if (!gl_FrontFacing) n = -n;
          float r = length(vP.xy);
          // A film thinner than a soap bubble: a faint grey, a grid of ribs, the rim.
          float rib = smoothstep(0.47, 0.495, abs(fract(atan(vP.y, vP.x) / 6.2831853 * ${rejilla.toFixed(1)}) - 0.5));
          float ring = smoothstep(0.47, 0.495, abs(fract(r * 4.0) - 0.5));
          vec3 col = vec3(0.016, 0.018, 0.022) + vec3(0.2, 0.21, 0.23) * max(rib, ring) * 0.1;
          // Its rim catches the light (so it reads as a sail, not as a hole in the sky).
          col += vec3(0.45, 1.0, 0.85) * (1.0 - smoothstep(0.0, 0.025, 1.0 - r)) * 0.9;
          col += vec3(0.5, 0.56, 0.62) * pow(max(1.0 - abs(dot(n, normalize(vV))), 0.0), 3.0) * 0.12;
          // A star's light, mirrored towards us.
          vec3 L = normalize(uLuzDir);
          vec3 R = reflect(-L, n);
          float rv = max(dot(R, normalize(vV)), 0.0);
          float spec = pow(rv, 900.0) * 6.0 + pow(rv, 60.0) * 0.25;
          col += uLuzCol * uLuz * (0.025 * max(dot(n, L), 0.0) + spec);
          // From behind, the film lets a little of the star's light through: a lantern.
          float back = step(dot(n, L), 0.0);
          col += uLuzCol * uLuz * back * 0.28 * (0.55 + 0.45 * (1.0 - r * r)) * (1.0 - 0.6 * max(rib, ring));
          // The beam's heat: a dull red glow, hottest at the middle.
          col += vec3(1.0, 0.28, 0.08) * uCalor * (0.35 + 0.65 * (1.0 - r * r));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  group.add(sail);
  // The chip: a wafer at the centre, a teal light.
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.01), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 0.07, 0.08) }));
  chip.position.z = 0.005;
  group.add(chip);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 2.4, 2.0) }));
  led.position.z = 0.015;
  group.add(led);
  return { group, uni };
}
