import { logDepth } from '../../../estudios/motor/logdepth';
import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from '../../../estudios/motor/materia';
import { gauss } from '../../../estudios/motor/math';
import { TEAL } from '../../../estudios/remake';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const RADIOS = [1.8, 2.6, 3.6, 4.9, 6.5];
export const COLORES = [new THREE.Color(1.0, 0.78, 0.5), new THREE.Color(1.0, 0.55, 0.2), new THREE.Color(1.0, 0.3, 0.09), new THREE.Color(0.85, 0.16, 0.06), new THREE.Color(0.6, 0.1, 0.08)];
export const LUCES = [0.5, 0.48, 0.44, 0.38, 0.3];
export const PUNTOS = [50000, 70000, 95000, 125000, 165000];
export const AZUL = new THREE.Color(0.42, 0.62, 1.0);

/** The shells: Fibonacci spheres, `aKind` the shell (0 inside .. 4 outside). */
export function capasDatos(cuadro: boolean): MateriaData {
  const b = materiaBuilder(61);
  const ga = Math.PI * (3 - Math.sqrt(5));
  RADIOS.forEach((R, k) => {
    const n = PUNTOS[k];
    const paso = Math.sqrt((4 * Math.PI) / n);
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 2;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const th = ga * i;
      const j = R * (1 + gauss(b.r) * 0.004);
      b.push(Math.cos(th) * rr * j, y * j, Math.sin(th) * rr * j, COLORES[k], R * paso * (cuadro ? 0.42 : 0.5), LUCES[k], { kind: k });
    }
  });
  return b.data();
}

/**
 * The network: knots in the gap between the third and fourth shells, each joined to its nearest
 * three by a thread. Each point comes from a place on those shells (`aFrom`): the shells' matter,
 * reordered. `aDat`: kind (0 knot, 1 thread), how far along its thread, a phase.
 */
export function redDatos(): { data: MateriaData; dat: Float32Array; nodos: THREE.Vector3[] } {
  const b = materiaBuilder(67);
  const r = b.r;
  const dat: number[] = [];
  const nodos: THREE.Vector3[] = [];
  for (let i = 0; i < 1500; i++) {
    const [x, y, z] = b.onSphere();
    nodos.push(V(x, y, z).multiplyScalar(3.8 + r() * 0.95));
  }
  const desde = () => {
    const [x, y, z] = b.onSphere();
    const R = r() < 0.5 ? RADIOS[2] : RADIOS[3];
    return [x * R, y * R, z * R] as [number, number, number];
  };
  const BLANCO = new THREE.Color(0.9, 1.0, 0.97);
  for (const n of nodos) {
    for (let k = 0; k < 16; k++) {
      b.push(n.x + gauss(r) * 0.012, n.y + gauss(r) * 0.012, n.z + gauss(r) * 0.012, k < 4 ? BLANCO : TEAL, 0.012, k < 4 ? 1.4 : 0.8, { from: desde(), delay: r() });
      dat.push(0, 0, r(), 0);
    }
  }
  const hechos = new Set<string>();
  nodos.forEach((n, i) => {
    const cerca = nodos
      .map((m, j) => ({ j, d: m.distanceTo(n) }))
      .filter((x) => x.j !== i)
      .sort((a, z) => a.d - z.d)
      .slice(0, 3);
    for (const { j, d } of cerca) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (hechos.has(key)) continue;
      hechos.add(key);
      const m = nodos[j];
      const cuantos = Math.round(d * 220);
      const fase = r();
      for (let q = 0; q < cuantos; q++) {
        const t = r();
        b.push(n.x + (m.x - n.x) * t, n.y + (m.y - n.y) * t, n.z + (m.z - n.z) * t, TEAL, 0.006, 0.42, { from: desde(), delay: r() });
        dat.push(1, i < j ? t : 1 - t, fase, 0);
      }
    }
  });
  return { data: b.data(), dat: new Float32Array(dat), nodos };
}

/**
 * The shells as surfaces of computers (Diego, 30 Oct: the old Destino's cubes and blinking were more
 * striking): each shell a sphere tiled in square panels (a cube-sphere grid, even everywhere), the
 * colour of its temperature, with gaps between some tiles through which the hotter shells inside
 * glow. Built by fronts sweeping from three places; once thinking, the tiles blink (faster the
 * colder the shell) and waves of computation sweep across each shell. The third and fourth give
 * their tiles to the network; then all cools to black.
 */
export function capaMalla(k: number) {
  const R = RADIOS[k];
  const mat = logDepth(new THREE.ShaderMaterial({
    uniforms: {
      uK: { value: k },
      uN: { value: Math.round(46 * (R / RADIOS[0])) },
      uBrillo: { value: [1.0, 0.85, 0.7, 0.55, 0.42][k] },
      uColor: { value: COLORES[k].clone() },
      uHueco: { value: [0.04, 0.1, 0.16, 0.22, 0.3][k] },
      uCapas: { value: 0 },
      uBits: { value: 0 },
      uPiensa: { value: 0 },
      uSale: { value: 0 },
      uFrio: { value: 0 },
      uTime: { value: 0 },
      uFundido: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vL;
      void main() {
        vL = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uK, uN, uHueco, uCapas, uBits, uPiensa, uSale, uFrio, uTime, uFundido, uBrillo;
      uniform vec3 uColor;
      varying vec3 vL;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vL);
        vec3 a = abs(d);
        float cara;
        vec2 uv;
        if (a.x >= a.y && a.x >= a.z) { cara = d.x > 0.0 ? 0.0 : 1.0; uv = d.yz / a.x; }
        else if (a.y >= a.z) { cara = d.y > 0.0 ? 2.0 : 3.0; uv = d.xz / a.y; }
        else { cara = d.z > 0.0 ? 4.0 : 5.0; uv = d.xy / a.z; }
        // (equal-angle: the tiles the same size over the whole face)
        uv = atan(uv) * 1.2732395;
        vec2 g = (uv * 0.5 + 0.5) * uN;
        vec2 id = floor(g);
        vec2 fr = fract(g);
        vec2 tid = id + vec2(cara * 97.0, cara * 31.0) + uK * 13.1;
        float h = h21(tid);
        // Some tiles missing: through the gaps, the hotter shells inside.
        if (h < uHueco) discard;
        // The third and fourth give their tiles to the network.
        if (uK > 1.5 && uK < 3.5 && h21(tid + 5.0) < uSale * 0.8) discard;
        // Built by fronts from seven places spread over it, turned for each shell: a mosaic that comes
        // together (from the same three places, the shells grew as caps stacked on each other).
        float ang = 10.0;
        for (int i = 0; i < 7; i++) {
          float fi = float(i);
          float y = 1.0 - (fi + 0.5) / 3.5;
          float th = fi * 2.39996 + uK * 1.3;
          vec3 sd = vec3(cos(th) * sqrt(1.0 - y * y), y, sin(th) * sqrt(1.0 - y * y));
          ang = min(ang, acos(clamp(dot(d, sd), -1.0, 1.0)));
        }
        ang = ang / 1.15 + 0.04 * h;
        float hecho = (uCapas * 5.0 - uK) * 1.25;
        if (hecho < ang) discard;
        float frente = exp(-pow((hecho - ang) / 0.05, 2.0));
        // The tile's edge: a dark seam.
        float m = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
        float fw = max(fwidth(g.x), 1e-5) * 1.2;
        float cuerpo = smoothstep(0.06, 0.06 + fw, m);
        // Thinking: each tile blinks (faster the colder the shell), and waves sweep across the shell.
        float rate = (1.0 + 1.7 * uK) * uPiensa;
        float cel = floor(uTime * rate + h * 50.0);
        float bit = step(0.55, fract(sin(cel * 12.9898 + h * 78.233) * 43758.5453));
        float w1 = sin(dot(d, normalize(vec3(0.3, 1.0, 0.2))) * (14.0 + 3.0 * uK) - uTime * 1.4 + uK);
        float w2 = sin(dot(d, normalize(vec3(-0.8, 0.1, 0.6))) * (20.0 + 2.0 * uK) - uTime * 1.9);
        float ola = smoothstep(0.82, 1.0, w1) + smoothstep(0.88, 1.0, w2);
        float luz = 0.16 + uBits * (0.45 * bit + 1.1 * ola * (0.4 + 0.6 * bit));
        vec3 col = (uColor * luz * cuerpo + uColor * 0.025) * uBrillo;
        // (the front warm, a glow on the tiles being laid, not a white rim)
        col += vec3(1.0, 0.74, 0.45) * frente * 0.4 * cuerpo;
        col *= 1.0 - uFrio;
        gl_FragColor = vec4(col * uFundido, uFundido * (1.0 - uFrio * 0.9));
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
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 96), mat);
  // (inner first: an outer shell covers what it hides, its gaps show what is inside)
  m.renderOrder = 20 + k;
  return { mesh: m, u: mat.uniforms };
}
