import { tr } from '../../estudios/idioma';
import * as THREE from 'three';
import { Timeline } from '../../estudios/timeline';
import { enfocar, materia, materiaBuilder, type Nube } from '../../estudios/motor/materia';
import { redCosmica } from '../../estudios/comun';
import { brillosGalaxias, formaGalaxia, type FormaGalaxia } from '../../estudios/galaxias';
import { gauss } from '../../estudios/motor/math';
import { FONT, ink, type Cuenta, type Rotulo } from '../../estudios/placa';
import { cuantas, enfocarMarcas, marcas, nombres, type Nombre } from '../../estudios/revelar';
import { TEAL, potencia, anioEn } from '../../estudios/remake';
import { toma } from '../../estudios/rig';
import { crearChispa, montar, type Camino } from '../../estudios/chispa';
import { escribir, toma as plano } from '../toma';
import type { Acto, EscenaChasis, FrameActo } from '../tipos';
import { COSTURA_MOVE, capaLuzSegura, costuraDatos, espiralHuida } from '../../estudios/momentos-cosmos';

/**
 * Scene 20 of ESCALETA.md, «Seis horas» (GUION.md, moments 47–51).
 *
 * The thinking network of scene 19 moves off and its knots become galaxies: the cosmic web. From
 * ours, thousands of threads of teal go out to every galaxy we can reach, in six hours. The web
 * swells (dark energy): the galaxies past the horizon redden and go. Other bubbles, other colours,
 * grow and touch ours; each keeps its share of the sky. All we can reach, type IV; and then what we
 * reach stops growing and empties, until a golden point is left: the last black hole.
 *
 * Units: the web is drawn in a ball of radius 1.6; our horizon (what we can reach) is HOR.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const HOR = 0.8;
/** Round from where the camera comes in, the way the probe it rides goes out (the far side, a little on). */
const AZ_LEJOS = 118;
const OTRAS = [
  { c: V(1.15, 0.25, -0.5), col: new THREE.Color(1.0, 0.7, 0.32) },
  { c: V(-0.85, -0.4, 0.95), col: new THREE.Color(1.0, 0.45, 0.68) },
  { c: V(-0.4, 0.9, -1.0), col: new THREE.Color(0.78, 0.62, 1.0) },
];

/** The act's shot: p, az, el, ld, lw, mx, my, fov, roll (viaje.transcribir, then by hand). */
const TOMA_COSMOS: number[][] = [
  [0, 80, 20, 0.575, 0, 0, -0.01, 40, 0],
  [1.2, 82.32, 20.31, 0.55, 0, 0, 0, 40, 0],
  [2.4, 88.74, 21.53, 0.466, 0.029, -0.25, -0.34, 40, 0.04],
  [3.6, 100.04, 27.08, 0.063, 0.33, -1.21, -3.2, 40, 0.5],
  [4.8, 112.5, 33.54, -0.796, 0.814, -0.02, -6.28, 40, 0.51],
  [6, 117.74, 33.9, -1.183, 0.992, 0.02, -6.6, 40, 0.03],
  [7.2, 118, 32.66, -1.158, 1, 0, -6, 40, 0],
  [8.4, 118.14, 30.24, -1.051, 0.999, -0.09, -4.93, 40, 0],
  [9.6, 142.15, 36.94, -1.1, 0.936, -17.2, -17.78, 40, -0.26],
  [10.8, 234.15, 37.18, -1.051, 0.637, -91.51, -41.06, 40, -1.28],
  [12, 175.82, 29.1, -0.338, 0.238, -26.81, -12.42, 40, -1.18],
  [13.2, 172.44, 3.62, 0.243, 0.023, -1.48, -0.32, 40, -0.12],
  [14.4, 188.62, -11.86, 0.33, 0, 0.02, -0.02, 40, 0.01],
  [15.6, 196.4, -17.95, 0.218, 0, 0, 0, 40, 0],
  [16.8, 200.43, -21.46, 0.075, 0, 0, 0, 40, 0],
  [18, 202.61, -23.68, -0.043, 0, -0.07, 0.19, 40, 0],
  [19.2, 218.59, -36.15, -0.146, 0, -3.49, 15.69, 40, -0.03],
  [20.4, 352.15, -57.67, -0.319, 0, 37.86, 70.59, 40, -1.37],
  [21.6, 428.94, -30.34, -0.26, 0, -52.19, 69.42, 40, -7.38],
  [22.8, 437.9, -20.17, -0.224, 0, -84.36, 64.14, 40, -30.25],
  [24, 440.9, -24.95, -0.227, 0, -57.34, 78.17, 40, -7.69],
  [25.2, 442.26, -40.87, -0.225, 0, -110.72, 75.98, 40, -0.07],
  [26.4, 444.04, -48.65, -0.216, 0, -74.78, 65.38, 40, -0.14],
  [27.6, 446.47, -47.14, -0.221, 0, -11.64, 64.11, 40, -5.63],
  [28.8, 479.18, -4.89, -0.114, 0, 67.16, 15.07, 40, -7.55],
  [30, 553, 28.35, 0.497, 0, 9.46, -3.2, 40, -0.44],
  [31.2, 565.43, 26.07, 0.661, 0, 0.07, -0.06, 40, 0],
  [32.4, 566.33, 26, 0.663, 0, 0, 0, 40, 0],
  [33.6, 567.63, 25.92, 0.661, 0, -0.03, 0.01, 40, 0],
  [34.8, 570.72, 24.65, 0.616, 0, 0.01, -0.01, 40, 0],
  [36, 576.7, 21.53, 0.469, 0, 0.01, 0, 40, 0],
  [37.2, 584.01, 19.05, 0.117, 0, 0.01, 0, 40, 0],
  [38.4, 592.64, 17.27, -0.589, 0, 0.01, 0, 40, 0],
  [39.6, 598.38, 16.27, -1.137, 0, 0, 0, 40, 0],
  [40, 600, 16, -1.301, 0, 0, 0, 40, 0]
];

/** Among the bubbles: p, az, el, ld, lw, mx, my, fov, roll, cx, cy, cz (what it looks at). */
const TOMA_COSMOS_MIRA: number[][] = [
  [18.0, 202.71, -23.8, -0.058, 0, 0, 0, 40.0, 0.0, 0.50363, 0.10945, -0.21895],
  [18.3, 202.95, -23.99, -0.07, 0, 0, 0, 40.0, 0.01, 0.50331, 0.10938, -0.21883],
  [18.6, 203.08, -23.94, -0.07, 0, 0, 0, 40.0, -0.01, 0.50397, 0.10951, -0.2191],
  [18.9, 203.19, -23.73, -0.067, 0, 0, 0, 40.0, -0.0, 0.50309, 0.10959, -0.22002],
  [19.2, 203.17, -22.96, -0.061, 0, 0, 0, 40.0, 0.04, 0.51596, 0.08953, -0.15259],
  [19.5, 202.97, -21.09, -0.052, 0, 0, 0, 40.0, 0.14, 0.57119, 0.01802, 0.11908],
  [19.8, 203.47, -19.6, -0.041, 0, 0, 0, 40.0, -0.01, 0.64806, -0.03493, 0.43464],
  [20.1, 205.8, -19.94, -0.028, 0, 0, 0, 40.0, -0.5, 0.75116, -0.026, 0.66685],
  [20.4, 211.0, -23.98, -0.013, 0, 0, 0, 40.0, -1.33, 0.87703, 0.0656, 0.7669],
  [20.7, 219.83, -31.75, 0.004, 0, 0, 0, 40.0, -2.3, 1.00948, 0.2263, 0.73702],
  [21.0, 234.18, -42.24, 0.023, 0, 0, 0, 40.0, -2.97, 1.11959, 0.4263, 0.56855],
  [21.3, 256.13, -51.41, 0.044, 0, 0, 0, 40.0, -2.38, 1.1748, 0.60065, 0.29166],
  [21.6, 280.95, -54.67, 0.066, 0, 0, 0, 40.0, -0.69, 1.17873, 0.70102, 0.00375],
  [21.9, 294.64, -51.85, 0.089, 0, 0, 0, 40.0, -3.28, 1.21593, 0.7287, -0.18415],
  [22.2, 309.85, -40.8, 0.114, 0, 0, 0, 40.0, -22.14, 1.28969, 0.62424, -0.50015],
  [22.5, 327.22, -21.11, 0.139, 0, 0, 0, 40.0, -34.4, 1.24017, 0.28541, -0.95541],
  [22.8, 350.88, 8.4, 0.166, 0, 0, 0, 40.0, -41.72, 0.78321, -0.41127, -1.3122],
  [23.1, 371.33, 31.73, 0.193, 0, 0, 0, 40.0, -40.48, 0.3002, -1.00755, -1.19056],
  [23.4, 390.87, 45.82, 0.221, 0, 0, 0, 40.0, -31.09, -0.03236, -1.37926, -0.89384],
  [23.7, 424.24, 57.34, 0.249, 0, 0, 0, 40.0, -3.85, -0.30723, -1.69442, -0.32452],
  [24.0, 437.03, 58.5, 0.277, 0, 0, 0, 40.0, -0.0, -0.42655, -1.8454, -0.13884],
  [24.3, 438.3, 58.46, 0.306, 0, 0, 0, 40.0, 0.0, -0.52289, -1.99604, -0.13805],
  [24.6, 437.41, 58.23, 0.334, 0, 0, 0, 40.0, 0.02, -0.6244, -2.15473, -0.17725],
  [24.9, 433.62, 57.58, 0.362, 0, 0, 0, 40.0, 0.06, -0.7271, -2.30896, -0.28288],
  [25.2, 427.08, 55.64, 0.39, 0, 0, 0, 40.0, -0.08, -0.8407, -2.42825, -0.47932],
  [25.5, 418.02, 50.86, 0.417, 0, 0, 0, 40.0, -0.06, -0.98005, -2.45513, -0.81836],
  [25.8, 410.31, 42.25, 0.444, 0, 0, 0, 40.0, -0.04, -1.17396, -2.31304, -1.26317],
  [26.1, 406.91, 32.52, 0.47, 0, 0, 0, 40.0, 0.03, -1.4144, -2.03993, -1.65328],
  [26.4, 406.31, 25.18, 0.495, 0, 0, 0, 40.0, -0.0, -1.64697, -1.78886, -1.91075],
  [26.7, 406.92, 19.8, 0.518, 0, 0, 0, 40.0, 0.0, -1.87502, -1.58198, -2.08315],
  [27.0, 407.49, 16.12, 0.541, 0, 0, 0, 40.0, 0.0, -2.07313, -1.43268, -2.2232],
  [27.3, 408.51, 14.64, 0.562, 0, 0, 0, 40.0, -0.23, -2.26021, -1.39157, -2.30971],
  [27.6, 415.39, 23.21, 0.582, 0, 0, 0, 40.0, -2.94, -2.50096, -1.97066, -1.96421],
  [27.9, 430.65, 40.43, 0.599, 0, 0, 0, 40.0, -9.56, -2.45853, -3.03093, -0.97325],
  [28.2, 462.21, 57.54, 0.615, 0, 0, 0, 40.0, -18.15, -1.74043, -3.89346, 0.49731],
  [28.5, 512.88, 59.87, 0.629, 0, 0, 0, 40.0, -14.51, -0.50773, -3.99548, 1.90764],
  [28.8, 544.46, 48.62, 0.641, 0, 0, 0, 40.0, -6.45, 0.72984, -3.36263, 2.77449],
  [29.1, 557.47, 37.3, 0.65, 0, 0, 0, 40.0, -2.68, 1.5212, -2.34757, 2.93362],
  [29.4, 563.01, 29.99, 0.657, 0, 0, 0, 40.0, -0.69, 1.64104, -1.27364, 2.40007],
  [29.7, 564.77, 26.88, 0.661, 0, 0, 0, 40.0, -0.06, 1.04884, -0.45858, 1.31882],
  [30.0, 565.04, 26.08, 0.663, 0, 0, 0, 40.0, 0.02, 0.22889, -0.06365, 0.26548],
  [30.3, 565.09, 26.0, 0.663, 0, 0, 0, 40.0, 0.0, -0.00251, -0.00025, 0.00217],
  [30.6, 565.2, 26.0, 0.663, 0, 0, 0, 40.0, 0.0, -0.00423, 0.00018, 0.00111],
  [30.9, 565.34, 26.0, 0.663, 0, 0, 0, 40.0, 0.0, -0.00032, 2e-05, 0.00026],
  [31.2, 565.49, 26.0, 0.663, 0, 0, 0, 40.0, -0.0, -0.00026, 3e-05, -0.00035]
];

export const cosmos: EscenaChasis = {
  id: 'cosmos',
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
    const web = new THREE.Group();
    web.scale.setScalar(1.6);
    root.add(web);
    const rc = redCosmica(241, 150, (t, out) => out.setRGB(0.82, 0.88, 1.0).multiplyScalar(1 - 0.3 * t), true);
    const otrasU = OTRAS.map((o) => o.c.clone().divideScalar(1.6));
    const red = add(
      materia(rc.data, {
        pre: /* glsl */ `
          uniform float uRed, uExp, uBur, uOtras, uVacia, uHor;
          uniform vec3 uTeal, uO1, uO2, uO3, uC1, uC2, uC3;
        `,
        move: /* glsl */ `
          // The swell: everything moves out; what crosses our horizon reddens and goes.
          p *= 1.0 + uExp * 1.4;
          float rr = length(p) * 1.6;
          float fuera = smoothstep(uHor * 0.9, uHor * 1.15, rr) * step(0.001, uExp);
          em = mix(em, vec3(0.9, 0.25, 0.12) * length(em), fuera * 0.8);
          em *= 1.0 - 0.85 * fuera * uExp;
          // Each galaxy belongs to the bubble that got there: the nearest, for its size (so where two
          // meet, each keeps its share of the sky); a glow along the line where they touch.
          float d0 = rr / max(uBur, 1e-4);
          float d1 = length(p * 1.6 - uO1 * 1.6) / max(uOtras, 1e-4);
          float d2 = length(p * 1.6 - uO2 * 1.6) / max(uOtras, 1e-4);
          float d3 = length(p * 1.6 - uO3 * 1.6) / max(uOtras, 1e-4);
          float m = min(min(d0, d1), min(d2, d3));
          float tomado = (1.0 - smoothstep(0.94, 1.0, m)) * step(0.25, fract(seed * 11.7));
          vec3 suyo = d0 <= m ? uTeal * (0.45 + 0.8 * length(em)) : d1 <= m ? uC1 * (0.35 + 0.7 * length(em)) : d2 <= m ? uC2 * (0.35 + 0.7 * length(em)) : uC3 * (0.35 + 0.7 * length(em));
          em = mix(em, suyo, tomado);
          // (the second nearest, almost as near: the border)
          float m2 = d0 <= m ? min(min(d1, d2), d3) : d1 <= m ? min(min(d0, d2), d3) : d2 <= m ? min(min(d0, d1), d3) : min(min(d0, d1), d2);
          em += vec3(1.0, 0.95, 0.85) * 0.9 * (1.0 - smoothstep(0.0, 0.06, m2 - m)) * step(m2, 1.0) * step(0.001, uOtras);
          float nuestro = d0 <= m ? tomado : 0.0;
          // What we can touch stops growing and empties.
          em *= 1.0 - uVacia * (1.0 - smoothstep(0.0, uHor, rr)) * smoothstep(0.03, 0.12, rr);
          em *= uRed;
        `,
        uniforms: {
          uRed: { value: 1 },
          uExp: { value: 0 },
          uBur: { value: 0 },
          uOtras: { value: 0 },
          uVacia: { value: 0 },
          uHor: { value: HOR },
          uTeal: { value: TEAL.clone() },
          uO1: { value: otrasU[0] },
          uO2: { value: otrasU[1] },
          uO3: { value: otrasU[2] },
          uC1: { value: OTRAS[0].col },
          uC2: { value: OTRAS[1].col },
          uC3: { value: OTRAS[2].col },
        },
      }),
      web,
    );
    red.u.uFuente.value = 0.5;

    // The probes: threads from ours to galaxies within reach (`aKind`: how far along).
    const sb = materiaBuilder(251);
    const pos = rc.data.position;
    const n = pos.length / 3;
    let hechos = 0;
    for (let guard = 0; hechos < 1400 && guard < 20000; guard++) {
      const k = Math.floor(sb.r() * n);
      const g = V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).multiplyScalar(1.6);
      const L = g.length();
      if (L > HOR || L < 0.05) continue;
      hechos++;
      const cuantos = Math.round(L * 90);
      for (let i = 0; i < cuantos; i++) {
        const t = sb.r();
        sb.push(g.x * t, g.y * t, g.z * t, TEAL, 0.0035, 0.35, { kind: t * L });
      }
    }
    const sondas = add(
      materia(sb.data(), {
        pre: /* glsl */ `uniform float uSondas, uExp, uVacia, uTenue;`,
        move: /* glsl */ `
          p *= 1.0 + uExp * 1.4;
          em *= step(aKind, uSondas) * (0.1 + 2.2 * smoothstep(uSondas - 0.05, uSondas, aKind)) * (1.0 - uVacia) * (1.0 - 0.92 * uTenue);
        `,
        uniforms: { uSondas: { value: 0 }, uExp: { value: 0 }, uVacia: { value: 0 }, uTenue: { value: 0 } },
      }),
      root,
      2,
    );
    sondas.u.uFuente.value = 0.5;

    // Our horizon: a sphere of faint points.
    const hb = materiaBuilder(257);
    for (let i = 0; i < 16000; i++) {
      const [x, y, z] = hb.onSphere();
      hb.push(x * HOR, y * HOR, z * HOR, new THREE.Color(0.55, 0.62, 0.8), 0.004, 0.12);
    }
    const horizonte = add(materia(hb.data(), { pre: `uniform float uOn;`, move: `em *= uOn;`, uniforms: { uOn: { value: 0 } } }), root, 1);
    const capaHor = capaLuzSegura(new THREE.Color(0.55, 0.62, 0.8), { cara: 0.03, grano: 0.3 });
    capaHor.mesh.scale.setScalar(HOR);
    root.add(capaHor.mesh);

    // Type IV up close: our share of the web is galaxies, every one ours. Spirals along our
    // filaments (where the web is once the swell has done), and a way among them for the camera.
    const PASA = 1 + 1.4;
    const gb = materiaBuilder(271);
    const gr = gb.r;
    const candidatas: THREE.Vector3[] = [];
    for (let k = 0; k < n && candidatas.length < 220; k += 23) {
      const g = V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).multiplyScalar(1.6 * PASA);
      if (g.length() < HOR * 0.9 && g.length() > 0.06 && candidatas.every((c) => c.distanceTo(g) > 0.045)) candidatas.push(g);
    }
    const blanco = new THREE.Color(0.9, 1.0, 0.96);
    // (each its own kind of galaxy, all ours: teal, warmer at their hearts)
    const col = new THREE.Color();
    const formas: { c: THREE.Vector3; f: FormaGalaxia }[] = [];
    for (const c of candidatas) {
      const f = formaGalaxia(gr, 420, 0.012, (x, y, z, t, luz, tinte) => {
        col.copy(TEAL).lerp(blanco, 0.3 * gr()).lerp(tinte, t < 0.05 ? 0.55 : 0.25);
        gb.push(c.x + x, c.y + y, c.z + z, col, t < 0.05 ? 0.0007 : 0.0006, luz * (t < 0.05 ? 1.6 : 1.7));
      });
      formas.push({ c, f });
    }
    // (and under their points, each galaxy's soft light)
    const brillos = brillosGalaxias(formas, TEAL);
    root.add(brillos.mesh);
    const cercanas = add(materia(gb.data(), { pre: `uniform float uOn;`, move: `em *= uOn;`, uniforms: { uOn: { value: 0 } } }), root, 3);
    cercanas.u.uFuente.value = 0.6;

    // The bubble that touches ours (the amber one): its galaxies on its side of the seam, each lit as
    // its front gets there; and the seam itself, a wall of light where the two fronts meet.
    const EJE = OTRAS[0].c.clone().normalize();
    const SEAM = 0.56;
    /** A bubble's galaxies, seen from afar: `n` of them inside radius `R` round `o`, on its side of the
     * seam, each lit as its front gets there (`uFrente`), those along the seam flaring (`uCostura`). */
    const nubeBurbuja = (seed: number, o: THREE.Vector3, R: number, n: number, color: THREE.Color, nuestro: boolean) => {
      const bb = materiaBuilder(seed);
      const br = bb.r;
      const cs: number[] = [];
      for (let k = 0, hechas = 0; hechas < n && k < 20000; k++) {
        const [x, y, z] = bb.onSphere();
        const c = o.clone().add(V(x, y, z).multiplyScalar(R * Math.cbrt(br())));
        const lado = c.dot(EJE);
        if (nuestro ? lado > SEAM - 0.025 : lado < SEAM + 0.025 || c.length() < 0.4) continue;
        hechas++;
        formaGalaxia(br, 160, 0.011, (gx, gy, gz, t, luz, tinte) => {
          col.copy(color).lerp(blanco, 0.15 * br()).lerp(tinte, t < 0.05 ? 0.4 : 0.12);
          bb.push(c.x + gx, c.y + gy, c.z + gz, col, t < 0.05 ? 0.0008 : 0.0007, luz * 0.9);
          cs.push(c.x, c.y, c.z);
        });
      }
      const nb = add(
        materia(bb.data(), {
          pre: /* glsl */ `attribute vec3 aC; uniform float uOn, uFrente, uCostura, uHuye, uApaga; uniform vec3 uEje, uO;`,
          move: /* glsl */ `
            float dC = length(aC - uO);
            em *= uOn * smoothstep(dC - 0.03, dC, uFrente);
            // (what dark energy takes goes off, reddening; what we hold goes out, galaxy by galaxy)
            p *= 1.0 + 2.2 * uHuye * uHuye;
            em = mix(em, vec3(0.9, 0.22, 0.1) * max(max(em.r, em.g), em.b), smoothstep(0.0, 0.4, uHuye));
            em *= 1.0 - smoothstep(0.55, 1.0, uHuye);
            em *= step(uApaga, fract(sin(dot(aC, vec3(12.9898, 78.233, 37.719))) * 43758.5453));
            em *= 1.0 + 3.0 * uCostura * exp(-pow(abs(dot(aC, uEje) - ${SEAM.toFixed(2)}) / 0.05, 2.0));
          `,
          uniforms: { uOn: { value: 0 }, uFrente: { value: 0 }, uCostura: { value: 0 }, uHuye: { value: 0 }, uApaga: { value: 0 }, uEje: { value: EJE.clone() }, uO: { value: o.clone() } },
          extra: { aC: [new Float32Array(cs), 3] },
        }),
        root,
        3,
      );
      nb.u.uFuente.value = 0.6;
      return nb;
    };
    const nuestras = nubeBurbuja(281, V(), HOR * 0.85, 240, TEAL, true);
    const suyas = nubeBurbuja(283, OTRAS[0].c, 1.3, 260, OTRAS[0].col, false);
    const costura = add(
      materia(costuraDatos(9000, EJE), { pre: /* glsl */ `uniform float uOn, uRho; uniform vec3 uCentro;`, move: COSTURA_MOVE, uniforms: { uOn: { value: 0 }, uRho: { value: 0 }, uCentro: { value: EJE.clone().multiplyScalar(SEAM) } } }),
      root,
      5,
    );
    costura.u.uFuente.value = 1;
    // The way: through a ring of them round the middle, each passed close.
    const paso = candidatas
      .filter((c) => c.length() > 0.18 && c.length() < 0.62)
      .sort((a, b) => Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z));
    const elegidas = [0, 1, 2, 3, 4, 5].map((i) => paso[Math.floor((i / 6) * paso.length)] ?? V(0.3, 0, 0));
    const caminoRuta: Camino = (sv, out) => out.copy(ruta.getPoint(THREE.MathUtils.clamp(sv, 0, 1)));
    const ruta = new THREE.CatmullRomCurve3(elegidas.map((c, i) => c.clone().add(V(0.012, 0.018, 0.012).multiplyScalar(i % 2 ? 1 : -1))));
    // The last black hole, a golden point in the empty island.
    const ob = materiaBuilder(263);
    ob.push(0, 0, 0, new THREE.Color(1.0, 0.75, 0.4), 1, 2.4);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      ob.push(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4, new THREE.Color(1.0, 0.7, 0.35), 0.4, 0.6);
    }
    const oro = add(materia(ob.data()), root, 3);
    oro.u.uFuente.value = 1;
    oro.points.rotation.x = 0.35;

    // Revealing: our galaxy ringed in the middle of its share; the others and the horizon named a moment.
    const aroNuestra = add(marcas([{ pos: V(), R: 0, color: TEAL, nuestro: true, aro: 30, sinPunto: true }]), root, 40);
    const otrasAhora = OTRAS.map((o) => o.c.clone());
    const NOMBRES: Nombre[] = [
      { pos: V(), texto: 'Vía Láctea', nuestro: true, lado: 'o', aire: 100 },
      ...otrasAhora.map((pos): Nombre => ({ pos, texto: 'Otros', lado: 'n', aire: 6 })),
      { pos: V(0, -HOR, 0), texto: 'Horizonte', lado: 's' },
    ];
    /** Galaxies we reach (Armstrong & Sandberg, «Eternity in six hours»: some four thousand million). */
    const ALCANZABLES = 4e9;

    // ---------------------------------------------------------------- the moments (GUION.md 47–51)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: 80, el: 20, ld: Math.log10(3.7), yaw: 90, pitch: -90, roll: 0, fov: 40, sondas: 0, seis: 0, exp: 0, hor: 0, bur: 0, otras: 0, vacia: 0, oro: 0, prog: 0, tit: 0, mapa: 0, nombres: 0, vuela: 0, sv: 0, cerca: 0 });

    tl.label('seis').caption(5.8, 'La eternidad en seis horas', 'O hacia afuera: con la luz de una estrella, en seis horas salen sondas a todas las galaxias alcanzables.');
    luego(0.8, 4.0, { sondas: HOR, bur: HOR * 0.85 });
    // (the spark's way out as the relay left it: `prog`; from there on it flows without a stop through
    // the caption change, `prog2`, the two blended once the relay is done)
    luego(0.6, 5.0, { prog: 0.55 });
    tl.keyAt(0.6, { prog2: 0 });
    tl.keyAt(5.6, { prog2: 0.52 });
    tl.keyAt(10.4, { prog2: 0.72 });
    luego(1.2, 1.2, { seis: 1 });
    luego(4.4, 1.2, { seis: 0 });
    // (once the relay is done: down through home after the spark, the probes streaking out past the
    // camera on every side, and on behind it, galaxies rushing by; the web's own light lower, so the
    // probes are what shines; the dive as long as the relay was, never a lunge)
    luego(2.5, 3.0, { ride: 1 });
    luego(3.0, 1.4, { vel: 0.5 });
    luego(4.4, 1.8, { vel: 0 });
    luego(2.6, 1.8, { tenue: 1 });
    luego(2.8, 1.6, { huida: 1 });
    tl.to(5.8, { az: 110, el: 24, ld: Math.log10(2.4) });

    // Riding on behind the spark: the galaxy it chases is carried off faster than it goes, past the
    // horizon's faint wall, reddening, dimming, a red ember out there. Then the camera lets go and
    // falls back, slowly, the way it looks: home's galaxies slide past, our bubble opens round it in
    // its horizon, the lost one a dim red point beyond; it comes to rest out on the far side, where
    // the next bubble will come. (While it rides, its rig moves there unseen: the centre to where the
    // two will touch, the distance in.)
    const SEAM_C = OTRAS[0].c.clone().normalize().multiplyScalar(0.56);
    const D_ESPERA = Math.log10(1.3);
    tl.label('prisa').caption(5.8, 'La prisa', 'Hay que apurarse: las galaxias se alejan cada vez más rápido, y las que cruzan el horizonte ya no se alcanzan.');
    tl.with(1.4, { hor: 1 });
    luego(0.6, 5.0, { exp: 1, prog: 0.72 });
    luego(2.4, 2.4, { tit: 1 });
    luego(3.4, 4.0, { ride: 0 });
    luego(3.6, 2.8, { tenue: 0 });
    luego(7.2, 1.6, { huida: 0 });
    luego(0.6, 2.6, { cx: SEAM_C.x, cy: SEAM_C.y, cz: SEAM_C.z });
    tl.keyAt(tl.at('prisa') + 0.6, { ld: Math.log10(2.4) });
    tl.keyAt(tl.at('prisa') + 3.0, { ld: D_ESPERA });
    tl.to(5.8, { az: 140, el: 28, ld: D_ESPERA });

    // Ours, a cloud of teal galaxies, and the amber one growing towards it, each galaxy lit as its
    // front gets there; where they touch, a wall of light, and the galaxies along it flare. The
    // camera draws back to see both, the two colours either side of the wall, and goes in to it
    // (close in, the wall seen edge-on: a line between the two colours; from nearer, the two lost
    // their colours and the wall its line).
    tl.label('tocan').caption(6.8, 'Las expansivas se tocan', 'Si otras se expanden igual, las burbujas se tocan, y cada una se queda con su parte del cielo.');
    luego(0.0, 1.6, { toca: 1 });
    luego(0.4, 4.6, { otras: 1.3 });
    luego(2.4, 1.6, { costura: 1 });
    tl.to(2.4, { az: 186, el: -10, ld: Math.log10(2.3) });
    tl.to(2.2, { az: 199, el: -20, ld: Math.log10(1.4) });
    tl.to(2.2, { az: 203, el: -24, ld: Math.log10(0.85) });

    // The reveal: all we reach, ours in teal among the others; the names a moment; still.
    // Into our share of the web: every light a galaxy, every one ours, the camera gliding among
    // them; then out again, to the whole island among the others'.
    tl.label('tipo').caption(16.0, 'Tipo IV', 'Tipo IV: todo lo que se puede alcanzar. Más allá no hay adónde ir.');
    tl.with(2.0, { bur: HOR * 1.02 });
    luego(0.4, 2.0, { cerca: 1, toca: 0, costura: 0 });
    luego(1.0, 2.6, { cx: 0, cy: 0, cz: 0 });
    luego(0.6, 2.8, { vuela: 1 });
    luego(0.6, 10.0, { sv: 1 });
    luego(8.8, 3.0, { vuela: 0 });
    luego(10.0, 1.8, { cerca: 0 });
    luego(10.4, 1.6, { mapa: 1 });
    luego(11.4, 1.4, { nombres: 1 });
    // (then out again: our island of teal galaxies whole, the amber one against it at the seam)
    luego(9.6, 2.2, { isla: 1 });
    tl.to(11.6, { az: 205, el: 26, ld: Math.log10(4.6) });
    tl.to(4.0, { az: 208 });

    tl.label('horizonte').caption(6.0, 'El horizonte', 'Lo que se lleva la energía oscura no vuelve. Lo que podemos tocar ya no crece: se vacía.');
    luego(0.2, 1.0, { nombres: 0 });
    luego(0.4, 1.4, { mapa: 0 });
    luego(0.4, 3.6, { vacia: 1, hor: 0.4, tit: 0 });
    luego(0.9, 2.3, { vid: 1 });
    // (the others are carried off, reddening; ours goes out galaxy by galaxy; all of it before the
    // last stretch, which is as it was: the act after takes up from there)
    luego(0.1, 3.0, { huye: 1 });
    luego(0.4, 2.8, { apaga: 1 });
    luego(3.0, 0.4, { isla: 0 });
    luego(0.6, 3.6, { prog: 0 });
    luego(2.4, 2.0, { oro: 1 });
    tl.to(2.6, { az: 220, el: 20, ld: Math.log10(2.4) });
    tl.to(3.4, { az: 240, el: 16, ld: Math.log10(0.05) });

    // The spark: out on a probe towards one galaxy within reach, on the far side from where the camera
    // comes in (a little on, so the camera keeps turning the same way): the camera dives through home
    // after it and rides it.
    const lejos = V(Math.cos(THREE.MathUtils.degToRad(21)) * Math.sin(THREE.MathUtils.degToRad(AZ_LEJOS)), Math.sin(THREE.MathUtils.degToRad(21)), Math.cos(THREE.MathUtils.degToRad(21)) * Math.cos(THREE.MathUtils.degToRad(AZ_LEJOS))).negate();
    const meta = lejos.clone().multiplyScalar(HOR * 0.78);
    // (for its first beats, while the act before hands over, it heads where it always did, then bends
    // round to that galaxy)
    const metaAntes = (() => {
      let mejor = V(0.5, 0.1, 0.3);
      for (let k = 0; k < n; k += 97) {
        const g = V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).multiplyScalar(1.6);
        if (g.length() > HOR * 0.7 && g.length() < HOR * 0.95 && g.y > 0) {
          mejor = g;
          break;
        }
      }
      return mejor;
    })();
    const tmpM = V();
    // The galaxy it chases: a spiral that reads as one, out there; space swells and carries it off
    // faster than the probe goes, past the horizon, where it reddens and fades.
    const huida = add(
      materia(espiralHuida(3200, 0.05, meta.clone().negate()), {
        pre: /* glsl */ `uniform float uOn, uRojo;`,
        move: /* glsl */ `
          em = mix(em, vec3(1.0, 0.24, 0.1) * max(max(em.r, em.g), em.b) * 0.9, uRojo);
          em *= uOn;
        `,
        uniforms: { uOn: { value: 0 }, uRojo: { value: 0 } },
      }),
      root,
      4,
    );
    huida.u.uFuente.value = 0.6;
    const tm = toma(tl, 0);
    /** The spark's way at beat p (its galaxy carried off by the swell) and how far along it is. */
    const rutaEn = (p: number) => {
      const expC = tl.get('exp', p);
      const caminoCh: Camino = (sv, out) => out.copy(metaAntes).lerp(V().copy(meta), THREE.MathUtils.smoothstep(sv, 0.2, 0.34)).multiplyScalar((1 + expC * 1.4) * Math.max(0, sv));
      const wP = p < 20 ? THREE.MathUtils.smoothstep(p, 2.5, 3.6) : 0;
      const prog = THREE.MathUtils.lerp(tl.get('prog', p), tl.get('prog2', p), wP);
      return { caminoCh, prog };
    };
    // The shots (chasis/toma.ts): the act's camera written as keys (viaje.transcribir, then by hand).
    escribir(tl, TOMA_COSMOS);
    // (among the bubbles the old camera looked well away from the act's centre: there the shot says
    // what it looks at itself, so it never turns round a centre off the frame)
    escribir(tl, TOMA_COSMOS_MIRA);
    return {
      id: 'cosmos',
      tl,
      grupo: root as THREE.Group,
      costura: 'mundo',
      cerca: 1e-5,
      lejos: 100,
      film: { strength: 0.7, radius: 0.6, threshold: 0.4, exposure: 1.1 },
      entrada: { pos: V(), escala: 1.6 },
      salida: { pos: V(), escala: 0.0025 },
      camara(p, ch, out) {
        plano(tl, p, ch, out);
      },
      chispa(p, out) {
        const r = rutaEn(p);
        r.caminoCh(r.prog, out);
        return true;
      },
      // (out at the star's end, it comes on again once that act has handed over: never at once at the seam)
      luz: (p) => (1 - tl.get('oro', p)) * THREE.MathUtils.smoothstep(p, 0.3, 1.6),
      escalera: false,
      cuenta(p) {
        const c: Cuenta = p < tl.at('tipo') ? potencia(37 + 8 * Math.min(1, tl.get('bur', p) / (HOR * 0.85)), '') : p < tl.at('horizonte') ? potencia(46) : potencia(46 - 6 * tl.get('vacia', p));
        // How far we reach: the galaxies the probes get to, then all there is to reach.
        const k = Math.min(1, tl.get('sondas', p) / HOR);
        const todo = tl.at('tipo') + 1.0;
        c.alcance = p >= todo ? 'todo lo alcanzable' : k < 0.02 ? 'la galaxia' : cuantas(Math.max(2, ALCANZABLES * k * k * k), 'galaxia', 'galaxias');
        c.nuevo = p >= todo ? 1 - THREE.MathUtils.smoothstep(p, todo, todo + 1.8) : 0;
        return c;
      },
      // The years: the probes leave in six hours; arriving takes thousands of millions of years; and
      // then the island empties, until the stars go out.
      anio(p) {
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[0, 5e6], [a('prisa'), 5e6], [a('tocan'), 2e9], [a('tipo') + 2, 2e10], [a('horizonte'), 2e10], [a('horizonte') + 3.6, 1e12], [tl.length, 1e14]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'VII · El cosmos', name: c.name, fact: c.fact } : null;
      },
      update(f: FrameActo) {
        const p = f.p;
        const t = f.time;
        const camera = f.camera;
        // Where it is: along the way to its galaxy (which the swell carries off), and home again at the end.
        const expC = tl.get('exp', p);
        const caminoCh: Camino = (sv, out) => out.copy(metaAntes).lerp(tmpM.copy(meta), THREE.MathUtils.smoothstep(sv, 0.2, 0.34)).multiplyScalar((1 + expC * 1.4) * Math.max(0, sv));
        // (as the relay left it, then flowing on: the two blended once the relay is done; equal again
        // long before the spark comes home)
        const wP = p < 20 ? THREE.MathUtils.smoothstep(p, 2.5, 3.6) : 0;
        const prog = THREE.MathUtils.lerp(tl.get('prog', p), tl.get('prog2', p), wP);
        // Gliding through our galaxies (Type IV): the camera on its way among them, looking ahead.
        const vuela = tl.get('vuela', p);
        const ride = tl.get('ride', p);
        const sv = THREE.MathUtils.clamp(tl.get('sv', p), 0, 1);
        // (the gaze always a little ahead of the place, even at the way's end; both smoothed, so the
        // camera rounds each galaxy it passes instead of turning at it)
        const cerca = tl.get('cerca', p);
        const toca = tl.get('toca', p);
        const otrasV = tl.get('otras', p);
        const contacto = THREE.MathUtils.smoothstep(otrasV, 0.62, 0.95);
        cercanas.u.uOn.value = cerca;
        brillos.u.uOn.value = 0.55 * cerca;
        const isla = Math.max(toca, tl.get('isla', p));
        nuestras.u.uApaga.value = tl.get('apaga', p);
        suyas.u.uHuye.value = tl.get('huye', p);
        for (const [nb, fr] of [[nuestras, tl.get('bur', p)], [suyas, otrasV]] as [Nube, number][]) {
          // (the neighbour seen whole, from afar, dimmer than ours: ours is the one we look at)
          nb.u.uOn.value = nb === suyas ? isla * (1 - 0.4 * tl.get('isla', p) * (1 - toca)) : isla;
          nb.u.uFrente.value = fr;
          nb.u.uCostura.value = contacto;
          nb.points.visible = isla > 0.002;
          nb.u.uMaxPx.value = 4 * f.dpr;
        }
        costura.u.uOn.value = Math.max(tl.get('costura', p), 0.5 * tl.get('isla', p)) * (1 - tl.get('huye', p));
        costura.u.uRho.value = 0.6 * THREE.MathUtils.smoothstep(otrasV, 0.6, 1.25);
        costura.points.visible = costura.u.uOn.value > 0.002;
        sondas.u.uTenue.value = Math.max(vuela, Math.min(1, tl.get('toca', p) + cerca + tl.get('isla', p)));
        // The galaxy it chases: carried off faster than the probe, reddening past the horizon.
        const huyeR = meta.length() * (1 + expC * 1.4 + expC * expC * 1.8);
        huida.points.position.copy(meta).setLength(huyeR);
        huida.u.uOn.value = tl.get('huida', p) * (1 - 0.72 * THREE.MathUtils.smoothstep(huyeR, HOR * 1.1, HOR * 2.6));
        huida.u.uRojo.value = THREE.MathUtils.smoothstep(huyeR, HOR * 0.85, HOR * 1.35);
        huida.points.visible = huida.u.uOn.value > 0.002;
        huida.u.uSizeUnit.value = 1;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        const exp = tl.get('exp', p);
        red.u.uExp.value = exp;
        red.u.uRed.value = 1 - 0.55 * tl.get('tenue', p);
        red.u.uBur.value = tl.get('bur', p);
        red.u.uOtras.value = tl.get('otras', p);
        red.u.uVacia.value = tl.get('vacia', p);
        sondas.u.uSondas.value = tl.get('sondas', p);
        sondas.u.uExp.value = 0;
        sondas.u.uVacia.value = tl.get('vacia', p);
        horizonte.u.uOn.value = 0.6 * tl.get('hor', p) * (1 - tl.get('toca', p));
        capaHor.u.uOn.value = 0.5 * tl.get('hor', p) * tl.get('vid', p);
        capaHor.u.uTime.value = t;
        oro.u.uGain.value = tl.get('oro', p);
        oro.u.uSizeUnit.value = (6 * camera.position.length()) / f.focal;
        for (const x of nubes) enfocar(x, f.focal, f.dpr, t);
        enfocarMarcas(aroNuestra, f.dpr, tl.get('mapa', p));
        OTRAS.forEach((o, i) => otrasAhora[i].copy(o.c).multiplyScalar(1 + exp * 1.4));
        red.u.uMaxPx.value = 3.2 * f.dpr;
        // Up close a galaxy is many fine points, never a few big blobs.
        cercanas.u.uMaxPx.value = 5 * f.dpr;
        red.u.uSizeUnit.value = 1.6;
      },
      efectos(p) {
        return { vel: tl.get('vel', p) };
      },
      placa(g, f) {
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
        // Six hours: the number that is the spectacle, large and alone.
        const a = tl.get('seis', f.p);
        if (a > 0.01) {
          const u = f.u;
          g.save();
          g.globalAlpha = a;
          g.textAlign = 'right';
          g.textBaseline = 'alphabetic';
          g.shadowColor = 'rgba(0,0,0,0.9)';
          g.shadowBlur = 20 * u;
          g.font = FONT.serif(150 * u);
          g.fillStyle = ink(0.92);
          g.fillText('6', f.W - 90 * u, f.H * 0.42);
          g.font = FONT.italic(30 * u);
          g.fillStyle = ink(0.7);
          g.fillText(tr('horas'), f.W - 90 * u, f.H * 0.42 + 44 * u);
          g.restore();
        }
      },
    };
  },
};
