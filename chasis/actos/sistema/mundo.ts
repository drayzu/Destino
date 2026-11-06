import { logDepth } from '../../../estudios/motor/logdepth';
import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from '../../../estudios/motor/materia';
import { gauss } from '../../../estudios/motor/math';
import { TEAL, dirLatLon } from '../../../estudios/remake';
import { DIR_CIUDAD } from '../../../estudios/interior';

/**
 * Scenes 8–10 of ESCALETA.md: the Solar System at work (GUION.md, moments 20–24), in the same frame
 * as Mercury's scene (solar radii, the Sun at the origin, distances drawn short), so the Earth hands
 * over to it and it hands Mercury over without a cut.
 *
 * One flight that never stops: from the Earth down onto the Moon's launcher and out on its stream of
 * rock towards Mars; once round Mars, under the ring of mirrors at its south pole; across to Venus
 * and round behind it, where the parasol hides the Sun, skimming a city on its limb; and on to
 * Mercury while the camera draws back to the whole inner system at work, all at once.
 */

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const Y = V(0, 1, 0);
export const D2R = THREE.MathUtils.degToRad;

/**
 * Mars' mirrors: a ring of them under its south pole, the cone of light they send down onto the
 * pole, the pole warming where it lands, and domes of light on its ground. Mars radii.
 * `aKind`: 0 mirror, 1 light, 2 dome, 3 the warm pole.
 */
export function marteDatos(): MateriaData {
  const b = materiaBuilder(137);
  const r = b.r;
  for (let i = 0; i < 2600; i++) {
    const fi = r() * Math.PI * 2;
    const q = 0.9 + gauss(r) * 0.012;
    b.push(Math.cos(fi) * q, -1.7 + gauss(r) * 0.006, Math.sin(fi) * q, new THREE.Color(1.0, 0.96, 0.88), 0.006, 0.7, { kind: 0 });
  }
  for (let i = 0; i < 5000; i++) {
    const lat = -90 + Math.sqrt(r()) * 24;
    const c = dirLatLon(lat, r() * 360);
    b.push(c.x * 1.004, c.y * 1.004, c.z * 1.004, new THREE.Color(1.0, 0.55, 0.28), 0.006, 0.12 * (1 - (lat + 90) / 26), { kind: 3 });
  }
  for (let d = 0; d < 46; d++) {
    const c = dirLatLon(-40 + r() * 75, 20 + r() * 150);
    const t1 = Y.clone().cross(c).normalize();
    const t2 = c.clone().cross(t1);
    const rad = 0.025 + r() * 0.025;
    for (let i = 0; i < 300; i++) {
      const [x, y, z] = b.onSphere();
      const h = Math.abs(y);
      const p = c.clone().multiplyScalar(1.002 + h * rad * 0.8).addScaledVector(t1, x * rad).addScaledVector(t2, z * rad);
      b.push(p.x, p.y, p.z, TEAL, 0.0025, 0.4, { kind: 2 });
    }
  }
  return b.data();
}

/**
 * Mars warmed (its own units, radius 1): the light the ring of mirrors sends up onto its south pole,
 * a beam of light rather than points, shimmering upwards; and its air thickening, a glow round its
 * limb that grows (`uAire`).
 */
export function marteLuz() {
  const haz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.9, 0.73, 96, 1, true),
    new THREE.ShaderMaterial({
      uniforms: { uMar: { value: 0 }, uTime: { value: 0 }, uFundido: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec3 vL;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vL = position;
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uMar, uTime, uFundido;
        varying vec3 vL;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float h = (vL.y + 0.365) / 0.73;
          float rim = 1.0 - abs(dot(normalize(vN), normalize(-vV)));
          // (rays, one from each group of mirrors up to the pole, light running up them)
          float ang = atan(vL.z, vL.x);
          float rayo = pow(0.5 + 0.5 * cos(ang * 23.0), 10.0) + 0.6 * pow(0.5 + 0.5 * cos(ang * 41.0 + 1.3), 16.0);
          float subir = 0.65 + 0.35 * sin(h * 14.0 - uTime * 3.0 + ang * 3.0);
          // (from close by, or from inside it, the beam is only a glow: no walls)
          float lejos = smoothstep(0.06, 0.4, length(vV));
          // (faint where it leaves the mirrors, gathering as it nears the pole)
          float luz = (0.025 + 0.5 * rayo * subir) * (0.15 + 0.85 * h * h) * (0.7 + 0.3 * rim) * smoothstep(0.0, 0.12, h) * lejos;
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * luz * 0.7 * uMar * uFundido, 0.0);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    }),
  );
  haz.position.y = -1.335;
  haz.renderOrder = 6;
  const aire = new THREE.Mesh(
    new THREE.SphereGeometry(1.07, 96, 48),
    logDepth(new THREE.ShaderMaterial({
      uniforms: { uAire: { value: 0 }, uFundido: { value: 1 }, uSol: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        varying vec3 vW;
        varying vec3 vC;
        varying float vR;
        void main() {
          vN = normalize(normalMatrix * normal);
          vW = normalize(position);
          vC = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vR = length(modelViewMatrix[0].xyz);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAire, uFundido;
        uniform vec3 uSol;
        varying vec3 vN;
        varying vec3 vV;
        varying vec3 vW;
        varying vec3 vC;
        varying float vR;
        void main() {
          // (how close the line of sight passes to Mars' centre, in its radii: the haze is thickest
          // just over the limb and thins out above it, a thin veil over the disc)
          vec3 ray = normalize(vV);
          float b = length(vC - ray * dot(vC, ray)) / vR;
          float g = b > 1.0 ? exp(-(b - 1.0) / 0.018) : 0.5 * exp(-(1.0 - b) / 0.02);
          float dia = 0.3 + 0.7 * smoothstep(-0.3, 0.6, dot(vW, uSol));
          vec3 col = mix(vec3(1.0, 0.56, 0.42), vec3(0.95, 0.72, 0.85), smoothstep(1.0, 1.04, b));
          gl_FragColor = vec4(col * g * dia * 1.1 * uAire * uFundido, 0.0);
        }
      `,
      side: THREE.FrontSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    })),
  );
  aire.renderOrder = 5;
  return { haz, aire };
}

/** Venus' cloud tops, the cities floating in them and the shade between it and the Sun. Venus radii, the Sun towards `sol`. */
export function venusDatos(sol: THREE.Vector3): MateriaData {
  const b = materiaBuilder(139);
  const r = b.r;
  for (let i = 0; i < 150000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 1.012 + r() * 0.035;
    b.push(x * q, y * q, z * q, new THREE.Color(0.95, 0.84, 0.56), 0.0009, 0.025 + r() * 0.05, { kind: 0 });
  }
  // The cities: discs of light floating on the cloud tops, sunward (in the parasol's shade); the
  // first is the spark's.
  const ciudades = [DIR_CIUDAD.clone()];
  // (round the limb as seen from behind, where the camera passes)
  while (ciudades.length < 34) {
    const c = V(gauss(r), gauss(r) * 0.7, gauss(r)).normalize();
    const k = c.dot(sol);
    if (k > -0.45 && k < 0.35) ciudades.push(c);
  }
  for (const [k, c] of ciudades.entries()) {
    const t1 = Y.clone().cross(c).normalize();
    const t2 = c.clone().cross(t1);
    const rad = k === 0 ? 0.022 : 0.01 + r() * 0.012;
    const n = k === 0 ? 900 : 360;
    for (let i = 0; i < n; i++) {
      const q = Math.sqrt(r());
      const fi = r() * Math.PI * 2;
      const p = c.clone().multiplyScalar(1.055 + gauss(r) * 0.0012).addScaledVector(t1, Math.cos(fi) * q * rad).addScaledVector(t2, Math.sin(fi) * q * rad);
      b.push(p.x, p.y, p.z, q < 0.35 ? new THREE.Color(0.85, 1.0, 0.95) : TEAL, 0.0008, 0.55, { kind: 1 });
    }
  }
  const t1 = Y.clone().cross(sol).normalize();
  const t2 = sol.clone().cross(t1);
  // The parasol's rim, ours (teal), between Venus and the Sun (its film is a membrane: parasolMalla).
  for (let i = 0; i < 6000; i++) {
    const borde = true;
    const q = borde ? 1.3 + gauss(r) * 0.006 : Math.sqrt(r()) * 1.3;
    const fi = r() * Math.PI * 2;
    const p = sol.clone().multiplyScalar(2.2).addScaledVector(t1, Math.cos(fi) * q).addScaledVector(t2, Math.sin(fi) * q);
    b.push(p.x, p.y, p.z, borde ? TEAL : new THREE.Color(0.7, 0.85, 0.9), borde ? 0.004 : 0.006, borde ? 0.32 : 0.05, { kind: 2 });
  }
  return b.data();
}

/**
 * The parasol as a membrane (Venus' own units: Venus is 1, the Sun along `sol`): a disc 1.3 across
 * at 2.2 towards the Sun. Its sunward face shines with the light it turns away (rings and struts);
 * its face towards Venus is dark.
 */
export function parasolMalla(sol: THREE.Vector3) {
  // (a little wider than the parasol: round it, seen from behind, the Sun's glow it hides)
  const g = new THREE.CircleGeometry(1.3 * 1.5, 160);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), sol));
  g.translate(sol.x * 2.2, sol.y * 2.2, sol.z * 2.2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uFundido: { value: 1 }, uSol: { value: sol.clone() }, uOcc: { value: new THREE.Vector4() }, uDetras: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vL;
      varying vec3 vV;
      void main() {
        vL = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOn, uFundido, uDetras;
      uniform vec3 uSol;
      uniform vec4 uOcc;
      varying vec3 vL;
      varying vec3 vV;
      float raya(float x, float w) {
        float d = abs(fract(x + 0.5) - 0.5);
        float fw = max(fwidth(x), 1e-6);
        return 1.0 - smoothstep(w - fw, w + fw, d);
      }
      void main() {
        // Behind Venus (seen from its far side): hidden by it.
        vec3 ray = normalize(vV);
        float tt = dot(uOcc.xyz, ray);
        if (uOcc.w > 0.0 && tt > 0.0 && length(vV) > tt && length(uOcc.xyz - ray * tt) < uOcc.w) discard;
        vec3 c = vL - uSol * 2.2;
        float r = length(c) / 1.3;
        vec3 t1 = normalize(cross(uSol, vec3(0.0, 1.0, 0.0)));
        vec3 t2 = cross(uSol, t1);
        float fi = atan(dot(c, t2), dot(c, t1));
        if (r > 1.0) {
          // Beyond the rim: the corona of the hidden Sun, only from behind.
          float halo = exp(-(r - 1.0) * 7.0) * uDetras * (gl_FrontFacing ? 0.0 : 1.0);
          gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * halo * 0.55 * uOn * uFundido, 0.0);
          return;
        }
        float aros = raya(r * 9.0, 0.04);
        float varas = raya(fi / 6.2831853 * 16.0, 0.02);
        vec3 col;
        float a;
        if (gl_FrontFacing) {
          // Facing the Sun: the light it turns away, warm.
          col = vec3(1.0, 0.86, 0.6) * (0.16 + 0.08 * (1.0 - r)) + vec3(1.0, 0.92, 0.75) * (aros * 0.12 + varas * 0.1);
          a = 0.9;
        } else {
          // Facing Venus: its shadow side, dark; the struts barely there.
          // (near black: a shade, its struts barely there)
          col = vec3(0.006, 0.007, 0.009) + vec3(0.3, 0.34, 0.38) * (aros * 0.025 + varas * 0.025);
          // (its rim lit from behind by the Sun it hides)
          col += vec3(1.0, 0.78, 0.5) * smoothstep(0.93, 1.0, r) * uDetras * 0.9;
          a = 0.94;
        }
        gl_FragColor = vec4(col * uOn * uFundido, a * uOn * uFundido);
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
  const m = new THREE.Mesh(g, mat);
  // (after the Sun, so it covers it: from behind, an eclipse)
  m.renderOrder = 45;
  m.frustumCulled = false;
  return { mesh: m, u: mat.uniforms };
}

/**
 * Sunlight on its way to Venus (Venus' units), as a fine rain of light flowing from the Sun: what
 * meets the parasol stops there, so behind it a cylinder of shadow reaches down to Venus; the rest
 * goes past, or ends on Venus' clouds. `aOff`: where across the beam; `aKind`: its phase.
 */
export function luzVenusDatos() {
  const b = materiaBuilder(141);
  const off: number[] = [];
  // (each grain a short streak: a few points one behind the other)
  for (let i = 0; i < 9000; i++) {
    // (a thick sheet through the axis, edge-on to the side the camera looks from: there the
    // parasol's shadow shows as a dark band down to Venus)
    const fase = b.r();
    const anillo = i % 3 === 0;
    const ang = b.r() * Math.PI * 2;
    const q = 1.34 + Math.pow(b.r(), 1.6) * 1.3;
    const x = anillo ? Math.cos(ang) * q : gauss(b.r) * 0.28;
    const y = anillo ? Math.sin(ang) * q : (b.r() * 2 - 1) * 2.6;
    const luz = 0.3 + 0.3 * b.r();
    for (let k = 0; k < 4; k++) {
      b.push(0, 0, 0, new THREE.Color(1.0, 0.9, 0.7), 0.008, luz * (1 - k * 0.22), { kind: fase - k * 0.0035 });
      off.push(x, y);
    }
  }
  return { data: b.data(), off: new Float32Array(off) };
}

/** The asteroid belt, with the sparks of its mines; and the first glints of a swarm by the Sun. */
export function cinturonDatos(): MateriaData {
  const b = materiaBuilder(149);
  const r = b.r;
  for (let i = 0; i < 46000; i++) {
    const fi = r() * Math.PI * 2;
    const q = 60 + r() * 10;
    const mina = r() < 0.025;
    b.push(Math.sin(fi) * q, gauss(r) * 0.7, Math.cos(fi) * q, mina ? TEAL : new THREE.Color(0.6, 0.56, 0.5), 0.03, mina ? 1.2 : 0.32, { kind: mina ? 1 : 0 });
  }
  for (let i = 0; i < 6000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 2.6 + r() * 0.8;
    b.push(x * q, y * q, z * q, new THREE.Color(0.9, 0.97, 1.0), 0.01, 0.8, { kind: 2 });
  }
  return b.data();
}
