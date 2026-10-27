import * as THREE from 'three';
import { materia, type MateriaData, type Nube } from '../engine/materia';

/**
 * A planet in points, the style of Espacio and Tiempo, coloured from a real map. It is the design
 * Diego chose in the study (prototypes/src/estudios/planetas.ts, way 3). The recipe, its numbers and
 * how to carry it to another project are in docs/planeta-puntos.md.
 *
 * Three layers, all in the planet's own frame (radii, north up +Y, longitude 0 at +X, east towards −Z
 * as `esfera` in tierra.ts):
 *
 * 1 · Global points: a Fibonacci sphere, each point coloured from the map on the CPU. With a cloud map,
 *     a second shell of points at 1.01 where it is cloudy.
 * 2 · Under them, the same photograph, treated and dim (~0.2). The gaps between points read as ground,
 *     not as holes, and it hides what is behind the planet.
 * 3 · A patch of ever finer points under the camera, clipmaps for points. Level L has a spacing of
 *     S0 / 2^L radians and a window of 2·NV × 2·NV cells. Each point sits in a fixed cell of a
 *     latitude–longitude lattice of its level, so moving the camera never makes the points slide.
 *     The window moves by whole cells and fades at its edge. Each level leaves a hole where the next,
 *     finer one is on. The camera's height picks the level: about 0.45 % of the height between
 *     points on the ground.
 *
 * Every layer shares one treatment. The grade is dark and muted (`grado`). The terminator is soft
 * where there is air and sharp on bare rock (`luzSol`). The Sun glints on open sea. Behind the limb
 * there can be a haze.
 *
 * A planet's own changes to its ground (a mine, a greening, a shade) are one piece of GLSL,
 * `superficie.glsl`, run on every point and on every pixel of the photograph. In scope:
 *   n (vec3)       the unit direction of the ground, planet frame
 *   alb (vec3)     its colour, linear (inout)
 *   nn (vec3)      the normal the Sun lights (inout)
 *   sombra (float) how much sunlight reaches it (inout, 1)
 *   extra (vec3)   its own light, added unlit (inout, 0)
 *   paso (float)   the spacing between points there, in radians (for thin lines: draw them
 *                  max(width, paso) wide and dim them by width / paso, so they read the same at any distance)
 *   hp (float)     a hash of the point, 0..1
 * plus h3, n3, fbm and dirDe(la, lo).
 */

/** Level 0's spacing (radians), how many levels, half the window (cells). */
export const S0 = 0.0049;
export const NIVELES = 9;
export const NV = 80;

export interface PlanetaPuntosOpts {
  /** The colour map: equirectangular, longitude 0 in the middle, east to the right. */
  mapa: string;
  /** A cloud map (white where cloudy): a shell of points above the ground, grey on the ground. */
  nubes?: string;
  /** How much air: 0, bare rock with a hard terminator; 1, a thick atmosphere with a soft one and a rim. */
  aire: number;
  /** Relief read from the map's own shading (for rock lit low: Mercury, the Moon). */
  relieve?: boolean;
  /** The Sun's glint on open water (the map's blue pixels). */
  mar?: boolean;
  /** The haze beyond the limb (its colour and radius), or none. */
  halo?: { color: THREE.Color; r?: number };
  /** Points over the whole sphere (the patch adds finer ones near the camera). */
  puntos?: number;
  /** The albedo's tint. */
  tinte?: THREE.Color;
  /** How bright the photograph under the points is, and its radius. */
  fondo?: number;
  fondoR?: number;
  semilla?: number;
  /** The planet's own changes to its ground (see above). Uniforms are shared by every layer. */
  superficie?: { pre?: string; glsl: string; uniforms?: Record<string, THREE.IUniform> };
}

export interface PlanetaPuntos {
  /** Add it to the planet's frame (scaled to its radius, turned with it). */
  group: THREE.Group;
  /** Its points, once built (empty before): keep them in focus and give them their own horizon. */
  nubes: Nube[];
  /** Resolves once the maps are loaded and the points built. */
  listo: Promise<void>;
  /** The haze's uniforms (colour, strength), when there is one. */
  halo: { uColor: { value: THREE.Color }; uOn: { value: number } } | null;
  /** Per frame: the Sun's direction and the camera, in the planet's frame; how present it is (0..1). */
  update(sunL: THREE.Vector3, camL: THREE.Vector3, gain?: number): void;
}

// ---------------------------------------------------------------- GLSL every layer shares

export const GLSL_COMUN = /* glsl */ `
  float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n3(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
  vec3 dirDe(float la, float lo) { return vec3(cos(la) * cos(lo), sin(la), -cos(la) * sin(lo)); }
  vec2 uvDe(vec3 n) { return vec2(atan(-n.z, n.x) / 6.2831853 + 0.5, 0.5 + asin(clamp(n.y, -1.0, 1.0)) / 3.14159265); }
  vec2 uvLL(float la, float lo) { return vec2(fract(lo / 6.2831853 + 0.5), 0.5 + la / 3.14159265); }
  // The grade: muted, darker, a little cool.
  vec3 grado(vec3 c) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, 0.6);
    c = pow(max(c, vec3(0.0)), vec3(1.3));
    return c * vec3(0.9, 0.96, 1.04);
  }
  // Sunlight on a point: soft where there is air (the light goes round a little), sharp on rock.
  float luzSol(vec3 n, vec3 nn, vec3 L, float aire) {
    float d = dot(nn, L);
    return mix(smoothstep(-0.02, 0.22, d) * smoothstep(-0.05, 0.05, dot(n, L)), smoothstep(-0.14, 0.42, d), aire);
  }
  // The photograph's light: the same, plus the air within the limb (blue by day, warm at the terminator).
  vec3 luz(vec3 albedo, vec3 n, vec3 L, vec3 V, float aire) {
    float d = dot(n, L);
    float lit = mix(smoothstep(-0.02, 0.22, d), smoothstep(-0.14, 0.42, d), aire);
    vec3 c = grado(albedo) * lit * 0.62;
    float mu = max(dot(n, V), 0.0);
    float rim = pow(max(1.0 - mu, 0.0), 2.6) * aire;
    c += vec3(0.32, 0.55, 1.0) * rim * 0.45 * smoothstep(-0.2, 0.5, d);
    c += vec3(1.0, 0.5, 0.26) * aire * 0.06 * exp(-(d / 0.09) * (d / 0.09)) * (0.4 + rim);
    return c;
  }
  float esMar(vec3 c) { return step(c.r * 1.4, c.b) * step(c.g, c.b); }
  vec3 brilloMar(vec3 n, vec3 L, vec3 V, float pw) { return vec3(1.0, 0.85, 0.65) * pow(max(dot(reflect(-L, n), V), 0.0), pw) * 0.5; }`;

const NUBE_GRIS = 'vec3(0.62, 0.64, 0.66)';
const f = (x: number) => x.toFixed(6);
const v3 = (c: THREE.Color) => `vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;

// ---------------------------------------------------------------- maps

function cargar(url: string, srgb: boolean) {
  return new Promise<THREE.Texture>((res, rej) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.wrapS = THREE.RepeatWrapping;
        t.anisotropy = 8;
        res(t);
      },
      undefined,
      rej,
    );
  });
}

const LIN = Array.from({ length: 256 }, (_, k) => (k / 255) ** 2.2);

/** A map's pixels on the CPU: the linear colour at a direction (nearest pixel). */
function lector(tex: THREE.Texture) {
  const img = tex.image as HTMLImageElement;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const W = c.width;
  const H = c.height;
  return (x: number, y: number, z: number, out: number[]) => {
    const u = Math.atan2(-z, x) / (Math.PI * 2) + 0.5;
    const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI;
    const px = Math.min(W - 1, Math.max(0, Math.floor(u * W)));
    const py = Math.min(H - 1, Math.max(0, Math.floor(v * H)));
    const i = (py * W + px) * 4;
    out[0] = LIN[d[i]];
    out[1] = LIN[d[i + 1]];
    out[2] = LIN[d[i + 2]];
    return out;
  };
}

function azar(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pausa = () => new Promise<void>((r) => setTimeout(r, 0));

// ---------------------------------------------------------------- layer 1 · global points

async function puntosGlobales(o: Required<Pick<PlanetaPuntosOpts, 'puntos' | 'semilla'>> & PlanetaPuntosOpts, mapa: ReturnType<typeof lector>, nubes: ReturnType<typeof lector> | null) {
  const N = o.puntos;
  const maxC = nubes ? Math.round(N * 0.5) : 0;
  const M = N + maxC;
  const pos = new Float32Array(M * 3);
  const col = new Float32Array(M * 3);
  const size = new Float32Array(M);
  const seed = new Float32Array(M);
  const kind = new Float32Array(M);
  const nrm = o.relieve ? new Float32Array(M * 3) : null;
  const r = azar(o.semilla);
  const gauss = () => (r() + r() + r() + r() - 2) * 0.866;
  // Point size so the sphere stays covered (and as bright) whatever the count.
  const S = 4.76 / Math.sqrt(N);
  const ga = Math.PI * (3 - Math.sqrt(5));
  const J = Math.sqrt((4 * Math.PI) / N) * 0.35;
  const t = o.tinte ?? new THREE.Color(1, 1, 1);
  const c = [0, 0, 0];
  const lum = (x: number, y: number, z: number) => {
    const l = Math.hypot(x, y, z);
    mapa(x / l, y / l, z / l, c);
    return c[0] + c[1] + c[2];
  };
  let k = 0;
  for (let i = 0; i < N; i++) {
    if (i % 40000 === 0) await pausa();
    const y0 = 1 - (2 * (i + 0.5)) / N;
    const rr = Math.sqrt(1 - y0 * y0);
    // The Fibonacci lattice, each point nudged within its cell (else its spirals show as hatching).
    const a = i * ga + (gauss() * J) / Math.max(rr, 0.05);
    const y = Math.max(-1, Math.min(1, y0 + gauss() * J * rr));
    const r2 = Math.sqrt(1 - y * y);
    const x = Math.cos(a) * r2;
    const z = Math.sin(a) * r2;
    if (nrm) {
      // Relief from the map's own shading: brighter where it faces its light, read as slope.
      let ax = z;
      let az = -x;
      const al = Math.hypot(ax, az);
      let nx = x;
      let ny = y;
      let nz = z;
      if (al > 1e-6) {
        ax /= al;
        az /= al;
        // t1 = UP × p, t2 = p × t1.
        const bx = y * az;
        const by = z * ax - x * az;
        const bz = -y * ax;
        const e = 0.003;
        const h0 = lum(x, y, z);
        const d1 = (lum(x + ax * e, y, z + az * e) - h0) * 2.0;
        const d2 = (lum(x + bx * e, y + by * e, z + bz * e) - h0) * 2.0;
        nx = x - ax * d1 - bx * d2;
        ny = y - by * d2;
        nz = z - az * d1 - bz * d2;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl;
        ny /= nl;
        nz /= nl;
      }
      nrm.set([nx, ny, nz], k * 3);
    }
    mapa(x, y, z, c);
    const sea = o.mar && c[2] > c[0] * 1.4 && c[2] > c[1] ? 1 : 0;
    const v = 0.8 + r() * 0.4;
    pos.set([x, y, z], k * 3);
    col.set([c[0] * t.r * v, c[1] * t.g * v, c[2] * t.b * v], k * 3);
    size[k] = S * (0.65 + r() * 0.7);
    seed[k] = r();
    kind[k] = sea;
    k++;
  }
  if (nubes) {
    // The clouds: a second shell, where the cloud map is white.
    for (let i = 0; i < maxC; i++) {
      if (i % 40000 === 0) await pausa();
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const x = Math.cos(a) * s;
      const y = Math.sin(a) * s;
      const z = u;
      const cl = nubes(x, y, z, c)[0];
      if (cl < 0.12 || r() > cl * 1.6) continue;
      const v = Math.min(1, cl * 1.4) * (0.8 + r() * 0.4);
      pos.set([x * 1.01, y * 1.01, z * 1.01], k * 3);
      col.set([0.62 * v, 0.64 * v, 0.66 * v], k * 3);
      if (nrm) nrm.set([x, y, z], k * 3);
      size[k] = S * 1.03 * (0.65 + r() * 0.7);
      seed[k] = r();
      kind[k] = 2;
      k++;
    }
  }
  const p3 = pos.slice(0, k * 3);
  const zeros = new Float32Array(k);
  const data: MateriaData = { position: p3, aFrom: p3, color: col.slice(0, k * 3), aInk: zeros, size: size.slice(0, k), seed: seed.slice(0, k), aDelay: zeros, aKind: kind.slice(0, k) };
  return { data, nrm: nrm ? nrm.slice(0, k * 3) : null };
}

// ---------------------------------------------------------------- layer 3 · the patch (one geometry for every planet)

let geoParche: THREE.BufferGeometry | null = null;
function datosParche(): MateriaData {
  const n = NIVELES * (2 * NV) * (2 * NV);
  const pos = new Float32Array(n * 3);
  let k = 0;
  for (let L = 1; L <= NIVELES; L++)
    for (let j = -NV; j < NV; j++)
      for (let i = -NV; i < NV; i++) {
        pos.set([i, j, L], k * 3);
        k++;
      }
  const ones = new Float32Array(n).fill(1);
  const zeros = new Float32Array(n);
  return { position: pos, aFrom: pos, color: new Float32Array(n * 3).fill(1), aInk: zeros, size: ones, seed: zeros, aDelay: zeros, aKind: zeros };
}

// ---------------------------------------------------------------- the planet

export function planetaPuntos(opts: PlanetaPuntosOpts): PlanetaPuntos {
  const o = { puntos: 400000, semilla: 7, fondo: 0.2, fondoR: 0.996, ...opts };
  const group = new THREE.Group();
  const nubes: Nube[] = [];
  const AIRE = f(o.aire);
  const hook = o.superficie?.glsl ?? '';
  const pre = o.superficie?.pre ?? '';
  const propios = o.superficie?.uniforms ?? {};
  const negro = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  negro.needsUpdate = true;
  const u = {
    uSun: { value: new THREE.Vector3(1, 0, 0) },
    uCamL: { value: new THREE.Vector3(0, 0, 5) },
    uMap: { value: negro as THREE.Texture },
    uNubes: { value: negro as THREE.Texture },
    uTinte: { value: (o.tinte ?? new THREE.Color(1, 1, 1)).clone() },
    uFocoLat: { value: 0 },
    uFocoLon: { value: 0 },
    uNivel: { value: 0 },
  };
  const conNubes = !!o.nubes;

  // Layer 2 · the photograph, treated and dim, under the points.
  const fondoU = { ...u, ...propios, uBrillo: { value: o.fondo } };
  const fondo = new THREE.Mesh(
    new THREE.SphereGeometry(1, 192, 128),
    new THREE.ShaderMaterial({
      uniforms: fondoU,
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vN;
        void main() { vN = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uMap, uNubes; uniform vec3 uSun, uCamL, uTinte; uniform float uBrillo;
        varying vec3 vN;
        ${GLSL_COMUN}
        ${pre}
        void main() {
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          vec3 V = normalize(uCamL - vN);
          vec2 uv = uvDe(n);
          vec3 base = texture2D(uMap, uv).rgb * uTinte;
          vec3 alb = base;
          float cl = 0.0;
          ${conNubes ? `cl = smoothstep(0.2, 0.9, texture2D(uNubes, uv).r); alb = mix(alb, ${NUBE_GRIS}, cl * 0.8);` : ''}
          vec3 nn = n;
          ${o.relieve ? RELIEVE_GLSL : ''}
          float sombra = 1.0;
          vec3 extra = vec3(0.0);
          float paso = length(fwidth(n));
          float hp = 0.5;
          ${hook}
          vec3 c = luz(alb, nn, uSun, V, ${AIRE}) * sombra;
          ${o.mar ? 'c += brilloMar(n, uSun, V, 70.0) * esMar(base) * (1.0 - cl) * smoothstep(0.0, 0.2, dot(n, uSun)) * sombra;' : ''}
          gl_FragColor = vec4((c + extra) * uBrillo, 1.0);
        }`,
    }),
  );
  fondo.scale.setScalar(o.fondoR);
  fondo.renderOrder = -50;
  group.add(fondo);

  // The haze beyond the limb: a slightly larger sphere, its back half only, glowing edge-on by day.
  let halo: PlanetaPuntos['halo'] = null;
  if (o.halo) {
    const hu = { uSun: u.uSun, uCamL: u.uCamL, uOn: { value: 1 }, uColor: { value: o.halo.color.clone() } };
    halo = hu;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(o.halo.r ?? 1.028, 128, 64),
      new THREE.ShaderMaterial({
        uniforms: hu,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          #include <common>
          #include <logdepthbuf_pars_vertex>
          uniform vec3 uCamL;
          varying vec3 vN; varying vec3 vV;
          void main() { vN = normalize(position); vV = normalize(uCamL - position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: /* glsl */ `
          #include <logdepthbuf_pars_fragment>
          uniform vec3 uSun, uColor; uniform float uOn; varying vec3 vN; varying vec3 vV;
          void main() {
            #include <logdepthbuf_fragment>
            float e = 1.0 - abs(dot(normalize(vN), normalize(vV)));
            float g = pow(max(e, 0.0), 5.0) * smoothstep(-0.35, 0.45, dot(normalize(vN), uSun));
            gl_FragColor = vec4(uColor * g * 1.1 * uOn, 1.0);
          }`,
      }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    group.add(mesh);
  }

  // Layer 3 · the patch.
  const dp = datosParche();
  const parche = materia(dp, {
    pre: /* glsl */ `
      uniform sampler2D uMap, uNubes;
      uniform float uFocoLat, uFocoLon, uNivel;
      uniform vec3 uSun, uCamL, uTinte;
      ${GLSL_COMUN}
      ${pre}`,
    move: /* glsl */ `{
      float L = position.z;
      float sp = ${f(S0)} / exp2(L);
      float row = floor(uFocoLat / sp) + position.y;
      float lat = (row + 0.5) * sp;
      float nLon = max(1.0, floor(6.2831853 * cos(lat) / sp));
      float dl = 6.2831853 / nLon;
      float col = floor(uFocoLon / dl) + position.x;
      vec3 cell = vec3(row, mod(col, nLon), L);
      float la = lat + (h3(cell) - 0.5) * sp * 0.8;
      float lo = (col + 0.5 + (h3(cell + 1.7) - 0.5) * 0.8) * dl;
      vec3 n = dirDe(la, lo);
      p = n;
      // Its colour: the map, the clouds, a little grain of its own (the map's pixels are larger than the finest points).
      vec2 uv = uvLL(la, lo);
      vec3 base = texture2D(uMap, uv).rgb * uTinte;
      vec3 alb = base;
      float cl = 0.0;
      ${conNubes ? `cl = smoothstep(0.2, 0.9, texture2D(uNubes, uv).r); alb = mix(alb, ${NUBE_GRIS}, cl * 0.8);` : ''}
      float hp = h3(cell + 3.1);
      alb *= 0.82 + 0.36 * hp;
      vec3 nn = n;
      ${o.relieve ? RELIEVE_GLSL : ''}
      float sombra = 1.0;
      vec3 extra = vec3(0.0);
      float paso = sp;
      ${hook}
      float lit = luzSol(n, nn, uSun, ${AIRE}) * sombra;
      em = grado(alb) * (lit * 0.9 + 0.003) + extra;
      ${o.mar ? 'em += brilloMar(n, uSun, normalize(uCamL - n), 60.0) * lit * esMar(base) * (1.0 - cl);' : ''}
      // Which levels are on: the finest the camera's height asks for; fading at the window's edge;
      // a hole where the next, finer level takes over; nothing past the poles.
      float on = clamp(uNivel - L + 1.0, 0.0, 1.0);
      float dc = max(abs(position.x + 0.5), abs(position.y + 0.5)) / ${f(NV)};
      on *= 1.0 - smoothstep(0.7, 1.0, dc);
      float ang = acos(clamp(dot(n, dirDe(uFocoLat, uFocoLon)), -1.0, 1.0));
      on *= mix(1.0, smoothstep(0.7, 0.95, ang / (${f(NV)} * sp * 0.5)), clamp(uNivel - L, 0.0, 1.0));
      on *= step(abs(lat), 1.5707);
      em *= on;
      sz = sp * 0.8;
      if (dot(n, uCamL - n) < 0.0 || on < 0.002) em *= 0.0;
    }`,
    uniforms: { ...u, ...propios },
  });
  parche.u.uSpread.value = 0;
  // Every planet's patch has the same lattice: one geometry for all.
  geoParche ??= parche.points.geometry;
  if (parche.points.geometry !== geoParche) {
    parche.points.geometry.dispose();
    parche.points.geometry = geoParche;
  }
  parche.points.visible = false;
  group.add(parche.points);

  let hecho = false;
  const listo = (async () => {
    const [map, cloud] = await Promise.all([cargar(o.mapa, true), o.nubes ? cargar(o.nubes, false) : Promise.resolve(null)]);
    u.uMap.value = map;
    if (cloud) u.uNubes.value = cloud;
    // Layer 1 · the global points.
    const { data, nrm } = await puntosGlobales(o, lector(map), cloud ? lector(cloud) : null);
    const global = materia(data, {
      pre: /* glsl */ `
        uniform vec3 uSun, uCamL;
        uniform float uFocoLat, uFocoLon, uNivel;
        ${nrm ? 'attribute vec3 aNrm;' : ''}
        ${GLSL_COMUN}
        ${pre}`,
      move: /* glsl */ `{
        vec3 n = normalize(p);
        vec3 alb = color;
        vec3 nn = ${nrm ? 'aNrm' : 'n'};
        float sombra = 1.0;
        vec3 extra = vec3(0.0);
        float paso = ${f(Math.sqrt((4 * Math.PI) / o.puntos))};
        float hp = seed;
        float nube = step(1.5, aKind);
        if (nube < 0.5) {
          ${hook}
        }
        float lit = luzSol(n, nn, uSun, max(${AIRE}, nube)) * sombra;
        em = grado(alb) * (lit * 0.9 + 0.003) + extra;
        ${o.mar ? 'if (aKind > 0.5 && aKind < 1.5) em += brilloMar(n, uSun, normalize(uCamL - p), 60.0) * lit;' : ''}
        // They step aside where the patch's first level is on.
        float angF = acos(clamp(dot(n, dirDe(uFocoLat, uFocoLon)), -1.0, 1.0));
        em *= mix(1.0, smoothstep(0.7, 0.95, angF / ${f(NV * S0 * 0.5)}), clamp(uNivel, 0.0, 1.0));
        if (dot(n, uCamL - p) < 0.0) em *= 0.0;
      }`,
      uniforms: { ...u, ...propios },
      extra: nrm ? { aNrm: [nrm, 3] } : {},
    });
    global.u.uSpread.value = 0;
    group.add(global.points);
    nubes.push(global, parche);
    hecho = true;
  })();

  const c = new THREE.Vector3();
  return {
    group,
    nubes,
    listo,
    halo,
    update(sunL, camL, gain = 1) {
      u.uSun.value.copy(sunL);
      u.uCamL.value.copy(camL);
      c.copy(camL).normalize();
      u.uFocoLat.value = Math.asin(Math.max(-1, Math.min(1, c.y)));
      u.uFocoLon.value = Math.atan2(-c.z, c.x);
      // Spacing on the ground of about 0.45 % of the height: the level that gives it.
      const h = Math.max(camL.length() - 1, 1e-6);
      u.uNivel.value = Math.max(0, Math.min(NIVELES, Math.log2(S0 / (h * 0.0045))));
      parche.points.visible = hecho && u.uNivel.value > 0.001 && gain > 0.001;
      for (const n of nubes) n.u.uGain.value = gain;
      fondoU.uBrillo.value = o.fondo * gain;
    },
  };
}

/** Relief from the map's own shading (rock lit low): brighter where it faces its light, read as slope. */
const RELIEVE_GLSL = /* glsl */ `
  {
    float e = 0.0015;
    float h0 = dot(texture2D(uMap, uv).rgb, vec3(0.33));
    float hx = dot(texture2D(uMap, uv + vec2(e, 0.0)).rgb, vec3(0.33));
    float hy = dot(texture2D(uMap, uv + vec2(0.0, e)).rgb, vec3(0.33));
    vec3 t1 = normalize(cross(vec3(0.0, 1.0, 0.0), n) + 1e-5);
    vec3 t2 = cross(n, t1);
    nn = normalize(n - (t1 * (hx - h0) + t2 * (hy - h0)) * 2.5);
  }`;
