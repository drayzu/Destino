import { tr } from './idioma';
import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss, lerp } from './motor/math';
import { ease } from './comun';
import { FONT, ink, VIOLETA, type Cuenta, type Rotulo } from './placa';
import { TEAL, capaLuz, potencia } from './remake';
import { aplicarToma, toma } from './rig';
import { crearChispa, montar, type Camino } from './chispa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scenes 1–3 of ESCALETA.md: the opening and act 0 (GUION.md, moments 1–9).
 *
 * Black, and a teal point that breathes: you, thinking, twenty watts. The camera pulls back and the
 * point lets go of a shell of teal points, our radio, that grows; around it the stars come on, real
 * points that pass the camera. It leaves the disc from above and the whole galaxy is below, turning;
 * the bubble is a point beside the Sun. The title. Then down again among the stars: planets round
 * them, the small drop of teal we have listened to, a teal wave over the whole galaxy that should
 * be there and is not, and the dive towards one yellow star.
 *
 * Units: thousands of light years (kly). The galaxy lies in the XZ plane, the Sun 26 kly out.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// (opened from 13°: wound that tight, the arms went round twice and read as rings)
const PITCH = THREE.MathUtils.degToRad(21);
const KW = 1 / Math.tan(PITCH);
/**
 * Where arm j's centre is at radius R: a log spiral, but not a perfect one (Diego, 30 Oct: «galaxia
 * muy perfecta»): its winding wanders with radius, each arm its own way.
 */
export const brazo = (R: number, j: number) => KW * (1 + 0.07 * j) * Math.log(R / 4) + j * Math.PI + 0.32 * Math.sin(R * 0.17 + j * 1.9) + 0.14 * Math.sin(R * 0.53 + j * 4.1);
/** The Sun: 26 kly out, between the two main arms. */
const R_SOL = 26;
const PHI_SOL = brazo(R_SOL, 0) + Math.PI / 2 + 0.25;
export const S = V(Math.sin(PHI_SOL) * R_SOL, 0.02, Math.cos(PHI_SOL) * R_SOL);
/** A neighbourhood a little way from the Sun, where the camera flies among stars with planets. */
const P = S.clone().add(V(0.09, 0.006, -0.07));
const R_VOZ = P.distanceTo(S);
/** Which way the spark leaves the Sun with our radio (the act before ends going this way: the relay
 * only moves and scales the worlds, so the way is the same in both). */
export const DIR_VOZ = P.clone().sub(S).normalize();

/** A smooth 2D noise (0..1), two octaves: the disc is clumpy, not even. */
function ruido2(x: number, y: number) {
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

function angDif(a: number, b: number) {
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
function localesDatos(): MateriaData {
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
function vecinasDatos() {
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
function vozDatos(): MateriaData {
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

export const apertura: Escena = {
  id: 'apertura',
  nombre: 'Apertura · 0 Escuchar',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'Tú, nuestra voz, la galaxia, el título; las estrellas con planetas, lo que hemos escuchado, el silencio, una estrella amarilla.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.65;
    stage.bloom.threshold = 0.4;
    stage.renderer.toneMappingExposure = 1.1;

    const galaxia = new THREE.Group();
    root.add(galaxia);
    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root, orden = 0) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };

    const estrellas = add(
      materia(galaxiaDatos(), {
        pre: /* glsl */ `uniform float uGal, uOla, uOlaOn; uniform vec3 uSol, uTeal, uCamG;`,
        move: /* glsl */ `
          em *= smoothstep(0.25, 1.6, length(p - uCamG));
          // What should be there: one civilization's teal over the whole galaxy, a wave from the Sun.
          float dS = length(p - uSol);
          float frente = uOla * 110.0;
          float ola = (1.0 - smoothstep(frente - 4.0, frente, dS)) * step(0.62, fract(seed * 17.3)) * uOlaOn;
          float luzE = max(max(em.r, em.g), em.b);
          em = mix(em, uTeal * (luzE * 1.8 + 0.12), ola);
          // (seen whole, the stars sparkle over the haze rather than draw it in grain)
          em *= mix(1.0, 0.3, smoothstep(40.0, 110.0, length(uCamG)));
          em *= uGal;
        `,
        uniforms: { uGal: { value: 0 }, uOla: { value: 0 }, uOlaOn: { value: 0 }, uSol: { value: S.clone() }, uTeal: { value: TEAL.clone() }, uCamG: { value: V() } },
      }),
      galaxia,
    );
    estrellas.u.uFuente.value = 0.55;
    const polvo = add(materia(polvoDatos(), { pre: `uniform float uGal; uniform vec3 uCamG;`, move: `occ *= uGal * smoothstep(1.0, 4.0, length(p - uCamG)) * (1.0 - smoothstep(30.0, 60.0, length(uCamG)));`, uniforms: { uGal: { value: 0 }, uCamG: { value: V() } } }), galaxia, 2);
    // (no dust of points: up close they drew a dotted black line; the haze carries the lanes)
    polvo.u.uInk.value = 0.22;
    polvo.points.visible = false;
    const brillo = galaxiaBrillo();
    galaxia.add(brillo.mesh);

    const locales = add(materia(localesDatos(), { pre: `uniform float uLoc;`, move: `em *= uLoc;`, uniforms: { uLoc: { value: 0 } } }), galaxia, 3);
    locales.u.uFuente.value = 0.8;

    const vd = vecinasDatos();
    const vecinas = add(
      materia(vd.data, {
        pre: /* glsl */ `attribute vec3 aU, aV, aO, aC; uniform float uPla;`,
        move: /* glsl */ `
          float th = aO.y + aO.z * uTime;
          p = aC + (aU * cos(th) + aV * sin(th)) * aO.x;
          em *= mix(1.0, uPla, step(0.0000001, aO.x)) * step(0.001, uPla + step(aO.x, 0.0));
        `,
        uniforms: { uPla: { value: 0 } },
        extra: { aU: [vd.U, 3], aV: [vd.W, 3], aO: [vd.O, 3], aC: [vd.C, 3] },
      }),
      galaxia,
      3,
    );
    vecinas.u.uFuente.value = 0.9;

    const voz = add(materia(vozDatos(), { pre: `uniform float uR, uOn; uniform vec3 uC;`, move: `p = uC + p * uR; sz *= uR; em *= uOn;`, uniforms: { uR: { value: 0 }, uOn: { value: 0 }, uC: { value: S.clone() } } }), galaxia, 4);
    voz.u.uFuente.value = 0.4;
    // (its outer shells as shells of light; its points a faint grain on them)
    const capasVoz = [1, 0.66].map((k) => {
      const c = capaLuz(TEAL, { cara: 0.04, grano: 0.3 });
      c.mesh.position.copy(S);
      galaxia.add(c.mesh);
      return { c, k };
    });

    // The Sun as a star, and «tú» beside it: both points whose size follows the camera.
    const punto = (col: THREE.Color, luz: number) => {
      const b = materiaBuilder(5);
      b.push(0, 0, 0, col, 1, luz);
      for (let i = 0; i < 30; i++) {
        const [x, y, z] = b.onSphere();
        const q = Math.sqrt(b.r()) * 0.9;
        b.push(x * q, y * q, z * q, col, 0.5, luz * 0.12);
      }
      const n = materia(b.data());
      n.u.uFuente.value = 1;
      return n;
    };
    const sol = add(punto(new THREE.Color(1.0, 0.86, 0.55), 2.2), galaxia, 5);
    const chispa = crearChispa();
    galaxia.add(chispa.nube.points);
    const tu = add(punto(TEAL, 2.4), galaxia, 6);

    // ---------------------------------------------------------------- the moments (GUION.md 1–9)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const C = (v: THREE.Vector3) => ({ cx: v.x, cy: v.y, cz: v.z });
    const G = V();
    const hacia = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
    // The spark's way (galaxy frame): out from the Sun with our radio to the neighbourhood P (s 0..1),
    // a loop among its stars with planets (1..2), and back to the yellow star (2..3).
    const lazo = new THREE.CatmullRomCurve3([P.clone(), P.clone().add(V(0.007, 0.001, 0.004)), P.clone().add(V(0.004, -0.0015, 0.011)), P.clone().add(V(-0.006, 0.001, 0.008)), P.clone().add(V(-0.002, 0.0005, 0.001))]);
    const camino: Camino = (sv, out) => {
      if (sv <= 1) return out.copy(S).lerp(P, Math.max(sv, -0.3));
      if (sv <= 2) return out.copy(lazo.getPoint(sv - 1));
      const fin = lazo.getPoint(1);
      const t = Math.min(sv - 2, 1);
      return out.copy(fin).lerp(S, t);
    };
    tl.set({ ...C(P), ox: 0, oy: 0, oz: 0, az: 0, el: 4, ld: -1.2, yaw: 90, pitch: -90, roll: 0, fov: 42, tu: 0, cue: 0, voz: 0, vozOn: 1, cielo: 0.4, gal: 0.4, titulo: 0, vatios: 0, giro: 0, pla: 0, vaso: 0, ola: 0, olaOn: 0, solp: 0, luzSol: 0, sc: 0, lw: 1, on: 1, tit: 0 });

    // Riding the front of our radio, out from the Sun; the stars round it pass.
    tl.label('voz').caption(5.0, 'Nuestra voz', 'Lo que pensamos, lo decimos. Hace un siglo que nuestra radio sale de aquí.');
    tl.with(5.0, { voz: 1, sc: 1 });
    luego(0.4, 3.0, { cielo: 1, gal: 1 });
    tl.wait(5.0);

    // Off the spark, far back: the galaxy, the bubble a point.
    tl.label('cien').caption(4.4, 'Cien mil años luz', 'Pero la galaxia mide cien mil años luz. Toda nuestra voz cabe en un punto.');
    tl.with(1.2, { lw: 0, ld: -1.1, az: 20, el: 10 });
    luego(1.8, 2.6, { ...C(hacia(P, G, 0.55)) });
    tl.to(4.4, { ld: 2.02, el: 56, az: 34 });

    tl.label('luz').caption(4.6, 'Toda esa luz', 'Quien usara toda la luz de una galaxia sería de tipo III en la escala de Kardashev, que mide a una civilización por su energía: tipo I, la de un planeta; II, la de una estrella; III, la de una galaxia.');
    luego(0.5, 1.2, { titulo: 1 });
    luego(3.0, 1.2, { titulo: 2 });
    luego(0.6, 3.4, { vatios: 1 });
    tl.with(1.0, { vozOn: 0 });
    tl.to(4.6, { ...C(G), ld: 1.98, el: 60, az: 52, giro: 0.4 });

    tl.label('alguien').caption(3.8, '¿Hay alguien más?', 'Cientos de miles de millones de estrellas. Hasta donde sabemos, nadie usa su luz.');
    tl.to(3.8, { ...C(hacia(G, P, 0.75)), ld: 1.15, el: 24, az: 80, giro: 0.5 });

    // Down to the spark again: it flies among stars with planets, and the camera with it.
    tl.label('planetas').caption(5.6, 'Planetas por todas partes', 'Y planetas no faltan: al menos uno por estrella. Muchos, donde podría haber agua.');
    tl.with(1.1, { ...C(P) });
    tl.to(2.4, { ld: -2.1, el: 10, az: 96 });
    luego(-0.6, 1.6, { pla: 1 });
    tl.with(1.0, { lw: 0.85 });
    tl.to(3.2, { sc: 2 });

    tl.label('escuchado').caption(4.4, 'Lo que hemos escuchado', 'Llevamos décadas escuchando. Es como sacar un vaso de agua del mar y decir que no hay peces.');
    // (from above: the camera leaves as its centre heads for the Sun, and must not cross the spark)
    tl.with(1.4, { lw: 0, ld: -2.0, az: 150, el: 34 });
    luego(0.2, 1.2, { pla: 0 });
    luego(2.2, 1.4, { vaso: 1 });
    luego(0.3, 2.6, { ...C(S) });
    tl.to(4.4, { ld: -0.72, el: 14, az: 172 });

    // The silence: the wave of what should be there, and nothing; the spark flickers.
    tl.label('silencio').caption(5.0, 'El silencio', 'Una sola civilización habría tenido tiempo de llenar la galaxia miles de veces. ¿Dónde están todos?');
    luego(0.4, 1.0, { vaso: 0 });
    luego(1.0, 1.8, { ...C(hacia(S, G, 0.6)) });
    tl.to(2.6, { ld: 1.95, el: 52, az: 200 });
    luego(-0.6, 0.4, { olaOn: 1 });
    luego(-0.4, 2.6, { ola: 1 });
    luego(1.0, 1.4, { tit: 1 });
    tl.to(2.4, { az: 214 });
    luego(-0.4, 1.0, { olaOn: 0, tit: 0 });

    // The leap: the spark dives to one yellow star, the camera behind it, and its light fills the frame.
    tl.label('amarilla').caption(5.0, 'Una estrella amarilla', 'No lo sabemos. Pero podemos imaginar cómo crecería una, empezando por la nuestra.');
    luego(0.6, 2.4, { solp: 1 });
    tl.with(1.8, { ...C(lazo.getPoint(1)) });
    tl.to(2.6, { ld: -2.2, el: 8, az: 236 });
    tl.with(1.0, { lw: 1 });
    luego(1.4, 1.2, { luzSol: 1 });
    tl.to(2.4, { sc: 3 });
    tl.label('fin');

    const tm = toma(tl, 0);
    const largo = tl.length;
    const Sw = V();
    return {
      tl,
      entrada: { pos: S.clone(), escala: 0.004 },
      salida: { pos: S.clone(), escala: Math.pow(10, -3.5) },
      escalera: false,
      cuenta(p): Cuenta | null {
        if (p < tl.at('luz')) {
          const linea = 'nuestra radio · 100 años luz';
          return { pisos: ['20'], unidad: 'W', linea, h: 1 };
        }
        if (p < tl.at('alguien')) {
          const v = tl.get('vatios', p);
          if (v < 0.02) return { pisos: ['20'], unidad: 'W', linea: 'nuestra radio · 100 años luz', h: 1 };
          const lp = lerp(1.3, 37, v);
          return { pisos: ['10', String(Math.floor(lp))], unidad: 'W', linea: 'la Vía Láctea', h: 1 };
        }
        return potencia(37, 'la Vía Láctea · ', 1);
      },
      anio() {
        return 2026;
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        if (!c || !c.fact) return null;
        return { capitulo: p >= tl.at('alguien') ? '0 · Escuchar' : '', name: c.name, fact: c.fact };
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-7;
        camera.far = 2000;
        galaxia.rotation.y = tl.get('giro', p);
        galaxia.updateMatrixWorld(true);
        // The rig works in the galaxy's frame: its centre turns with it.
        const sc = tl.get('sc', p);
        // (the ride's distances change from leg to leg gradually, never at once)
        const k1 = THREE.MathUtils.smoothstep(sc, 0.9, 1.2);
        const k2 = THREE.MathUtils.smoothstep(sc, 1.9, 2.2);
        // (smoothed only a little: the legs differ wildly in length, a light year against a loop
        // among a few stars, and a wide average would mix them)
        // (and while the spark rests at the end of its loop, the gaze does not peek down the long way
        // to the yellow star; that way opens as the spark takes it)
        const tope = sc <= 2 ? 2 : 2 + (sc - 2) * 3;
        const cam: Camino = (sv, out) => camino(Math.min(sv, tope), out);
        const m = montar(cam, sc, 0.04 + 0.02 * k1 - 0.01 * k2, 0.12 - 0.02 * k1, 0.0006 - 0.0002 * k1, V(0, 1, 0), 0.006);
        const lw = tl.get('lw', p);
        aplicarToma(camera, toma(tl, p, tm, { punto: m.mira, peso: lw, arriba: m.arriba, delante: m.delante }, { punto: m.lugar, peso: lw }));
        camera.position.applyAxisAngle(V(0, 1, 0), galaxia.rotation.y);
        camera.up.applyAxisAngle(V(0, 1, 0), galaxia.rotation.y);
        camera.lookAt(camera.position.clone().add(tm.dir.clone().applyAxisAngle(V(0, 1, 0), galaxia.rotation.y)));
        const camG0 = camera.position.clone().applyAxisAngle(V(0, 1, 0), -galaxia.rotation.y);
        chispa.update(camino, sc, sc < 1.05 ? 0.002 : 0.003, tl.get('on', p), tl.get('tit', p), camG0, f.focal, f.dpr, t);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        const d = Math.pow(10, tl.get('ld', p));
        const gal = tl.get('gal', p);
        estrellas.u.uGal.value = gal;
        polvo.u.uGal.value = gal;
        brillo.u.uGal.value = gal;
        estrellas.u.uOla.value = tl.get('ola', p);
        estrellas.u.uOlaOn.value = tl.get('olaOn', p);
        // The stars round the Sun: on with the sky, gone once the camera is far from them.
        Sw.copy(S).applyAxisAngle(V(0, 1, 0), galaxia.rotation.y);
        const dSol = camera.position.distanceTo(Sw);
        locales.u.uLoc.value = tl.get('cielo', p) * (1 - ease(1.2, 5, dSol));
        vecinas.u.uPla.value = tl.get('pla', p);
        // The bubble grows with the distance until it reaches its hundred light years, so it always fits.
        voz.u.uR.value = tl.get('vaso', p) > 0.001 ? R_VOZ * 0.03 : Math.max(1e-5, Math.min(sc, 1) * R_VOZ);
        voz.u.uOn.value = Math.min(1, tl.get('voz', p) * 4) * tl.get('vozOn', p) * (1 - ease(0.4, 3, dSol)) + tl.get('vaso', p) * 1.6;
        // (a shell only from outside it: the camera that rides our voice's front would be inside its
        // rim, a wall of light)
        const camVoz = camera.position.clone().applyAxisAngle(V(0, 1, 0), -galaxia.rotation.y).distanceTo(S);
        for (const { c, k } of capasVoz) {
          const rr = Math.max(1e-6, voz.u.uR.value * k);
          c.mesh.scale.setScalar(rr);
          c.u.uOn.value = voz.u.uOn.value * (k === 1 ? 0.55 : 0.25) * THREE.MathUtils.smoothstep(camVoz / rr, 1.4, 2.4);
          c.u.uTime.value = f.time;
        }
        voz.u.uOn.value *= 0.55;
        // The two points keep a few pixels whatever the distance.
        const px = (n: number) => (n * dSol) / f.focal;
        tu.points.position.copy(S).add(V(px(9), px(2), 0));
        tu.u.uSizeUnit.value = px(7);
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.22 * Math.sin(t * 1.5)) * (1 - 0.65 * tl.get('solp', p));
        sol.points.position.copy(S);
        sol.u.uSizeUnit.value = px(6 + 3 * tl.get('solp', p));
        sol.u.uGain.value = Math.max(tl.get('cielo', p), tl.get('solp', p)) * (0.5 + 0.8 * tl.get('solp', p));
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        for (const n of [estrellas, locales, vecinas]) n.u.uMaxPx.value = 3.2 * f.dpr;
        voz.u.uMaxPx.value = 4 * f.dpr;
        const camG = camera.position.clone().applyAxisAngle(V(0, 1, 0), -galaxia.rotation.y);
        estrellas.u.uCamG.value.copy(camG);
        polvo.u.uCamG.value.copy(camG);
        void d;
        void largo;
      },
      placa(g, f) {
        const u = f.u;
        // The yellow star's light fills the frame (scene 4 opens inside it).
        const ls = tl.get('luzSol', f.p);
        if (ls > 0.002) {
          g.save();
          const grad = g.createRadialGradient(f.W / 2, f.H / 2, 0, f.W / 2, f.H / 2, Math.max(f.W, f.H) * (0.1 + 0.9 * ls));
          grad.addColorStop(0, `rgba(255,246,230,${Math.min(1, ls * 1.4)})`);
          grad.addColorStop(1, `rgba(255,246,230,${ls * ls})`);
          g.fillStyle = grad;
          g.fillRect(0, 0, f.W, f.H);
          g.restore();
        }
        // «Desliza para empezar», under the point.
        const cue = tl.get('cue', f.p);
        if (cue > 0.01) {
          g.save();
          g.globalAlpha = cue * 0.6;
          g.textAlign = 'center';
          g.font = FONT.mono(11 * u);
          g.letterSpacing = `${1.6 * u}px`;
          g.fillStyle = ink();
          g.fillText(tr('Desliza para empezar').toUpperCase(), f.W / 2, f.H / 2 + 70 * u);
          g.restore();
        }
        // The title, over the whole galaxy.
        const ti = tl.get('titulo', f.p);
        const a = ease(0, 0.6, ti) * (1 - ease(1.2, 1.9, ti));
        if (a > 0.01) {
          g.save();
          g.globalAlpha = a;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.shadowColor = 'rgba(0,0,0,0.9)';
          g.shadowBlur = 24 * u;
          g.font = FONT.mono(11 * u);
          g.letterSpacing = `${1.8 * u}px`;
          g.fillStyle = VIOLETA;
          g.fillText('HORIZONTES · 03', f.W / 2, f.H * 0.18 - 92 * u);
          g.letterSpacing = '0px';
          g.font = FONT.serif(118 * u);
          g.fillStyle = ink(0.96);
          g.fillText('Destino', f.W / 2, f.H * 0.18);
          g.font = FONT.italic(30 * u);
          g.fillStyle = ink(0.78);
          g.fillText(tr('¿Adónde podemos llegar?'), f.W / 2, f.H * 0.18 + 84 * u);
          g.restore();
        }
      },
      dispose() {},
    };
  },
};
