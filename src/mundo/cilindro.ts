import * as THREE from 'three';
import { enfocar, geometria, puntos, type Puntos } from '../horizontes';

/**
 * An O'Neill cylinder (Island Three: 8 km across, 32 km long; O'Neill 1976) in the style Diego chose
 * in the study (prototypes/src/estudios/estructuras.ts, way 1 with silhouette mirrors): the hull and
 * the land in points over a dim surface, finer near the camera (a clipmap on the unrolled
 * cylinder); the end caps; the three mirrors as dark glass with a glint and a thin frame, opened
 * like petals from the end away from the Sun, at 45° to the axis, so the sunlight that comes along
 * the axis is thrown in through the windows.
 *
 * Kilometres, axis along local Y, the Sun towards +Y. `update` takes the camera in the cylinder's
 * (turning) frame.
 */

export const R = 4;
export const L = 32;
const SEC = (2 * Math.PI) / 3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
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

/**
 * The three mirrors, as petals: each hinged at its window's end away from the Sun (−Y), opened at
 * 45° to the axis towards the Sun, so the light that comes down the axis is thrown in through the
 * window. Each matrix maps a plane (x across the window, y along the mirror) into place.
 */
function espejos() {
  const alfa = Math.PI / 4;
  return [0, 1, 2].map((k) => {
    const a = (k + 0.75) * SEC - Math.PI;
    const r = V(Math.cos(a), 0, Math.sin(a));
    const t = V(-Math.sin(a), 0, Math.cos(a));
    const d = r.clone().multiplyScalar(Math.sin(alfa)).add(V(0, Math.cos(alfa), 0));
    const n = t.clone().cross(d).normalize();
    const centro = r.clone().multiplyScalar(R * 1.01).add(V(0, -L / 2, 0)).addScaledVector(d, LARGO_ESPEJO / 2);
    return new THREE.Matrix4().makeBasis(t, d, n).setPosition(centro);
  });
}
const LARGO_ESPEJO = L;
const ANCHO_ESPEJO = R * 1.1;

export const dentro = (c: THREE.Vector3) => Math.hypot(c.x, c.z) < R && Math.abs(c.y) < L / 2;
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
      em = grado(alb) * (lit * 0.9 + 0.09);
      em += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-uSun, nOut), normalize(uCamL - p0)), 0.0), 40.0) * 0.25 * lit;
    }
  }`;

export function cilindroPuntos(root: THREE.Group) {
  const u = {
    uCamL: { value: V() },
    uSun: { value: V(0, 1, 0) },
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
        else em = mix(color * (smoothstep(-0.1, 0.4, dot(nCap, uSun)) * 0.9 + 0.16), color, port);
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
  // The mirrors: silhouettes (dark glass, a glint, a thin frame).
  espejosSilueta(root, u);
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
  for (const sg of [-1, 1]) {
    const M = new THREE.Matrix4().makeTranslation(0, sg * (L / 2 + 0.002), 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    bajo(new THREE.CircleGeometry(R, 128), M, `
      float r = length(vW.xz);
      float terr = fract(r * 3.0);
      vec3 alb = mix(vec3(0.12, 0.17, 0.08), vec3(0.24, 0.23, 0.16), step(0.5, terr));
      c = uDentro > 0.5 ? mix(alb * 0.6, vec3(0.42, 0.55, 0.72) * 0.5, (1.0 - exp(-distance(vW, uCamL) / 22.0)) * 0.5) : vec3(0.035);`);
  }
  return {
    capas,
    update(cam: THREE.Vector3, vista: { focal: number; dpr: number }) {
      for (const c of capas) enfocar(c, vista);
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

/** The mirrors as silhouettes: dark glass, a glint where the Sun is reflected towards the camera, a thin frame. */
function espejosSilueta(root: THREE.Group, u: { uCamL: { value: THREE.Vector3 }; uSun: { value: THREE.Vector3 } }) {
  for (const M of espejos()) {
    const nrm = V(0, 0, 1).transformDirection(M);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(ANCHO_ESPEJO, LARGO_ESPEJO),
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
            float glint = pow(max(dot(reflect(-uSun, nn), normalize(uCamL - vW)), 0.0), 400.0);
            vec2 e = min(vUv, 1.0 - vUv);
            float edge = 1.0 - smoothstep(0.0, 0.006, min(e.x, e.y));
            vec3 c = vec3(0.006) + vec3(1.0, 0.95, 0.88) * glint * 1.6 + vec3(0.6, 0.65, 0.7) * edge * 0.25;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    m.applyMatrix4(M);
    root.add(m);
  }
}

