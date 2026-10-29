import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { sol as solHorizontes } from '../src/horizontes';
import { TEAL, potencia, puntoTu } from './remake';
import { aplicarToma, toma } from './rig';
import type { Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Study C of the remake: scenes 18 and 19 of ESCALETA.md, «Pensar con una estrella» and «Dejar de
 * ser materia» (GUION.md, moments 43–46).
 *
 * A star is wrapped, shell by shell, in computers: five spheres of points, each the colour of its
 * temperature (white, orange, red, deep red, the false colour of the infrared), and the star goes
 * dim inside them. The camera goes in through the shells to the gap between the third and the
 * fourth: a glowing floor below, a ceiling that sparkles above. The points compute (they blink,
 * faster the colder the shell: cold thinks cheaper). Then the points of the shell leave it and
 * gather, in front of the camera, into a network that thinks: knots and threads with pulses. A teal
 * point lights among them and becomes one more knot. At the end the network spreads out into the
 * dark and cools to blue.
 *
 * Ways: 1 «Puntos», the computers and the bits as points of light; 2 «Cuadros», as small square tiles
 * (the bits of the first studies, 26 Oct).
 *
 * Units: the star's radius.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RADIOS = [1.8, 2.6, 3.6, 4.9, 6.5];
const COLORES = [new THREE.Color(1.0, 0.78, 0.5), new THREE.Color(1.0, 0.55, 0.2), new THREE.Color(1.0, 0.28, 0.08), new THREE.Color(0.78, 0.12, 0.05), new THREE.Color(0.5, 0.09, 0.16)];
const LUCES = [0.5, 0.48, 0.44, 0.38, 0.3];
const PUNTOS = [50000, 70000, 95000, 125000, 165000];
const AZUL = new THREE.Color(0.42, 0.62, 1.0);

/** The shells: Fibonacci spheres, `aKind` the shell (0 inside .. 4 outside). */
function capasDatos(cuadro: boolean): MateriaData {
  const b = materiaBuilder(61);
  const ga = Math.PI * (3 - Math.sqrt(5));
  RADIOS.forEach((R, k) => {
    const n = PUNTOS[k];
    const paso = Math.sqrt((4 * Math.PI) / n);
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 2;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const th = ga * i;
      const j = R * (1 + gauss(b.r) * 0.004);
      b.push(Math.cos(th) * rr * j, y * j, Math.sin(th) * rr * j, COLORES[k], R * paso * (cuadro ? 0.42 : 0.5), LUCES[k], { kind: k });
    }
  });
  return b.data();
}

/**
 * The network: knots in the gap between the third and fourth shells, each joined to its nearest
 * three by a thread. Each point comes from a place on those shells (`aFrom`): the shells' matter,
 * reordered. `aDat`: kind (0 knot, 1 thread), how far along its thread, a phase.
 */
function redDatos(): { data: MateriaData; dat: Float32Array; nodos: THREE.Vector3[] } {
  const b = materiaBuilder(67);
  const r = b.r;
  const dat: number[] = [];
  const nodos: THREE.Vector3[] = [];
  for (let i = 0; i < 1500; i++) {
    const [x, y, z] = b.onSphere();
    nodos.push(V(x, y, z).multiplyScalar(3.8 + r() * 0.95));
  }
  const desde = () => {
    const [x, y, z] = b.onSphere();
    const R = r() < 0.5 ? RADIOS[2] : RADIOS[3];
    return [x * R, y * R, z * R] as [number, number, number];
  };
  const BLANCO = new THREE.Color(0.9, 1.0, 0.97);
  for (const n of nodos) {
    for (let k = 0; k < 16; k++) {
      b.push(n.x + gauss(r) * 0.012, n.y + gauss(r) * 0.012, n.z + gauss(r) * 0.012, k < 4 ? BLANCO : TEAL, 0.012, k < 4 ? 1.4 : 0.8, { from: desde(), delay: r() });
      dat.push(0, 0, r(), 0);
    }
  }
  const hechos = new Set<string>();
  nodos.forEach((n, i) => {
    const cerca = nodos
      .map((m, j) => ({ j, d: m.distanceTo(n) }))
      .filter((x) => x.j !== i)
      .sort((a, z) => a.d - z.d)
      .slice(0, 3);
    for (const { j, d } of cerca) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (hechos.has(key)) continue;
      hechos.add(key);
      const m = nodos[j];
      const cuantos = Math.round(d * 220);
      const fase = r();
      for (let q = 0; q < cuantos; q++) {
        const t = r();
        b.push(n.x + (m.x - n.x) * t, n.y + (m.y - n.y) * t, n.z + (m.z - n.z) * t, TEAL, 0.006, 0.42, { from: desde(), delay: r() });
        dat.push(1, i < j ? t : 1 - t, fase, 0);
      }
    }
  });
  return { data: b.data(), dat: new Float32Array(dat), nodos };
}

export const estrella: Escena = {
  id: 'estrella',
  nombre: 'C · Pensar con una estrella',
  estilos: [
    { key: '1', nombre: 'Puntos', nota: 'Las computadoras y los bits como puntos de luz, de la misma materia que todo lo demás.' },
    { key: '2', nombre: 'Cuadros', nota: 'Las computadoras y los bits como cuadritos que se encienden y se apagan (los bits de los primeros estudios).' },
  ],
  montar(stage, estilo): Instancia {
    const cuadro = estilo === 1;
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.55;
    stage.renderer.toneMappingExposure = 1.05;

    const sol = solHorizontes({ puntos: 260000, corona: 120000, llamaradas: 0 });
    root.add(sol.group);

    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root) => {
      parent.add(n.points);
      nubes.push(n);
      return n;
    };

    const capas = add(
      materia(capasDatos(cuadro), {
        cuadro,
        pre: /* glsl */ `uniform float uCapas, uBits, uPiensa, uSale, uFrio;`,
        move: /* glsl */ `
          float kc = aKind;
          float on = smoothstep(kc, kc + 0.8, uCapas * 5.0);
          // Its computers blink: faster the colder the shell.
          float rate = (1.0 + 1.7 * kc) * uPiensa;
          float cel = floor(uTime * rate + seed * 50.0);
          float bit = step(0.5, fract(sin(cel * 12.9898 + seed * 78.233) * 43758.5453));
          em *= on * mix(1.0, 0.18 + 1.4 * bit, uBits);
          // The third and fourth shells give their points to the network.
          em *= 1.0 - 0.75 * uSale * step(1.5, kc) * step(kc, 3.5);
          em *= 1.0 - uFrio;
        `,
        uniforms: { uCapas: { value: 0 }, uBits: { value: 0 }, uPiensa: { value: 0 }, uSale: { value: 0 }, uFrio: { value: 0 } },
      }),
    );
    capas.u.uSpread.value = 0;
    capas.u.uFuente.value = 0.35;

    const rd = redDatos();
    const redG = new THREE.Group();
    root.add(redG);
    const red = add(
      materia(rd.data, {
        cuadro,
        pre: /* glsl */ `
          attribute vec4 aDat;
          uniform float uRed, uFrioR;
          uniform vec3 uTeal, uAzul;
        `,
        move: /* glsl */ `
          float pulso = aDat.x > 0.5 ? smoothstep(0.86, 1.0, fract(aDat.y - uTime * 0.55 + aDat.z * 9.0)) * 3.5 : 0.0;
          vec3 tinte = mix(uTeal, uAzul, uFrioR);
          em = tinte * length(em) * 0.6 * (1.0 + pulso);
          em *= uRed;
        `,
        uniforms: { uRed: { value: 0 }, uFrioR: { value: 0 }, uTeal: { value: TEAL.clone() }, uAzul: { value: AZUL.clone() } },
        extra: { aDat: [rd.dat, 4] },
      }),
      redG,
    );
    red.u.uSpread.value = 1.4;
    red.u.uFuente.value = 0.3;

    const listo = sol.listo;

    // ---------------------------------------------------------------- the moments (GUION.md 43–46)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: 18, el: 16, ld: 1.32, yaw: 90, pitch: -90, roll: 0, fov: 40, capas: 0, bits: 0, piensa: 0, forma: 0, sale: 0, red: 0, tu: 0, expande: 0, frio: 0 });

    tl.label('estrella').caption(5.0, 'Pensar con una estrella', 'Hacia adentro: envolver una estrella en capas de computadoras, y ponerla a pensar.');
    luego(0.3, 4.4, { capas: 1 });
    luego(2.6, 2.2, { bits: 1, piensa: 1 });
    tl.to(5.0, { az: 34, el: 14, ld: 1.1 });

    // In through the shells, to the gap between the third and the fourth; then the gaze lifts to the
    // curved walls: the hot floor below, the cold ceiling above.
    tl.label('frio').caption(5.4, 'El frío piensa más', 'Cada capa vive del calor de la anterior. Y cuanto más fría, más barato le sale pensar.');
    tl.to(3.2, { az: 52, el: 9, ld: 0.63, fov: 50 });
    tl.to(2.2, { az: 58, pitch: -18, yaw: 70 });

    tl.label('materia').caption(6.0, 'Dejar de ser materia', 'Una mente así ya no necesita cuerpo: es cálculo. De ti quedaría la forma en que piensas.');
    luego(0.2, 3.6, { forma: 1, sale: 1, red: 1 });
    luego(2.8, 1.0, { tu: 1 });
    tl.to(6.0, { az: 63, pitch: -10, yaw: 80 });

    tl.label('fin').caption(5.4, 'El frío', 'Pero pensar cuesta, y todo termina como calor. Nada se enfría más que el fondo del universo.');
    luego(0.4, 4.6, { expande: 1, frio: 1 });
    luego(0.2, 1.4, { tu: 0 });
    tl.to(5.4, { az: 80, el: 20, ld: 1.45, pitch: -90, yaw: 90, fov: 40 });

    // «Tú»: a knot in front of the camera where the network forms.
    const tm = toma(tl, tl.at('materia') + 4);
    const tuPos = tm.pos.clone().addScaledVector(tm.dir, 0.42).addScaledVector(tm.up, -0.05);
    const tu = add(puntoTu(tuPos, 0.02), redG);
    tu.u.uSpread.value = 0;

    return {
      tl,
      listo,
      escalera: false,
      cuenta() {
        return potencia(37);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'VI · Hacia adentro', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-3;
        camera.far = 500;
        aplicarToma(camera, toma(tl, p, tm));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        const cap = tl.get('capas', p);
        const dentro = THREE.MathUtils.smoothstep(camera.position.length(), RADIOS[0], RADIOS[4]);
        sol.u.uBrillo.value = 1.5 * (1 - 0.88 * cap * dentro) * (1 - tl.get('frio', p));
        sol.update({ sol: V(1, 0, 0), camara: camera.position.clone(), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });

        capas.u.uCapas.value = cap;
        capas.u.uBits.value = tl.get('bits', p);
        capas.u.uPiensa.value = tl.get('piensa', p);
        capas.u.uSale.value = tl.get('sale', p);
        capas.u.uFrio.value = tl.get('frio', p);
        red.u.uK.value = tl.get('forma', p);
        red.u.uRed.value = tl.get('red', p);
        red.u.uFrioR.value = tl.get('frio', p);
        redG.scale.setScalar(1 + tl.get('expande', p) * 1.8);
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.25 * Math.sin(t * 1.5));
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
      },
      dispose() {},
    };
  },
};
