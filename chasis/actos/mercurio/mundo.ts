import * as THREE from 'three';
import { materia, materiaBuilder, type Nube } from '../../../estudios/motor/materia';
import { gauss } from '../../../estudios/motor/math';
import { TEAL } from '../../../estudios/remake';
import { angulos } from '../../../estudios/rig';
import { M, RM, PHI0, PHI, enRiel, D_RIO as D, N_RIO as N_T } from '../../../estudios/interior';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const Y = V(0, 1, 0);
// (Mercury's place, its rail and its river: interior.ts, shared with the flight that brings the spark here)

/** Where the scene leaves the camera: far away, the Sun an ember in its swarm (scene 13 starts here). */
/** What the flight passes right by fades out instead of blooming into a blot (first person, DIRECCION.md). */
export const LENTE = /* glsl */ `
  float dCam = length(mv.xyz) / max(uEscalaMundo, 1e-30);
  em *= smoothstep(0.012, 0.07, dCam);
  occ *= smoothstep(0.012, 0.07, dCam);
`;
export const LEJOS = V(Math.sin(PHI0 + PHI * 0.86 + 0.7), 0.35, Math.cos(PHI0 + PHI * 0.86 + 0.7)).multiplyScalar(160);

export function rigDe(pos: THREE.Vector3) {
  const a = angulos(pos);
  return { az: a.az, el: a.el, ld: Math.log10(pos.length()) };
}

// ---------------------------------------------------------------- the pieces

/** The rail: an arc of Mercury's equator that ends where the river leaves, tangent to it. `aKind`: 0 at the end, 1 at the start. */
export function rielDatos() {
  const b = materiaBuilder(31);
  for (let i = 0; i < 4200; i++) {
    const t = b.r();
    const a = t * 1.15;
    const p = N_T.clone().multiplyScalar(Math.cos(a)).addScaledVector(D, -Math.sin(a)).multiplyScalar(RM * 1.004).add(M);
    b.push(p.x, p.y + gauss(b.r) * 0.0012, p.z, TEAL, 0.0032, 0.8, { kind: t });
  }
  return b.data();
}

/** Where on the rail (v: 0 at its start, 1 at its end, where the river leaves), and a little above it. */
/** How many loads are on the rail at once, and how fast they go (cycles a second). */
export const CARGAS = 5;
export const CADENCIA = 0.16;

/**
 * The rail (a mass driver) as a structure: a strip along the arc with its two rails, and coils
 * across it every few metres that fire as each load passes, faster and faster towards its end.
 * Mercury hides what is behind it (`uOcc`, as the points do).
 */
export function rielMalla() {
  const n = 360;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const lado = N_T.clone().cross(D).normalize();
  const ancho = 0.011;
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    const c = enRiel(v, 0.0006);
    for (const k of [0, 1]) {
      const p = c.clone().addScaledVector(lado, (k - 0.5) * ancho);
      pos.push(p.x, p.y, p.z);
      uv.push(k, v);
    }
    if (i < n) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uRiel: { value: 0 }, uTime: { value: 0 }, uFundido: { value: 1 }, uOcc: { value: new THREE.Vector4() } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRiel, uTime, uFundido;
      uniform vec4 uOcc;
      varying vec2 vUv;
      varying vec3 vV;
      float raya(float x, float w) {
        float d = abs(fract(x + 0.5) - 0.5);
        float fw = max(fwidth(x), 1e-6);
        return 1.0 - smoothstep(w - fw, w + fw, d);
      }
      void main() {
        // Behind Mercury: hidden.
        vec3 ray = normalize(vV);
        float tt = dot(uOcc.xyz, ray);
        if (uOcc.w > 0.0 && tt > 0.0 && length(vV) > tt && length(uOcc.xyz - ray * tt) < uOcc.w) discard;
        float v = vUv.y;
        // Built from its start: it lights up along its length as it comes on.
        if (v > uRiel * 1.05) discard;
        // Two fine rails; coils across them, faint until a load passes.
        float rieles = raya(vUv.x * 1.0 - 0.2, 0.012) + raya(vUv.x * 1.0 - 0.8, 0.012);
        float bobina = raya(v * 140.0, 0.03) * step(0.2, vUv.x) * step(vUv.x, 0.8);
        // Each load: where it is now (it accelerates: v = phase²), and the coils round it fire.
        float fuego = 0.0;
        for (int k = 0; k < ${CARGAS}; k++) {
          float fase = fract(uTime * ${CADENCIA.toFixed(3)} + float(k) / ${CARGAS.toFixed(1)});
          float vk = fase * fase;
          fuego += exp(-pow((v - vk) / 0.012, 2.0)) + 0.35 * exp(-max(0.0, vk - v) / 0.04) * step(v, vk) * step(0.02, vk - v);
        }
        vec3 col = vec3(0.42, 0.95, 0.85) * rieles * 0.42 + vec3(0.5, 0.56, 0.62) * bobina * 0.05;
        col += vec3(0.6, 1.0, 0.92) * bobina * min(fuego, 1.0) * 0.7 + vec3(0.42, 0.95, 0.85) * rieles * min(fuego, 1.0) * 0.4;
        // (the rail's bed: barely there, a darker band on the ground)
        // (what passes right by the lens fades: riding the rail, a coil going by was a flash)
        float lente = smoothstep(0.003, 0.02, length(vV));
        gl_FragColor = vec4(col * uFundido * lente, 0.25 * uFundido * lente);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 6;
  m.frustumCulled = false;
  return { mesh: m, u: mat.uniforms };
}

/** The loads on the rail: bright capsules, each at its phase, accelerating to the end. */
export function cargasDatos() {
  const b = materiaBuilder(33);
  for (let k = 0; k < CARGAS; k++) {
    for (let i = 0; i < 24; i++) b.push(gauss(b.r) * 0.0008, gauss(b.r) * 0.0008, (b.r() - 0.5) * 0.005, i < 5 ? 0xffffff : TEAL, 0.0012, i < 5 ? 0.9 : 0.4, { kind: k / CARGAS });
  }
  return b.data();
}

/** The river: rock in flight, each grain with its phase along the path (`aKind`) and its place across it (`aOff`). */
export function rioDatos(n: number) {
  const b = materiaBuilder(37);
  const off: number[] = [];
  for (let i = 0; i < n; i++) {
    b.push(0, 0, 0, 0xffffff, 0.003 + b.r() * 0.005, 1, { kind: b.r() });
    off.push(gauss(b.r), gauss(b.r) * 0.5);
  }
  return { data: b.data(), off: new Float32Array(off) };
}

/**
 * The swarm: collectors in orbits of every tilt between 2.5 and 3.6 radii. `aU`, `aV`: each orbit's
 * plane; `aO`: radius, starting angle, angular speed. `aDelay`: when it arrives (with `uCubre`).
 */
export function enjambreDatos(n: number) {
  const b = materiaBuilder(41);
  const U: number[] = [];
  const W: number[] = [];
  const O: number[] = [];
  const v = V();
  for (let i = 0; i < n; i++) {
    const [x, y, z] = b.onSphere();
    // (a sixth of them in a dense band of low orbits round the equator, where the camera flies
    // among them: the nearest pass large)
    const banda = i % 6 === 0;
    const nrm = banda ? V(gauss(b.r) * 0.12, b.r() < 0.5 ? 1 : -1, gauss(b.r) * 0.12).normalize() : v.set(x, y, z).clone();
    const u = Math.abs(nrm.y) < 0.9 ? Y.clone().cross(nrm).normalize() : V(1, 0, 0).cross(nrm).normalize();
    const w = nrm.clone().cross(u);
    const R = banda ? 2.75 + b.r() * 0.5 : Math.sqrt(2.5 * 2.5 + b.r() * (3.6 * 3.6 - 2.5 * 2.5));
    const th = b.r() * Math.PI * 2;
    b.push(Math.cos(th) * R * u.x + Math.sin(th) * R * w.x, Math.cos(th) * R * u.y + Math.sin(th) * R * w.y, Math.cos(th) * R * u.z + Math.sin(th) * R * w.z, 0xffffff, 0.011 + b.r() * 0.008, 1, { delay: b.r(), ink: 1 });
    U.push(u.x, u.y, u.z);
    W.push(w.x, w.y, w.z);
    O.push(R, th, 0.05 * Math.pow(3 / R, 1.5));
  }
  return { data: b.data(), U: new Float32Array(U), W: new Float32Array(W), O: new Float32Array(O) };
}

/** The swarm as a cloud (scene 12 and the Sun's, scene 13, use the same one, so they meet without a seam). */
export function enjambreNube(teal: boolean): Nube {
  const ed = enjambreDatos(380000);
  const enjambre = materia(ed.data, {
        pre: /* glsl */ `
          attribute vec3 aU, aV, aO;
          uniform vec3 uCam, uBase;
          uniform float uCubre, uIR;
          varying float vAng;
        `,
        move: /* glsl */ `
          float th = aO.y + aO.z * uTime;
          p = (aU * cos(th) + aV * sin(th)) * aO.x;
          vec3 rh = normalize(p);
          vec3 tilt = vec3(fract(seed * 13.1), fract(seed * 71.7), fract(seed * 37.3)) - 0.5;
          vec3 wob = vec3(sin(uTime * 0.6 + seed * 91.0), cos(uTime * 0.5 + seed * 53.0), sin(uTime * 0.4 + seed * 17.0));
          vec3 Nf = normalize(-rh + tilt * 0.55 + wob * 0.1);
          vec3 Vv = normalize(uCam - p);
          float frente = step(0.0, dot(Nf, Vv));
          float g = pow(max(dot(reflect(rh, Nf), Vv), 0.0), 90.0);
          float on = step(aDelay, uCubre);
          em = uBase * (0.35 + 0.65 * frente) + vec3(1.0, 0.95, 0.86) * g * 4.0 * frente;
          em += vec3(0.42, 0.09, 0.025) * uIR * (1.0 - 0.6 * frente);
          em *= on;
          occ = 0.92 * on;
          vAng = seed * 6.2831853 + uTime * (fract(seed * 7.3) - 0.5) * 0.6;
        `,
        // (each collector a flat panel: a square, turned its own way, its rim a little brighter)
        frag: /* glsl */ `
          varying vec3 vEm;
          varying float vOcc;
          varying float vAng;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float ca = cos(vAng);
            float sa = sin(vAng);
            c = vec2(ca * c.x - sa * c.y, sa * c.x + ca * c.y) * vec2(1.0, 1.45);
            float m = max(abs(c.x), abs(c.y));
            float f = 1.0 - smoothstep(0.27, 0.33, m);
            float borde = smoothstep(0.2, 0.3, m) * f;
            gl_FragColor = vec4(vEm * f * (0.85 + 0.6 * borde), vOcc * f);
          }
        `,
        uniforms: { uCam: { value: V() }, uBase: { value: teal ? TEAL.clone().multiplyScalar(0.16) : new THREE.Color(0.02, 0.022, 0.028) }, uCubre: { value: 0 }, uIR: { value: 0 } },
        extra: { aU: [ed.U, 3], aV: [ed.W, 3], aO: [ed.O, 3] },
      });
  enjambre.u.uInk.value = 1;
  enjambre.u.uFuente.value = 0.25;
  enjambre.points.renderOrder = 10;
  return enjambre;
}

export const MINA = {
  pre: /* glsl */ `uniform vec3 uSem, uTeal; uniform float uMina, uLejos;`,
  glsl: /* glsl */ `
    float a = acos(clamp(dot(n, uSem), -1.0, 1.0)) / 3.14159265;
    float on = step(0.0005, uMina);
    float dentro = (1.0 - smoothstep(uMina - 0.015, uMina, a)) * on;
    float borde = smoothstep(uMina - 0.05, uMina - 0.004, a) * (1.0 - smoothstep(uMina - 0.004, uMina + 0.004, a)) * on;
    vec2 g = abs(fract(uvDe(n) * vec2(96.0, 48.0)) - 0.5);
    float malla = smoothstep(0.43, 0.5, max(g.x, g.y));
    float nodo = smoothstep(0.38, 0.5, min(g.x, g.y));
    float luz = step(0.9, hp);
    alb *= mix(1.0, 0.32, dentro);
    // (its grid of machines reads from afar; skimming the ground on the rail, only their dark ground
    // and the front where they advance)
    extra += uTeal * (dentro * (malla * 0.16 + nodo * 0.9 + luz * 0.12) * uLejos + borde * 1.2 * (0.35 + 0.65 * uLejos));
  `,
};
