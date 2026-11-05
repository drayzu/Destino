import * as THREE from 'three';
import { EASE, Timeline } from '../../estudios/timeline';
import { DECADAS, LOG0, crearBurbuja, frente } from '../../estudios/burbuja';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from '../../estudios/motor/materia';
import { gauss } from '../../estudios/motor/math';
import { TEAL, potencia, anioEn } from '../../estudios/remake';
import { angulos, toma, type Toma } from '../../estudios/rig';
import { tierra as tierraH } from '../../src/horizontes';
import { crearChispa, montar, type Camino } from '../../estudios/chispa';
import { S, brazo, galaxiaBrillo, galaxiaDatos, polvoDatos } from './apertura';
import { cuantas, enfocarMarcas, marcas, nombres, type Nombre } from '../../estudios/revelar';
import type { Cuenta, Rotulo } from '../../estudios/placa';
import { escribir, toma as plano } from '../toma';
import type { Acto, EscenaChasis, FrameActo } from '../tipos';
import { COPIAS_MOVE, SALTOS_MOVE, SALTOS_POST, TOCADAS_MOVE, copiasDatos, curva, escombros, ramaBurbuja, saltosDatos, tocadasDatos } from '../../estudios/momentos-galaxia';

/**
 * Scenes 16–17 of ESCALETA.md, «La burbuja» and «¿Dónde están?» (GUION.md, moments 36–42). The same
 * galaxy as the opening (kly, the Sun 26 kly out), so it is recognised.
 *
 * The ship becomes a point crawling among the stars: light is slow here. A front of teal spreads from
 * the Sun, star after star, until the whole galaxy is ours: type III; and then it goes dark and warm,
 * as a galaxy that used all its light would look. None we have looked at does. Three encounters,
 * close: a blue living world that the front surrounds without touching (the zoo); stars that go out
 * as you look at them (the ones who keep quiet); a dead swarm adrift round a cold star (the Great
 * Filter). The edge of the galaxy, the dark, and a single star.
 *
 * The encounters are drawn far larger than they are (a world a few light-months across), each in a
 * group of its own so its small coordinates stay exact.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const D2R = THREE.MathUtils.degToRad;
const G = V();
/** Where the ship is, a little way from the Sun. */
const Q = S.clone().add(V(0.004, 0.0005, -0.003));
const enDisco = (R: number, j: number, off: number) => {
  const th = brazo(R, j) + off;
  return V(Math.sin(th) * R, 0.03, Math.cos(th) * R);
};
const ZOO = enDisco(30, 0, 0.5);
const CALLAN = enDisco(36, 1, 0.42);
const FILTRO = enDisco(42, 0, 0.62);
/** The single star past the edge. */
const UNA = enDisco(57, 1, 0.55).add(V(0, 0.4, 0));
/** Where the camera stands round the living world when its star is right behind it. */
const AZ_ALBA = 238;
/** How much the gaze goes with the spark as it flies from one encounter to the next. */
const VIAJA = 0;

/** The living world's own seas and lands (not ours): deep ocean, green and ochre lands, ice at the poles. */
const MUNDO_VIVO = /* glsl */ `
  float cv = fbm(n * 1.6 + vec3(3.1, 7.7, 1.3));
  float suelo = smoothstep(0.5, 0.53, cv);
  vec3 verde = mix(vec3(0.12, 0.26, 0.08), vec3(0.42, 0.34, 0.17), smoothstep(0.48, 0.72, fbm(n * 4.3 + 2.0)));
  float hielo = smoothstep(0.8, 0.9, abs(n.y) + 0.08 * fbm(n * 7.0));
  alb = mix(mix(vec3(0.025, 0.1, 0.27), verde, suelo), vec3(0.55, 0.58, 0.62), hielo);
  // (alive on its night side too, with no lights of anyone's: its seas faintly glowing, the land a
  // darker shape on them, and auroras round its poles; a black disc ringed in blue read as a hoop)
  extra += vec3(0.0, 0.018, 0.028) * (1.0 - suelo) * (1.0 - hielo) * (0.6 + 0.4 * fbm(n * 9.0 + 4.0));
  float aurora = smoothstep(0.8, 0.84, abs(n.y)) * (1.0 - smoothstep(0.86, 0.9, abs(n.y)));
  float cortina = smoothstep(0.35, 0.75, fbm(vec3(atan(n.z, n.x) * 5.0, n.y * 14.0, 1.7)));
  extra += vec3(0.04, 0.16, 0.1) * aurora * cortina;
`;

/** The probes that keep away: a still lattice round the living world, from three radii out (its units). */
function vigiasDatos(): MateriaData {
  const b = materiaBuilder(213);
  const n = 2200;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i;
    const q = 3.1 + b.r() * 0.6;
    b.push(Math.cos(th) * rr * q, y * q, Math.sin(th) * rr * q, TEAL, 0.03, 1.3);
  }
  return b.data();
}

/** A globular cluster: a few thousand old stars, crowded to the middle (its own units, radius ~1). */
function callanDatos(): MateriaData {
  const b = materiaBuilder(223);
  const c = new THREE.Color();
  for (let i = 0; i < 3200; i++) {
    const [x, y, z] = b.onSphere();
    const q = 0.08 + Math.pow(b.r(), 1.8) * 1.1;
    c.setRGB(1, 0.8, 0.58).lerp(new THREE.Color(0.78, 0.86, 1), b.r() * b.r());
    const brillo = 0.5 + 2.2 * Math.pow(b.r(), 6);
    b.push(x * q, y * q * 0.85, z * q, c, 0.006 + 0.01 * Math.pow(b.r(), 3), brillo);
  }
  return b.data();
}

/** A call: a sphere of teal that spreads from the spark (unit radius, scaled by the shader). */
function llamadaDatos(): MateriaData {
  const b = materiaBuilder(225);
  for (let i = 0; i < 5000; i++) {
    const [x, y, z] = b.onSphere();
    b.push(x, y, z, TEAL, 0.004, 0.22);
  }
  return b.data();
}

/** A dim red star (its own units: radius 1): points, a glow round them. */
function rojaDatos(): MateriaData {
  const b = materiaBuilder(227);
  const r = b.r;
  for (let i = 0; i < 14000; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.pow(r(), 0.25);
    b.push(x * q, y * q, z * q, new THREE.Color(1.0, 0.2, 0.07), 0.03, 0.045);
  }
  for (let i = 0; i < 2000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 1 + r() * r() * 1.6;
    b.push(x * q, y * q, z * q, new THREE.Color(0.8, 0.16, 0.06), 0.1, 0.012);
  }
  return b.data();
}

/**
 * A dead swarm: collectors, square and ash-grey, on a broken shell round the red star, tumbling
 * (they catch its light now and then); some adrift, out of the shell (its own units).
 */
function muertosDatos(): MateriaData {
  const b = materiaBuilder(229);
  const r = b.r;
  for (let i = 0; i < 52000; i++) {
    const [x, y, z] = b.onSphere();
    const roto = Math.sin(x * 5 + y * 3) * Math.sin(z * 4) > 0.2;
    if (roto && r() < 0.88) continue;
    const suelto = r() < 0.06;
    const q = suelto ? 3.3 + r() * 2.8 : 3.2 + gauss(r) * 0.06;
    const g = 0.22 + r() * 0.16;
    b.push(x * q, y * q, z * q, new THREE.Color(g * 1.1, g, g * 0.92), suelto ? 0.014 + r() * 0.03 : 0.012, 0.09 + r() * 0.07, { kind: suelto ? 1 : 0 });
  }
  return b.data();
}

/** The act's shot: p, az, el, ld, lw, mx, my, fov, roll (viaje.transcribir, then by hand). */
const TOMA_GALAXIA: number[][] = [
  [0, -95, 14, -3.3221, 0, -0.33, 0.23, 40, 0.0578],
  [0.4, -112, 14.6, -3.2, 0.85, 0, -1, 40, 0.1],
  [1.2, -160, 16.74, -2.802, 0.844, 4, -5, 40, 0.3],
  [2.4, -206.25, 24.53, -2.844, 0.956, 4.57, -8.63, 40, 1.92],
  [3.6, -220.64, 17.67, -2.786, 0.997, 1.04, -2.8, 40, 0.32],
  [4.8, -214.2, 19.14, -2.819, 1, 1.1, -3.59, 40, 0.01],
  [6, -203.6, 12.74, -2.296, 1, 0.35, -3.72, 40, -0.01],
  [7.2, -199.36, 19.16, -1.795, 1, -0.36, -3.1, 40, -0.01],
  [8.4, -199.82, 12.25, -0.932, 0.965, 0.29, 2.58, 40, -0.04],
  [9.6, -197.42, 15.8, -0.303, 0.338, 0.52, 2.43, 40, -0.01],
  [10.8, -195.39, 21.14, 0.08, 0.004, 0.01, 0.03, 40, 0],
  [12, -193.68, 24.01, 0.458, 0, -0.01, -0.01, 40, 0],
  [13.2, -191.63, 26.7, 0.744, 0, -0.01, -0.01, 40, 0],
  [14.4, -189.28, 29.01, 0.883, 0, 0, 0, 40, 0],
  [15.6, -187.05, 31.11, 0.939, 0, 0.01, -0.01, 40, 0],
  [16.8, -185.38, 33.63, 1.091, 0, 0, -0.01, 40, 0],
  [18, -183.99, 36.28, 1.32, 0, 0, 0, 40, 0],
  [19.2, -182.55, 38.53, 1.542, 0, 0, -0.01, 40, 0],
  [20.4, -180.67, 39.77, 1.674, 0, 0, 0, 40, 0],
  [21.6, -177.92, 39.99, 1.7, 0, 0, 0, 40, 0],
  [22.8, -173.73, 39.74, 1.703, 0, 0.01, 0, 40, 0],
  [24, -166.98, 37.28, 1.731, 0, -0.02, 0.01, 40, 0],
  [25.2, -157.91, 31.7, 1.792, 0, -0.01, 0.02, 40, 0],
  [26.4, -148.48, 24.79, 1.861, 0, 0, 0, 40, 0.03],
  [27.6, -140.86, 18.55, 1.89, 0.001, -0.04, 0.01, 40, 0],
  [28.8, -130.45, 12.05, 1.532, 0.146, -5, 1.77, 40, 0.23],
  [30, -104.91, 1.65, 1.139, 0.853, -22.66, 7.49, 40, 1.22],
  [31.2, -107.43, 1.9, -0.466, 0.579, -19.87, 5.53, 39.97, 0.66],
  [32.4, -125.35, 7.03, -2.482, 0.027, -1.99, 0.51, 39.52, 0.03],
  [33.6, -122.4, 7.28, -2.717, 0, 0, 0, 38.62, 0],
  [34.8, -115.65, 6.99, -2.771, 0, 0, 0, 38.06, 0],
  [36, -105.88, 6.61, -2.785, 0, 0, 0, 38, 0],
  [37.2, -93.25, 6.24, -2.792, 0, 0, 0, 38, 0],
  [38.4, -79.99, 6.44, -2.759, 0.001, -0.14, 0.02, 38, 0.01],
  [39.6, -51.5, 6.64, -1.743, 0.18, -11.33, 2.4, 38, 1.38],
  [40.8, -30.43, 7.45, 0.4, 0.816, -17.09, 5.25, 38, 3.22],
  [42, -54.09, 17.04, -0.247, 0.219, 1.21, -0.35, 38, -0.47],
  [43.2, -43.24, 14.5, -1.366, 0.002, 0.02, -0.01, 38.17, -0.01],
  [44.4, -33.05, 12.62, -1.775, 0, 0.01, 0, 40.38, 0],
  [45.6, -20.74, 11.06, -1.925, 0, 0.01, 0, 45.05, 0],
  [46.8, -6.67, 9.26, -2.089, 0, 0.02, 0, 48.95, 0],
  [48, 9.96, 7, -2.3, 0, 0.04, -0.01, 51.85, 0],
  [49.2, 24.1, 5.55, -2.395, 0, 0, 0, 53.64, 0],
  [50.4, 30.98, 8.23, -1.441, 0.052, 0.09, 0.58, 53.99, 0],
  [51.6, 33.54, 6.58, 0.477, 0.66, 1.97, 8.09, 54, 0],
  [52.8, 40.93, 11.45, -0.346, 0.251, 1.25, 3.41, 54, 0],
  [54, 50.92, 12.72, -1.943, 0.002, 0.02, 0.03, 53.97, 0],
  [55.2, 60.1, 10.84, -2.46, 0, 0, 0, 53.35, 0],
  [56.4, 69.67, 9.13, -2.594, 0, 0, 0, 51.69, 0],
  [57.6, 80.33, 7.51, -2.676, 0, -0.01, 0, 50.32, 0],
  [58.8, 92.84, 5.88, -2.743, 0, 0.01, 0, 50.01, 0],
  [60, 107.4, 4.25, -2.8, 0, 0.01, 0, 50, 0],
  [61.2, 122.82, 3.57, -2.767, 0, -0.01, 0.01, 50, 0],
  [62.4, 141.08, 9.36, -1.609, 0.023, -2.22, 0.17, 50, 0.36],
  [63.6, 192.1, 12.42, 0.695, 0.54, -24.49, 4.28, 49.84, 5.65],
  [64.8, 194.09, 23.1, 1.63, 0.98, -12.77, 7.37, 48.52, 2.11],
  [66, 196.92, 39.77, 1.97, 0.652, 4.86, -0.08, 46.62, 0.01],
  [67.2, 227.67, 38.49, 1.926, 0.046, 0.37, -0.13, 46.02, 0.01],
  [68.4, 252.31, 27.5, 1.376, 0, 0.02, 0, 46, 0.01],
  [69.6, 286.66, 17.99, 0.805, 0, 0.04, 0, 46, 0.01],
  [70.8, 340.41, 11.78, 0.363, 0, 0.03, 0.01, 46, 0.01],
  [72, 392.78, 7.46, -0.126, 0, 0, 0, 45.99, 0.01],
  [73.2, 422.12, 5.35, -0.972, 0, 0, 0, 45.61, 0],
  [74.4, 437.19, 4.35, -2.12, 0, -0.01, 0, 44.58, 0],
  [75.2, 442.59, 4, -2.678, 0, -0.08, 0.02, 44, 0.01]
];

export const galaxia: EscenaChasis = {
  id: 'galaxia',
  montar(stage): Acto {
    const root = stage.root;
    const { camera } = stage;

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
        pre: /* glsl */ `uniform float uGal, uBulbo, uBur, uIR; uniform vec3 uSol, uTeal, uCamG;`,
        move: /* glsl */ `
          em *= smoothstep(0.25, 1.6, length(p - uCamG));
          // Ours: every star the front has reached is teal; the front itself brighter.
          float dS = length(p - uSol);
          float dentro = 1.0 - smoothstep(uBur - 1.5, uBur, dS);
          float frente = smoothstep(uBur - 2.5, uBur - 0.8, dS) * dentro;
          // (turning teal it keeps the light it had, the front itself brighter: the whole galaxy ours
          // must not burn into one white disc)
          float luzE = max(max(em.r, em.g), em.b);
          em = mix(em, uTeal * (luzE * 1.7 + 0.45 * frente), dentro * step(0.18, fract(seed * 17.3)));
          // A galaxy that used all its light: dark, warm.
          em = mix(em, vec3(0.22, 0.05, 0.02) * (0.4 + 0.6 * fract(seed * 7.1)), uIR);
          // (seen whole from outside, the stars, ours too, sparkle over the haze rather than pile up
          // into a burnt disc or draw the arms as bands)
          em *= mix(1.0, 0.35, smoothstep(26.0, 100.0, length(uCamG)));
          // (and its bulge, thick with stars, most of all: from above the disc it burnt into a white mass)
          em *= 1.0 - 0.6 * exp(-dot(p.xz, p.xz) / 50.0) * smoothstep(18.0, 40.0, length(uCamG));
          // (and through the encounters and the reveal, dimmer still: from inside the disc it was a
          // burnt band across them)
          em *= 1.0 - uBulbo * 0.92 * exp(-dot(p.xz, p.xz) / 60.0);
          em *= uGal;
        `,
        uniforms: { uGal: { value: 1 }, uBulbo: { value: 0 }, uBur: { value: 0 }, uIR: { value: 0 }, uSol: { value: S.clone() }, uTeal: { value: TEAL.clone() }, uCamG: { value: V() } },
      }),
    );
    estrellas.u.uFuente.value = 0.55;
    const polvo = add(materia(polvoDatos(), { pre: `uniform float uGal; uniform vec3 uCamG;`, move: `occ *= uGal * smoothstep(1.0, 4.0, length(p - uCamG)) * (1.0 - smoothstep(30.0, 60.0, length(uCamG)));`, uniforms: { uGal: { value: 1 }, uCamG: { value: V() } } }), root, 2);
    polvo.u.uInk.value = 0.22;
    // (no dust of points: up close they drew a dotted black line; the haze carries the lanes)
    polvo.points.visible = false;
    const brillo = galaxiaBrillo();
    root.add(brillo.mesh);

    // A point that keeps a few pixels: the ship, and the single star at the end.
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
    const nave = add(punto(TEAL, 2.0), root, 5);
    nave.points.position.copy(Q);
    const una = add(punto(new THREE.Color(1.0, 0.82, 0.6), 2.2), root, 5);
    una.points.position.copy(UNA);

    const grupo = (pos: THREE.Vector3, escala: number) => {
      const g = new THREE.Group();
      g.position.copy(pos);
      g.scale.setScalar(escala);
      root.add(g);
      return g;
    };
    // The living world: its own lands, the light of its star, turning; and the probes round it, kept away.
    const base = `${import.meta.env.BASE_URL}texturas/`;
    const R_ZOO = 0.0004;
    const zooG = grupo(ZOO, R_ZOO);
    const vivo = tierraH(base, { giro: 0.03, mar: false, puntos: 300000, superficie: { glsl: MUNDO_VIVO } });
    zooG.add(vivo.group);
    // Its star right behind it as the camera comes in on its night side: as the camera turns round
    // it the star rises over its limb, a dawn on a living world.
    const SOL_ZOO = V(Math.cos(D2R(-7)) * Math.sin(D2R(AZ_ALBA + 180)), Math.sin(D2R(-7)), Math.cos(D2R(-7)) * Math.cos(D2R(AZ_ALBA + 180)));
    const solZoo = add(punto(new THREE.Color(1.0, 0.92, 0.78), 2.6), root, 5);
    solZoo.points.position.copy(ZOO).addScaledVector(SOL_ZOO, R_ZOO * 90);
    const vigias = add(
      materia(vigiasDatos(), {
        pre: /* glsl */ `uniform float uOn;`,
        move: /* glsl */ `
          float ag = uTime * 0.012;
          p.xz = vec2(cos(ag) * p.x - sin(ag) * p.z, sin(ag) * p.x + cos(ag) * p.z);
          em *= uOn * (0.55 + 0.45 * sin(uTime * 1.1 + seed * 40.0));
        `,
        uniforms: { uOn: { value: 0 } },
      }),
      zooG,
      4,
    );
    vigias.u.uFuente.value = 0.6;

    // The cluster that keeps quiet: the spark calls from its edge, and the call sweeps through it; every
    // star it passes flickers and goes out, a few a little later than the rest, until the whole ball is
    // a dark ghost of embers where a crowd of lights was.
    const R_CALLAN = 0.006;
    const callanG = grupo(CALLAN, R_CALLAN);
    const ORIGEN_LLAMADA = V(Math.cos(D2R(14)) * Math.sin(D2R(296)), Math.sin(D2R(14)), Math.cos(D2R(14)) * Math.cos(D2R(296))).multiplyScalar(0.78);
    /** How far the call has gone at its end (its units: the cluster is ~1.2 across its halo). */
    const LLAMA_R = 2.4;
    const callan = add(
      materia(callanDatos(), {
        pre: /* glsl */ `uniform float uOn, uLlama; uniform vec3 uOrigen;`,
        move: /* glsl */ `
          float frente = uLlama * ${LLAMA_R.toFixed(2)};
          float pasado = frente - length(p - uOrigen) - 1.4 * pow(fract(seed * 7.7), 8.0);
          float apagada = smoothstep(0.04, 0.4, pasado) * step(0.0005, uLlama);
          // (just after the front they tremble, then go out to an ember)
          float tiembla = smoothstep(-0.03, 0.04, pasado) * (1.0 - apagada);
          float parpadeo = 0.5 + 0.5 * sin(uTime * 23.0 + seed * 90.0);
          vec3 brasa = vec3(0.55, 0.11, 0.05) * (0.3 + 0.3 * fract(seed * 13.0));
          em = mix(em * (1.0 + tiembla * (parpadeo * 1.6 - 0.4)), brasa, apagada) * uOn;
        `,
        uniforms: { uOn: { value: 0 }, uLlama: { value: 0 }, uOrigen: { value: ORIGEN_LLAMADA.clone() } },
      }),
      callanG,
      4,
    );
    callan.u.uFuente.value = 0.7;
    const llamada = add(
      materia(llamadaDatos(), {
        pre: /* glsl */ `uniform float uLlama; uniform vec3 uOrigen;`,
        move: /* glsl */ `
          float rr = uLlama * ${LLAMA_R.toFixed(2)};
          p = uOrigen + p * rr;
          em *= smoothstep(0.0, 0.06, uLlama) * (1.0 - smoothstep(0.6, 1.0, uLlama));
        `,
        uniforms: { uLlama: { value: 0 }, uOrigen: { value: ORIGEN_LLAMADA.clone() } },
      }),
      callanG,
      5,
    );
    llamada.u.uFuente.value = 0.6;

    // The dead swarm round its red star.
    const R_FILTRO = 0.0005;
    const filtroG = grupo(FILTRO, R_FILTRO);
    const roja = add(materia(rojaDatos(), { pre: `uniform float uOn;`, move: `em *= uOn;`, uniforms: { uOn: { value: 0 } } }), filtroG, 3);
    roja.u.uFuente.value = 0.5;
    const muertos = add(
      materia(muertosDatos(), {
        cuadro: true,
        pre: /* glsl */ `uniform float uOn;`,
        move: /* glsl */ `
          // Drifting, and tumbling: now and then a face catches the red light.
          float ag = uTime * (aKind > 0.5 ? 0.02 : 0.008) * (0.6 + 0.8 * fract(seed * 9.1));
          p.xz = vec2(cos(ag) * p.x - sin(ag) * p.z, sin(ag) * p.x + cos(ag) * p.z);
          float cara = pow(abs(sin(uTime * (0.3 + 0.9 * fract(seed * 5.3)) + seed * 30.0)), 40.0);
          em = mix(em, vec3(1.0, 0.36, 0.18) * 0.7, cara * 0.6);
          em *= uOn;
        `,
        uniforms: { uOn: { value: 0 } },
      }),
      filtroG,
      4,
    );
    muertos.u.uFuente.value = 0.3;
    // And close by, the wreck itself: broken collectors the camera passes among, tumbling.
    const restos = escombros(700, 233, 2.3, 4.4);
    restos.mesh.renderOrder = 6;
    filtroG.add(restos.mesh);

    // ---------------------------------------------------------------- the moments (GUION.md 36–42)
    // Revealing: home ringed in teal, its name a moment (the galaxy names itself).
    const aroSol = add(marcas([{ pos: S, R: 0, color: new THREE.Color(1.0, 0.94, 0.82), nuestro: true }]), root, 40);
    const NOMBRES: Nombre[] = [
      { pos: S, texto: 'Sol', nuestro: true },
    ];
    /** How many stars a bubble this wide holds (units of this galaxy: ~830 light years). */
    const estrellasEn = (r: number) => {
      const A: [number, number][] = [[-2.3, 0.3], [-1.22, 3.3], [-0.22, 6.3], [0.78, 8.5], [1.53, 11], [2.08, 11.6]];
      const x = THREE.MathUtils.clamp(Math.log10(Math.max(r, 0.005)), A[0][0], A[A.length - 1][0]);
      let i = 0;
      while (x > A[i + 1][0]) i++;
      return Math.pow(10, THREE.MathUtils.mapLinear(x, A[i][0], A[i + 1][0], A[i][1], A[i + 1][1]));
    };
    let alcanceR = 0.005;

    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const Cn = (v: THREE.Vector3) => ({ cx: v.x, cy: v.y, cz: v.z });
    const D0 = 0.0006;
    // The spark's way (GUION.md v2, 39–45): copied from star to star outward from the ship (ch 0..1);
    // then to each encounter (2, 3, 4) and to the single star at the edge (5).
    const burb = crearBurbuja(S, ZOO.clone().sub(S).setY(0));
    add(burb.estrellas, root, 3);
    add(burb.hilos, root, 3);
    // At every star the copies reach, a burst of them flies out in all directions; and the threads
    // between the stars, brighter once the camera lets go, so the network reads as a growing tree
    // at every scale, not as a dim cloud.
    // (on the spark's own branch, and at one star in ten of the rest, so the whole front sparkles)
    const ramaB = ramaBurbuja(ZOO.clone().sub(S).setY(0));
    const enLaRama = new Set(ramaB.camino.map((c) => c.p));
    const copiasD = copiasDatos([...ramaB.camino, ...ramaB.estrellas.filter((e, i) => i % 10 === 3 && !enLaRama.has(e.p))], 9, TEAL);
    const copias = add(
      materia(copiasD.data, { pre: /* glsl */ `attribute vec3 aO, aD; attribute float aL, aT0; uniform float uRed, uOn;`, move: COPIAS_MOVE, uniforms: { uRed: { value: 0 }, uOn: { value: 0 } }, extra: copiasD.extra }),
      root,
      4,
    );
    copias.points.position.copy(S);
    copias.u.uFuente.value = 1;
    // (Where the camera ends up at each, so the spark waits in sight: among the probes, in the
    // cluster where its call starts, among the dead collectors; and beside the single star.)
    const dirDe = (az: number, el: number) => V(Math.cos(D2R(el)) * Math.sin(D2R(az)), Math.sin(D2R(el)), Math.cos(D2R(el)) * Math.cos(D2R(az)));
    const paradas = [
      burb.hoja.clone(),
      ZOO.clone().addScaledVector(dirDe(AZ_ALBA + 40, 9), R_ZOO * 3.4),
      CALLAN.clone().addScaledVector(ORIGEN_LLAMADA, R_CALLAN),
      FILTRO.clone().addScaledVector(dirDe(AZ_ALBA + 160 + 98, 5), R_FILTRO * 1.9).add(V(0, R_FILTRO * 0.2, 0)),
      UNA.clone().add(V(-0.0006, 0, 0)),
    ];
    const caminoCh: Camino = (sv, out) => {
      if (sv <= 1) return burb.rama(sv, out);
      const i = Math.min(Math.floor(sv - 1), paradas.length - 2);
      const t = THREE.MathUtils.smoothstep(sv - 1 - i, 0, 1);
      return out.copy(paradas[i]).lerp(paradas[i + 1], t);
    };
    tl.set({ ...Cn(Q), ox: 0, oy: 0, oz: 0, az: 120, el: 10, ld: LOG0 + 0.5, yaw: 90, pitch: -90, roll: 0, fov: 40, bur: 0, ir: 0, gal: 1, zoo: 0, callan: 0, calla: 0, filtro: 0, una: 0, ch: 0, lw: 0, tit: 0, mapa: 0, nombres: 0, llama: 0 });

    // Copied from star to star: the camera rides one branch, the stars it touches turn ours.
    // From star to star: the probes copy themselves at each star they reach and go on to the ones
    // around it, a network that branches like an organism. The camera rides one branch, then lets
    // go and pulls back at the very pace of the front (both in logarithm): at every scale, from a
    // few light years to thousands, the same network growing.
    tl.label('burbuja').caption(15.0, 'La burbuja', 'Sondas que se copian en cada estrella que tocan. Aunque vayan lento, el movimiento de las estrellas las reparte.');
    tl.with(1.2, { lw: 1 });
    tl.with(14.6, { ch: 1 }, EASE.sine);
    tl.with(14.6, { ld: LOG0 + DECADAS + 0.5 }, EASE.sine);
    luego(1.0, 1.4, { ...Cn(S) });
    // (the new pieces come up only once the relay is done)
    luego(1.8, 2.4, { lw: 0 });
    luego(2.6, 1.0, { copias: 1 });
    tl.to(15.0, { az: 172, el: 30 });

    // The reveal: far back, the bubble spreads over the galaxy.
    tl.label('freno').caption(7.8, 'La luz pone el freno', 'La luz tarda cien mil años en cruzar la galaxia. Desde aquí, el tiempo se mide en millones de años.');
    luego(1.6, 4.2, { bur: 34 });
    luego(1.0, 3.0, { copias: 0 });
    luego(2.2, 2.6, { ...Cn(S.clone().lerp(G, 0.45)) });
    luego(3.4, 1.6, { mapa: 1 });
    luego(4.4, 1.4, { nombres: 1 });
    tl.to(5.8, { ld: 1.7, el: 40, az: 180 });
    tl.to(2.0, { az: 186 });

    tl.label('tipo').caption(5.4, 'Tipo III', 'Toda la luz de una galaxia: tipo III. Se vería oscura y tibia. Ninguna de las que revisamos es así.');
    luego(0.4, 1.0, { nombres: 0 });
    luego(3.4, 1.4, { mapa: 0 });
    tl.with(2.4, { bur: 120 });
    luego(2.6, 2.2, { ir: 1 });
    // (the moment: as it goes dark and warm the camera sweeps down round it to look across its disc,
    // a dimmed, smouldering spiral seen low, before going down into it)
    tl.to(5.4, { ...Cn(G), ld: 1.92, el: 16, az: 222 });

    // Down into the disc: three encounters, each a place of its own. The camera goes with the spark,
    // stays, and looks. All the way to the edge it turns one way round (the encounters follow on in
    // azimuth), and the galaxy behind them dims, so the bulge seen edge-on is no burnt white band.
    const cerca = (a: number, ref: number) => a + 360 * Math.round((ref - a) / 360);

    // A living world, its own seas and lands, and round it a still lattice of probes that never
    // touch it. The camera comes in on its night side, its star right behind it: a dark disc ringed
    // by its air; turning, the star rises over its limb, a dawn on a world we leave in peace. The
    // spark takes its place among the probes.
    tl.label('zoo').caption(10.4, 'El zoológico', '¿Por qué no vemos a nadie? Quizá alguien nos vio y nos dejó tranquilos. Al pasar, nosotros también dejamos un mundo vivo en paz.');
    tl.with(1.2, { ...Cn(ZOO), ir: 0.35 });
    luego(0.6, 2.2, { zoo: 1 });
    luego(0.4, 3.4, { ch: 2 });
    luego(0.2, 2.4, { fondo: 1, bulbo: 1, hb: 1 });
    tl.to(3.2, { ld: Math.log10(R_ZOO * 9), el: 8, az: AZ_ALBA - 9 });
    tl.to(3.4, { ld: Math.log10(R_ZOO * 4.2), el: 7, az: AZ_ALBA + 6, fov: 38 });
    tl.to(3.8, { ld: Math.log10(R_ZOO * 4.0), el: 6, az: AZ_ALBA + 44 });

    // A crowded cluster of old stars, a ball of lights. From its edge the spark calls; the call
    // sweeps through it, and every star it passes trembles and goes out, until the ball is a dark
    // ghost of embers. The camera goes in among them as they go quiet.
    tl.label('callan').caption(11.0, 'Los que callan', 'O callan a propósito, porque hacerse oír puede ser peligroso.');
    luego(1.2, 1.2, { zoo: 0 });
    // (from one encounter to the next: out first, then across, then in; never across while close;
    // backing away from the living world, its cage of probes round it a moment)
    luego(1.6, 1.4, { ...Cn(CALLAN) });
    luego(1.8, 1.4, { callan: 1 });
    luego(0.9, 2.6, { ch: 3 });
    luego(6.0, 4.6, { llama: 1 });
    tl.to(1.2, { ld: Math.log10(R_ZOO * 13), el: 12, az: AZ_ALBA + 56 });
    tl.to(1.4, { ld: 0.4, el: 18, az: AZ_ALBA + 66 });
    tl.to(2.2, { ld: Math.log10(R_CALLAN * 4.2), el: 14, az: AZ_ALBA + 80 });
    // (and into the ball as the call sweeps it: its stars going out round the camera, not only seen)
    tl.to(3.0, { ld: Math.log10(R_CALLAN * 1.6), el: 10, az: AZ_ALBA + 110, fov: 48 });
    tl.to(3.2, { ld: Math.log10(R_CALLAN * 0.55), el: 5, az: AZ_ALBA + 150, fov: 54 });

    // A swarm that died, round a cold red star: the camera goes in through its wreck, broken
    // collectors tumbling past close enough to touch, black against the star or catching its dull
    // light. The spark flickers, as if it too would go out.
    const AZ_FIL = AZ_ALBA + 158;
    tl.label('filtro').caption(12.0, 'El Gran Filtro', 'O casi todas se apagan antes de llegar tan lejos, como este enjambre muerto. ¿Ese filtro quedó atrás, o nos espera?');
    luego(0.4, 1.2, { callan: 0 });
    luego(1.2, 1.4, { ...Cn(FILTRO) });
    luego(1.6, 1.6, { filtro: 1 });
    luego(0.6, 2.8, { ch: 4 });
    luego(4.4, 2.0, { tit: 1 });
    tl.to(2.2, { ld: 0.45, el: 16, az: AZ_FIL });
    tl.to(2.6, { ld: Math.log10(R_FILTRO * 9), el: 12, az: AZ_FIL + 18 });
    tl.to(3.6, { ld: Math.log10(R_FILTRO * 4.0), el: 7, az: AZ_FIL + 48, fov: 50 });
    tl.to(3.6, { ld: Math.log10(R_FILTRO * 2.9), el: 3, az: AZ_FIL + 92 });

    // The edge. Up out of the disc as the spark crosses it: the whole galaxy below, ours, every
    // star of it teal; then down to its rim, the galaxy behind the single star there; and round, to
    // face out: black, and that one star. (Its last two stretches as they were: the act after takes
    // up from there; one turn further on, the same place.)
    const azFuera = cerca(angulos(UNA.clone().sub(G).setY(0)).az, 399) + 360;
    const MEDIO = UNA.clone().lerp(G, 0.5);
    tl.label('borde').caption(13.6, 'El borde y el silencio', 'Llegamos al borde, y vuelve la pregunta del principio: ¿dónde están todos? Quizá se fueron hacia adentro.');
    luego(0.4, 1.2, { filtro: 0 });
    // (the galaxy whole, and then edge-on from its rim, dimmer than it was: from the rim its stars
    // pile up into a burnt band; it is back to its light by the last stretch, turned away from it)
    luego(0.2, 2.8, { fondo: 0.15 });
    luego(5.0, 2.4, { fondo: 0.8 });
    luego(7.6, 3.0, { fondo: 0 });
    // (the bubble round the Sun, a bright knot now that the whole galaxy is ours, fades; the bulge and
    // the haze stay dim for the reveal, and are back by the last stretch)
    luego(7.4, 3.2, { hb: 0, bulbo: 0 });
    luego(1.0, 2.6, { ...Cn(MEDIO) });
    luego(3.8, 2.4, { ...Cn(UNA) });
    luego(3.0, 1.4, { una: 1 });
    luego(0.2, 0.6, { tit: 0 });
    luego(0.8, 4.8, { ch: 5 });
    luego(0.4, 2.4, { ir: 0 });
    tl.to(2.0, { ld: 0.6, el: 24, az: AZ_FIL + 118 });
    tl.to(3.0, { ld: 2.1, el: 42, az: azFuera - 46, fov: 46 });
    tl.to(2.6, { ld: 0.95, el: 20, az: azFuera + 8 });
    tl.to(3.4, { ld: -0.4, el: 6, az: azFuera + 150 });
    tl.to(2.6, { ld: Math.log10(0.0021), el: 4, az: azFuera + 180, fov: 44 });

    // ---------------------------------------------------------------- «La burbuja» as a ride
    // After the relay (as it was up to PB), the spark hops: three stars, each farther and sooner,
    // each touched turning ours with a burst of copies to the stars round it (and from those, more);
    // the camera rides behind it. Then it lifts and draws back as the front runs on through the
    // disc, into the reveal ('freno', as it was). The front's clock (`ch`) is the act's own up to PB
    // and from the end of the bubble on; between, it reaches each star as the spark does.
    const PB = 2.5;
    const P_ROJO = 14.6;
    const K_I = [1008, 1501, 2484];
    const P_TOCA = [4.2, 5.6, 6.7];
    const KR = K_I.map((i) => ramaB.estrellas[i].p.clone());
    const K = KR.map((k) => k.clone().add(S));
    const tK = K_I.map((i) => ramaB.estrellas[i].t);
    const ch25 = tl.get('ch', PB);
    const dch25 = (tl.get('ch', PB) - tl.get('ch', PB - 0.002)) / 0.002;
    const chCurva = curva([[PB, ch25], [P_TOCA[0], tK[0]], [P_TOCA[1], tK[1]], [P_TOCA[2], tK[2]], [9.6, 0.72], [P_ROJO, 1]], dch25, 0);
    const chDe = (q: number) => (q <= PB || q >= P_ROJO ? tl.get('ch', q) : chCurva(q));
    const dchDe = (q: number) => (chDe(q + 0.002) - chDe(q - 0.002)) / 0.004;
    /** The beat the front's clock reaches c (between PB and the end of the bubble). */
    const pDe = (c: number) => {
      let a = PB;
      let b = P_ROJO;
      if (c >= 1) return P_ROJO;
      for (let i = 0; i < 40; i++) {
        const m = (a + b) / 2;
        if (chDe(m) < c) a = m;
        else b = m;
      }
      return (a + b) / 2;
    };
    // The spark's way in beats: as it was up to PB; then from star to star, slowing to touch each;
    // after the last, on outwards with the front, taking up its own branch again by P_UNE.
    const K0 = caminoCh(ch25, V());
    const v0 = K0.clone().sub(caminoCh(chDe(PB - 0.01), V())).divideScalar(0.01);
    const D_SUELTA = 2.2;
    const dirK3 = KR[2].clone().normalize();
    const escK3 = KR[2].length() / frente(tK[2]);
    const P_UNE = 12.0;
    const tmpU = V();
    const arcos = [0, 1].map((i) => {
      const L = K[i].distanceTo(K[i + 1]);
      const lado = K[i + 1].clone().sub(K[i]).cross(Y).normalize();
      return Y.clone().multiplyScalar(0.1 * L).addScaledVector(lado, 0.07 * L);
    });
    const ruta: Camino = (q, out) => {
      if (q <= PB) return caminoCh(chDe(q), out);
      if (q < P_TOCA[0]) {
        const h = P_TOCA[0] - PB;
        const u = (q - PB) / h;
        const u2 = u * u;
        const u3 = u2 * u;
        return out.copy(K0).multiplyScalar(2 * u3 - 3 * u2 + 1).addScaledVector(v0, (u3 - 2 * u2 + u) * h).addScaledVector(K[0], -2 * u3 + 3 * u2);
      }
      if (q < P_TOCA[2]) {
        const i = q < P_TOCA[1] ? 0 : 1;
        const u = (q - P_TOCA[i]) / (P_TOCA[i + 1] - P_TOCA[i]);
        const e = u * u * u * (u * (u * 6 - 15) + 10);
        return out.copy(K[i]).lerp(K[i + 1], e).addScaledVector(arcos[i], Math.sin(Math.PI * e));
      }
      // (after the last, on outwards the way it went, at the front's pace; it takes up its own branch
      // again only once the camera is far back, where that is a drift of a few pixels)
      const u = Math.min(1, (q - P_TOCA[2]) / D_SUELTA);
      const phi = u < 1 ? P_TOCA[2] + D_SUELTA * (2 * u * u - u * u * u) : q;
      out.copy(dirK3).multiplyScalar(escK3 * frente(chDe(phi))).add(S);
      const w = THREE.MathUtils.smoothstep(q, P_UNE - 2.0, P_UNE);
      return w > 0 ? out.lerp(caminoCh(chDe(q), tmpU), w) : out;
    };
    /** Until when the spark goes by the beat (by then that way is its branch again, wake and all). */
    const P_SUELTA = P_UNE + 0.8;

    // The touched stars, and the copies: from each, to the stars about it it will reach first (the
    // front's own), arriving as those turn ours; and from each of those, three more.
    const tocadasD = tocadasDatos(KR.map((k, i) => ({ p: k, pt: P_TOCA[i], r: k.length() * 0.03 })));
    const tocadas = add(
      materia(tocadasD.data, {
        pre: /* glsl */ `attribute float aPt; uniform float uP, uOn; uniform vec3 uTeal;`,
        move: TOCADAS_MOVE,
        uniforms: { uP: { value: 0 }, uOn: { value: 0 }, uTeal: { value: TEAL.clone() } },
        extra: tocadasD.extra,
      }),
      root,
      6,
    );
    tocadas.points.position.copy(S);
    tocadas.u.uFuente.value = 1;
    const vuelos: { de: THREE.Vector3; a: THREE.Vector3; p0: number; p1: number; luz: number }[] = [];
    const usadas = new Set<number>(K_I);
    const cercanas = (de: THREE.Vector3, t0: number, dt: number, dmax: number, n: number) => {
      const c: { i: number; d: number }[] = [];
      ramaB.estrellas.forEach((e, i) => {
        if (usadas.has(i) || e.t <= t0 + 0.004 || e.t > t0 + dt) return;
        const d = e.p.distanceTo(de);
        if (d < dmax) c.push({ i, d });
      });
      c.sort((a, b) => a.d - b.d);
      return c.slice(0, n).map((x) => {
        usadas.add(x.i);
        return x.i;
      });
    };
    KR.forEach((k, i) => {
      const L = i < 2 ? k.distanceTo(KR[i + 1]) : k.distanceTo(KR[1]) * 1.3;
      for (const j of cercanas(k, tK[i], 0.1, 2.4 * L, 26)) {
        const e = ramaB.estrellas[j];
        const p0 = P_TOCA[i];
        const p1 = THREE.MathUtils.clamp(pDe(e.t), p0 + 0.45, p0 + 1.6);
        vuelos.push({ de: k, a: e.p, p0, p1, luz: 1.3 });
        for (const j2 of cercanas(e.p, e.t, 0.07, 1.6 * e.p.distanceTo(k), 3)) {
          const e2 = ramaB.estrellas[j2];
          vuelos.push({ de: e.p, a: e2.p, p0: p1, p1: THREE.MathUtils.clamp(pDe(e2.t), p1 + 0.4, p1 + 1.4), luz: 0.6 });
        }
      }
    });
    const saltosD = saltosDatos(vuelos, TEAL);
    const saltos = add(
      materia(saltosD.data, { pre: /* glsl */ `attribute vec3 aO, aA; attribute vec2 aP; uniform float uP, uOn;`, move: SALTOS_MOVE, post: SALTOS_POST, uniforms: { uP: { value: 0 }, uOn: { value: 0 } }, extra: saltosD.extra }),
      root,
      5,
    );
    saltos.points.position.copy(S);
    saltos.u.uFuente.value = 1;

    // The camera: riding behind the spark from star to star (B); then the rig again, its own way up
    // and back (C), until it is the act's own at the reveal.
    // (C: looking at a point on the front ahead, from behind and above it; the point falls back to the
    // Sun and the camera draws back past it, from a few hundredths of the front's radius to three
    // times it: at the end, the act's own shot)
    const frDe = (q: number) => frente(chDe(q));
    const kC = curva([[6.0, -0.3], [7.8, 0.0], [10.2, 0.32], [P_ROJO, 0.5]], 0, 0);
    const cC = curva([[6.0, 1.0], [7.0, 0.9], [9.6, 0]], 0, 0);
    const azC = curva([[6.0, 161.5], [P_ROJO, tl.get('az', P_ROJO)]], 0, (tl.get('az', P_ROJO) - tl.get('az', P_ROJO - 0.01)) / 0.01);
    const elC = curva([[6.0, 14], [P_ROJO, tl.get('el', P_ROJO)]], 0, (tl.get('el', P_ROJO) - tl.get('el', P_ROJO - 0.01)) / 0.01);
    const cenC = V();
    const propia = (n: string, q: number) => {
      if (n === 'az') return azC(q);
      if (n === 'el') return elC(q);
      if (n === 'ld') return Math.log10(frDe(q)) + kC(q);
      cenC.copy(dirK3).multiplyScalar(escK3 * frDe(q) * Math.max(0, cC(q))).add(S);
      return n === 'cx' ? cenC.x : n === 'cy' ? cenC.y : cenC.z;
    };
    const PROPIAS = new Set(['cx', 'cy', 'cz', 'az', 'el', 'ld']);
    const sgDe = (q: number) => THREE.MathUtils.smoothstep(q, PB, PB + 1.3) * (1 - THREE.MathUtils.smoothstep(q, 7.2, 9.4));
    const krDe = (q: number) => THREE.MathUtils.smoothstep(q, 5.0, 6.2) * (1 - THREE.MathUtils.smoothstep(q, 13.6, P_ROJO));
    const tlA = {
      get: (n: string, q: number) => {
        const v = tl.get(n, q);
        const w = PROPIAS.has(n) ? krDe(q) : 0;
        return w > 0 ? v + (propia(n, q) - v) * w : v;
      },
    } as unknown as Timeline;
    const tmB = toma(tl, 0);
    const qA = new THREE.Quaternion();
    const qB = new THREE.Quaternion();
    const mq = new THREE.Matrix4();
    const tmpL = V();
    const quatDe = (tt: Toma, out: THREE.Quaternion) => out.setFromRotationMatrix(mq.lookAt(tt.pos, tmpL.copy(tt.pos).add(tt.dir), tt.up));
    const hkDe = (q: number) => THREE.MathUtils.smoothstep(q, PB + 0.1, PB + 0.8) * (1 - THREE.MathUtils.smoothstep(q, 9.0, 11.5));

    const occZoo = new THREE.Vector4();
    const tmpO = V();
    const tmpS = V();
    const tm = toma(tl, 0);
    const tmR = toma(tl, 0);
    const camFin = toma(tl, tl.length);
    // (the spark is lit the whole act)
    tl.keyAt(0, { on: 1 });
    // The shots (chasis/toma.ts), and the spark's way in from the ship (the seam's picture, in this
    // act's units: where the sail's act leaves it).
    escribir(tl, TOMA_GALAXIA);
    const entra = V(6.148131711708195, 0.020544473336365457, 25.260604989285923).sub(caminoCh(chDe(0), V()));
    return {
      id: 'galaxia',
      tl,
      grupo: root as THREE.Group,
      listo: vivo.listo,
      costura: 'mundo',
      cerca: 1e-8,
      lejos: 2000,
      film: { strength: 0.7, radius: 0.65, threshold: 0.4, exposure: 1.1 },
      presencias: ['copias', 'zoo', 'callan', 'filtro', 'fondo', 'bulbo', 'hb', 'una', 'llama', 'mapa', 'nombres'],
      entrada: { pos: Q.clone(), escala: D0 / 9 },
      salida: { pos: UNA.clone(), escala: camFin.pos.distanceTo(UNA) / 200 },
      relevoMaxPx: 3,
      // The spark: hopping from star to star in the bubble (its way by the beat), then on through the
      // galaxy from encounter to encounter.
      chispa(p, out) {
        if (p > PB && p < P_SUELTA) ruta(p, out);
        else caminoCh(chDe(p), out);
        // (it comes in where the sail's act left it, on the ship, and joins its own way in two beats)
        if (p < 2) out.addScaledVector(entra, 1 - THREE.MathUtils.smoothstep(p, 0, 2));
        return true;
      },
      camara(p, ch, out) {
        plano(tl, p, ch, out);
      },
      escalera: false,
      cuenta(p) {
        // The power: the light of every star reached (two at first, the whole galaxy at the end).
        const n = Math.max(2, estrellasEn(alcanceR));
        const c: Cuenta = p < tl.at('tipo') + 2.4 ? potencia(Math.min(37, 27.4 + Math.log10(n / 2) * 0.85)) : potencia(37);
        // How far we reach: the stars inside the bubble, then the whole galaxy.
        const toda = tl.at('tipo') + 2.4;
        c.alcance = p < toda ? cuantas(n, 'estrella', 'estrellas') : 'la galaxia';
        c.nuevo = p >= toda ? 1 - THREE.MathUtils.smoothstep(p, toda, toda + 1.8) : 0;
        return c;
      },
      placa(g, f) {
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
      },
      // The years: the bubble's own, at an even twentieth of the speed of light (stopping at each
      // star to copy itself); then the encounters, deep in the galaxy's time.
      anio(p) {
        const burbuja = 2500 + (alcanceR * 830) / 0.05;
        if (p < tl.at('zoo')) return burbuja;
        return anioEn(p, [[tl.at('zoo'), burbuja], [tl.length, 3e6]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'V · La galaxia', name: c.name, fact: c.fact } : null;
      },
      update(f: FrameActo) {
        const p = f.p;
        const t = f.time;
        const camera = f.camera;
        const ch = chDe(p);
        const hk = p > PB && p < P_ROJO ? hkDe(p) : 0;
        tocadas.u.uP.value = p;
        tocadas.u.uOn.value = hk;
        tocadas.points.visible = hk > 0.001;
        saltos.u.uP.value = p;
        saltos.u.uOn.value = hk;
        saltos.points.visible = hk > 0.001;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        const red = Math.min(1, Math.max(0, ch));
        estrellas.u.uBur.value = Math.max(tl.get('bur', p), frente(red));
        burb.estrellas.u.uRed.value = red;
        burb.hilos.u.uRed.value = red;
        copias.u.uRed.value = red;
        // (during the hops only the spark's own bursts; the rest come up as the camera lifts)
        const copOn = tl.get('copias', p) * (p > PB && p < 15 ? THREE.MathUtils.smoothstep(p, 7.6, 9.4) : 1);
        copias.u.uOn.value = copOn;
        copias.points.visible = copias.u.uOn.value > 0.001;
        burb.hilos.u.uOn.value = 1 - 0.85 * tl.get('ir', p);
        // The reach counts from where the spark has been (the bubble's own edge once it spreads).
        alcanceR = Math.max(tl.get('bur', p), frente(red));
        estrellas.u.uIR.value = tl.get('ir', p);
        estrellas.u.uCamG.value.copy(camera.position);
        polvo.u.uCamG.value.copy(camera.position);
        const px = (n: number, en: THREE.Vector3) => (n * camera.position.distanceTo(en)) / f.focal;
        nave.u.uSizeUnit.value = px(6, Q);
        nave.u.uGain.value = 0;
        una.u.uSizeUnit.value = px(7, UNA);
        una.u.uGain.value = tl.get('una', p);
        // The living world: lit by its star, turning; seen from the camera (both in its radii).
        const zooOn = tl.get('zoo', p);
        zooG.visible = zooOn > 0.001;
        if (zooG.visible) vivo.update({ sol: SOL_ZOO, camara: camera.position.clone().sub(ZOO).divideScalar(R_ZOO), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: zooOn });
        vigias.u.uOn.value = zooOn;
        // (the world hides what is behind it: its star before the dawn, the probes and stars beyond it)
        if (zooG.visible) {
          zooG.getWorldPosition(tmpO).applyMatrix4(camera.matrixWorldInverse);
          occZoo.set(tmpO.x, tmpO.y, tmpO.z, zooG.getWorldScale(tmpS).x * 0.995);
        } else occZoo.set(0, 0, 0, 0);
        for (const n of [solZoo, vigias, estrellas, burb.estrellas, burb.hilos, ...(f.propio ? [f.nubeChispa] : [])]) n.u.uOcc.value.copy(occZoo);
        // (dimmed while an encounter holds the frame; between them, as the spark flies on, the disc's
        // stars come back round the camera instead of a black stretch)
        const encuentro = Math.max(tl.get('zoo', p), tl.get('callan', p), tl.get('filtro', p));
        estrellas.u.uGal.value = 1 - 0.8 * tl.get('fondo', p) * (0.35 + 0.65 * encuentro) - 0.1 * tl.get('filtro', p);
        const bulbo = tl.get('bulbo', p);
        estrellas.u.uBulbo.value = bulbo;
        const hb = tl.get('hb', p);
        burb.estrellas.u.uOn.value = 1 - hb;
        burb.hilos.u.uOn.value *= (1 - hb) * (1 + 1.8 * copOn);
        polvo.u.uGal.value = 1 - Math.max(zooOn, tl.get('filtro', p));
        brillo.u.uGal.value = estrellas.u.uGal.value * (1 - tl.get('ir', p)) * (1 - Math.max(zooOn, tl.get('filtro', p))) * (1 - 0.75 * bulbo);
        // (its star flares as it clears the limb: the dawn)
        let alba = 0;
        if (zooG.visible) {
          const dPl = camera.position.distanceTo(ZOO);
          const aPl = Math.asin(Math.min(1, R_ZOO / dPl));
          const aSt = tmpO.copy(solZoo.points.position).sub(camera.position).angleTo(tmpS.copy(ZOO).sub(camera.position));
          // (the dawn grows as the star clears the limb, not in one step: a small point first, then the flare)
          const asoma = THREE.MathUtils.smoothstep(aSt, aPl - 0.002, aPl + 0.02);
          alba = asoma * Math.exp(-Math.max(0, aSt - aPl - 0.02) / 0.06);
        }
        solZoo.u.uGain.value = zooOn * (1 + 4 * alba);
        solZoo.u.uSizeUnit.value = px(9 + 16 * alba, solZoo.points.position);
        const callOn = tl.get('callan', p);
        callan.u.uOn.value = callOn;
        callan.u.uLlama.value = tl.get('llama', p);
        llamada.u.uLlama.value = tl.get('llama', p) * callOn;
        const filOn = tl.get('filtro', p);
        roja.u.uOn.value = filOn;
        muertos.u.uOn.value = filOn;
        restos.u.uOn.value = filOn;
        restos.u.uTime.value = t;
        restos.mesh.visible = filOn > 0.001;
        if (restos.mesh.visible) filtroG.worldToLocal(restos.u.uCam.value.copy(camera.position));
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        tocadas.u.uMaxPx.value = 14 * f.dpr;
        saltos.u.uMinPx.value = 2.4 * f.dpr;
        enfocarMarcas(aroSol, f.dpr, tl.get('mapa', p));
        estrellas.u.uMaxPx.value = 3.2 * f.dpr;
        vigias.u.uSizeUnit.value = R_ZOO;
        callan.u.uSizeUnit.value = R_CALLAN;
        llamada.u.uSizeUnit.value = R_CALLAN;
        callan.u.uMaxPx.value = 14 * f.dpr;
        roja.u.uSizeUnit.value = R_FILTRO;
        muertos.u.uSizeUnit.value = R_FILTRO;
        muertos.u.uMaxPx.value = 24 * f.dpr;
        void Y;
      },
    };
  },
};
