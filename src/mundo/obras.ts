import * as THREE from 'three';
import { materia, materiaBuilder, type Nube } from '../engine/materia';
import { gauss, smoothstep } from '../engine/math';
import { HORIZONTE, SPHERE_PRE, esfera, textura } from './tierra';
import { luna as lunaEnPuntos, mercurio as mercurioEnPuntos, sol as solEnPuntos, type Vista } from '../horizontes';

/**
 * The works of a civilization between Type I and Type II, spread over the Solar System and all
 * running at once: the Sun and its growing swarm, Mercury being taken apart, the Moon's catapult,
 * the elevator and the orbital ring, mining in the belt, and the routes between them.
 *
 * World units are astronomical units (AU), Sun at the origin, the ecliptic in the XZ plane. Each
 * body is a group in its own units (radii), so nothing small ever sits on a big float.
 */

export const R_E = 4.2635e-5;
export const R_SUN = 4.6505e-3;
export const R_MER = 1.6308e-5;
export const R_MOON = 1.1614e-5;
export const MOON_D = 2.5696e-3 / R_E; // in Earth radii (60.3)
export const GEO = 6.61;

const LOG_V = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>`;
const LOG_F = /* glsl */ `#include <logdepthbuf_pars_fragment>`;

// ---------------------------------------------------------------- the Sun

/**
 * The Sun: the series' Sun in points (src/horizontes: the Atlas's star in visible light) once it is
 * a few pixels across; below that, a small bright disk (a dot is a dot, and half a million points
 * for one would be waste). Around it, a glow; in infrared, the disk turns a dull red past the curtain.
 */
export function sol() {
  const group = new THREE.Group();
  group.scale.setScalar(R_SUN);
  const uni = { uTime: { value: 0 }, uDim: { value: 0 }, uIR: { value: 0 }, uWipePx: { value: 1e9 }, uLejos: { value: 1 } };
  const estrella = solEnPuntos();
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
        uniform float uTime, uDim, uIR, uWipePx, uLejos; varying vec3 vP; varying float vMu;
        float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main() {
          #include <logdepthbuf_fragment>
          float g = n3(vP * 14.0 + uTime * 0.05) * 0.6 + n3(vP * 40.0 - uTime * 0.08) * 0.4;
          float limb = 0.35 + 0.65 * sqrt(max(vMu, 0.0));
          vec3 c = vec3(1.0, 0.86, 0.66) * (0.85 + 0.3 * g) * limb;
          c *= 18.0 * (1.0 - 0.75 * uDim) * uLejos;
          if (uIR > 0.5 && gl_FragCoord.x > uWipePx) c = vec3(1.0, 0.4, 0.12) * 0.6;
          // Close, the points draw the star; this disk only hides what is behind it.
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  disk.renderOrder = -90;
  // The points draw over it (they test depth: the disk sits just under their surface).
  disk.scale.setScalar(0.99);
  group.add(disk);
  // The glow around it: a billboard that always faces the camera.
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
        uniform float uDim, uIR, uWipePx; varying vec2 vUv;
        void main() {
          #include <logdepthbuf_fragment>
          float r = length(vUv) * 40.0;
          if (r < 1.0) discard;
          float a = 0.9 / (r * r) + 0.06 * exp(-r * 0.12);
          a *= 1.0 - smoothstep(30.0, 40.0, r);
          vec3 g = vec3(1.0, 0.8, 0.55) * a * 6.0 * (1.0 - 0.8 * uDim);
          if (uIR > 0.5 && gl_FragCoord.x > uWipePx) g *= vec3(0.25, 0.08, 0.03);
          gl_FragColor = vec4(g, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.scale.setScalar(40);
  glow.renderOrder = -89;
  group.add(glow);
  // Children 0 and 1 stay the disk and the glow (acts reach for the glow); the points come after.
  group.add(estrella.group);
  const camL = new THREE.Vector3();
  return {
    group,
    uni,
    listo: estrella.listo,
    /** Per frame: the camera (its orientation, and where it is in AU), the time, how dimmed, the focal length and pixel ratio. */
    update(camera: THREE.Camera, time: number, dim: number, camW: THREE.Vector3, vista: Vista) {
      uni.uTime.value = time;
      uni.uDim.value = dim;
      glow.quaternion.copy(camera.quaternion);
      // How many pixels its radius spans: the points take over from the disk between 6 and 14.
      camL.copy(camW).divideScalar(R_SUN);
      const px = vista.focal / Math.max(camL.length(), 1e-9);
      const cerca = smoothstep(6, 14, px);
      uni.uLejos.value = 1 - cerca;
      estrella.group.visible = cerca > 0.001;
      if (estrella.group.visible) {
        estrella.u.uBrillo.value = 2.2 * (1 - 0.5 * dim);
        estrella.update({ sol: camL, camara: camL, focal: vista.focal, dpr: vista.dpr, tiempo: time, presencia: cerca });
      }
    },
  };
}

// ---------------------------------------------------------------- the swarm

/** Ring A: the one the journey flies along (radius, tilt), and where on it the matter arrives. */
export const RING_A = { r: 0.3, tilt: 0.14, node: 0.6 };
export function ringABasis() {
  const n = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(Math.cos(RING_A.node), 0, Math.sin(RING_A.node)), RING_A.tilt);
  const e1 = new THREE.Vector3(Math.cos(RING_A.node), 0, Math.sin(RING_A.node));
  const e2 = new THREE.Vector3().crossVectors(n, e1).normalize();
  return { n, e1, e2 };
}
/** A point on ring A at angle a (radians), offset h along its axis and dr outwards. */
export function ringAPoint(a: number, h = 0, dr = 0, out = new THREE.Vector3()) {
  const { n, e1, e2 } = ringABasis();
  return out
    .copy(e1)
    .multiplyScalar(Math.cos(a) * (RING_A.r + dr))
    .addScaledVector(e2, Math.sin(a) * (RING_A.r + dr))
    .addScaledVector(n, h);
}

const RINGS = 20;
export function enjambre() {
  const b = materiaBuilder(31);
  const orb: number[] = [];
  const tilt: number[] = [];
  const { n: nA } = ringABasis();
  for (let k = 0; k < RINGS; k++) {
    const r = k === 0 ? RING_A.r : 0.26 + b.r() * 0.11;
    const inc = k === 0 ? RING_A.tilt : 0.2 + b.r() * 1.3;
    const node = k === 0 ? RING_A.node : b.r() * Math.PI * 2;
    const count = k === 0 ? 9000 : 6500;
    for (let i = 0; i < count; i++) {
      // A ring is a band: a few rows across its axis.
      const ph = (i / count) * Math.PI * 2 + gauss(b.r) * 0.002;
      b.push(0, 0, 0, new THREE.Color(0.62, 1.0, 0.88).lerp(new THREE.Color(1, 0.92, 0.75), b.r() * 0.5), 3.5e-5, 1, {
        delay: (k + i / count) / RINGS,
        kind: k,
      });
      // Ring A is one exact band (the camera flies along it); the others are loose families of
      // orbits, each collector a little off its family's plane, so from afar the swarm reads as a
      // glowing cloud with denser bands, not as wire rings.
      const suelto = k === 0 ? 0 : 1;
      orb.push(r + gauss(b.r) * (0.0015 + 0.012 * suelto), inc + gauss(b.r) * 0.2 * suelto, node + gauss(b.r) * 0.35 * suelto, ph, (Math.floor(b.r() * 4) - 1.5) * 1.2e-4);
      tilt.push(gauss(b.r) * 0.35, gauss(b.r) * 0.35);
    }
  }
  void nA;
  const data = b.data();
  // orbit attributes split into a vec4 and a float
  const n = data.seed.length;
  const o4 = new Float32Array(n * 4);
  const off = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    o4.set(orb.slice(i * 5, i * 5 + 4), i * 4);
    off[i] = orb[i * 5 + 4];
  }
  const nube = materia(data, {
    pre: /* glsl */ `
      attribute vec4 aOrb; attribute float aOff; attribute vec2 aTilt;
      uniform float uBuilt, uSpin, uNearA, uFar, uFocus, uIR, uWipe; uniform vec3 uCamW;
      vec3 orbita(vec4 o, float off, float extra) {
        float a = o.w + extra;
        vec3 p = vec3(cos(a) * o.x, off, sin(a) * o.x);
        float ci = cos(o.y), si = sin(o.y);
        p = vec3(p.x, p.y * ci - p.z * si, p.y * si + p.z * ci);
        float cn = cos(o.z), sn = sin(o.z);
        return vec3(p.x * cn - p.z * sn, p.y, p.x * sn + p.z * cn);
      }`,
    move: /* glsl */ `
      float spin = uSpin * (0.3 / aOrb.x) * sqrt(0.3 / aOrb.x);
      p = orbita(aOrb, aOff, spin);
      float on = smoothstep(aDelay, aDelay + 0.004, uBuilt);
      // Each collector faces the Sun, a little tilted: it glints when it mirrors the Sun at you.
      vec3 L = normalize(-p);
      vec3 V = normalize(uCamW - p);
      vec3 t1 = normalize(cross(L, vec3(0.0, 1.0, 0.0)));
      vec3 t2 = cross(L, t1);
      vec3 nn = normalize(L + t1 * aTilt.x + t2 * aTilt.y);
      float front = dot(nn, V);
      // A soft, broad glint (a sharp one makes thousands of sub-pixel points twinkle as they turn).
      float glint = pow(max(dot(reflect(-L, nn), V), 0.0), 14.0);
      em *= on * (front > 0.0 ? 0.18 + 2.2 * glint : 0.04 + 0.4 * glint);
      em *= 1.0 - 0.6 * uFar;
      em *= 1.0 - uFocus * (aKind < 0.5 ? 0.4 : 0.92);
      occ = on * 0.3;
      // Each point stands for millions of collectors: from afar the swarm still reads as a cloud.
      fuente = 0.35;
      // Up close, ring A is drawn as plates instead.
      if (aKind < 0.5) { float dc = distance(p, uCamW); float hide = uNearA * (1.0 - smoothstep(0.004, 0.02, dc)); em *= 1.0 - hide; occ *= 1.0 - hide; }
      // Behind the Sun (as seen from the camera): hidden.
      vec3 dv = p - uCamW; float tt = clamp(dot(-uCamW, dv) / dot(dv, dv), 0.0, 1.0);
      if (length(uCamW + dv * tt) < ${R_SUN.toFixed(6)} && dot(dv, dv) > dot(uCamW, uCamW)) { em *= 0.0; occ *= 0.0; }`,
    // In the infrared (false colour), every collector glows with its own heat, on both faces.
    post: /* glsl */ `
      if (uIR > 0.5 && gl_Position.x / gl_Position.w > uWipe) { em = vec3(1.0, 0.42, 0.14) * 0.42 * on * (1.0 - uFocus * 0.9); occ = 0.0; fuente = 1.0; }`,
    uniforms: { uBuilt: { value: 0.4 }, uSpin: { value: 0 }, uNearA: { value: 0 }, uFar: { value: 0 }, uFocus: { value: 0 }, uIR: { value: 0 }, uWipe: { value: 2 }, uCamW: { value: new THREE.Vector3() } },
    extra: { aOrb: [o4, 4], aOff: [off, 1], aTilt: [new Float32Array(tilt), 2] },
  });
  nube.u.uInk.value = 1;
  nube.u.uSpread.value = 0;
  return nube;
}

/** Ring A up close: plates that turn to face the Sun as a wave unfolds the ring. */
export function placas() {
  const N = 30000;
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  const ang = new Float32Array(N);
  const row = new Float32Array(N);
  const sd = new Float32Array(N);
  const rows = 3;
  for (let i = 0; i < N; i++) {
    const k = Math.floor(i / rows);
    ang[i] = (k / (N / rows)) * Math.PI * 2;
    row[i] = (i % rows) - (rows - 1) / 2;
    sd[i] = Math.random();
  }
  geo.setAttribute('aAng', new THREE.InstancedBufferAttribute(ang, 1));
  geo.setAttribute('aRow', new THREE.InstancedBufferAttribute(row, 1));
  geo.setAttribute('aSd', new THREE.InstancedBufferAttribute(sd, 1));
  geo.instanceCount = N;
  const { n, e1, e2 } = ringABasis();
  const u = {
    uN: { value: n },
    uE1: { value: e1 },
    uE2: { value: e2 },
    uR: { value: RING_A.r },
    uSpin: { value: 0 },
    uWave: { value: 0 },
    uWave0: { value: 0 },
    uSize: { value: new THREE.Vector2(1.6e-4, 1.25e-4) },
    uTime: { value: 0 },
    uHero: { value: 100 },
    uFocus: { value: 0 },
    /** The camera in world units (AU): the plates live in AU, the scene is the pivot's. */
    uCam: { value: new THREE.Vector3() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `${LOG_V}
      attribute float aAng, aRow, aSd;
      uniform vec3 uN, uE1, uE2; uniform float uR, uSpin, uWave, uWave0, uTime, uHero; uniform vec2 uSize;
      varying vec2 vUv; varying vec3 vW; varying vec3 vNrm; varying float vOpen, vSd, vHero;
      void main() {
        float a = aAng + uSpin;
        vec3 rad = cos(a) * uE1 + sin(a) * uE2;
        vec3 tan = -sin(a) * uE1 + cos(a) * uE2;
        vec3 c = rad * uR + uN * aRow * uSize.y * 1.25;
        // Folded: edge-on to the Sun; open: facing it. The wave opens them in order.
        float rel = mod(aAng - uWave0, 6.2831853);
        float open = smoothstep(0.0, 0.05, uWave - rel - aSd * 0.02);
        float phi = (1.0 - open) * 1.5707963 + (aSd - 0.5) * 0.25 * open;
        vec3 s = normalize(cos(phi) * tan + sin(phi) * rad);
        vec3 w = c + s * position.x * uSize.x + uN * position.y * uSize.y;
        vNrm = normalize(cross(s, uN));
        vUv = uv; vW = w; vOpen = open; vSd = aSd;
        float dh = abs(mod(a - uHero + 3.14159265, 6.2831853) - 3.14159265);
        vHero = step(dh, 0.0003) * step(abs(aRow), 0.1);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      uniform float uWave, uTime, uFocus; uniform vec3 uCam;
      varying vec2 vUv; varying vec3 vW; varying vec3 vNrm; varying float vOpen, vSd, vHero;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 L = normalize(-vW);
        vec3 V = normalize(uCam - vW);
        vec3 nn = vNrm * (dot(vNrm, L) < 0.0 ? -1.0 : 1.0);
        bool lit = dot(nn, V) > 0.0;
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = 1.0 - smoothstep(0.0, 0.035, min(e.x, e.y));
        float sunlit = max(dot(nn, L), 0.0);
        vec3 col;
        if (lit) {
          // The face that drinks the light: dark glass, the Sun's reflection sliding over it.
          float spec = pow(max(dot(reflect(-L, nn), V), 0.0), 300.0) * 0.3;
          float sheen = pow(max(dot(reflect(-L, nn), V), 0.0), 24.0);
          col = vec3(0.01, 0.025, 0.035) + (vec3(0.1, 0.45, 0.4) * sheen * 0.12 + vec3(1.0, 0.92, 0.75) * spec * 6.0) * sunlit;
          col += vec3(0.6, 1.0, 0.9) * edge * (0.08 + 0.4 * sunlit);
        } else {
          // The back: a silhouette, its rim lit when the Sun is behind it.
          float back = pow(max(dot(-V, L), 0.0), 6.0);
          col = vec3(0.006) + vec3(1.0, 0.8, 0.55) * edge * back * 3.0 + vec3(0.4, 0.9, 0.8) * edge * 0.12;
        }
        // The moment a plate turns to the Sun it flashes.
        col += vec3(0.7, 1.0, 0.9) * exp(-((vOpen - 0.5) / 0.12) * ((vOpen - 0.5) / 0.12)) * 1.0;
        col *= mix(1.0, 0.15, uFocus * (1.0 - vHero));
        col += vHero * uFocus * vec3(0.4, 1.0, 0.85) * edge * 1.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, u };
}

// ---------------------------------------------------------------- Mercury, being taken apart

/** Where the mine is centred (unit, Mercury local) and the mass driver's rail (from, to). */
export const MINA = new THREE.Vector3(0.2, 0.25, 1).normalize();
export function mercurio() {
  const group = new THREE.Group();
  group.scale.setScalar(R_MER);
  const uni = { uSun: { value: new THREE.Vector3(1, 0, 0) }, uCamL: { value: new THREE.Vector3(0, 0, 5) }, uEat: { value: 0.3 } };
  // The ground: the real Mercury in points (src/horizontes), lit hard by a Sun three times closer
  // than ours. Where the machines have been: a terraced pit, a grid of factories and the glowing
  // front where they cut, drawn on every point (and on the dim photograph under them).
  const tA = new THREE.Vector3(0, 1, 0).cross(MINA).normalize();
  const tB = MINA.clone().cross(tA).normalize();
  const suelo = mercurioEnPuntos(textura(''), {
    superficie: {
      uniforms: { uEat: uni.uEat, uMina: { value: MINA }, uTA: { value: tA }, uTB: { value: tB } },
      pre: /* glsl */ `
        uniform vec3 uMina, uTA, uTB; uniform float uEat;
        vec3 hashM(vec3 p) {
          p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
          return fract(sin(p) * 43758.5453);
        }`,
      glsl: /* glsl */ `{
        // How long ago the machines were here, and the terraces they leave.
        float e = (1.0 - dot(n, uMina)) * 0.5 + 0.006 * sin(dot(n, uTA) * 40.0) * cos(dot(n, uTB) * 33.0);
        float mined = 1.0 - smoothstep(uEat - 0.0015, uEat + 0.0015, e);
        if (mined > 0.001) {
          float terr = fract(e * 160.0);
          vec3 nm = normalize(n + (uMina - n * dot(n, uMina)) * (smoothstep(0.0, 0.15, terr) - 0.5) * 0.6);
          nn = normalize(mix(nn, nm, mined));
          alb = mix(alb, alb * (0.12 + 0.1 * step(0.5, terr)), mined);
          // Factories: districts of grids, each turned its own way and bent by the ground; some roads
          // unfinished; knots of light where the lines cross; sparks up close.
          vec2 q0 = vec2(dot(n, uTA), dot(n, uTB)) * 26.0;
          vec3 dist = hashM(floor(vec3(q0 * 0.22, 1.0)));
          float ang = (dist.x - 0.5) * 1.2;
          float esc = 0.8 + 0.5 * dist.y;
          vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q0 * esc;
          q += vec2(sin(q0.y * 0.37 + dist.z * 6.0), cos(q0.x * 0.31 + dist.x * 6.0)) * 0.35;
          vec2 gq = abs(fract(q) - 0.5);
          vec3 cell = hashM(floor(q.xyx) + 3.0);
          // A thin line in points: as wide as the points are apart, dimmed by how much thinner it is.
          float wq = paso * 26.0 * esc;
          float hw = max(0.015, wq * 0.5);
          float line = max(step(0.5 - hw, gq.x) * step(0.25, cell.y), step(0.5 - hw, gq.y) * step(0.25, cell.z)) * 0.03 / max(0.03, wq);
          float kr = max(0.06, wq * 0.5);
          float knot = step(length(gq - 0.5), kr) * step(0.6, hashM(vec3(floor(q + 0.5), 7.0)).x) * (0.06 / kr) * (0.06 / kr);
          vec2 q2 = vec2(dot(n, uTA), dot(n, uTB)) * 400.0;
          float w2 = paso * 400.0;
          float spark = step(length(fract(q2) - 0.5), max(0.18, w2 * 0.5)) * step(0.93, hashM(floor(q2.xyx) + 5.0).x) * (1.0 - smoothstep(0.1, 0.4, w2));
          extra += mined * vec3(0.35, 1.0, 0.82) * (line * 0.08 + knot * 1.2 + spark * 1.4);
        }
        // The front where they cut: a ragged line of light.
        float fw = max(0.0025, paso * 0.35);
        float fr = (e - uEat) / fw;
        extra += vec3(0.6, 1.0, 0.9) * exp(-fr * fr) * 2.2 * (0.0025 / fw);
      }`,
    },
  });
  group.add(suelo.group);

  // The mass driver: a rail across the pit, lights along it, payloads that run and leave.
  const riel = rielMercurio();
  void riel;
  const rb = materiaBuilder(42);
  const rs: number[] = [];
  for (let k = 0; k < 2400; k++) {
    const s = k / 2400;
    const p = riel.at(s, new THREE.Vector3());
    const big = k % 40 === 0;
    rb.push(p.x, p.y, p.z, new THREE.Color(0.7, 1.0, 0.92), big ? 0.003 : 0.0012, big ? 1.6 : 0.5);
    rs.push(s);
  }
  // Payloads: they run the rail faster and faster and leave at its end.
  for (let k = 0; k < 40; k++) {
    rb.push(0, 0, 0, new THREE.Color(1, 0.95, 0.85), 0.004, 4);
    rs.push(1 + k / 40);
  }
  const rail = materia(rb.data(), {
    pre: `${SPHERE_PRE}\nattribute float aS;\nuniform vec3 uMina, uAxis;\nuniform float uSpan;
      vec3 rot(vec3 v, vec3 k, float a) { return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a)); }`,
    move: /* glsl */ `
      if (aS > 1.0) {
        float s = fract(aS + uTime * 0.12);
        s = s * s;
        p = rot(uMina, uAxis, (s - 0.5) * uSpan) * 0.95;
        em *= 1.0 - smoothstep(0.97, 1.0, s);
      }
      ${HORIZONTE}`,
    uniforms: { ...uni, uMina: { value: MINA }, uAxis: { value: new THREE.Vector3() }, uSpan: { value: 0 } },
    extra: { aS: [new Float32Array(rs), 1] },
  });
  rail.u.uSpread.value = 0;
  rail.u.uAxis.value.copy(riel.axis);
  rail.u.uSpan.value = riel.span;
  group.add(rail.points);
  return {
    group,
    /** Its own points (the rail); the ground draws itself. */
    nubes: [rail] as Nube[],
    listo: suelo.listo,
    uni,
    riel,
    /** Per frame, after the world's matrices: the Sun's direction (local); how far the pit has gone. */
    update(sunL: THREE.Vector3, eat: number, vista: Vista) {
      uni.uSun.value.copy(sunL);
      group.worldToLocal(uni.uCamL.value.set(0, 0, 0));
      uni.uEat.value = eat;
      suelo.update({ sol: sunL, camara: uni.uCamL.value, focal: vista.focal, dpr: vista.dpr });
    },
  };
}

/** The rail: a great-circle arc over Mercury, slightly above the pit floor (local units). */
export function rielMercurio() {
  const a = MINA.clone();
  const axis = new THREE.Vector3(0, 1, 0).cross(a).normalize();
  const q = new THREE.Quaternion();
  const span = 0.9;
  return {
    span,
    axis,
    /** Point at s (0..1) along the rail. */
    at(s: number, out: THREE.Vector3) {
      q.setFromAxisAngle(axis, (s - 0.5) * span);
      return out.copy(a).applyQuaternion(q).multiplyScalar(0.945);
    },
    /** Direction of travel at s. */
    dir(s: number, out: THREE.Vector3) {
      q.setFromAxisAngle(axis, (s - 0.5) * span);
      return out.copy(a).applyQuaternion(q).cross(axis).negate().normalize();
    },
  };
}

// ---------------------------------------------------------------- the Moon

/**
 * The Moon: the real one in points (src/horizontes), its near side (longitude 0) turned to the
 * Earth. On it, a base and its catapult. `dirTierra` is the direction from the Moon to the Earth (world).
 */
export function luna(dirTierra: THREE.Vector3) {
  const group = new THREE.Group();
  group.scale.setScalar(R_MOON / R_E);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dirTierra.clone().normalize());
  const suelo = lunaEnPuntos(textura(''));
  group.add(suelo.group);
  const uni = { uSun: { value: new THREE.Vector3(1, 0, 0) }, uCamL: { value: new THREE.Vector3(0, 0, 5) } };
  // A base and its catapult on the near side.
  const b = materiaBuilder(51);
  for (let k = 0; k < 600; k++) {
    const s = k / 600;
    const [x, y, z] = esfera(5 + (s - 0.5) * 30, -20, 1.004);
    b.push(x, y, z, new THREE.Color(0.7, 1.0, 0.9), 0.006, k % 25 === 0 ? 5 : 1.6);
  }
  const base = materia(b.data(), { pre: SPHERE_PRE, move: HORIZONTE, uniforms: uni });
  base.u.uSpread.value = 0;
  group.add(base.points);
  const sunL = new THREE.Vector3();
  const q = new THREE.Quaternion();
  return {
    group,
    /** Its own points (the base); the ground draws itself. */
    nubes: [base],
    listo: suelo.listo,
    /** Per frame, after the world's matrices: the Sun's direction (world); how present it is (0..1). */
    update(sunW: THREE.Vector3, gain: number, vista: Vista) {
      sunL.copy(sunW).applyQuaternion(q.copy(group.quaternion).invert());
      group.worldToLocal(uni.uCamL.value.set(0, 0, 0));
      uni.uSun.value.copy(sunL);
      suelo.update({ sol: sunL, camara: uni.uCamL.value, focal: vista.focal, dpr: vista.dpr, presencia: gain });
      base.u.uGain.value = gain;
    },
  };
}

// ---------------------------------------------------------------- around the Earth (Earth radii)

/** The space elevator's base (lat, lon) and the orbital ring. */
export const ASCENSOR = { lat: 0, lon: -80, top: 15 };
export function ascensorDir() {
  const [x, y, z] = esfera(ASCENSOR.lat, ASCENSOR.lon);
  return new THREE.Vector3(x, y, z);
}

export function cercanias() {
  const group = new THREE.Group();
  const uni = { uSun: { value: new THREE.Vector3(1, 0, 0) }, uCamL: { value: new THREE.Vector3(0, 0, 5) }, uTime: { value: 0 } };
  const b = materiaBuilder(61);
  const kind: number[] = [];
  const par: number[] = [];
  const teal = new THREE.Color(0.62, 1.0, 0.88);
  const white = new THREE.Color(1, 0.95, 0.85);
  // The ribbon: denser near the ground, where the camera rides it first.
  const up = ascensorDir();
  for (let k = 0; k < 6000; k++) {
    const r = Math.pow(ASCENSOR.top, k / 6000);
    b.push(up.x * r, up.y * r, up.z * r, white, 0.0014 * Math.sqrt(r), 0.9);
    kind.push(0);
    par.push(r);
  }
  // The station at GEO and the counterweight at the top.
  for (const [rr, n, s] of [[GEO, 700, 0.06], [ASCENSOR.top, 900, 0.12]] as const) {
    for (let k = 0; k < n; k++) {
      const [dx, dy, dz] = b.onSphere();
      const rad = s * Math.pow(b.r(), 0.5);
      b.push(up.x * rr + dx * rad, up.y * rr + dy * rad, up.z * rr + dz * rad * 0.4, teal, 0.006, 1.5);
      kind.push(1);
      par.push(rr);
    }
  }
  // Climbers: lights that run up and down the ribbon.
  for (let k = 0; k < 14; k++) {
    b.push(0, 0, 0, white, 0.01, 6);
    kind.push(2);
    par.push(k / 14);
  }
  // The orbital ring, at 500 km, along the equator; stations with tethers to the ground.
  const RING = 1.08;
  for (let k = 0; k < 9000; k++) {
    const a = (k / 9000) * Math.PI * 2;
    b.push(Math.cos(a) * RING, gauss(b.r) * 0.0008, -Math.sin(a) * RING, teal, 0.0028, 1.1);
    kind.push(3);
    par.push(0);
  }
  for (let s = 0; s < 36; s++) {
    const a = (s / 36) * Math.PI * 2;
    for (let k = 0; k < 120; k++) {
      const r = 1 + (RING - 1) * (k / 120);
      b.push(Math.cos(a) * r, 0, -Math.sin(a) * r, white, 0.0016, k > 110 ? 4 : 0.7);
      kind.push(3);
      par.push(0);
    }
  }
  const nube = materia(b.data(), {
    pre: `${SPHERE_PRE}\nattribute float aKindC, aPar;\nuniform vec3 uUp;`,
    move: /* glsl */ `
      if (aKindC > 1.5 && aKindC < 2.5) {
        float s = fract(aPar + uTime * 0.02 * (mod(aPar * 14.0, 2.0) < 1.0 ? 1.0 : -1.0));
        p = uUp * pow(${ASCENSOR.top.toFixed(1)}, s);
      }
      // the ring and its tethers sit in the Earth's shadow on the night side: still lit by their own lamps
      ${HORIZONTE}`,
    uniforms: { ...uni, uUp: { value: up } },
    extra: { aKindC: [new Float32Array(kind), 1], aPar: [new Float32Array(par), 1] },
  });
  group.add(nube.points);
  return { group, nubes: [nube], uni };
}

// ---------------------------------------------------------------- routes: matter in motion

/**
 * A route: no hard line, but a faint trail of points along the path, along which packets of light
 * travel (the cargo), fading in at the start and out at the end. The path is any function of t
 * (0..1) in the world; `n` points sample it. `speed`: laps per second of a packet; `paquetes`: how
 * many are on the route at once.
 */
export function camino(n: number, speed: number, color: THREE.Color, size: number, paquetes = 6) {
  const group = new THREE.Group();
  const ts = new Float32Array(n);
  for (let k = 0; k < n; k++) ts[k] = (k + 0.5) / n;
  const b = materiaBuilder(71 + n);
  for (let k = 0; k < n; k++) b.push(0, 0, 0, color, size, 1);
  const u = { uSpeed: { value: speed }, uPaquetes: { value: paquetes }, uAccel: { value: 1 } };
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute float aT; uniform float uSpeed, uPaquetes, uAccel;`,
    move: /* glsl */ `
      float t = aT;
      // A packet: a bright head and a short tail behind it, running along t (faster towards the end with uAccel).
      float tt = pow(t, 1.0 / max(uAccel, 0.05));
      float f = fract(tt * uPaquetes - uTime * uSpeed * uPaquetes);
      float paquete = smoothstep(0.93, 0.992, f) * (1.0 - smoothstep(0.992, 1.0, f));
      float ends = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.92, 1.0, t));
      // The trail itself is a faint dotted path, so the route reads as a way, not as loose sparks.
      em *= ends * (0.16 + 1.8 * paquete);
      sz *= 0.7 + 1.1 * paquete;
      fuente = 0.25 + 0.75 * paquete;`,
    uniforms: u,
    extra: { aT: [ts, 1] },
  });
  nube.u.uSpread.value = 0;
  group.add(nube.points);
  const pos = nube.points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const from = nube.points.geometry.getAttribute('aFrom') as THREE.BufferAttribute;
  let fn: (t: number, out: THREE.Vector3) => THREE.Vector3 = (_t, out) => out.set(0, 0, 0);
  const tmp = new THREE.Vector3();
  const p0 = new THREE.Vector3();
  return {
    group,
    nube,
    u,
    /** Sets the path (a function of t in the world); call when it moves. */
    trazar(path: (t: number, out: THREE.Vector3) => THREE.Vector3) {
      fn = path;
      path(0, p0);
      group.position.copy(p0);
      for (let k = 0; k < n; k++) {
        path(ts[k], tmp).sub(p0);
        pos.setXYZ(k, tmp.x, tmp.y, tmp.z);
        from.setXYZ(k, tmp.x, tmp.y, tmp.z);
      }
      pos.needsUpdate = true;
      from.needsUpdate = true;
    },
    /** World point at t (0..1). */
    at(t: number, out: THREE.Vector3) {
      return fn(t, out);
    },
  };
}

/** A cubic Bézier through four world points, as a path for `camino`. */
export function bezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) {
  return (t: number, out: THREE.Vector3) => {
    const s = 1 - t;
    return out
      .copy(p0)
      .multiplyScalar(s * s * s)
      .addScaledVector(p1, 3 * s * s * t)
      .addScaledVector(p2, 3 * s * t * t)
      .addScaledVector(p3, t * t * t);
  };
}

/**
 * A transfer between two orbits round the Sun, as a path for `camino`: the radius changes smoothly
 * (in logarithm) while the angle sweeps prograde, the way a ship spirals in or out (AU, the ecliptic
 * in XZ; `y0`, `y1`: a little out of the plane at each end).
 */
export function transferencia(r0: number, th0: number, r1: number, th1: number, y0 = 0, y1 = 0) {
  return (t: number, out: THREE.Vector3) => {
    const s = t * t * (3 - 2 * t);
    const r = Math.exp(Math.log(r0) + (Math.log(r1) - Math.log(r0)) * s);
    const th = th0 + (th1 - th0) * t;
    return out.set(r * Math.cos(th), y0 + (y1 - y0) * s, r * Math.sin(th));
  };
}

// ---------------------------------------------------------------- the belt, planets as beacons

export function cinturon(camp?: THREE.Vector3) {
  const b = materiaBuilder(81);
  const kind: number[] = [];
  if (camp) {
    for (let k = 0; k < 6000; k++) {
      const [dx, dy, dz] = b.onSphere();
      const r = 0.05 * Math.pow(b.r(), 0.6);
      b.push(camp.x + dx * r, camp.y + dy * r * 0.3, camp.z + dz * r, new THREE.Color(0.66, 0.58, 0.5), 6e-6 + 2e-5 * Math.pow(b.r(), 4), 0.5);
      kind.push(0.5);
    }
    for (let k = 0; k < 160; k++) {
      const [dx, dy, dz] = b.onSphere();
      const r = 0.04 * Math.pow(b.r(), 0.8);
      b.push(camp.x + dx * r, camp.y + dy * r * 0.3, camp.z + dz * r, new THREE.Color(0.55, 1.0, 0.85), 1e-5, 1.6);
      kind.push(1);
    }
  }
  for (let k = 0; k < 60000; k++) {
    const r = 2.1 + Math.pow(b.r(), 0.8) * 1.2;
    const a = b.r() * Math.PI * 2;
    b.push(Math.cos(a) * r, gauss(b.r) * 0.08 * r * 0.3, Math.sin(a) * r, new THREE.Color(0.6, 0.52, 0.44), 1.2e-4, 0.35);
    kind.push(0);
  }
  // Mines: steady lights where machines work the rocks.
  for (let k = 0; k < 500; k++) {
    const r = 2.2 + b.r() * 1.0;
    const a = b.r() * Math.PI * 2;
    b.push(Math.cos(a) * r, gauss(b.r) * 0.04, Math.sin(a) * r, new THREE.Color(0.55, 1.0, 0.85), 2.5e-4, 3);
    kind.push(1);
  }
  const nube = materia(b.data(), {
    pre: 'attribute float aMine;',
    move: 'fuente = aMine > 0.75 ? 1.0 : aMine > 0.25 ? 0.6 : 0.25;',
    extra: { aMine: [new Float32Array(kind), 1] },
  });
  return nube;
}

/** Beacons: things too small to see that still show as a point of light (planets, the sail). */
export function faros(list: { color: THREE.Color; px: number }[]) {
  const n = list.length;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const px = new Float32Array(n);
  const alpha = new Float32Array(n).fill(1);
  list.forEach((f, i) => {
    col.set([f.color.r, f.color.g, f.color.b], i * 3);
    px[i] = f.px;
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aPx', new THREE.BufferAttribute(px, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uDpr: { value: 1 } },
    vertexShader: /* glsl */ `attribute vec3 color; attribute float aPx, aAlpha; uniform float uDpr; varying vec3 vC;
      void main() { vC = color * aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aPx * uDpr * 3.0; }`,
    fragmentShader: /* glsl */ `varying vec3 vC; void main() { vec2 c = gl_PointCoord - 0.5; float d = dot(c, c);
      float f = exp(-d * 60.0) * 1.6 + exp(-d * 12.0) * 0.25; gl_FragColor = vec4(vC * f, 0.0); }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    mat,
    set(i: number, p: THREE.Vector3, a: number) {
      pos.set([p.x, p.y, p.z], i * 3);
      alpha[i] = a;
    },
    commit() {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
    },
  };
}

/** A laser beam: a bright straight line from A to B with pulses running along it at light speed. */
export function haz() {
  const geo = new THREE.BufferGeometry();
  const N = 400;
  const pos = new Float32Array(N * 3);
  const t = new Float32Array(N);
  for (let k = 0; k < N; k++) t[k] = k / (N - 1);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  const u = { uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uOn: { value: 0 }, uTime: { value: 0 }, uDpr: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `attribute float aT; uniform vec3 uA, uB; uniform float uOn, uTime, uDpr; varying float vA;
      void main() { vec3 p = mix(uA, uB, aT); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        float pulse = pow(0.5 + 0.5 * sin((aT * 30.0 - uTime * 6.0)), 6.0);
        vA = uOn * (0.12 + 0.5 * pulse) * smoothstep(0.0, 0.02, aT); gl_PointSize = (1.4 + 1.2 * pulse) * uDpr; }`,
    fragmentShader: /* glsl */ `varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; float f = exp(-dot(c, c) * 18.0);
      gl_FragColor = vec4(vec3(0.6, 1.0, 0.88) * vA * f * 1.6, 0.0); }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const lineGeo = new THREE.BufferGeometry();
  const lp = new Float32Array(6);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: new THREE.Color(0.25, 0.6, 0.5), dashSize: 1, gapSize: 1, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  line.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points, line);
  return {
    group,
    u,
    set(a: THREE.Vector3, b: THREE.Vector3, on: number) {
      // The group sits at A: points stay precise near the emitter.
      group.position.copy(a);
      u.uA.value.set(0, 0, 0);
      u.uB.value.copy(b).sub(a);
      u.uOn.value = on;
      lp.set([0, 0, 0, b.x - a.x, b.y - a.y, b.z - a.z]);
      lineGeo.attributes.position.needsUpdate = true;
      line.computeLineDistances();
      const dm = line.material as THREE.LineDashedMaterial;
      dm.dashSize = dm.gapSize = a.distanceTo(b) / 160;
      dm.opacity = on;
      line.visible = on > 0.01;
      points.visible = on > 0.01;
    },
  };
}

export { smoothstep };

/** The planets' orbits, as plate lines (faint): they make the overview readable. */
export function orbitas(radii: number[]) {
  // Dotted circles of light (not lines): the same family as the routes. Opacity via `opacity`.
  const group = new THREE.Group();
  const b = materiaBuilder(4242);
  for (const r of radii) {
    const n = Math.round(900 * Math.sqrt(r));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      b.push(Math.cos(a) * r, 0, Math.sin(a) * r, new THREE.Color(0.93, 0.9, 0.86), 2.4e-3 * Math.sqrt(r), 1);
    }
  }
  const nube = materia(b.data(), { move: 'fuente = 0.6;' });
  nube.u.uSpread.value = 0;
  group.add(nube.points);
  return Object.assign(group, {
    nube,
    set opacidad(v: number) {
      nube.u.uGain.value = v;
    },
  });
}
