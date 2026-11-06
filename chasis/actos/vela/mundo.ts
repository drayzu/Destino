import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from '../../../estudios/motor/materia';
import { gauss } from '../../../estudios/motor/math';
import { TEAL } from '../../../estudios/remake';
import { crearAnillo } from '../../../estudios/cilindro';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const S0 = V(0, -1.2, -14);
/** Home seen from the sail: the Sun's direction (it only falls back along it). */
export const U_CASA = V(S0.x / 14, S0.y / 14, -1).normalize();
/**
 * «La luz es lenta»: the messages home. The echo leaves the sail ECO_SALE beats into the moment, and
 * then one every CADA beats (PULSOS after it), all at VEL_MSG units a beat along the way home: fast
 * across the frame at first, then crawling towards the Sun, so far away, while the years go by. They
 * get smaller as they go, from REF_MSG (units from the camera) on.
 */
export const ECO_SALE = 2.9;
export const CADA = 0.75;
export const PULSOS = 5;
export const VEL_MSG = 0.5;
export const REF_MSG = 0.45;

/** The sky: stars at «infinity» (a sphere far away), coloured by their temperature. */
export function cieloDatos(): MateriaData {
  const b = materiaBuilder(181);
  const c = new THREE.Color();
  for (let i = 0; i < 60000; i++) {
    const [x, y, z] = b.onSphere();
    const t = b.r();
    c.setRGB(1, 0.84, 0.66).lerp(new THREE.Color(0.72, 0.82, 1), t);
    b.push(x * 9000, y * 9000, z * 9000, c, 1, 0.25 + 0.75 * b.r() * b.r());
  }
  return b.data();
}

/** The sail: a thin square of teal light with a chip at its middle (its own units: the sail is 1 across). */
export function velaDatos(): MateriaData {
  const b = materiaBuilder(191);
  // (its film is a membrane, below; here only the chip at its middle and a few glints on its rim)
  for (let i = 0; i < 1600; i++) {
    const t = b.r() * 4;
    const k = Math.floor(t);
    const f = t - k - 0.5;
    const [x, y] = k === 0 ? [f, 0.5] : k === 1 ? [0.5, f] : k === 2 ? [f, -0.5] : [-0.5, f];
    b.push(x, y, 0, TEAL, 0.006, 0.5);
  }
  for (let i = 0; i < 300; i++) b.push(gauss(b.r) * 0.02, gauss(b.r) * 0.02, 0.01, 0xffffff, 0.006, 1.2);
  return b.data();
}

/**
 * The sail's film: a membrane a few atoms thick, nearly invisible, that shines where light falls
 * on it (the laser that pushes it, or Alpha Centauri's that brakes it): soft rainbow sheens as the
 * view slides over it, a bright frame, faint rigging to the chip.
 */
export function velaMembrana() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uLuz: { value: 0 }, uLuzA: { value: 0 }, uGain: { value: 1 }, uFundido: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      varying vec3 vV;
      varying vec3 vN;
      void main() {
        vP = position.xy;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLuz, uLuzA, uGain, uFundido, uTime;
      varying vec2 vP;
      varying vec3 vV;
      varying vec3 vN;
      float raya(float x, float w) {
        float fw = max(fwidth(x), 1e-6);
        return 1.0 - smoothstep(w - fw, w + fw, abs(x));
      }
      void main() {
        vec3 n = normalize(vN);
        float c = min(abs(dot(n, normalize(-vV))), 1.0);
        // Thin-film sheens: colour that shifts with the angle and slides across the film.
        float fase = (1.0 - c) * 9.0 + (vP.x + vP.y) * 2.0 + uTime * 0.15;
        vec3 iris = 0.5 + 0.5 * cos(6.2831853 * (fase + vec3(0.0, 0.33, 0.67)));
        float luz = 0.05 + 0.6 * (uLuz + uLuzA);
        vec3 col = mix(vec3(0.55, 0.85, 0.8), iris, 0.42) * luz * (0.35 + 0.65 * pow(1.0 - c, 1.5));
        // Its frame, and rigging from the corners to the chip.
        float marco = max(raya(abs(vP.x) - 0.5, 0.006), raya(abs(vP.y) - 0.5, 0.006));
        float aparejo = max(raya(vP.x - vP.y, 0.003), raya(vP.x + vP.y, 0.003)) * 0.35;
        col += vec3(0.45, 0.95, 0.85) * (marco * (0.6 + 1.5 * (uLuz + uLuzA)) + aparejo * (0.2 + uLuz + uLuzA));
        gl_FragColor = vec4(col * uGain * uFundido, 0.0);
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
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.02, 1, 1), mat);
  m.renderOrder = 5;
  m.frustumCulled = false;
  return { mesh: m, u: mat.uniforms };
}

/**
 * Interstellar dust streaming past, as fine streaks of light (not dots): each a short line along
 * the way, longer the faster we go, fading at both ends of the stretch round the sail.
 */
export function polvoLineas() {
  const n = 1400;
  const pos = new Float32Array(n * 2 * 3);
  const off = new Float32Array(n * 2 * 2);
  const fase = new Float32Array(n * 2);
  const cola = new Float32Array(n * 2);
  let seed = 193;
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const q = 0.03 + Math.sqrt(r()) * 0.6;
    const f = r();
    for (let k = 0; k < 2; k++) {
      off[(i * 2 + k) * 2] = Math.cos(a) * q;
      off[(i * 2 + k) * 2 + 1] = Math.sin(a) * q;
      fase[i * 2 + k] = f;
      cola[i * 2 + k] = k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aOff', new THREE.BufferAttribute(off, 2));
  g.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
  g.setAttribute('aCola', new THREE.BufferAttribute(cola, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPolvo: { value: 0 }, uVel: { value: 0.4 }, uTime: { value: 0 }, uFundido: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec2 aOff;
      attribute float aFase, aCola;
      uniform float uVel, uTime;
      varying float vLuz;
      void main() {
        float zz = fract(aFase - uTime * uVel) * 4.0 - 2.0;
        float largo = 0.01 + uVel * 0.18;
        vec3 p = vec3(aOff.x, aOff.y, zz + aCola * largo);
        vLuz = (1.0 - aCola) * (1.0 - smoothstep(1.2, 2.0, abs(zz)));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPolvo, uFundido;
      varying float vLuz;
      void main() {
        gl_FragColor = vec4(vec3(0.72, 0.8, 0.9) * vLuz * 0.55 * uPolvo * uFundido, 0.0);
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
  return { lineas, u: mat.uniforms };
}

/** Interstellar dust that streams past (`aKind` phase; `aOff` place round the path). */
export function polvoDatos() {
  const b = materiaBuilder(193);
  const off: number[] = [];
  for (let i = 0; i < 9000; i++) {
    b.push(0, 0, 0, new THREE.Color(0.75, 0.82, 0.9), 0.0015, 0.5, { kind: b.r() });
    const a = b.r() * Math.PI * 2;
    const q = 0.02 + Math.sqrt(b.r()) * 0.5;
    off.push(Math.cos(a) * q, Math.sin(a) * q);
  }
  return { data: b.data(), off: new Float32Array(off) };
}

/**
 * The ship that is a world (its own units: 1 long, along +Z): a spine, four wheels that turn, a
 * radiator fin and a shield at its bow. `aKind`: 0 spine, 1 wheel (turns), 2 light, 3 radiator.
 */
/** The ring the camera goes into (its z on the spine), and how fast the rings turn (radians a second). */
export const ANILLO = 0.0;
export const GIRO_ANILLO = 0.05;
// (three rings: Diego, 31 Oct)
export const RINGS = [-0.22, ANILLO, 0.22];

export function naveDatos(): MateriaData {
  const b = materiaBuilder(197);
  const r = b.r;
  const c = new THREE.Color();
  // The spine.
  for (let i = 0; i < 9000; i++) {
    const z = r() - 0.5;
    const a = r() * Math.PI * 2;
    b.push(Math.cos(a) * 0.012, Math.sin(a) * 0.012, z, new THREE.Color(0.6, 0.66, 0.75), 0.002, 0.14, { kind: 0 });
  }
  // Four rings (their land, walls and hull are surfaces: crearAnillo); here, their spokes.
  for (const zc of RINGS) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      for (let i = 0; i < 500; i++) {
        const q = 0.012 + r() * 0.1;
        b.push(Math.cos(a) * q, Math.sin(a) * q, zc, new THREE.Color(0.5, 0.56, 0.65), 0.002, 0.1, { kind: 1, delay: zc });
      }
    }
  }
  // The engine's glow behind, and the shield ahead.
  for (let i = 0; i < 6000; i++) {
    const z = -0.5 + r() * 0.35;
    const x = (r() - 0.5) * 0.5;
    b.push(x, 0, z, new THREE.Color(1.0, 0.4, 0.2), 0.002, 0.06, { kind: 3 });
  }
  for (let i = 0; i < 9000; i++) {
    const a = r() * Math.PI * 2;
    const q = Math.sqrt(r()) * 0.17;
    b.push(Math.cos(a) * q, Math.sin(a) * q, 0.55 - q * q * 1.5, new THREE.Color(0.65, 0.7, 0.78), 0.002, 0.12, { kind: 0 });
  }
  // Its teal lights along the spine.
  for (let i = 0; i < 400; i++) b.push(gauss(r) * 0.005, gauss(r) * 0.005, r() - 0.5, TEAL, 0.004, 1.0, { kind: 2 });
  return b.data();
}
