import * as THREE from 'three';
import { CIUDADES, esfera } from './tierra';
import { materia, materiaBuilder } from '../engine/materia';
import { gauss } from '../engine/math';

/**
 * The first wall, «El calor nos echa», as Diego chose it in phase 0: the Earth turns the colour of
 * its heat (infrared, false colour, behind a curtain that sweeps the screen), first where the energy
 * is used, then the whole planet; and the industry that rises to orbit, where its heat goes straight
 * to the void. All the energy a civilization uses ends as heat, and a planet can only shed heat by
 * radiating it: at 10¹⁶ W generated on the surface the Earth would warm at least ~6 K from waste
 * heat alone, before any feedback (investigacion.md § 18; Balbi & Lingam 2025). Earth radii, in the
 * Earth's body frame.
 */

const F_ABS = 1.22e17; // W of sunlight the Earth absorbs (albedo 0.30)
const T0 = 288; // K, the mean surface temperature
/** Warming from waste heat alone, no feedback: the planet must radiate F_ABS + P instead of F_ABS. */
export const calentamiento = (P: number) => T0 * (Math.pow(1 + P / F_ABS, 0.25) - 1);
const coma = (v: number, d: number) => v.toFixed(d).replace('.', ',');
export const grados = (k: number) => `+${k < 0.095 ? coma(k, 2) : k < 9.5 ? coma(k, 1) : Math.round(k)} K`;

const D2R = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The heat of our machines on the map (where energy is used): blobs around the cities. */
export function mapaCalor() {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'lighter';
  for (const [la, lo, pop] of CIUDADES) {
    const px = ((lo + 180) / 360) * W;
    const py = ((90 - la) / 180) * H;
    const r = (3 + 2.2 * Math.sqrt(pop)) * (W / 360) / Math.max(0.35, Math.cos(la * D2R));
    const ry = (3 + 2.2 * Math.sqrt(pop)) * (H / 180);
    const a = Math.min(0.5, 0.05 + pop * 0.012);
    x.save();
    x.translate(px, py);
    x.scale(r / ry, 1);
    const grd = x.createRadialGradient(0, 0, 0, 0, 0, ry);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(0.35, `rgba(255,255,255,${a * 0.45})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grd;
    x.beginPath();
    x.arc(0, 0, ry, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** The planet in infrared (false colour): its own warmth, plus our heat; only right of the curtain. */
export function infrarrojo() {
  const uni = {
    uHeat: { value: mapaCalor() },
    uLocal: { value: 0 },
    uGlobal: { value: 0 },
    uWipePx: { value: 1e9 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.004, 160, 96),
    new THREE.ShaderMaterial({
      uniforms: uni,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        void main() {
          vN = normalize(position);
          vUv = uv;
          vV = normalize((inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz - position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uHeat; uniform float uLocal, uGlobal, uWipePx;
        varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        vec3 ramp(float t) {
          vec3 a = vec3(0.08, 0.01, 0.01), b = vec3(0.38, 0.045, 0.025), c = vec3(0.95, 0.3, 0.07), d = vec3(1.15, 0.78, 0.32), e = vec3(1.4, 1.3, 1.0);
          return t < 0.3 ? mix(a, b, t / 0.3) : t < 0.6 ? mix(b, c, (t - 0.3) / 0.3) : t < 0.95 ? mix(c, d, (t - 0.6) / 0.35) : mix(d, e, clamp((t - 0.95) / 0.5, 0.0, 1.0));
        }
        void main() {
          #include <logdepthbuf_fragment>
          if (gl_FragCoord.x < uWipePx) discard;
          vec3 n = normalize(vN);
          float mu = max(dot(n, normalize(vV)), 0.0);
          // The planet's own warmth (288 K): the tropics warmer than the poles.
          float own = 0.16 + 0.1 * (1.0 - n.y * n.y);
          float h = texture2D(uHeat, vUv).r;
          float t = own + uGlobal + uLocal * h;
          vec3 col = ramp(t) * (0.45 + 0.55 * sqrt(mu)) * 0.85;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  mesh.renderOrder = 6;
  return { mesh, uni };
}

/**
 * The industry that leaves: points that start where the energy is used (around the cities) and rise
 * to orbit (a band around the orbital ring), where they keep circling. In infrared they glow with
 * the heat their radiators give to space.
 */
export function industria() {
  const b = materiaBuilder(97);
  const total = CIUDADES.reduce((s, c) => s + c[2], 0);
  const teal = new THREE.Color(0.55, 1.0, 0.86);
  const N = 14000;
  for (let i = 0; i < N; i++) {
    // A city, by its size.
    let r = b.r() * total;
    let c = CIUDADES[0];
    for (const x of CIUDADES) {
      r -= x[2];
      if (r <= 0) {
        c = x;
        break;
      }
    }
    const [fx, fy, fz] = esfera(c[0] + gauss(b.r) * 1.6, c[1] + gauss(b.r) * 1.6, 1.003);
    // Its place in orbit: most in a thin band near the ring, a few higher.
    const R = b.r() < 0.8 ? 1.07 + Math.pow(b.r(), 1.6) * 0.32 : 1.4 + b.r() * 1.1;
    const a = b.r() * Math.PI * 2;
    const inc = gauss(b.r) * 0.05;
    b.push(Math.cos(a) * R, Math.sin(a) * R * inc, -Math.sin(a) * R, teal, 0.0035, b.r() < 0.06 ? 3 : 1.1, { from: [fx, fy, fz], delay: b.r() });
  }
  const n = materia(b.data(), {
    pre: /* glsl */ `uniform vec3 uCamL; uniform float uSpin, uIR, uWipe;
      bool tapado(vec3 q, vec3 c) { vec3 d = q - c; float t = clamp(-dot(c, d) / dot(d, d), 0.0, 1.0); return t < 0.995 && length(c + d * t) < 0.996; }`,
    move: /* glsl */ `
      float rr = max(length(position), 1.0);
      float ang = uSpin * k / (rr * sqrt(rr));
      float ca = cos(ang), sa = sin(ang);
      p = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
      // Rising: a spark; parked in orbit: a steady light.
      float rising = k * (1.0 - k) * 4.0;
      em *= (0.25 + 0.75 * k) * (1.0 + 2.5 * rising);
      em *= step(0.002, k);
      fuente = 1.0;
      if (tapado(p, uCamL)) { em *= 0.0; }`,
    post: /* glsl */ `
      if (uIR > 0.5 && gl_Position.x / gl_Position.w > uWipe) { em = vec3(1.0, 0.45, 0.14) * 2.6 * step(0.002, k) * (0.3 + 0.7 * k); sz *= 1.6; }`,
    uniforms: { uCamL: { value: V() }, uSpin: { value: 0 }, uIR: { value: 0 }, uWipe: { value: 2 } },
  });
  n.u.uSpread.value = 1.6;
  n.u.uK.value = 0;
  return n;
}

