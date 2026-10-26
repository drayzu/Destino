import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';
import { gauss } from '../engine/math';
import { HORIZONTE, SPHERE_PRE } from './tierra';

/**
 * The other planets at work (act III), each a group in its own radii:
 *
 * - Mars, warmed. Mirrors in orbit throw more light on the south pole to free its ice (Zubrin & McKay
 *   1993: mirrors ~100 km across); its own CO₂ is not enough for air like ours (Jakosky & Edwards
 *   2018: ~20 mbar at most), so people live under domes while green spreads from the lowest basins.
 * - Venus, in the shade. At ~50 km over the surface the air is at ~1 bar and 0–50 °C, and cities
 *   float there (Landis 2003); a parasol at the L1 point, ~1 million km towards the Sun, shades it to
 *   cool it (Birch 1991). To cover the whole disc from L1 it must be about twice as wide as Venus.
 */

export const R_MARS = 3389.5 / 1.495978707e8;
export const R_VEN = 6051.8 / 1.495978707e8;
/** Venus–L1, in Venus radii (its Hill radius, ~1.0 million km). */
export const L1_VEN = 167;
/** The parasol's radius (Venus radii): the Sun's disc from L1, plus the planet. */
export const R_PARASOL = 2.1;

const LOG_V = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>`;
const LOG_F = /* glsl */ `#include <logdepthbuf_pars_fragment>`;
const NOISE3 = /* glsl */ `
  float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n3(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }`;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const toXYZ = (la: number, lo: number, r = 1) => V(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.sin(lo) * r);

// ---------------------------------------------------------------- Mars

/** Where the domes are (latitude, longitude in radians): basins and canyons first. */
const CUPULAS: [number, number, number][] = [
  [-0.75, 1.2, 1.4], // Hellas
  [-0.2, -1.2, 1.2], // Valles Marineris
  [0.08, 1.35, 0.8],
  [0.35, -0.4, 0.7],
  [-0.4, 2.6, 0.6],
  [0.6, 0.6, 0.5],
  [-0.05, -2.3, 0.6],
  [0.25, 2.9, 0.4],
];

export function marte() {
  const group = new THREE.Group();
  group.scale.setScalar(R_MARS);
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uSun: { value: V(1, 0, 0) }, uCamL: { value: V(0, 0, 5) }, uCalor: { value: 0 }, uVerde: { value: 0 } };
  const ground = new THREE.Mesh(
    new THREE.SphereGeometry(1, 160, 96),
    new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: /* glsl */ `${LOG_V}
        uniform vec3 uCamL;
        varying vec3 vN; varying vec3 vW; varying float vMu;
        void main() { vN = position; vW = (modelMatrix * vec4(position, 1.0)).xyz;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vMu = max(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)), 0.0);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform vec3 uSun; uniform float uCalor, uVerde;
        varying vec3 vN; varying float vMu;
        ${NOISE3}
        void main() {
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          // The ground: rust and ochre, dark plains, craters.
          float a = fbm(n * 3.0);
          float dark = smoothstep(0.52, 0.66, fbm(n * 1.6 + 4.0));
          vec3 col = mix(vec3(0.58, 0.29, 0.14), vec3(0.74, 0.48, 0.28), a);
          col = mix(col, vec3(0.3, 0.17, 0.1), dark * 0.7);
          // How low the ground is: the north is lower, and so is Hellas, deep in the south.
          vec3 hellas = normalize(vec3(cos(-0.75) * cos(1.2), sin(-0.75), cos(-0.75) * sin(1.2)));
          float low = (1.0 - fbm(n * 2.2 + 9.0)) * 0.7 + 0.35 * n.y + 0.5 * smoothstep(0.88, 0.97, dot(n, hellas));
          // What the warming brings: water in the deepest ground, a green that spreads from it.
          float sea = smoothstep(0.9 - 0.1 * uVerde, 0.91 - 0.1 * uVerde, low) * step(0.001, uVerde);
          float green = smoothstep(0.86 - 0.34 * uVerde, 0.89 - 0.34 * uVerde, low) * step(0.001, uVerde);
          col = mix(col, mix(vec3(0.1, 0.2, 0.08), vec3(0.2, 0.28, 0.1), a), green * 0.85);
          col = mix(col, vec3(0.04, 0.1, 0.16), sea);
          // Where it is advancing: a faint seam of light.
          float edge = 0.86 - 0.34 * uVerde;
          col += vec3(0.4, 1.0, 0.8) * exp(-((low - edge) / 0.008) * ((low - edge) / 0.008)) * 0.12 * step(0.001, uVerde) * (1.0 - sea);
          // The caps: the south one shrinks as the mirrors warm it.
          float south = smoothstep(0.86 + 0.08 * uCalor, 0.88 + 0.08 * uCalor, -n.y + 0.03 * fbm(n * 8.0));
          float north = smoothstep(0.9, 0.92, n.y + 0.03 * fbm(n * 8.0 + 2.0));
          col = mix(col, vec3(0.92, 0.92, 0.9), max(south, north));
          // Light: the Sun, a thin pink haze at the edge (thicker as it warms).
          float sun = dot(n, uSun);
          float lit = smoothstep(-0.05, 0.25, sun);
          vec3 c = col * lit * 0.6;
          // The night side: barely there, so its outline (and its lights) can be read.
          c += col * 0.02 * (1.0 - lit);
          float rim = pow(max(1.0 - vMu, 0.0), 3.0) * smoothstep(-0.2, 0.3, sun);
          c += mix(vec3(0.85, 0.5, 0.35), vec3(0.55, 0.7, 0.95), uCalor * 0.6) * rim * (0.15 + 0.25 * uCalor);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  giro.add(ground);

  // The domes: clusters of light, faint glints by day, warm by night.
  const b = materiaBuilder(1606);
  const site: number[] = [];
  CUPULAS.forEach(([la, lo, w], i) => {
    const n = Math.round(260 * w);
    for (let k = 0; k < n; k++) {
      const r = Math.abs(gauss(b.r)) * 0.035 * w;
      const t = b.r() * Math.PI * 2;
      const p = toXYZ(la + Math.sin(t) * r, lo + (Math.cos(t) * r) / Math.max(Math.cos(la), 0.3), 1.002);
      const teal = b.r() < 0.3;
      b.push(p.x, p.y, p.z, teal ? new THREE.Color(0.5, 1.0, 0.85) : new THREE.Color(1.0, 0.78, 0.5), 0.012, k < 3 ? 1.0 : 0.4);
      site.push(i / CUPULAS.length);
    }
  });
  // And smaller towns all over, each under its dome, growing in number.
  for (let i = 0; i < 70; i++) {
    const la = Math.asin(b.r() * 1.8 - 0.9);
    const lo = b.r() * Math.PI * 2;
    const at = 0.1 + b.r() * 0.85;
    const n = 4 + Math.floor(b.r() * 14);
    for (let k = 0; k < n; k++) {
      const p = toXYZ(la + gauss(b.r) * 0.012, lo + gauss(b.r) * 0.012, 1.002);
      b.push(p.x, p.y, p.z, b.r() < 0.3 ? new THREE.Color(0.5, 1.0, 0.85) : new THREE.Color(1.0, 0.78, 0.5), 0.011, k === 0 ? 0.9 : 0.4);
      site.push(at);
    }
  }
  const domes = materia(b.data(), {
    pre: `${SPHERE_PRE}\nattribute float aSite; uniform float uCupulas;`,
    move: /* glsl */ `
      float d = dot(normalize(p), uSun);
      em *= mix(0.12, 1.0, 1.0 - smoothstep(-0.15, 0.05, d));
      em *= step(aSite, uCupulas - 0.01);
      fuente = 1.0;
      ${HORIZONTE}`,
    uniforms: { ...uni, uCupulas: { value: 0 } },
    extra: { aSite: [new Float32Array(site), 1] },
  });
  domes.u.uSpread.value = 0;
  giro.add(domes.points);

  // The mirrors over the south pole: each a sail of light that throws the Sun down onto the cap.
  // (Their distance is illustrative: Zubrin and McKay put theirs ~60 radii away, past the planet.)
  const espejos: THREE.Vector3[] = [];
  const mb = materiaBuilder(77);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const p = V(Math.cos(a) * 0.95, -1.55, Math.sin(a) * 0.95);
    espejos.push(p);
    mb.push(p.x, p.y, p.z, new THREE.Color(1.0, 0.97, 0.88), 0.05, 3.0);
    for (let j = 0; j < 40; j++) mb.push(p.x + gauss(mb.r) * 0.06, p.y + gauss(mb.r) * 0.01, p.z + gauss(mb.r) * 0.06, new THREE.Color(0.9, 0.95, 1.0), 0.012, 0.6);
  }
  const mirrors = materia(mb.data(), { pre: `uniform float uOn;`, move: `em *= uOn; fuente = 1.0;`, uniforms: { uOn: { value: 0 } } });
  mirrors.u.uSpread.value = 0;
  group.add(mirrors.points);

  return {
    group,
    giro,
    uni,
    nubes: [domes, mirrors],
    espejos,
    /** Per frame: the Sun and the camera in the planet's (not turning) frame; how warm, how green, how many domes, the mirrors. */
    update(sunL: THREE.Vector3, camL: THREE.Vector3, time: number, calor: number, verde: number, cupulas: number, espejo: number) {
      giro.rotation.y = time * 0.01;
      const q = giro.quaternion.clone().invert();
      uni.uSun.value.copy(sunL).applyQuaternion(q);
      uni.uCamL.value.copy(camL).applyQuaternion(q);
      uni.uCalor.value = calor;
      uni.uVerde.value = verde;
      domes.u.uCupulas.value = cupulas;
      mirrors.u.uOn.value = espejo;
      mirrors.points.visible = espejo > 0.001;
    },
  };
}

// ---------------------------------------------------------------- Venus

export function venus() {
  const group = new THREE.Group();
  group.scale.setScalar(R_VEN);
  const uni = {
    uSun: { value: V(1, 0, 0) },
    uCamL: { value: V(0, 0, 5) },
    uTime: { value: 0 },
    uSombra: { value: 0 },
    uBarrido: { value: V(0, 0, 1) },
  };
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1, 160, 96),
    new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vN; varying float vMu;
        void main() { vN = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vMu = max(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)), 0.0);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform vec3 uSun, uBarrido; uniform float uTime, uSombra;
        varying vec3 vN; varying float vMu;
        ${NOISE3}
        void main() {
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          float lat = asin(clamp(n.y, -1.0, 1.0));
          float lon = atan(n.z, n.x);
          // The clouds race round the planet (four days a lap), in chevrons that open towards the poles.
          float l2 = lon + uTime * 0.03 + 0.9 * abs(lat);
          vec3 q = vec3(cos(l2) * cos(lat), sin(lat) * 3.0, sin(l2) * cos(lat));
          float f = fbm(q * vec3(2.0, 1.2, 2.0) + fbm(q * 3.0) * 0.8);
          vec3 col = mix(vec3(0.78, 0.66, 0.46), vec3(0.96, 0.92, 0.8), smoothstep(0.3, 0.75, f));
          // Lit by the Sun, softly (the light goes deep into the haze) and less where the parasol shades it.
          float sun = dot(n, uSun);
          float lit = smoothstep(-0.2, 0.6, sun);
          float shade = smoothstep(-0.12, 0.12, dot(n, uBarrido) - 1.15 + 2.3 * uSombra);
          float light = mix(1.0, 0.04, shade);
          vec3 c = col * lit * light * 0.5;
          c += col * 0.018 * (1.0 - lit * light);
          // The bright haze at the edge.
          float rim = pow(max(1.0 - vMu, 0.0), 2.5) * smoothstep(-0.3, 0.4, sun);
          c += vec3(1.0, 0.92, 0.78) * rim * 0.2 * light;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  group.add(clouds);

  // The cities, ~50 km up, in the cloud deck (riding its wind): glints by day, lights in the shade.
  const b = materiaBuilder(2203);
  for (let c = 0; c < 46; c++) {
    const la = (b.r() * 2 - 1) * 0.9;
    const lo = b.r() * Math.PI * 2;
    const n = 6 + Math.floor(b.r() * 24);
    for (let k = 0; k < n; k++) {
      const p = toXYZ(la + gauss(b.r) * 0.012, lo + gauss(b.r) * 0.012, 1.0083);
      const teal = b.r() < 0.35;
      b.push(p.x, p.y, p.z, teal ? new THREE.Color(0.5, 1.0, 0.85) : new THREE.Color(1.0, 0.8, 0.55), 0.014, k === 0 ? 1.2 : 0.45);
    }
  }
  const cities = materia(b.data(), {
    pre: `${SPHERE_PRE}\nuniform vec3 uBarrido; uniform float uSombra, uOn;`,
    move: /* glsl */ `
      // They ride the clouds' wind.
      float a = uTime * 0.03;
      p = vec3(p.x * cos(a) + p.z * sin(a), p.y, -p.x * sin(a) + p.z * cos(a));
      vec3 n = normalize(p);
      float dark = max(1.0 - smoothstep(-0.2, 0.1, dot(n, uSun)), smoothstep(-0.12, 0.12, dot(n, uBarrido) - 1.15 + 2.3 * uSombra));
      em *= mix(0.25, 1.3, dark) * uOn;
      fuente = 1.0;
      ${HORIZONTE}`,
    uniforms: { ...uni, uOn: { value: 0 } },
  });
  cities.u.uSpread.value = 0;
  group.add(cities.points);

  // The parasol at L1: a dark disc facing the Sun (built in Venus radii, along local +X; turned in update).
  const parasol = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(R_PARASOL, 128),
    new THREE.ShaderMaterial({
      uniforms: { uOn: { value: 0 } },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec2 vP;
        void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform float uOn; varying vec2 vP;
        void main() {
          #include <logdepthbuf_fragment>
          float r = length(vP) / ${R_PARASOL.toFixed(2)};
          if (r > uOn) discard;
          // Its frame: rings and spokes, a teal rim.
          float ring = 1.0 - smoothstep(0.0, 0.012, abs(fract(r * 6.0) - 0.5) - 0.48);
          float spoke = 1.0 - smoothstep(0.0, 0.01, abs(fract(atan(vP.y, vP.x) / 6.2831853 * 24.0) - 0.5) - 0.485);
          vec3 c = vec3(0.012, 0.013, 0.015) + vec3(0.12, 0.14, 0.16) * max(ring, spoke) * 0.25;
          c += vec3(0.45, 1.0, 0.85) * (1.0 - smoothstep(0.0, 0.015, uOn - r)) * 1.2;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  disc.rotation.y = Math.PI / 2;
  parasol.add(disc);
  group.add(parasol);

  return {
    group,
    uni,
    nubes: [cities],
    parasol,
    /** Per frame: the Sun and the camera in the planet's frame; the time; how far the parasol has opened (0..1) and its shade has swept (0..1); the cities. */
    update(sunL: THREE.Vector3, camL: THREE.Vector3, time: number, abre: number, sombra: number, ciudades: number) {
      uni.uSun.value.copy(sunL);
      uni.uCamL.value.copy(camL);
      uni.uTime.value = time;
      cities.u.uTime.value = time;
      cities.u.uOn.value = ciudades;
      cities.points.visible = ciudades > 0.001;
      // The parasol sits towards the Sun; its shadow comes in from one side as it opens.
      parasol.position.copy(sunL).multiplyScalar(L1_VEN);
      parasol.quaternion.setFromUnitVectors(V(1, 0, 0), sunL);
      (disc.material as THREE.ShaderMaterial).uniforms.uOn.value = abre;
      parasol.visible = abre > 0.001;
      // The shadow sweeps across the disc, from one side, as the shade slides into place.
      uni.uBarrido.value.copy(sunL).cross(V(0, 1, 0)).normalize().negate();
      uni.uSombra.value = sombra;
    },
  };
}
