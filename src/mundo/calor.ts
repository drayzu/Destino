import * as THREE from 'three';
import { CIUDADES, esfera, textura } from './tierra';
import { GLSL_SIMPLEX } from '../horizontes';
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

/**
 * The planet in infrared (false colour), as weather satellites see it: high cloud tops cold and dark,
 * the tropics and the deserts warm, the poles cold; on top, our heat. Its palette and its fine
 * mottling are the Sun's (horizontes · sol), so the two hot bodies of the journey read alike. Only
 * right of the curtain.
 */
export function infrarrojo() {
  const negro = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  negro.needsUpdate = true;
  const uni = {
    uNubes: { value: negro as THREE.Texture },
    uDia: { value: negro as THREE.Texture },
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
        uniform sampler2D uHeat, uNubes, uDia; uniform float uLocal, uGlobal, uWipePx;
        varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        ${GLSL_SIMPLEX}
        // The Sun's palette: deep red, ember, orange, hot white.
        vec3 ramp(float t) {
          vec3 c = mix(vec3(0.12, 0.012, 0.004), vec3(0.62, 0.11, 0.02), smoothstep(0.05, 0.32, t));
          c = mix(c, vec3(1.0, 0.42, 0.1), smoothstep(0.32, 0.6, t));
          // (it tops out at a warm amber: a white there read as a glint of sunlight on a shiny ball)
          return mix(c, vec3(1.0, 0.66, 0.3), smoothstep(0.62, 1.1, t));
        }
        void main() {
          #include <logdepthbuf_fragment>
          if (gl_FragCoord.x < uWipePx) discard;
          vec3 n = normalize(vN);
          float mu = max(dot(n, normalize(vV)), 0.0);
          // Map coordinates as the Earth's maps have them (east towards −Z).
          vec2 uv = vec2(atan(-n.z, n.x) / 6.2831853 + 0.5, 0.5 + asin(clamp(n.y, -1.0, 1.0)) / 3.14159265);
          // The planet's own warmth (288 K): the tropics warmer than the poles; land warmer than
          // sea by day (the bright deserts most); high clouds cold.
          float own = 0.06 + 0.2 * (1.0 - n.y * n.y);
          vec3 d = texture2D(uDia, uv).rgb;
          float desierto = smoothstep(0.25, 0.5, d.r) * (1.0 - smoothstep(0.55, 0.8, d.b)) * (1.0 - smoothstep(0.55, 0.75, abs(n.y)));
          own += 0.1 * desierto;
          float nube = smoothstep(0.2, 0.85, texture2D(uNubes, uv).r);
          own -= 0.3 * nube;
          // The Sun's mottling, so it is not a flat paint.
          own += 0.04 * snoise(n * 30.0) + 0.025 * snoise(n * 80.0);
          float h = texture2D(uHeat, vUv).r;
          // Warming shifts the whole palette, with a soft knee, so the planet never washes out.
          float t = own + 0.75 * uGlobal + uLocal * h;
          t = t > 0.55 ? 0.55 + (t - 0.55) / (1.0 + 1.4 * (t - 0.55)) : t;
          // Heat is given off, not reflected: no bright middle as on a lit ball, only a little less
          // towards the limb. And a fine grain, as of the points everything else is made of.
          float grano = 0.78 + 0.3 * snoise(n * 420.0) + 0.12 * snoise(n * 160.0);
          vec3 col = ramp(t) * (0.8 + 0.2 * smoothstep(0.0, 0.45, mu)) * grano * 0.8;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  mesh.renderOrder = 6;
  // Its air in infrared: a thin warm rim over the blue one of the visible Earth.
  const aire = new THREE.Mesh(
    new THREE.SphereGeometry(1.06, 160, 96),
    new THREE.ShaderMaterial({
      uniforms: uni,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vP; varying vec3 vC;
        void main() {
          vP = position;
          vC = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform float uWipePx, uGlobal;
        varying vec3 vP; varying vec3 vC;
        void main() {
          #include <logdepthbuf_fragment>
          if (gl_FragCoord.x < uWipePx) discard;
          // How close the line of sight passes to the centre (Earth radii).
          vec3 d = normalize(vP - vC);
          float b = length(vC - d * dot(vC, d));
          if (b < 1.0) discard;
          float a = 1.0 - smoothstep(1.01, 1.055, b);
          vec3 col = vec3(0.42, 0.09, 0.02) * (1.0 + 0.5 * uGlobal) * (0.25 + 0.75 * smoothstep(1.055, 1.004, b));
          gl_FragColor = vec4(col, a);
        }`,
    }),
  );
  aire.renderOrder = 6;
  mesh.add(aire);
  // The real Earth's clouds and land (the same maps as its points).
  new THREE.TextureLoader().load(textura('2k_earth_clouds.jpg'), (t) => {
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    uni.uNubes.value = t;
  });
  new THREE.TextureLoader().load(textura('2k_earth_daymap.jpg'), (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    uni.uDia.value = t;
  });
  return { mesh, uni };
}

/**
 * The industry that leaves: factories and data centres, from where the energy is used (around the
 * cities), gather at the space elevator's foot, climb its cable to their height and drift along
 * the orbit to their place in a band around the orbital ring, where they keep circling. In infrared
 * they glow with the heat their radiators give to space. `asc`: the elevator's direction (body frame).
 */
export function industria(asc: THREE.Vector3) {
  const b = materiaBuilder(97);
  const total = CIUDADES.reduce((s, c) => s + c[2], 0);
  const teal = new THREE.Color(0.55, 1.0, 0.86);
  // The data centres: a cooler white.
  const datos = new THREE.Color(0.85, 0.93, 1.0);
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
    b.push(Math.cos(a) * R, Math.sin(a) * R * inc, -Math.sin(a) * R, b.r() < 0.4 ? datos : teal, 0.0035, b.r() < 0.06 ? 3 : 1.1, { from: [fx, fy, fz], delay: b.r() });
  }
  const n = materia(b.data(), {
    pre: /* glsl */ `uniform vec3 uCamL, uAsc; uniform float uSpin, uIR, uWipe;
      vec3 slerpU(vec3 a, vec3 b, float t) {
        float c = clamp(dot(a, b), -1.0, 1.0);
        float w = acos(c);
        if (w < 1e-4) return a;
        return (a * sin((1.0 - t) * w) + b * sin(t * w)) / sin(w);
      }
      bool tapado(vec3 q, vec3 c) { vec3 d = q - c; float t = clamp(-dot(c, d) / dot(d, d), 0.0, 1.0); return t < 0.995 && length(c + d * t) < 0.996; }`,
    move: /* glsl */ `
      // To the elevator's foot over the ground, up its cable to its height, then along the orbit to its place.
      float rr = max(length(position), 1.0);
      if (k < 0.25) p = slerpU(normalize(aFrom), uAsc, smoothstep(0.0, 1.0, k / 0.25)) * 1.004;
      else if (k < 0.6) p = uAsc * mix(1.004, rr, smoothstep(0.0, 1.0, (k - 0.25) / 0.35));
      else {
        float t = smoothstep(0.0, 1.0, (k - 0.6) / 0.4);
        p = slerpU(uAsc, normalize(position), t) * rr;
      }
      float ang = uSpin * smoothstep(0.6, 1.0, k) / (rr * sqrt(rr));
      float ca = cos(ang), sa = sin(ang);
      p = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
      // Rising: a spark; parked in orbit: a steady light.
      float rising = k * (1.0 - k) * 4.0;
      em *= (0.25 + 0.75 * k) * (1.0 + 1.5 * rising);
      // Gathering at the foot they pile up: dimmer there, so the foot is a light, not a blaze.
      em *= mix(0.3, 1.0, smoothstep(0.3, 0.45, k));
      em *= step(0.002, k);
      fuente = 1.0;
      if (tapado(p, uCamL)) { em *= 0.0; }`,
    post: /* glsl */ `
      if (uIR > 0.5 && gl_Position.x / gl_Position.w > uWipe) { em = vec3(1.0, 0.45, 0.14) * 2.6 * step(0.002, k) * (0.3 + 0.7 * k); sz *= 1.6; }`,
    uniforms: { uCamL: { value: V() }, uAsc: { value: asc.clone().normalize() }, uSpin: { value: 0 }, uIR: { value: 0 }, uWipe: { value: 2 } },
  });
  n.u.uSpread.value = 1.6;
  n.u.uK.value = 0;
  return n;
}

