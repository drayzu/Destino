import { logDepth } from '../../../estudios/motor/logdepth';
import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from '../../../estudios/motor/materia';
import { gauss } from '../../../estudios/motor/math';
import { TEAL } from '../../../estudios/remake';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const Y = V(0, 1, 0);
export const PLASMA = new THREE.Color(1.0, 0.62, 0.28);
/** Which way the mirror pushes (it sits on this side, the Sun moves away from it). */
export const EMPUJE = V(-1, 0, 0.25).normalize();
export const R_ESPEJO = 7.5;
/** How far ahead of the spark the orbiting camera goes round (radians): the spark keeps to the left. */
export const ADELANTO = THREE.MathUtils.degToRad(26);
/** Where on its orbit the spark is when this act starts (mercurio.ts leaves it there). */
export const DESFASE = -0.34;

/** The jets off the poles: grains with a phase (`aKind`), a pole (`aDelay` < 0.5 south) and a place across (`aOff`); and the rings that gather them. */
export function chorrosDatos() {
  const b = materiaBuilder(161);
  const off: number[] = [];
  for (let i = 0; i < 46000; i++) {
    b.push(0, 0, 0, PLASMA, 0.014, 0.12 + b.r() * 0.22, { kind: b.r(), delay: b.r() });
    off.push(gauss(b.r), gauss(b.r));
  }
  return { data: b.data(), off: new Float32Array(off) };
}

export function anillosDatos(): MateriaData {
  const b = materiaBuilder(163);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7000; i++) {
      const a = b.r() * Math.PI * 2;
      const R = 0.75 + gauss(b.r) * 0.02;
      b.push(Math.cos(a) * R * 1.6, s * 6.6 + gauss(b.r) * 0.01, Math.sin(a) * R * 1.6, TEAL, 0.012, 0.22);
    }
  }
  return b.data();
}

/**
 * The mirror as a surface: a cap of a sphere round the Sun, tiled in hexagons. Its inside, facing
 * the Sun, glows with the light it sends back, each tile a little different; its outside is dark,
 * the tiles' seams catching a little light.
 */
export function espejoMalla() {
  const ang = THREE.MathUtils.degToRad(55);
  const g = new THREE.SphereGeometry(R_ESPEJO, 160, 56, 0, Math.PI * 2, 0, ang);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, EMPUJE.clone().negate()));
  const mat = logDepth(new THREE.ShaderMaterial({
    uniforms: { uEsp: { value: 0 }, uFundido: { value: 1 }, uEje: { value: EMPUJE.clone().negate() }, uR: { value: R_ESPEJO } },
    vertexShader: /* glsl */ `
      varying vec3 vL;
      varying vec3 vV;
      varying vec3 vN;
      void main() {
        vL = position;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uEsp, uFundido, uR;
      uniform vec3 uEje;
      varying vec3 vL;
      varying vec3 vV;
      varying vec3 vN;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // Distance to the edge of the hexagonal tile this point is in (0 on a seam), and the tile.
      vec3 hexa(vec2 p) {
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(p, r) - h;
        vec2 b = mod(p - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        vec2 id = p - gv;
        vec2 q = abs(gv);
        float borde = 0.5 - max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
        return vec3(borde, id);
      }
      void main() {
        vec3 d = normalize(vL);
        // A flat map of the cap (round its axis), for the tiles.
        vec3 t1 = normalize(cross(uEje, abs(uEje.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 t2 = cross(uEje, t1);
        vec2 q = vec2(dot(d, t1), dot(d, t2)) * 26.0;
        vec3 hx = hexa(q);
        float fw = fwidth(hx.x);
        float costura = 1.0 - smoothstep(0.02, 0.02 + 1.5 * fw, hx.x);
        float tono = h21(hx.yz);
        float c = dot(d, uEje);
        float borde = smoothstep(cos(0.96), cos(0.86), c);
        vec3 col;
        float a;
        if (gl_FrontFacing) {
          // Outside: dark tiles, their seams faintly lit.
          col = vec3(0.025, 0.028, 0.034) * (0.8 + 0.4 * tono) + vec3(0.5, 0.42, 0.3) * costura * 0.18;
          a = 1.0;
        } else {
          // Inside, facing the Sun: its light, sent back, warm; each tile tilted a hair differently.
          col = vec3(1.0, 0.78, 0.46) * (0.22 + 0.16 * tono) * (1.0 - costura * 0.7) + vec3(1.0, 0.9, 0.7) * costura * 0.05;
          a = 0.9;
        }
        col += vec3(0.4, 0.95, 0.85) * (1.0 - borde) * 0.5;
        gl_FragColor = vec4(col * uEsp * uFundido, a * uEsp * uFundido);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  }));
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 2;
  return { mesh: m, u: mat.uniforms };
}

/** The thread left behind: where the Sun has been (`aKind`, how far back along the push). */
export function estelaDatos(): MateriaData {
  const b = materiaBuilder(171);
  for (let i = 0; i < 9000; i++) {
    const d = b.r() * 4;
    const p = EMPUJE.clone().multiplyScalar(d).add(V(gauss(b.r) * 0.05, gauss(b.r) * 0.05, gauss(b.r) * 0.05));
    b.push(p.x, p.y, p.z, TEAL, 0.02, 0.35, { kind: d });
  }
  return b.data();
}
