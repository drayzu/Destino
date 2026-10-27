import * as THREE from 'three';
import { Timeline } from '../timeline';
import { cielo } from '../cielo';
import { CIUDADES, esfera, mascaraTierra } from '../tierra';
import { enfocar, materia, materiaBuilder, type Nube } from '../materia';
import { gauss, lerp, smoothstep } from '../math';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Study · how the planets look. Diego: the Earth, Mercury and the cylinder look cheap; Mars and Venus
 * hold up better (soft, continuous, a gentle terminator, a thin haze), but the planets cannot each
 * have a style of their own. The same Earth (Natural Earth's real land) and the same Mercury, five
 * views, three ways:
 *
 * 1 · Foto tratada: real maps (Solar System Scope, CC BY 4.0, from NASA data) under one treatment:
 *     a dark, muted grade, a soft terminator, a haze at the limb, the sea's glint, clouds; the
 *     cities as points of light.
 * 2 · Suave: no photographs: soft procedural colour on the real land (as Mars and Venus are made),
 *     the same treatment.
 * 3 · Puntitos: the planet as a cloud of points (as in Espacio and Tiempo), coloured from the same
 *     real maps, lit point by point, a black core hiding its far side; the same haze and cities.
 *
 * World units: planet radii, the planet at the origin, north up (as `esfera`).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const dir = (la: number, lo: number) => V(...esfera(la, lo, 1));
const rotY = (v: THREE.Vector3, a: number) => v.clone().applyAxisAngle(UP, a);

/** The views: where the camera is, what it looks at, where the Sun is (all in planet radii). */
interface Toma {
  planeta: 0 | 1;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  sun: THREE.Vector3;
  fov: number;
  /** «Up» for the camera (close to the ground: the local vertical). */
  up?: THREE.Vector3;
}
const TOMAS: Toma[] = (() => {
  const n0 = dir(24, -35);
  const n1 = dir(8, -62);
  const cerca = (la: number, lo: number, alt: number, mira: number) => {
    const n = dir(la, lo);
    const este = UP.clone().cross(n).normalize();
    const norte = n.clone().cross(este).normalize();
    const fwd = este.clone().multiplyScalar(0.8).addScaledVector(norte, 0.6).normalize();
    const pos = n.clone().multiplyScalar(1 + alt);
    return { pos, target: pos.clone().addScaledVector(fwd, 1).addScaledVector(n, -mira), fwd, n, side: fwd.clone().cross(n).normalize() };
  };
  const C2 = cerca(-18, -52, 0.07, 0.45);
  const n3 = dir(2, 10);
  const C4 = cerca(10, 18, 0.03, 0.2);
  return [
    { planeta: 0, pos: n0.clone().multiplyScalar(3.5), target: V(), sun: rotY(n0, 2.0).add(V(0, 0.15, 0)).normalize(), fov: 40 },
    { planeta: 0, pos: n1.clone().multiplyScalar(3.1), target: V(), sun: rotY(n1, 0.75).add(V(0, 0.2, 0)).normalize(), fov: 40 },
    { planeta: 0, pos: C2.pos, target: C2.target, sun: C2.fwd.clone().multiplyScalar(0.85).addScaledVector(C2.side, 0.35).addScaledVector(C2.n, 0.25).normalize(), fov: 56, up: C2.n },
    { planeta: 1, pos: n3.clone().multiplyScalar(3.0), target: V(), sun: rotY(n3, 1.25).add(V(0, 0.1, 0)).normalize(), fov: 40 },
    { planeta: 1, pos: C4.pos, target: C4.target, sun: C4.side.clone().multiplyScalar(0.9).addScaledVector(C4.fwd, 0.25).addScaledVector(C4.n, 0.12).normalize(), fov: 56, up: C4.n },
  ];
})();
const NOMBRES: [string, string][] = [
  ['La Tierra, de noche', 'Las ciudades encendidas del lado de la noche; el día se va a la derecha.'],
  ['La Tierra, de día', 'Océano, nubes, continentes: lo que todos conocemos, y por eso se nota si es falso.'],
  ['La Tierra, de cerca', 'Desde la altura del ascensor: el borde del planeta y su aire, con el Sol bajo.'],
  ['Mercurio, entero', 'Roca sin aire: el día termina de golpe.'],
  ['Mercurio, de cerca', 'A ras de suelo, con el Sol bajo: los cráteres hacen sombras largas.'],
];

// ---------------------------------------------------------------- shared GLSL

const LOG_V = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>`;
const LOG_F = /* glsl */ `#include <logdepthbuf_pars_fragment>`;
const NOISE = /* glsl */ `
  float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n3(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
  vec2 uvDe(vec3 n) { return vec2(atan(-n.z, n.x) / 6.2831853 + 0.5, 0.5 + asin(clamp(n.y, -1.0, 1.0)) / 3.14159265); }`;
/** The treatment every planet shares: a dark, muted grade; the soft terminator; the haze within the limb. */
const TRATO = /* glsl */ `
  vec3 grado(vec3 c) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, 0.6);
    c = pow(max(c, vec3(0.0)), vec3(1.3));
    return c * vec3(0.9, 0.96, 1.04);
  }
  vec3 luz(vec3 albedo, vec3 n, vec3 L, vec3 V, float aire) {
    float d = dot(n, L);
    // Soft where there is air (the light goes round a little), sharper on bare rock.
    float lit = mix(smoothstep(-0.02, 0.22, d), smoothstep(-0.14, 0.42, d), aire);
    vec3 c = grado(albedo) * lit * 0.62;
    // Within the limb, the air: blue on the day side, a thin warm band at the terminator.
    float mu = max(dot(n, V), 0.0);
    float rim = pow(max(1.0 - mu, 0.0), 2.6) * aire;
    c += vec3(0.32, 0.55, 1.0) * rim * 0.45 * smoothstep(-0.2, 0.5, d);
    c += vec3(1.0, 0.5, 0.26) * aire * 0.06 * exp(-(d / 0.09) * (d / 0.09)) * (0.4 + rim);
    return c;
  }`;

// ---------------------------------------------------------------- the pieces

/** The haze beyond the limb: a slightly larger sphere, its back half only, glowing edge-on on the day side. */
function halo(color: THREE.Color, r = 1.028) {
  const u = { uSun: { value: V(1, 0, 0) }, uOn: { value: 1 }, uColor: { value: color.clone() } };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 128, 64),
    new THREE.ShaderMaterial({
      uniforms: u,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vN; varying vec3 vV;
        void main() { vN = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
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
  return { mesh, u };
}

/** The cities: the same warm points in every way (night side only, hidden beyond the horizon). */
function ciudades(isLand: (la: number, lo: number) => number) {
  const b = materiaBuilder(77);
  const warm = [new THREE.Color(1.0, 0.82, 0.55), new THREE.Color(1.0, 0.72, 0.42)];
  for (const [la, lo, pop] of CIUDADES) {
    const n = Math.round(50 + pop * 22);
    const rad = 0.18 + 0.1 * Math.sqrt(pop);
    for (let k = 0; k < n; k++) {
      const r = rad * Math.pow(b.r(), 1.5);
      const a = b.r() * Math.PI * 2;
      const cla = la + Math.sin(a) * r;
      const clo = lo + (Math.cos(a) * r) / Math.max(0.2, Math.cos((la * Math.PI) / 180));
      if (isLand(cla, clo) < 0.5 && b.r() < 0.8) continue;
      const [x, y, z] = esfera(cla, clo, 1.002);
      b.push(x, y, z, warm[k % 2], 0.0016, k < 2 ? 1.6 : 0.5);
    }
  }
  for (let k = 0; k < 60000; k++) {
    const la = (Math.asin(b.r() * 2 - 1) * 180) / Math.PI;
    const lo = b.r() * 360 - 180;
    if (isLand(la, lo) < 0.5 || la < -55) continue;
    const temperate = la > 0 ? smoothstep(10, 30, la) * (1 - smoothstep(55, 66, la)) : 0.4;
    if (b.r() > 0.12 * (0.3 + temperate)) continue;
    const [x, y, z] = esfera(la, lo, 1.002);
    b.push(x, y, z, warm[0], 0.0012, 0.3);
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `uniform vec3 uSun, uCamL;`,
    move: /* glsl */ `
      em *= 1.0 - smoothstep(-0.12, 0.1, dot(normalize(p), uSun));
      if (dot(normalize(p), uCamL - p) < 0.0) em *= 0.0;
      fuente = 0.3;`,
    uniforms: { uSun: { value: V(1, 0, 0) }, uCamL: { value: V(0, 0, 5) } },
  });
  nube.u.uSpread.value = 0;
  return nube;
}

/** The land as a texture (from the same mask): 1 on land, 0 at sea. */
function texturaTierra(isLand: (la: number, lo: number) => number) {
  const W = 1024;
  const H = 512;
  const d = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const la = 90 - ((y + 0.5) / H) * 180;
      const lo = ((x + 0.5) / W) * 360 - 180;
      const v = isLand(la, lo) * 255;
      d.set([v, v, v, 255], (y * W + x) * 4);
    }
  const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
  t.flipY = true;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.wrapS = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

function cargar(url: string) {
  return new Promise<THREE.Texture>((res) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.anisotropy = 8;
      res(t);
    });
  });
}

// ---------------------------------------------------------------- way 1 · the photograph, treated

function tierraFoto(day: THREE.Texture, clouds: THREE.Texture, land: THREE.Texture) {
  const u = { uDay: { value: day }, uClouds: { value: clouds }, uLand: { value: land }, uSun: { value: V(1, 0, 0) } };
  return new THREE.Mesh(
    new THREE.SphereGeometry(1, 256, 128),
    new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vN; varying vec3 vV;
        void main() { vN = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform sampler2D uDay, uClouds, uLand; uniform vec3 uSun;
        varying vec3 vN; varying vec3 vV;
        ${NOISE}
        ${TRATO}
        void main() {
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          vec3 V = normalize(vV);
          vec2 uv = uvDe(n);
          vec3 alb = texture2D(uDay, uv).rgb;
          float cl = texture2D(uClouds, uv).r;
          float sea = 1.0 - texture2D(uLand, uv).r;
          alb = mix(alb, vec3(0.62, 0.64, 0.66), smoothstep(0.2, 0.9, cl) * 0.8);
          vec3 c = luz(alb, n, uSun, V, 1.0);
          // The Sun's glint on open sea.
          float spec = pow(max(dot(reflect(-uSun, n), V), 0.0), 70.0) * sea * (1.0 - cl) * smoothstep(0.0, 0.2, dot(n, uSun));
          c += vec3(1.0, 0.85, 0.65) * spec * 0.5;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
}

function mercurioFoto(tex: THREE.Texture) {
  const u = { uTex: { value: tex }, uSun: { value: V(1, 0, 0) } };
  return new THREE.Mesh(
    new THREE.SphereGeometry(1, 256, 128),
    new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vN; varying vec3 vV;
        void main() { vN = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform sampler2D uTex; uniform vec3 uSun;
        varying vec3 vN; varying vec3 vV;
        ${NOISE}
        ${TRATO}
        void main() {
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          vec2 uv = uvDe(n);
          // Bump from the map's own shading: brighter where it faces its light, read as relief.
          float e = 0.0015;
          float h0 = dot(texture2D(uTex, uv).rgb, vec3(0.33));
          float hx = dot(texture2D(uTex, uv + vec2(e, 0.0)).rgb, vec3(0.33));
          float hy = dot(texture2D(uTex, uv + vec2(0.0, e)).rgb, vec3(0.33));
          vec3 t1 = normalize(cross(vec3(0.0, 1.0, 0.0), n) + 1e-5);
          vec3 t2 = cross(n, t1);
          vec3 nn = normalize(n - (t1 * (hx - h0) + t2 * (hy - h0)) * 2.5);
          vec3 alb = texture2D(uTex, uv).rgb * vec3(1.0, 0.97, 0.92);
          gl_FragColor = vec4(luz(alb * 1.15, nn, uSun, normalize(vV), 0.0), 1.0);
        }`,
    }),
  );
}

// ---------------------------------------------------------------- way 2 · soft

function tierraSuave(land: THREE.Texture) {
  const u = { uLand: { value: land }, uSun: { value: V(1, 0, 0) } };
  return new THREE.Mesh(
    new THREE.SphereGeometry(1, 256, 128),
    new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vN; varying vec3 vV;
        void main() { vN = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform sampler2D uLand; uniform vec3 uSun;
        varying vec3 vN; varying vec3 vV;
        ${NOISE}
        ${TRATO}
        void main() {
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          vec3 V = normalize(vV);
          vec2 uv = uvDe(n);
          float land = smoothstep(0.35, 0.65, texture2D(uLand, uv).r);
          float lat = abs(n.y);
          float f = fbm(n * 4.0);
          // Land: green where it rains, ochre in the desert belts, white at the poles; a soft sea.
          float dry = smoothstep(0.22, 0.38, lat) * (1.0 - smoothstep(0.5, 0.62, lat)) * smoothstep(0.4, 0.6, fbm(n * 2.2 + 5.0));
          vec3 g = mix(vec3(0.12, 0.2, 0.08), vec3(0.24, 0.26, 0.12), f);
          vec3 l = mix(g, vec3(0.5, 0.4, 0.24), dry);
          l = mix(l, vec3(0.85, 0.88, 0.9), smoothstep(0.82, 0.9, lat));
          vec3 s = mix(vec3(0.02, 0.06, 0.14), vec3(0.03, 0.09, 0.17), fbm(n * 6.0));
          vec3 alb = mix(s, l, land);
          // Soft clouds.
          float cl = smoothstep(0.52, 0.78, fbm(n * 3.2 + vec3(0.0, 0.0, 2.0) + fbm(n * 6.0) * 0.8));
          alb = mix(alb, vec3(0.62, 0.64, 0.66), cl * 0.8);
          vec3 c = luz(alb, n, uSun, V, 1.0);
          float spec = pow(max(dot(reflect(-uSun, n), V), 0.0), 70.0) * (1.0 - land) * (1.0 - cl) * smoothstep(0.0, 0.2, dot(n, uSun));
          c += vec3(1.0, 0.85, 0.65) * spec * 0.5;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
}

function mercurioSuave() {
  const u = { uSun: { value: V(1, 0, 0) } };
  return new THREE.Mesh(
    new THREE.SphereGeometry(1, 256, 128),
    new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vN; varying vec3 vV;
        void main() { vN = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform vec3 uSun;
        varying vec3 vN; varying vec3 vV;
        ${NOISE}
        ${TRATO}
        vec3 hash3(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
        // Soft craters: smooth bowls and smooth shoulders (no stamped rings).
        float craters(vec3 p) {
          vec3 i = floor(p), f = fract(p); float h = 0.0;
          for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
            vec3 g = vec3(float(x), float(y), float(z)); vec3 o = hash3(i + g);
            if (o.y < 0.45) continue;
            float r = 0.18 + 0.35 * o.x * o.x;
            float d = length(g + o * 0.6 + 0.2 - f) / r;
            h += -exp(-d * d * 2.2) * 0.8 + 0.35 * exp(-(d - 1.0) * (d - 1.0) * 6.0);
          }
          return h;
        }
        float relief(vec3 n) { return craters(n * 4.0) * 0.5 + craters(n * 11.0 + 3.1) * 0.22 + craters(n * 30.0 + 7.7) * 0.08 + fbm(n * 20.0) * 0.05; }
        void main() {
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          vec3 t1 = normalize(cross(n, vec3(0.31, 0.92, 0.23)));
          vec3 t2 = cross(n, t1);
          float e = 0.002;
          float h0 = relief(n);
          vec3 nn = normalize(n - ((relief(normalize(n + t1 * e)) - h0) * t1 + (relief(normalize(n + t2 * e)) - h0) * t2) / e * 0.01);
          vec3 alb = vec3(0.36, 0.34, 0.32) * (0.75 + 0.5 * fbm(n * 3.0)) + 0.05 * h0;
          gl_FragColor = vec4(luz(alb, nn, uSun, normalize(vV), 0.0), 1.0);
        }`,
    }),
  );
}

// ---------------------------------------------------------------- way 3 · points

/** A black core: hides what is behind the planet (the points do not test depth). */
function nucleo(r = 0.996) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 96, 48), new THREE.MeshBasicMaterial({ color: 0x000000 }));
}

/** A map's pixels, to colour points on the CPU (equirectangular: u from longitude, v from latitude). */
function pixeles(tex: THREE.Texture) {
  const img = tex.image as HTMLImageElement;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  return (n: THREE.Vector3, out: THREE.Color) => {
    const u = Math.atan2(-n.z, n.x) / (Math.PI * 2) + 0.5;
    const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, n.y))) / Math.PI;
    const px = Math.min(c.width - 1, Math.max(0, Math.floor(u * c.width)));
    const py = Math.min(c.height - 1, Math.max(0, Math.floor(v * c.height)));
    const i = (py * c.width + px) * 4;
    // sRGB to linear.
    return out.setRGB((d[i] / 255) ** 2.2, (d[i + 1] / 255) ** 2.2, (d[i + 2] / 255) ** 2.2);
  };
}

/** The same treatment, for points: muted, darker, cool. */
const TRATO_PUNTOS = /* glsl */ `
  float l0 = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 g0 = pow(max(mix(vec3(l0), color, 0.6), vec3(0.0)), vec3(1.3)) * vec3(0.9, 0.96, 1.04);`;

function tierraPuntos(day: THREE.Texture, clouds: THREE.Texture) {
  const b = materiaBuilder(4);
  const N = 520000;
  const ga = Math.PI * (3 - Math.sqrt(5));
  const col = new THREE.Color();
  const dia = pixeles(day);
  const nub = pixeles(clouds);
  const kind: number[] = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const a = i * ga + gauss(b.r) * 0.002;
    const p = V(Math.cos(a) * r, y, Math.sin(a) * r);
    dia(p, col);
    b.push(p.x, p.y, p.z, col, 0.0066, 1);
    kind.push(col.b > col.r * 1.4 && col.b > col.g ? 1 : 0);
  }
  // Clouds: a second shell, where the cloud map is white.
  for (let i = 0; i < 260000; i++) {
    const [x, y, z] = b.onSphere();
    const p = V(x, y, z);
    const c = nub(p, col).r;
    if (c < 0.12 || b.r() > c * 1.6) continue;
    b.push(x * 1.01, y * 1.01, z * 1.01, new THREE.Color(0.62, 0.64, 0.66), 0.0068, Math.min(1, c * 1.4));
    kind.push(2);
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute float aSea; uniform vec3 uSun, uCamL;`,
    move: /* glsl */ `
      vec3 n = normalize(p);
      float d = dot(n, uSun);
      float lit = smoothstep(-0.14, 0.42, d);
      ${TRATO_PUNTOS}
      em = g0 * (lit * 0.9 + 0.003);
      // The sea's glint.
      if (aSea > 0.5 && aSea < 1.5) em += vec3(1.0, 0.85, 0.65) * pow(max(dot(reflect(-uSun, n), normalize(uCamL - p)), 0.0), 60.0) * 0.5 * lit;
      if (dot(n, uCamL - p) < 0.0) em *= 0.0;`,
    uniforms: { uSun: { value: V(1, 0, 0) }, uCamL: { value: V(0, 0, 5) } },
    extra: { aSea: [new Float32Array(kind), 1] },
  });
  nube.u.uSpread.value = 0;
  return nube;
}

function mercurioPuntos(tex: THREE.Texture) {
  const b = materiaBuilder(5);
  const N = 480000;
  const ga = Math.PI * (3 - Math.sqrt(5));
  const map = pixeles(tex);
  const col = new THREE.Color();
  const c2 = new THREE.Color();
  const nrm: number[] = [];
  const lum = (p: THREE.Vector3) => map(p, c2).r + c2.g + c2.b;
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const a = i * ga;
    const p = V(Math.cos(a) * r, y, Math.sin(a) * r);
    // Relief read from the map's own shading, as in way 1.
    const t1 = UP.clone().cross(p).normalize();
    const t2 = p.clone().cross(t1);
    const e = 0.003;
    const h0 = lum(p);
    const nn = p
      .clone()
      .sub(t1.clone().multiplyScalar((lum(p.clone().addScaledVector(t1, e).normalize()) - h0) * 2.0))
      .sub(t2.clone().multiplyScalar((lum(p.clone().addScaledVector(t2, e).normalize()) - h0) * 2.0))
      .normalize();
    map(p, col).multiply(new THREE.Color(1.0, 0.97, 0.92)).multiplyScalar(1.15);
    b.push(p.x, p.y, p.z, col, 0.0068, 1);
    nrm.push(nn.x, nn.y, nn.z);
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute vec3 aNrm; uniform vec3 uSun, uCamL;`,
    move: /* glsl */ `
      float lit = smoothstep(-0.02, 0.22, dot(aNrm, uSun)) * smoothstep(-0.05, 0.05, dot(normalize(p), uSun));
      ${TRATO_PUNTOS}
      em = g0 * (lit * 0.9 + 0.003);
      if (dot(normalize(p), uCamL - p) < 0.0) em *= 0.0;`,
    uniforms: { uSun: { value: V(1, 0, 0) }, uCamL: { value: V(0, 0, 5) } },
    extra: { aNrm: [new Float32Array(nrm), 3] },
  });
  nube.u.uSpread.value = 0;
  return nube;
}

// ---------------------------------------------------------------- the study

export const planetas: Escena = {
  id: 'planetas',
  nombre: 'Planetas',
  estilos: [
    { key: '1', nombre: 'Foto tratada', nota: 'Mapas reales (de datos de la NASA) con un mismo tratamiento: oscuro y apagado, paso suave del día a la noche, aire en el borde, brillo del mar, nubes; las ciudades como puntos de luz.' },
    { key: '2', nombre: 'Suave', nota: 'Sin fotos: color procedural suave sobre los continentes reales, como Marte y Venus, con el mismo tratamiento.' },
    { key: '3', nombre: 'Puntitos', nota: 'El planeta como una nube de puntos, como en Espacio y Tiempo, coloreados con los mismos mapas reales: cada punto con su luz, un núcleo negro que tapa el otro lado; el mismo aire y las mismas ciudades.' },
  ],
  montar(stage, estilo): Instancia {
    const s = estilo + 1;
    stage.bloom.strength = 0.55;
    stage.bloom.radius = 0.4;
    stage.bloom.threshold = 0.6;
    stage.renderer.toneMappingExposure = 1.0;
    const root = new THREE.Group();
    stage.root.add(root);
    const sky = cielo(0.55);
    stage.root.add(sky.mesh);
    const tierraG = new THREE.Group();
    const mercG = new THREE.Group();
    root.add(tierraG, mercG);
    const haloT = halo(new THREE.Color(0.35, 0.58, 1.0));
    tierraG.add(haloT.mesh);
    const nubes: Nube[] = [];
    const uniSun: { value: THREE.Vector3 }[] = [haloT.u.uSun];
    const camLs: { value: THREE.Vector3 }[] = [];
    let luces: Nube | null = null;

    const listo = (async () => {
      const isLand = await mascaraTierra();
      const land = texturaTierra(isLand);
      luces = ciudades(isLand);
      tierraG.add(luces.points);
      nubes.push(luces);
      uniSun.push(luces.u.uSun);
      camLs.push(luces.u.uCamL);
      if (s === 1) {
        const [day, clouds, merc] = await Promise.all([cargar('/texturas/2k_earth_daymap.jpg'), cargar('/texturas/2k_earth_clouds.jpg'), cargar('/texturas/2k_mercury.jpg')]);
        clouds.colorSpace = THREE.NoColorSpace;
        const t = tierraFoto(day, clouds, land);
        const mm = mercurioFoto(merc);
        tierraG.add(t);
        mercG.add(mm);
        uniSun.push((t.material as THREE.ShaderMaterial).uniforms.uSun, (mm.material as THREE.ShaderMaterial).uniforms.uSun);
      } else if (s === 2) {
        const t = tierraSuave(land);
        const mm = mercurioSuave();
        tierraG.add(t);
        mercG.add(mm);
        uniSun.push((t.material as THREE.ShaderMaterial).uniforms.uSun, (mm.material as THREE.ShaderMaterial).uniforms.uSun);
      } else {
        const [day, clouds, merc] = await Promise.all([cargar('/texturas/2k_earth_daymap.jpg'), cargar('/texturas/2k_earth_clouds.jpg'), cargar('/texturas/2k_mercury.jpg')]);
        const t = tierraPuntos(day, clouds);
        const mm = mercurioPuntos(merc);
        tierraG.add(nucleo(), t.points);
        mercG.add(nucleo(0.99), mm.points);
        nubes.push(t, mm);
        uniSun.push(t.u.uSun, mm.u.uSun);
        camLs.push(t.u.uCamL, mm.u.uCamL);
      }
    })();

    const tl = new Timeline({});
    NOMBRES.forEach(([n, f], i) => {
      tl.caption(2, n, f);
      tl.label(`t${i}`).to(2, {});
    });
    const P = (l: string) => tl.at(l);

    return {
      tl,
      listo,
      lectura: () => null,
      rotulo: (p) => tl.captionAt(p),
      escalera: false,
      update(f: Frame) {
        const { camera, p, time } = f;
        const i = Math.max(0, Math.min(TOMAS.length - 1, Math.floor(p / 2)));
        const tm = TOMAS[i];
        const k = (p - P(`t${i}`)) / 2;
        // A slow drift within each view.
        const pos = tm.pos.clone().applyAxisAngle(UP, (k - 0.5) * 0.06);
        camera.position.copy(pos);
        camera.up.copy(tm.up ?? UP);
        camera.lookAt(tm.target);
        camera.fov = tm.fov;
        camera.near = 1e-4;
        camera.far = 200;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        tierraG.visible = tm.planeta === 0;
        mercG.visible = tm.planeta === 1;
        for (const u of uniSun) u.value.copy(tm.sun);
        for (const u of camLs) u.value.copy(camera.position);
        const focal = f.H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        for (const n of nubes) {
          enfocar(n, focal, f.dpr, time);
          n.u.uSizeUnit.value = 1;
          n.u.uMinPx.value = 1.2 * f.dpr;
        }
        void lerp;
      },
      dispose() {},
    };
  },
};
