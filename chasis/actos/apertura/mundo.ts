import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from '../../../estudios/motor/materia';
import { gauss } from '../../../estudios/motor/math';
import { ink } from '../../../estudios/placa';
import { TEAL } from '../../../estudios/remake';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// (opened from 13°: wound that tight, the arms went round twice and read as rings)
export const PITCH = THREE.MathUtils.degToRad(21);
export const KW = 1 / Math.tan(PITCH);
/**
 * Where arm j's centre is at radius R: a log spiral, but not a perfect one (Diego, 30 Oct: «galaxia
 * muy perfecta»): its winding wanders with radius, each arm its own way.
 */
export const brazo = (R: number, j: number) => KW * (1 + 0.07 * j) * Math.log(R / 4) + j * Math.PI + 0.32 * Math.sin(R * 0.17 + j * 1.9) + 0.14 * Math.sin(R * 0.53 + j * 4.1);
/** The Sun: 26 kly out, between the two main arms. */
export const R_SOL = 26;
export const PHI_SOL = brazo(R_SOL, 0) + Math.PI / 2 + 0.25;
export const S = V(Math.sin(PHI_SOL) * R_SOL, 0.02, Math.cos(PHI_SOL) * R_SOL);
/** A neighbourhood a little way from the Sun, where the camera flies among stars with planets. */
export const P = S.clone().add(V(0.09, 0.006, -0.07));
export const R_VOZ = P.distanceTo(S);
/** Which way the spark leaves the Sun with our radio (the act before ends going this way: the relay
 * only moves and scales the worlds, so the way is the same in both). */
export const DIR_VOZ = P.clone().sub(S).normalize();

/** A smooth 2D noise (0..1), two octaves: the disc is clumpy, not even. */
export function ruido2(x: number, y: number) {
  const h = (i: number, j: number) => {
    const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const capa = (x: number, y: number) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = h(i, j) + (h(i + 1, j) - h(i, j)) * ux;
    const b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * ux;
    return a + (b - a) * uy;
  };
  return 0.65 * capa(x, y) + 0.35 * capa(x * 2.3 + 5.1, y * 2.3 + 1.7);
}

export function angDif(a: number, b: number) {
  const d = (((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return Math.abs(d);
}

/** The Milky Way in points: a disc wound into arms, young blue stars and pink knots in them, a golden bar and bulge. */
export function galaxiaDatos(): MateriaData {
  const b = materiaBuilder(71);
  const r = b.r;
  const c = new THREE.Color();
  const VIEJA = new THREE.Color(1.0, 0.74, 0.46);
  const AZUL = new THREE.Color(0.58, 0.72, 1.0);
  const ROSA = new THREE.Color(1.0, 0.45, 0.66);
  const ORO = new THREE.Color(1.0, 0.72, 0.38);
  // Patchy along each arm: brighter stretches and gaps (a smooth noise of radius).
  const parche = (R: number, j: number) => Math.max(0.12, 0.5 + 0.6 * Math.sin(R * 0.41 + j * 2.3) * Math.sin(R * 0.23 + j * 0.7 + 1.1));
  // The two major arms, two minor ones between them (weaker, shorter, thinner), and the short spur
  // the Sun lives in (Orion's).
  const brazos: { j: number; ancho: (R: number) => number; peso: number; R0: number; R1: number }[] = [
    { j: 0, ancho: (R) => 2.6 + 0.06 * R, peso: 1, R0: 3, R1: 54 },
    { j: 1, ancho: (R) => 2.4 + 0.07 * R, peso: 1, R0: 3, R1: 50 },
    { j: 0.5, ancho: () => 1.8, peso: 0.55, R0: 7, R1: 40 },
    { j: 1.5, ancho: () => 1.6, peso: 0.45, R0: 9, R1: 34 },
  ];
  const espolon = (R: number) => PHI_SOL - 0.25 + 0.9 * Math.log(R / R_SOL);
  // Feathers: short spurs leaving the arms outwards, more steeply wound.
  const plumas = Array.from({ length: 22 }, (_, k) => {
    const j = [0, 1, 0.5, 1.5][k % 4];
    const R0 = 8 + r() * 34;
    return { j, R0, R1: R0 + 3 + r() * 5, a0: brazo(R0, j), paso: 0.9 + r() * 0.8 };
  });
  let n = 0;
  while (n < 760000) {
    const R = 2.5 - 11 * Math.log(1 - r() * 0.985);
    if (R > 54) continue;
    const th = r() * Math.PI * 2;
    let A = 0;
    for (const a of brazos) {
      if (R < a.R0 || R > a.R1) continue;
      const fin = THREE.MathUtils.smoothstep(R, a.R0, a.R0 + 3) * (1 - THREE.MathUtils.smoothstep(R, a.R1 - 6, a.R1));
      const d = angDif(th, brazo(R, a.j)) * R;
      const w = a.ancho(R);
      A = Math.max(A, a.peso * fin * parche(R, a.j) * Math.exp(-(d * d) / (2 * w * w)));
    }
    for (const pl of plumas) {
      if (R < pl.R0 || R > pl.R1) continue;
      const d = angDif(th, pl.a0 + pl.paso * Math.log(R / pl.R0)) * R;
      A = Math.max(A, 0.42 * Math.sin(((R - pl.R0) / (pl.R1 - pl.R0)) * Math.PI) * Math.exp(-(d * d) / (2 * 0.8 * 0.8)));
    }
    if (R > 21 && R < 31) {
      const d = angDif(th, espolon(R)) * R;
      A = Math.max(A, 0.45 * Math.sin(((R - 21) / 10) * Math.PI) * Math.exp(-(d * d) / (2 * 1.1 * 1.1)));
    }
    // (and the whole disc clumpy: star clouds and gaps)
    const x0 = Math.sin(th) * R;
    const z0 = Math.cos(th) * R;
    const grumo = 0.25 + 1.1 * Math.pow(ruido2(x0 / 6 + 3, z0 / 6 - 2), 1.5);
    if (r() > (0.3 + 0.7 * A) * grumo) continue;
    n++;
    const h = gauss(r) * (0.12 + 0.012 * R);
    const joven = A > 0.5 && r() < 0.35;
    c.copy(VIEJA).lerp(AZUL, THREE.MathUtils.smoothstep(R, 6, 32));
    if (joven) c.copy(AZUL).multiplyScalar(1.15);
    b.push(Math.sin(th) * R, h, Math.cos(th) * R, c, 0.012, joven ? 0.42 : 0.1 + r() * 0.14, { kind: R });
  }
  // Pink knots where stars are born, strung along the arms.
  for (let k = 0; k < 700; k++) {
    const R = 5 + r() * 40;
    const j = [0, 1, 0, 1, 0.5, 1.5][Math.floor(r() * 6)];
    // (in clusters along the arms, not a dotted line)
    const th = brazo(R, j) + gauss(r) * 0.11;
    if (r() > parche(R, j) * parche(R, j)) continue;
    const cx = Math.sin(th) * R;
    const cz = Math.cos(th) * R;
    for (let i = 0; i < 22; i++) b.push(cx + gauss(r) * 0.22, gauss(r) * 0.08, cz + gauss(r) * 0.22, ROSA, 0.012, 0.45, { kind: R });
  }
  // The bar and the bulge.
  const bar = 0.45;
  for (let i = 0; i < 90000; i++) {
    const x = gauss(r) * 4.2;
    const z = gauss(r) * 1.6;
    const y = gauss(r) * 1.25 * Math.exp(-(x * x + z * z) / 40);
    const nucleo = x * x + z * z < 2.5;
    // (dimmer than they were: together they burnt the core into a white disc)
    b.push(x * Math.cos(bar) - z * Math.sin(bar), y, x * Math.sin(bar) + z * Math.cos(bar), ORO, 0.012, nucleo ? 0.12 : 0.07, { kind: Math.hypot(x, z) });
  }
  return b.data();
}

/**
 * The galaxy's diffuse light, not points (Diego, 30 Oct: «no podrías no hacerla solo de puntos?»):
 * a disc that glows as a photograph of a spiral does, under its stars: a warm bulge and bar, the
 * arms a soft blue-white haze, patchy, with dust lanes darkening their inner edges as a shading,
 * not as black lines; nothing seen edge-on (the stars carry that). The same arms as the points.
 */
export function galaxiaBrillo() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uGal: { value: 0 }, uFundido: { value: 1 }, uKW: { value: KW }, uBar: { value: 0.45 } },
    vertexShader: /* glsl */ `
      varying vec3 vL;
      varying vec3 vV;
      varying vec3 vN;
      void main() {
        vL = position;
        vN = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uGal, uFundido, uKW, uBar;
      varying vec3 vL;
      varying vec3 vV;
      varying vec3 vN;
      float brazo(float R, float j) {
        return uKW * (1.0 + 0.07 * j) * log(R / 4.0) + j * 3.14159265 + 0.32 * sin(R * 0.17 + j * 1.9) + 0.14 * sin(R * 0.53 + j * 4.1);
      }
      float angDif(float a, float b) {
        float d = mod(a - b + 3.14159265, 6.2831853);
        return abs(d - 3.14159265);
      }
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruido(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          s += a * ruido(p);
          p = p * 2.03 + vec2(1.7, 9.2);
          a *= 0.5;
        }
        return s;
      }
      void main() {
        float R = length(vL.xz);
        if (R < 0.05) R = 0.05;
        float th = atan(vL.x, vL.z);
        // The disc: exponential, its edge soft (Diego, 31 Oct: rings of bands read as no galaxy).
        float disco = exp(-R / 9.0) * (1.0 - smoothstep(36.0, 56.0, R));
        // The arms are not bands of their own: they brighten the disc where it is (density waves),
        // broad, broken along their length, their dust lanes on their inner edges.
        float A = 0.0;
        float lane = 0.0;
        for (int k = 0; k < 4; k++) {
          float j = k == 0 ? 0.0 : k == 1 ? 1.0 : k == 2 ? 0.5 : 1.5;
          float peso = k < 2 ? 1.0 : 0.45;
          float w = (k < 2 ? 0.17 : 0.11) * R + 1.2;
          float fin = smoothstep(2.5, 6.0, R) * (1.0 - smoothstep(k < 2 ? 38.0 : 26.0, k < 2 ? 55.0 : 40.0, R));
          float d = angDif(th, brazo(R, j)) * R;
          float parche = 0.5 + 0.5 * ruido(vec2(R * 0.28 + j * 17.0, j * 3.0));
          A = max(A, peso * fin * parche * exp(-(d * d) / (2.0 * w * w)));
          float dl = angDif(th, brazo(R, j) - 0.17) * R;
          float wl = 0.32 * w;
          if (k < 2) lane = max(lane, fin * exp(-(dl * dl) / (2.0 * wl * wl)));
        }
        // Texture: feathery streaks along the way the arms wind, clouds and gaps across the disc.
        float fase = th - uKW * log(R / 4.0);
        float pluma = fbm(vec2(R * 0.3, fase * 2.4));
        float nube = fbm(vL.xz * 0.18 + 3.0);
        float grumo = 0.5 + 0.95 * pluma * (0.6 + 0.8 * nube);
        // Old warm light inside, bluer outside; the arms bluer still at their crests; pink knots.
        vec3 tono = mix(vec3(1.0, 0.85, 0.66), vec3(0.74, 0.82, 1.0), smoothstep(4.0, 26.0, R));
        vec3 col = tono * disco * (1.0 + 3.0 * A * grumo) * 0.55;
        col += vec3(0.55, 0.7, 1.0) * disco * A * A * grumo * 0.8;
        float nudos = smoothstep(0.62, 0.8, fbm(vL.xz * 0.9 + 7.0)) * A * smoothstep(5.0, 12.0, R);
        col += vec3(1.0, 0.42, 0.62) * nudos * disco * 2.0;
        col *= 1.0 - 0.6 * lane * (0.35 + 0.9 * fbm(vL.xz * 0.55 - 2.0)) * smoothstep(3.0, 7.0, R);
        // The bulge, compact and warm, and the bar.
        float cb = cos(uBar);
        float sb = sin(uBar);
        vec2 b = vec2(vL.x * cb + vL.z * sb, -vL.x * sb + vL.z * cb);
        float bulbo = exp(-pow(R / 1.7, 0.9)) * 0.7 + exp(-(b.x * b.x / 14.0 + b.y * b.y / 1.8)) * 0.3;
        col += vec3(1.0, 0.86, 0.64) * bulbo;
        // Seen face-on, the haze; edge-on, nothing (the stars carry it).
        float cara = smoothstep(0.08, 0.5, abs(dot(normalize(vN), normalize(vV))));
        gl_FragColor = vec4(col * cara * 0.55 * uGal * uFundido, 0.0);
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
  const g = new THREE.PlaneGeometry(120, 120, 1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = -1;
  m.frustumCulled = false;
  return { mesh: m, u: mat.uniforms };
}

/** Dust along the inner edges of the arms: points that hide what is behind them (the dark lanes). */
export function polvoDatos(): MateriaData {
  const b = materiaBuilder(73);
  const r = b.r;
  for (let i = 0; i < 110000; i++) {
    const R = 4 + r() * 34;
    const j = r() < 0.5 ? 0 : 1;
    const th = brazo(R, j) - 0.22 + gauss(r) * 0.06;
    // (in patches, broken here and there)
    if (ruido2(R * 0.35 + j * 7, j * 3.3) < 0.42) continue;
    b.push(Math.sin(th) * R + gauss(r) * 0.3, gauss(r) * 0.05, Math.cos(th) * R + gauss(r) * 0.3, 0x000000, 0.14, 0, { ink: 0.5, kind: R });
  }
  return b.data();
}

/** The stars round the Sun, close enough to pass the camera: a flattened cloud 0.8 kly across. */
export function localesDatos(): MateriaData {
  const b = materiaBuilder(79);
  const r = b.r;
  const c = new THREE.Color();
  for (let i = 0; i < 26000; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r()) * 0.8;
    const t = r();
    c.setRGB(1, 0.86, 0.7).lerp(new THREE.Color(0.75, 0.84, 1), t * t);
    b.push(S.x + x * q, S.y + y * q * 0.35, S.z + z * q, c, 0.00002, 0.45 + r() * 0.7);
  }
  return b.data();
}

/**
 * Stars with planets near P. Each star a point; each planet a spark on its orbit. `aO`: the orbit
 * (radius, phase, speed), `aU`/`aV` its plane, `aC` its star (stars have radius 0).
 */
export function vecinasDatos() {
  const b = materiaBuilder(83);
  const r = b.r;
  const U: number[] = [];
  const W: number[] = [];
  const O: number[] = [];
  const C: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < 700; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r()) * 0.018;
    const e = V(P.x + x * q, P.y + y * q * 0.5, P.z + z * q);
    c.setRGB(1, 0.85, 0.66).lerp(new THREE.Color(0.78, 0.86, 1), r());
    b.push(e.x, e.y, e.z, c, 0.00003, 1.6);
    U.push(1, 0, 0);
    W.push(0, 0, 1);
    O.push(0, 0, 0);
    C.push(e.x, e.y, e.z);
    const nP = 1 + Math.floor(r() * 3);
    const [nx, ny, nz] = b.onSphere();
    const nrm = V(nx, ny * 0.3 + 1, nz).normalize();
    const u = V(1, 0, 0).cross(nrm).normalize();
    const w = nrm.clone().cross(u);
    for (let k = 0; k < nP; k++) {
      const R = 0.00012 + r() * 0.0005;
      b.push(e.x, e.y, e.z, r() < 0.3 ? new THREE.Color(0.55, 0.75, 1.0) : new THREE.Color(0.9, 0.82, 0.7), 0.00002, 1.5);
      U.push(u.x, u.y, u.z);
      W.push(w.x, w.y, w.z);
      O.push(R, r() * Math.PI * 2, 0.6 * Math.pow(0.0003 / R, 1.5));
      C.push(e.x, e.y, e.z);
    }
  }
  return { data: b.data(), U: new Float32Array(U), W: new Float32Array(W), O: new Float32Array(O), C: new Float32Array(C) };
}

/** Our radio: three thin shells of teal points (unit sphere; the scene scales them). */
export function vozDatos(): MateriaData {
  const b = materiaBuilder(89);
  const ga = Math.PI * (3 - Math.sqrt(5));
  [1, 0.66, 0.33].forEach((R, k) => {
    const n = [22000, 9000, 3000][k];
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 2;
      const rr = Math.sqrt(1 - y * y);
      const th = ga * i;
      b.push(Math.cos(th) * rr * R, y * R, Math.sin(th) * rr * R, TEAL, 0.012, [0.5, 0.26, 0.14][k]);
    }
  });
  return b.data();
}
