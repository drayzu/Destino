import * as THREE from 'three';
import { Timeline } from '../timeline';
import { cielo } from '../cielo';
import { enfocar, geometria, puntos, type Puntos } from '../../../src/horizontes';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Study · the built things in 3D. Diego: the O'Neill cylinder (and the other habitats) look cheap,
 * like flat 3D. The same cylinder (Island Three: 8 km across, 32 long; three valleys of land and
 * three long windows; a mirror hinged at each window), four views, three ways:
 *
 * 1 · Puntitos: as the planets now are. The hull and the land as points over a dim, treated surface,
 *     finer near the camera (a clipmap on the unrolled cylinder); the mirrors catch the Sun; the towns
 *     are lights.
 * 2 · Silueta: almost black; the form is told by light alone: the Sun's rim on the hull, the glowing
 *     windows, the mirrors' glint, navigation lights. Inside, evening (the mirrors half closed): the
 *     land in shadow and haze, its towns lit.
 * 3 · Línea: a drawing of light, as on the plate: rings and seams, the windows' ribs, the mirrors'
 *     frames; inside, the same lines climbing round, and the towns.
 *
 * Units: kilometres, the cylinder at the origin, its axis along Y.
 */

const R = 4;
const L = 32;
const SEC = (2 * Math.PI) / 3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SOL = V(0.82, 0.3, 0.48).normalize();

interface Toma {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  fov: number;
}
// The middle of a valley (θ measured as the shaders do: atan(z, x) + π).
const VALLE = Math.PI / 6 - Math.PI;
const enValle = (r: number, y: number) => V(Math.cos(VALLE) * r, y, Math.sin(VALLE) * r);
const TOMAS: Toma[] = [
  { pos: V(40, 10, 46), target: V(0, 0, 0), up: V(0.6, 0.8, 0).normalize(), fov: 34 },
  { pos: V(5.6, -9, 6.8), target: V(-0.5, 9, 1.5), up: V(0.6, 0.2, 0.75).normalize(), fov: 52 },
  { pos: V(0, -15.4, 0), target: V(0, 12, 0.6), up: enValle(1, 0).normalize(), fov: 60 },
  { pos: enValle(3.93, -11), target: enValle(1.2, 4).add(V(0, 0, 0)), up: enValle(-1, 0).normalize(), fov: 62 },
];
const NOMBRES: [string, string][] = [
  ['Un cilindro de O’Neill', '8 km de ancho y 32 de largo; tres valles y tres ventanas, y un espejo en cada ventana.'],
  ['El casco, de cerca', 'Las ventanas, sus costillas, y la luz del día adentro.'],
  ['Por dentro, desde el eje', 'El paisaje sube por los lados y pasa por encima.'],
  ['Por dentro, desde el suelo', 'Al fondo el valle sube; arriba, el otro valle, a 8 km.'],
];

// ---------------------------------------------------------------- shared GLSL

const GLSL = /* glsl */ `
  const float RC = ${R.toFixed(1)};
  const float LC = ${L.toFixed(1)};
  const float SEC = 2.0943951;
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
  float fbm2(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.07 + 3.1; a *= 0.5; } return s; }
  vec3 grado(vec3 c) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, 0.6);
    c = pow(max(c, vec3(0.0)), vec3(1.3));
    return c * vec3(0.9, 0.96, 1.04);
  }
  // Where a point of the surface is: its angle (0..2π), which strip, how far across it (0..1).
  float angulo(vec3 p) { return atan(p.z, p.x) + 3.14159265; }
  float tramo(float th) { return mod(th, SEC) / SEC; }
  // The land of a valley: q = (across, along) in km; s: 0..1 across the valley.
  vec3 tierraCil(vec2 q, float s) {
    float f = fbm2(q * 0.9);
    vec3 col = mix(vec3(0.07, 0.12, 0.05), vec3(0.19, 0.21, 0.09), smoothstep(0.35, 0.65, f));
    // Farmland: a patchwork of fields, each its own tint, with thin borders.
    vec2 g = q * vec2(3.0, 1.7);
    vec2 fr = fract(g);
    float hf = h21(floor(g));
    float campo = smoothstep(0.42, 0.55, fbm2(q * 0.32 + 4.0));
    vec3 cf = mix(vec3(0.24, 0.22, 0.1), vec3(0.11, 0.19, 0.06), hf) * (0.88 + 0.12 * step(0.07, min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y))));
    col = mix(col, cf, campo * 0.85);
    // A river winding down the valley.
    float river = abs(s - 0.5 - 0.17 * sin(q.y * 0.33) - 0.05 * sin(q.y * 1.27 + 1.0));
    col = mix(col, vec3(0.03, 0.08, 0.13), 1.0 - smoothstep(0.01, 0.022, river));
    // Towards the windows the valley rises in bare terraces.
    float rise = smoothstep(0.0, 0.14, s) * (1.0 - smoothstep(0.86, 1.0, s));
    return mix(vec3(0.2, 0.19, 0.17) * (0.8 + 0.2 * step(0.5, fract(s * 40.0))), col, rise);
  }
  // Inside, the air: what is far fades into a pale haze.
  vec3 aire(vec3 col, float d, float dia) { return mix(col, vec3(0.42, 0.55, 0.72) * 0.5 * dia, (1.0 - exp(-d / 22.0)) * 0.5); }`;

const LOG_V = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>`;
const LOG_F = /* glsl */ `#include <logdepthbuf_pars_fragment>`;

/** The three mirrors: hinged at a window's edge, opened outwards (as in Destino). */
function espejos() {
  return [0, 1, 2].map((k) => {
    const a0 = (k * 2 * Math.PI) / 3 + Math.PI / 3 - Math.PI;
    const hinge = new THREE.Group();
    hinge.rotation.y = -a0;
    const plane = new THREE.Object3D();
    plane.position.set(R * 1.01 + R * 1.1 * Math.cos(0.5), 0, R * 1.1 * Math.sin(0.5));
    plane.rotation.y = -0.5 - Math.PI / 2;
    hinge.add(plane);
    hinge.updateMatrixWorld(true);
    return plane.matrixWorld.clone();
  });
}
const ANCHO_ESPEJO = R * 2.2;

const dentro = (c: THREE.Vector3) => Math.hypot(c.x, c.z) < R && Math.abs(c.y) < L / 2;

// ---------------------------------------------------------------- way 1 · points

/** A lattice on the unrolled cylinder (u = θ·R across, v along): spacing `sp`, its cells fixed. */
const G0 = 0.05;
const NIV = 6;
const NVC = 60;
function geoCilindro() {
  const nu = Math.round((2 * Math.PI * R) / G0);
  const nv = Math.round(L / G0);
  const n = nu * nv;
  const pos = new Float32Array(n * 3);
  let k = 0;
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      pos.set([i, j, 0], k * 3);
      k++;
    }
  // The patch's levels 1..NIV round the camera.
  const m = NIV * (2 * NVC) * (2 * NVC);
  const pp = new Float32Array(m * 3);
  k = 0;
  for (let l = 1; l <= NIV; l++)
    for (let j = -NVC; j < NVC; j++)
      for (let i = -NVC; i < NVC; i++) {
        pp.set([i, j, l], k * 3);
        k++;
      }
  const one = (c: number) => new Float32Array(c).fill(1);
  return {
    global: geometria({ position: pos, color: one(n * 3), size: one(n), seed: new Float32Array(n), aKind: new Float32Array(n) }),
    parche: geometria({ position: pp, color: one(m * 3), size: one(m), seed: new Float32Array(m), aKind: new Float32Array(m) }),
    nu,
  };
}

/** What a point of the surface looks like: from inside the land (lit by day), from outside the hull. */
const PUNTO_CIL = /* glsl */ `
  vec3 p0 = p;
  float th = angulo(p0);
  float t = tramo(th);
  bool ventana = t >= 0.5;
  float s = ventana ? (t - 0.5) / 0.5 : t / 0.5;
  float dCam = distance(p0, uCamL);
  if (uDentro > 0.5) {
    if (ventana) {
      // The windows' ribs, faint against space.
      float rib = 1.0 - smoothstep(0.0, max(0.02, paso * 0.6), abs(fract(p0.y * 1.5) - 0.5) - 0.48);
      em = vec3(0.32, 0.36, 0.4) * rib * 0.12 * min(1.0, 0.04 / max(paso, 0.001));
    } else {
      vec3 alb = tierraCil(vec2(th * RC, p0.y), s) * (0.92 + 0.16 * hp);
      em = aire(grado(alb) * 1.1 * uDia, dCam, uDia) * uPeso;
      if (paso < 0.04) em *= 0.75;
    }
  } else {
    vec3 nOut = normalize(vec3(p0.x, 0.0, p0.z));
    if (dot(nOut, uCamL - p0) < 0.0) em *= 0.0;
    else if (ventana) {
      // From outside, the windows glow with the day inside (and its land, across the cylinder).
      float rib = 1.0 - smoothstep(0.0, max(0.02, paso * 0.6), abs(fract(p0.y * 1.5) - 0.5) - 0.48);
      vec3 dentroVisto = mix(vec3(0.42, 0.58, 0.72), vec3(0.3, 0.42, 0.24), smoothstep(0.4, 0.7, n2(vec2(th * 6.0, p0.y * 0.4))));
      em = dentroVisto * 0.6 * (1.0 - 0.7 * rib) * (0.85 + 0.3 * hp) * smoothstep(0.0, 0.08, s) * smoothstep(0.0, 0.08, 1.0 - s);
    } else {
      // The hull: plates in rings and seams, lit by the Sun.
      float seam = 1.0 - smoothstep(0.0, max(0.012, paso * 0.6), abs(fract(p0.y * 0.5) - 0.5) - 0.485);
      float seam2 = 1.0 - smoothstep(0.0, max(0.012, paso * 0.6), abs(fract(th * RC * 0.8) - 0.5) - 0.485);
      vec3 alb = vec3(0.32, 0.33, 0.34) * (0.75 + 0.5 * h21(floor(vec2(th * RC * 0.8, p0.y * 0.5)))) * (0.82 + 0.36 * hp);
      alb *= 1.0 - 0.45 * max(seam, seam2);
      // A structural ring every 4 km, lighter.
      float aro = 1.0 - smoothstep(0.0, max(0.03, paso * 0.7), abs(fract(p0.y * 0.25 + 0.5) - 0.5) - 0.48);
      alb = mix(alb, vec3(0.6, 0.6, 0.62), aro * min(1.0, 0.06 / max(paso, 0.001)));
      float lit = smoothstep(-0.02, 0.3, dot(nOut, uSun));
      em = grado(alb) * (lit * 0.9 + 0.004);
      em += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-uSun, nOut), normalize(uCamL - p0)), 0.0), 40.0) * 0.25 * lit;
    }
  }`;

function maneraPuntos(root: THREE.Group) {
  const u = {
    uCamL: { value: V() },
    uSun: { value: SOL.clone() },
    uDentro: { value: 0 },
    uDia: { value: 1 },
    uPeso: { value: 0.55 },
    uFocoU: { value: 0 },
    uFocoV: { value: 0 },
    uNivel: { value: 0 },
  };
  const { global, parche, nu } = geoCilindro();
  const PRE = /* glsl */ `uniform vec3 uCamL, uSun; uniform float uDentro, uDia, uPeso, uFocoU, uFocoV, uNivel; ${GLSL}`;
  const capas: Puntos[] = [];
  // The global lattice: 50 m apart.
  const g = puntos(global, {
    pre: PRE,
    cuerpo: /* glsl */ `{
      float th0 = (position.x + 0.5) / ${nu.toFixed(1)} * 6.2831853;
      float hp = h21(position.xy + 0.37);
      th0 += (h21(position.xy) - 0.5) * 0.8 * ${(G0 / R).toFixed(5)};
      float y0 = (position.y + 0.5 + (hp - 0.5) * 0.8) * ${G0.toFixed(3)} - ${(L / 2).toFixed(1)};
      p = vec3(cos(th0 - 3.14159265) * RC, y0, sin(th0 - 3.14159265) * RC);
      float paso = ${G0.toFixed(3)};
      ${PUNTO_CIL}
      // Inside, they are only grain over the surface; near the camera the patch takes over.
      sz = ${G0.toFixed(3)} * mix(0.8, 0.45, uDentro);
      float dF = length(vec2(th0 * RC - uFocoU, y0 - uFocoV));
      em *= mix(1.0, smoothstep(0.7, 0.95, dF / (${NVC.toFixed(1)} * ${(G0 / 2).toFixed(4)})), clamp(uNivel, 0.0, 1.0));
    }`,
    uniforms: u,
  });
  // The patch: ever finer near the camera.
  const pa = puntos(parche, {
    pre: PRE,
    cuerpo: /* glsl */ `{
      float lv = position.z;
      float sp = ${G0.toFixed(3)} / exp2(lv);
      float cu = floor(uFocoU / sp) + position.x;
      float cv = floor(uFocoV / sp) + position.y;
      vec2 cell = vec2(cu, cv);
      float hp = h21(cell + lv * 7.3);
      float uu = (cu + 0.5 + (h21(cell + 1.7 + lv) - 0.5) * 0.8) * sp;
      float vv = (cv + 0.5 + (hp - 0.5) * 0.8) * sp;
      float th0 = uu / RC;
      p = vec3(cos(th0 - 3.14159265) * RC, vv, sin(th0 - 3.14159265) * RC);
      float paso = sp;
      ${PUNTO_CIL}
      float on = clamp(uNivel - lv + 1.0, 0.0, 1.0);
      float dc = max(abs(position.x + 0.5), abs(position.y + 0.5)) / ${NVC.toFixed(1)};
      on *= 1.0 - smoothstep(0.7, 1.0, dc);
      float dF = length(vec2(uu - uFocoU, vv - uFocoV));
      on *= mix(1.0, smoothstep(0.7, 0.95, dF / (${NVC.toFixed(1)} * sp * 0.5)), clamp(uNivel - lv, 0.0, 1.0));
      on *= step(abs(vv), ${(L / 2).toFixed(1)});
      em *= on;
      // Inside, the ground is close and grazing: the points overlap so it reads as land, not foam.
      sz = sp * mix(0.8, 1.25, uDentro);
    }`,
    uniforms: u,
  });
  // Under them, the same surface, dim: inside the land by day, outside the dark hull.
  const fondo = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.002, R * 1.002, L, 256, 64, true),
    new THREE.ShaderMaterial({
      uniforms: u,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vP;
        void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform vec3 uCamL, uSun; uniform float uDentro, uDia;
        varying vec3 vP;
        ${GLSL}
        void main() {
          #include <logdepthbuf_fragment>
          float th = angulo(vP);
          float t = tramo(th);
          float d = distance(vP, uCamL);
          vec3 c;
          if (uDentro > 0.5) {
            if (t >= 0.5) discard;
            c = aire(grado(tierraCil(vec2(th * RC, vP.y), t / 0.5)) * 1.1 * uDia, d, uDia) * 0.85;
          } else {
            vec3 nOut = normalize(vec3(vP.x, 0.0, vP.z));
            c = t >= 0.5 ? vec3(0.42, 0.58, 0.72) * 0.08 : vec3(0.3) * 0.25 * smoothstep(-0.02, 0.3, dot(nOut, uSun)) + 0.003;
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  root.add(fondo, g.points, pa.points);
  capas.push(g, pa);
  // The end caps: discs of points, with the port at the axis lit.
  const capsN = 160000;
  const cp = new Float32Array(capsN * 3);
  const cc = new Float32Array(capsN * 3);
  for (let i = 0; i < capsN; i++) {
    const r = Math.sqrt(Math.random()) * R;
    const a = Math.random() * Math.PI * 2;
    const y = (i % 2 ? 1 : -1) * L * 0.5;
    cp.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    const port = r < 0.35 ? 1 : 0;
    const ring = Math.abs(((r * 3) % 1) - 0.5) > 0.47 ? 1 : 0;
    const v = port ? 1.2 : 0.14 + 0.06 * ring;
    cc.set(port ? [0.5 * v, 1.0 * v, 0.85 * v] : [v, v, v * 1.04], i * 3);
  }
  const caps = puntos(geometria({ position: cp, color: cc, size: new Float32Array(capsN).fill(0.04), seed: new Float32Array(capsN), aKind: new Float32Array(capsN) }), {
    pre: `uniform vec3 uCamL, uSun; uniform float uDentro;`,
    cuerpo: /* glsl */ `
      vec3 nCap = vec3(0.0, sign(p.y), 0.0);
      float port = step(0.9, color.g / max(color.r, 1e-3));
      if (uDentro < 0.5) {
        if (dot(nCap, uCamL - p) < 0.0) em *= 0.0;
        else em = mix(color * (smoothstep(-0.1, 0.4, dot(nCap, uSun)) * 0.9 + 0.05), color, port);
      } else {
        // Inside, the far end: terraced land climbing to the port, lit by day, under the haze.
        float r = length(p.xz);
        float terr = fract(r * 3.0);
        vec3 alb = mix(vec3(0.12, 0.17, 0.08), vec3(0.24, 0.23, 0.16), step(0.5, terr)) * (0.85 + 0.3 * fract(sin(dot(p.xz, vec2(12.9, 78.2))) * 43758.5));
        float d = distance(p, uCamL);
        em = mix(alb * 0.6, vec3(0.42, 0.55, 0.72) * 0.35, (1.0 - exp(-d / 22.0)) * 0.5) * 0.7;
        em = mix(em, color, port);
      }`,
    uniforms: u,
  });
  root.add(caps.points);
  capas.push(caps);
  // The mirrors: points over their plane, catching the Sun towards the camera.
  for (const M of espejos()) {
    const n = 60000;
    const mp = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set((Math.random() - 0.5) * ANCHO_ESPEJO, (Math.random() - 0.5) * L, 0).applyMatrix4(M);
      mp.set([v.x, v.y, v.z], i * 3);
    }
    const nrm = V(0, 0, 1).transformDirection(M);
    const mm = puntos(geometria({ position: mp, color: new Float32Array(n * 3).fill(1), size: new Float32Array(n).fill(0.07), seed: new Float32Array(n), aKind: new Float32Array(n) }), {
      pre: `uniform vec3 uCamL, uSun, uN;`,
      cuerpo: /* glsl */ `
        vec3 nn = dot(uN, uSun) > 0.0 ? uN : -uN;
        vec3 Vv = normalize(uCamL - p);
        float glint = pow(max(dot(reflect(-uSun, nn), Vv), 0.0), 18.0);
        float sheen = pow(max(1.0 - abs(dot(nn, Vv)), 0.0), 3.0);
        em = vec3(0.55, 0.6, 0.66) * (0.012 + 0.12 * sheen) + vec3(1.0, 0.96, 0.9) * glint * 0.8;
        // Seen from inside, through a window, a mirror is where the day comes from: bright sky.
        bool inn = length(uCamL.xz) < ${R.toFixed(1)} && abs(uCamL.y) < ${(L / 2).toFixed(1)};
        if (inn) em = vec3(0.55, 0.62, 0.72) * 0.03 + vec3(1.0, 0.95, 0.85) * glint * 0.15;`,
      uniforms: { uCamL: u.uCamL, uSun: u.uSun, uN: { value: nrm } },
    });
    root.add(mm.points);
    capas.push(mm);
  }
  // Under the mirrors' and the caps' points, their surfaces, dim (as under the hull).
  const bajo = (geo: THREE.BufferGeometry, M: THREE.Matrix4, glsl: string) => {
    const mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: u,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `${LOG_V}
          varying vec3 vW;
          void main() { vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: /* glsl */ `${LOG_F}
          uniform vec3 uCamL; uniform float uDentro;
          varying vec3 vW;
          void main() {
            #include <logdepthbuf_fragment>
            vec3 c;
            ${glsl}
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    mesh.geometry.applyMatrix4(M);
    root.add(mesh);
  };
  for (const M of espejos()) {
    const back = M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.01));
    bajo(new THREE.PlaneGeometry(ANCHO_ESPEJO, L), back, `c = uDentro > 0.5 ? vec3(0.42, 0.5, 0.62) * 0.025 : vec3(0.006);`);
  }
  for (const sg of [-1, 1]) {
    const M = new THREE.Matrix4().makeTranslation(0, sg * (L / 2 + 0.002), 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    bajo(new THREE.CircleGeometry(R, 128), M, `
      float r = length(vW.xz);
      float terr = fract(r * 3.0);
      vec3 alb = mix(vec3(0.12, 0.17, 0.08), vec3(0.24, 0.23, 0.16), step(0.5, terr));
      c = uDentro > 0.5 ? mix(alb * 0.6, vec3(0.42, 0.55, 0.72) * 0.5, (1.0 - exp(-distance(vW, uCamL) / 22.0)) * 0.5) : vec3(0.02);`);
  }
  // Inside: the towns' lights.
  capas.push(...luces(root, u.uCamL, 0.35));
  return {
    capas,
    update(cam: THREE.Vector3) {
      u.uCamL.value.copy(cam);
      const inn = dentro(cam);
      u.uDentro.value = inn ? 1 : 0;
      // The patch round the nearest point of the surface; its level from the distance to it.
      const th = Math.atan2(cam.z, cam.x) + Math.PI;
      u.uFocoU.value = th * R;
      u.uFocoV.value = THREE.MathUtils.clamp(cam.y, -L / 2, L / 2);
      const d = Math.max(Math.abs(Math.hypot(cam.x, cam.z) - R), Math.max(0, Math.abs(cam.y) - L / 2), 1e-4);
      u.uNivel.value = THREE.MathUtils.clamp(Math.log2(G0 / (d * 0.0045)), 0, NIV);
      // Under the points from either side: just outside them seen from inside, just inside from outside.
      fondo.material.side = inn ? THREE.BackSide : THREE.FrontSide;
      fondo.scale.set(inn ? 1 : 0.995, 1, inn ? 1 : 0.995);
    },
  };
}

/** The towns inside: warm (and a few teal) lights along the valleys; only seen from inside. */
function luces(root: THREE.Group, uCamL: { value: THREE.Vector3 }, brillo: number) {
  const n = 14000;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let k = 0;
  while (k < n) {
    const th = Math.random() * Math.PI * 2;
    const t = (th % SEC) / SEC;
    if (t >= 0.5) continue;
    // In clusters: towns along the river, villages on the terraces.
    const y = (Math.random() - 0.5) * L * 0.96;
    const town = Math.sin(y * 1.7 + th * 9) * Math.cos(y * 0.6 - th * 5);
    if (town < 0.35 && Math.random() > 0.15) continue;
    const a = th - Math.PI;
    pos.set([Math.cos(a) * R * 0.997, y, Math.sin(a) * R * 0.997], k * 3);
    const teal = Math.random() < 0.25;
    col.set(teal ? [0.5, 1.0, 0.85] : [1.0, 0.8, 0.55], k * 3);
    k++;
  }
  const c = puntos(geometria({ position: pos, color: col, size: new Float32Array(n).fill(0.014), seed: new Float32Array(n), aKind: new Float32Array(n) }), {
    pre: `uniform vec3 uCamL; uniform float uB;`,
    cuerpo: /* glsl */ `
      bool inn = length(uCamL.xz) < ${R.toFixed(1)} && abs(uCamL.y) < ${(L / 2).toFixed(1)};
      em *= inn ? uB : 0.0;`,
    uniforms: { uCamL, uB: { value: brillo } },
  });
  // They keep their brightness a little below a pixel (they are lamps).
  c.u.uMinPx.value = 2;
  root.add(c.points);
  return [c];
}

// ---------------------------------------------------------------- way 2 · silhouette

function maneraSilueta(root: THREE.Group) {
  const u = { uCamL: { value: V() }, uSun: { value: SOL.clone() }, uDentro: { value: 0 } };
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, L, 256, 64, true),
    new THREE.ShaderMaterial({
      uniforms: u,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vP;
        void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform vec3 uCamL, uSun; uniform float uDentro;
        varying vec3 vP;
        ${GLSL}
        void main() {
          #include <logdepthbuf_fragment>
          float th = angulo(vP);
          float t = tramo(th);
          float s = t >= 0.5 ? (t - 0.5) / 0.5 : t / 0.5;
          vec3 Vv = normalize(uCamL - vP);
          float d = distance(vP, uCamL);
          vec3 c;
          if (uDentro > 0.5) {
            // Evening inside: the land in shadow under a haze; the windows a band of dusk.
            if (t >= 0.5) {
              float rib = 1.0 - smoothstep(0.0, fwidth(vP.y) * 1.5 + 0.004, abs(fract(vP.y * 1.5) - 0.5) - 0.49);
              c = mix(vec3(0.95, 0.55, 0.3), vec3(0.25, 0.32, 0.5), smoothstep(0.1, 0.9, abs(s - 0.5) * 2.0)) * 0.35 * (1.0 - rib * 0.8);
            } else {
              vec3 alb = tierraCil(vec2(th * RC, vP.y), s);
              c = grado(alb) * 0.12;
              c = mix(c, vec3(0.55, 0.42, 0.4) * 0.16, (1.0 - exp(-d / 12.0)) * 0.85);
            }
          } else {
            vec3 nOut = normalize(vec3(vP.x, 0.0, vP.z));
            float mu = abs(dot(nOut, Vv));
            float lit = smoothstep(-0.05, 0.4, dot(nOut, uSun));
            // Almost black; the Sun only draws its rim.
            c = vec3(0.012, 0.013, 0.015) + vec3(1.0, 0.92, 0.8) * pow(max(1.0 - mu, 0.0), 6.0) * lit * 0.9;
            if (t >= 0.5) {
              float rib = 1.0 - smoothstep(0.0, fwidth(vP.y) * 1.5 + 0.004, abs(fract(vP.y * 1.5) - 0.5) - 0.49);
              float edge = smoothstep(0.0, 0.06, s) * smoothstep(0.0, 0.06, 1.0 - s);
              c += vec3(0.5, 0.68, 0.85) * 0.5 * edge * (1.0 - rib * 0.7);
            }
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  root.add(hull);
  const capMat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `${LOG_V}
      varying vec3 vP;
      void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      varying vec3 vP;
      void main() {
        #include <logdepthbuf_fragment>
        float r = length(vP.xy);
        vec3 c = vec3(0.012, 0.013, 0.015) + vec3(0.5, 1.0, 0.85) * (1.0 - smoothstep(0.25, 0.32, r)) * 0.7;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  for (const sg of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 128), capMat);
    cap.rotation.x = sg > 0 ? -Math.PI / 2 : Math.PI / 2;
    cap.position.y = (sg * L) / 2;
    root.add(cap);
  }
  // The mirrors: dark glass, a glint where the Sun is reflected towards the camera, a thin frame.
  const capas: Puntos[] = [];
  for (const M of espejos()) {
    const nrm = V(0, 0, 1).transformDirection(M);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(ANCHO_ESPEJO, L),
      new THREE.ShaderMaterial({
        uniforms: { uCamL: u.uCamL, uSun: u.uSun, uN: { value: nrm } },
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `${LOG_V}
          varying vec2 vUv; varying vec3 vW;
          void main() { vUv = uv; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: /* glsl */ `${LOG_F}
          uniform vec3 uCamL, uSun, uN; varying vec2 vUv; varying vec3 vW;
          void main() {
            #include <logdepthbuf_fragment>
            vec3 nn = dot(uN, uSun) > 0.0 ? uN : -uN;
            float glint = pow(max(dot(reflect(-uSun, nn), normalize(uCamL - vW)), 0.0), 30.0);
            vec2 e = min(vUv, 1.0 - vUv);
            float edge = 1.0 - smoothstep(0.0, 0.006, min(e.x, e.y));
            vec3 c = vec3(0.006) + vec3(1.0, 0.95, 0.88) * glint * 0.9 + vec3(0.6, 0.65, 0.7) * edge * 0.25;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    m.applyMatrix4(M);
    root.add(m);
  }
  // Navigation lights round the caps' rims, blinking.
  const nN = 48;
  const np = new Float32Array(nN * 3);
  for (let i = 0; i < nN; i++) {
    const a = (i / 24) * Math.PI * 2;
    np.set([Math.cos(a) * R * 1.01, (i < 24 ? 1 : -1) * L * 0.5, Math.sin(a) * R * 1.01], i * 3);
  }
  const nav = puntos(geometria({ position: np, color: new Float32Array(nN * 3).fill(1), size: new Float32Array(nN).fill(0.03), seed: Float32Array.from({ length: nN }, (_, i) => i / nN), aKind: new Float32Array(nN) }), {
    pre: `uniform float uT; uniform vec3 uCamL;`,
    cuerpo: `em = mix(vec3(1.0, 0.35, 0.25), vec3(0.5, 1.0, 0.85), step(0.5, fract(seed * 7.0))) * 2.0 * step(0.75, fract(uT * 0.5 + seed * 3.0));`,
    uniforms: { uT: { value: 0 }, uCamL: u.uCamL },
  });
  nav.u.uMinPx.value = 2.5;
  root.add(nav.points);
  capas.push(nav, ...luces(root, u.uCamL, 0.9));
  return {
    capas,
    update(cam: THREE.Vector3, time: number) {
      u.uCamL.value.copy(cam);
      u.uDentro.value = dentro(cam) ? 1 : 0;
      nav.u.uT.value = time;
    },
  };
}

// ---------------------------------------------------------------- way 3 · lines

function maneraLinea(root: THREE.Group) {
  const pts: number[] = [];
  const seg = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const circ = (r: number, y: number, n = 160, from = 0, to = Math.PI * 2) => {
    for (let i = 0; i < n; i++) {
      const a0 = from + ((to - from) * i) / n;
      const a1 = from + ((to - from) * (i + 1)) / n;
      seg(V(Math.cos(a0) * r, y, Math.sin(a0) * r), V(Math.cos(a1) * r, y, Math.sin(a1) * r));
    }
  };
  // Rings every 2 km; the seams at each window's edges; the ends.
  for (let y = -L / 2; y <= L / 2 + 1e-6; y += 4) circ(R, y);
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 - Math.PI;
    seg(V(Math.cos(a) * R, -L / 2, Math.sin(a) * R), V(Math.cos(a) * R, L / 2, Math.sin(a) * R));
  }
  // The windows' ribs: short arcs every 0.67 km across each window.
  for (let k = 0; k < 3; k++) {
    const a0 = k * SEC + SEC / 2 - Math.PI;
    for (let y = -L / 2; y <= L / 2; y += 4 / 3) circ(R, y, 12, a0, a0 + SEC / 2);
  }
  for (const sg of [-1, 1]) {
    circ(R * 0.66, (sg * L) / 2, 96);
    circ(R * 0.33, (sg * L) / 2, 64);
    circ(0.3, (sg * L) / 2, 32);
  }
  // The mirrors' frames and a few ribs.
  for (const M of espejos()) {
    const w = ANCHO_ESPEJO / 2;
    const c = [V(-w, -L / 2), V(w, -L / 2), V(w, L / 2), V(-w, L / 2)].map((v) => v.applyMatrix4(M));
    for (let i = 0; i < 4; i++) seg(c[i], c[(i + 1) % 4]);
    for (let y = -L / 2 + 4; y < L / 2; y += 4) seg(V(-w, y).applyMatrix4(M), V(w, y).applyMatrix4(M));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const u = { uCamL: { value: V() } };
  const lines = new THREE.LineSegments(
    geo,
    new THREE.ShaderMaterial({
      uniforms: u,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `${LOG_V}
        uniform vec3 uCamL; varying float vD;
        void main() { vD = distance(position, uCamL); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        varying float vD;
        void main() {
          #include <logdepthbuf_fragment>
          // Far lines fade, so the drawing keeps a depth.
          gl_FragColor = vec4(vec3(0.95, 0.88, 0.76) * (0.22 + 0.5 * exp(-vD / 20.0)), 1.0);
        }`,
    }),
  );
  lines.frustumCulled = false;
  root.add(lines);
  return {
    capas: luces(root, u.uCamL, 0.8),
    update(cam: THREE.Vector3) {
      u.uCamL.value.copy(cam);
    },
  };
}

// ---------------------------------------------------------------- the study

export const estructuras: Escena = {
  id: 'estructuras',
  nombre: 'Estructuras',
  estilos: [
    { key: '1', nombre: 'Puntitos', nota: 'Como los planetas: el casco y el paisaje en puntos sobre una superficie tenue, más finos de cerca; los espejos atrapan el Sol; los pueblos, luces.' },
    { key: '2', nombre: 'Silueta', nota: 'Casi negro; la forma la dice la luz: el borde que ilumina el Sol, las ventanas encendidas, el destello de los espejos. Adentro, atardecer: el valle en sombra y sus pueblos encendidos.' },
    { key: '3', nombre: 'Línea', nota: 'Un dibujo de luz, como en la lámina: anillos, costuras, las costillas de las ventanas, los marcos de los espejos; adentro, las mismas líneas y los pueblos.' },
  ],
  montar(stage, estilo): Instancia {
    stage.bloom.strength = 0.55;
    stage.bloom.radius = 0.4;
    stage.bloom.threshold = 0.6;
    stage.renderer.toneMappingExposure = 1.0;
    const sky = cielo(0.55);
    stage.root.add(sky.mesh);
    // It turns (its gravity), as in Destino: once every ~2 minutes.
    const giro = new THREE.Group();
    stage.root.add(giro);
    const m = estilo === 0 ? maneraPuntos(giro) : estilo === 1 ? maneraSilueta(giro) : maneraLinea(giro);

    // Free look: drag to turn the view round its target, Shift + wheel (or + / −) to come closer; double click resets.
    const libre = { yaw: 0, pitch: 0, zoom: 0, toma: -1 };
    let drag: { x: number; y: number } | null = null;
    const down = (ev: PointerEvent) => {
      if (ev.button !== 0 || (ev.target as Element | null)?.closest?.('button, a')) return;
      drag = { x: ev.clientX, y: ev.clientY };
    };
    const move = (ev: PointerEvent) => {
      if (!drag) return;
      libre.yaw -= ((ev.clientX - drag.x) / innerWidth) * 3.2;
      libre.pitch = Math.max(-1.45, Math.min(1.45, libre.pitch + ((ev.clientY - drag.y) / innerHeight) * 2.4));
      drag = { x: ev.clientX, y: ev.clientY };
    };
    const up = () => (drag = null);
    const wheel = (ev: WheelEvent) => {
      if (!ev.shiftKey) return;
      ev.preventDefault();
      libre.zoom = Math.max(-4, Math.min(2.5, libre.zoom + Math.sign(ev.deltaY || ev.deltaX) * 0.12));
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key === '+' || ev.key === '=') libre.zoom = Math.max(-4, libre.zoom - 0.15);
      if (ev.key === '-' || ev.key === '_') libre.zoom = Math.min(2.5, libre.zoom + 0.15);
    };
    const reset = () => Object.assign(libre, { yaw: 0, pitch: 0, zoom: 0 });
    addEventListener('pointerdown', down);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('wheel', wheel, { passive: false });
    addEventListener('keydown', key);
    addEventListener('dblclick', reset);

    const tl = new Timeline({});
    NOMBRES.forEach(([n, f], i) => {
      tl.caption(2, n, f);
      tl.label(`t${i}`).to(2, {});
    });
    const camL = V();
    const qi = new THREE.Quaternion();
    // Lamps keep a larger minimum size (set when they are built).
    const base = new Map<Puntos, number>();
    return {
      tl,
      lectura: () => null,
      rotulo: (p) => tl.captionAt(p),
      escalera: false,
      update(f: Frame) {
        const { camera, p, time } = f;
        const i = Math.max(0, Math.min(TOMAS.length - 1, Math.floor(p / 2)));
        const tm = TOMAS[i];
        if (libre.toma !== i) {
          reset();
          libre.toma = i;
        }
        // Look round from where the view stands; Shift + wheel moves along the gaze.
        const dir = tm.target.clone().sub(tm.pos);
        const right = dir.clone().cross(tm.up).normalize();
        const q = new THREE.Quaternion().setFromAxisAngle(tm.up, libre.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(right, libre.pitch));
        const outside = i < 2;
        const pos = outside ? tm.pos.clone().sub(tm.target).applyQuaternion(q).multiplyScalar(Math.exp(libre.zoom)).add(tm.target) : tm.pos.clone();
        const tgt = outside ? tm.target.clone() : tm.pos.clone().add(dir.applyQuaternion(q));
        if (!outside) pos.addScaledVector(tgt.clone().sub(pos).normalize(), -libre.zoom * 3);
        camera.position.copy(pos);
        camera.up.copy(tm.up).applyQuaternion(outside ? q : new THREE.Quaternion());
        camera.lookAt(tgt);
        camera.fov = tm.fov;
        camera.near = 0.001;
        camera.far = 2000;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        giro.rotation.y = time * Math.sqrt(9.81 / 4000) * 0.25;
        giro.updateMatrixWorld(true);
        // The camera in the turning frame.
        camL.copy(camera.position).applyQuaternion(qi.copy(giro.quaternion).invert());
        m.update(camL, time);
        const focal = f.H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        for (const c of m.capas) {
          const minPx = (base.get(c) ?? base.set(c, c.u.uMinPx.value).get(c))!;
          enfocar(c, { focal, dpr: f.dpr });
          if (minPx > 1.3) c.u.uMinPx.value = minPx * f.dpr;
        }
      },
      placa(g, f: Frame) {
        g.save();
        g.font = `500 ${Math.round(11 * f.u)}px "Geist Mono Variable", monospace`;
        g.fillStyle = 'rgba(236,231,219,0.55)';
        g.textAlign = 'center';
        g.fillText('ARRASTRA PARA MIRAR · SHIFT + RUEDA O + / − PARA ACERCAR · DOBLE CLIC: VOLVER · SCROLL: OTRA VISTA · 1 2 3: OTRA MANERA', f.W / 2, f.H - 26 * f.u);
        g.restore();
      },
      dispose() {
        removeEventListener('pointerdown', down);
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        removeEventListener('wheel', wheel);
        removeEventListener('keydown', key);
        removeEventListener('dblclick', reset);
      },
    };
  },
};
