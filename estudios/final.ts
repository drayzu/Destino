import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { crearAgujero } from './motor/agujero';
import { ease, redCosmica } from './comun';
import { FONT, ink, type Cuenta, type Rotulo } from './placa';
import { TEAL, potencia, puntoTu } from './remake';
import { aplicarToma, toma } from './rig';
import { crearChispa, type Camino } from './chispa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scenes 21–22 of ESCALETA.md, «El último agujero negro» and «Un universo nuevo» (GUION.md, moments
 * 52–57), and the hand-over to Infinito.
 *
 * The golden point is the last black hole: its disk white and gold, light bent round its shadow
 * (Infinito's ray-traced hole). A ring of ours round it takes energy from its spin. The last mind
 * flashes, each time further apart; the point breathes beside it; she goes out, the point does not.
 * In the black, a white point grows into a bubble and the camera goes in: the light spills, cools,
 * gathers into a web; the camera goes down to a corner of it, and there a teal point lights: twenty
 * watts, someone thinking for the first time. Everything goes out but the point. Infinito opens there.
 *
 * Units: the hole's horizon radius is 1.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const N_DISCO = V(0.05, 1, 0.12).normalize();
const MENTE = V(8, 6.5, 9);
/** Where the new universe is born, in the black beside the hole; and its corner where someone thinks. */
const NACE = V(-14, 4, 10);
const R_UNI = 9;

function anilloDatos(): MateriaData {
  const b = materiaBuilder(271);
  const u = V(1, 0, 0).cross(N_DISCO).normalize();
  const w = N_DISCO.clone().cross(u);
  for (let i = 0; i < 16000; i++) {
    const a = b.r() * Math.PI * 2;
    const R = 26 + gauss(b.r) * 0.15;
    const p = u.clone().multiplyScalar(Math.cos(a) * R).addScaledVector(w, Math.sin(a) * R).addScaledVector(N_DISCO, gauss(b.r) * 0.05);
    b.push(p.x, p.y, p.z, TEAL, 0.05, 0.35);
  }
  return b.data();
}

function menteDatos(): MateriaData {
  const b = materiaBuilder(277);
  for (let i = 0; i < 700; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(b.r()) * 0.9;
    b.push(MENTE.x + x * q, MENTE.y + y * q, MENTE.z + z * q, b.r() < 0.3 ? 0xffffff : TEAL, 0.05, 0.9);
  }
  return b.data();
}

/** The new universe: a bubble of white (its points on a sphere) and the light inside that cools into a web. */
function burbujaDatos(): MateriaData {
  const b = materiaBuilder(281);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 30000; i++) {
    const y = 1 - ((i + 0.5) / 30000) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i;
    b.push(Math.cos(th) * rr, y, Math.sin(th) * rr, new THREE.Color(1.0, 0.96, 0.9), 0.012, 0.7);
  }
  return b.data();
}

export const final: Escena = {
  id: 'final',
  nombre: 'VIII · El final',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'El último agujero negro, la última mente y tu punto; la burbuja de un universo nuevo; alguien piensa por primera vez; ¿y el nuestro?' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.75;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.4;
    stage.renderer.toneMappingExposure = 1.1;

    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root, orden = 0) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };
    const hoyo = crearAgujero();
    hoyo.u.uStars.value = 0.25;
    hoyo.u.uDiskOut.value = 16;
    root.add(hoyo.mesh);
    const anillo = add(materia(anilloDatos(), { pre: `uniform float uOn;`, move: `em *= uOn * (0.6 + 0.4 * sin(uTime * 0.7 + seed * 30.0));`, uniforms: { uOn: { value: 0 } } }), root, 2);
    anillo.u.uFuente.value = 0.5;
    const mente = add(
      materia(menteDatos(), {
        pre: /* glsl */ `uniform float uOn, uPeriodo;`,
        move: /* glsl */ `
          // It thinks in flashes, each one further from the last.
          float ph = fract(uTime / max(uPeriodo, 0.5));
          em *= uOn * (0.08 + 1.6 * exp(-ph * 14.0));
        `,
        uniforms: { uOn: { value: 0 }, uPeriodo: { value: 1 } },
      }),
      root,
      3,
    );
    mente.u.uFuente.value = 0.6;
    const tuMente = add(puntoTu(MENTE.clone().add(V(1.6, 0.3, 0.6)), 0.1), root, 4);

    const uniG = new THREE.Group();
    uniG.position.copy(NACE);
    root.add(uniG);
    const burbuja = add(materia(burbujaDatos(), { pre: `uniform float uOn;`, move: `em *= uOn;`, uniforms: { uOn: { value: 0 } } }), uniG, 5);
    burbuja.u.uFuente.value = 0.5;
    // Inside: the light that spills and cools into a web (from a white fog to its knots).
    const rc = redCosmica(293, 110, (t, out) => out.setRGB(1.0, 0.86 - 0.1 * t, 0.7 - 0.15 * t));
    const luz = add(
      materia(rc.data, {
        pre: /* glsl */ `uniform float uLuz, uRed, uApaga; attribute vec3 aAzar;`,
        move: /* glsl */ `
          p = mix(aAzar, p, uRed);
          em = mix(vec3(1.0, 0.97, 0.92) * 1.1, em * 1.3, uRed) * uLuz * (1.0 - uApaga);
        `,
        uniforms: { uLuz: { value: 0 }, uRed: { value: 0 }, uApaga: { value: 0 } },
        extra: { aAzar: [rc.azar, 3] },
      }),
      uniG,
      6,
    );
    luz.u.uFuente.value = 0.5;
    // The corner where someone thinks: a knot of the new web, near its edge.
    const rincon = rc.nodos.slice().sort((a, z) => z.length() - a.length())[8].clone();
    const tu = add(puntoTu(rincon.clone(), 0.006), uniG, 7);

    // ---------------------------------------------------------------- the moments (GUION.md 52–57)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const Cn = (v: THREE.Vector3) => ({ cx: v.x, cy: v.y, cz: v.z });
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: 240, el: 16, ld: Math.log10(400), yaw: 90, pitch: -90, roll: 0, fov: 40, hoyo: 1, anillo: 0, mente: 0, periodo: 1, tuM: 0, apagaM: 0, bur: 0, rb: 0, luz: 0, red: 0, tu: 0, apaga: 0, tarjeta: 0, baja: 0, chs: 0, chOn: 0 });

    tl.label('centrales').caption(5.6, 'Las últimas centrales', 'Cuando las estrellas se apagan, quedan los agujeros negros. Todavía se puede sacar energía de su giro.');
    luego(1.6, 2.0, { anillo: 1 });
    tl.to(5.6, { ld: Math.log10(70), el: 9, az: 262 });

    tl.label('contados').caption(6.6, 'Pensamientos contados', 'Al universo le quedan pensamientos contados. Este que tienes ahora es uno de ellos.');
    tl.with(1.2, { mente: 1, chOn: 1 });
    tl.with(6.6, { chs: 1 });
    luego(0.6, 1.0, { tuM: 1 });
    luego(0.4, 5.0, { periodo: 6 });
    luego(5.0, 1.2, { apagaM: 1 });
    tl.with(1.6, { ...Cn(MENTE) });
    tl.to(6.6, { ld: Math.log10(9), el: 28, az: 300 });

    // In the black, a white point grows into a bubble, and the camera goes in.
    tl.label('crear').caption(5.4, 'Crear un universo', 'La última obra posible: una burbuja que crece hasta ser un universo propio. Hoy no sabemos hacerlo.');
    tl.with(2.0, { hoyo: 0, anillo: 0, mente: 0, tuM: 0 });
    luego(0.8, 1.0, { bur: 1 });
    luego(0.6, 3.0, { chs: 2 });
    luego(1.0, 4.2, { rb: 1 });
    luego(0.4, 1.6, { ...Cn(NACE) });
    tl.to(5.4, { ld: Math.log10(26), el: 12, az: 330 });

    tl.label('adentro').caption(3.6, 'Adentro', 'Adentro, un universo empieza.');
    tl.with(1.6, { luz: 1 });
    luego(1.4, 2.0, { bur: 0 });
    tl.to(3.6, { ld: Math.log10(R_UNI * 0.75), el: 10, az: 345 });

    const rinconW = rincon.clone().multiplyScalar(R_UNI).add(NACE);
    tl.label('alguien').caption(6.2, 'Alguien', 'En miles de millones de años, en algún rincón de ahí adentro, algo va a pensar por primera vez. Como tú, ahora.');
    tl.with(3.2, { red: 1 });
    luego(1.6, 2.4, { ...Cn(rinconW), baja: 1 });
    luego(0.6, 3.4, { chs: 3 });
    luego(3.6, 1.4, { tu: 1, chOn: 0 });
    tl.to(6.2, { ld: Math.log10(0.5), el: 6, az: 365 });

    tl.label('nuestro').caption(6.0, '¿Y el nuestro?', '¿Y si alguien hizo también el nuestro?');
    luego(0.6, 2.4, { apaga: 1 });
    luego(3.2, 1.6, { tarjeta: 1 });
    tl.to(6.0, { ld: Math.log10(0.6), az: 368 });

    const chispa = crearChispa();
    root.add(chispa.nube.points);
    const junto = MENTE.clone().add(V(1.6, 0.3, 0.6));
    const tm = toma(tl, 0);
    const sky = new THREE.Matrix3();
    return {
      tl,
      entrada: { pos: V(), escala: 20 },
      escalera: false,
      cuenta(p): Cuenta | null {
        if (p < tl.at('crear')) {
          const per = tl.get('periodo', p);
          return potencia(29 - (per - 1) * 1.4);
        }
        if (p < tl.at('alguien')) return null;
        const b = tl.get('baja', p);
        if (b > 0.5) return { pisos: ['20'], unidad: 'W', linea: 'alguien, pensando', h: 1, a: ease(0.5, 1, b) };
        return null;
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: p < tl.at('adentro') ? 'VIII · El final' : '', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-4;
        camera.far = 5000;
        aplicarToma(camera, toma(tl, p, tm));
        // The spark: beside the last mind (0..1, it waits there), into the bubble (1..2), down to its corner (2..3).
        const caminoCh: Camino = (sv, out) => {
          if (sv <= 1) return out.copy(junto).add(V(Math.sin(sv * 9) * 0.3, Math.cos(sv * 7) * 0.2, 0));
          if (sv <= 2) return out.copy(junto).lerp(NACE, THREE.MathUtils.smoothstep(sv - 1, 0, 1));
          return out.copy(NACE).lerp(rinconW, THREE.MathUtils.smoothstep(sv - 2, 0, 1));
        };
        chispa.update(caminoCh, tl.get('chs', p), 0.01, tl.get('chOn', p), 0, camera.position, f.focal, f.dpr, f.time);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        hoyo.update({ camera, center: V(), normal: N_DISCO, rs: 1, sky, time: t, alpha: tl.get('hoyo', p) });
        anillo.u.uOn.value = tl.get('anillo', p);
        mente.u.uOn.value = tl.get('mente', p) * (1 - tl.get('apagaM', p));
        mente.u.uPeriodo.value = tl.get('periodo', p);
        tuMente.u.uGain.value = tl.get('tuM', p) * (1 + 0.25 * Math.sin(t * 1.5));
        const rb = tl.get('rb', p);
        uniG.scale.setScalar(Math.max(1e-3, R_UNI * rb));
        burbuja.u.uOn.value = tl.get('bur', p);
        burbuja.u.uSizeUnit.value = uniG.scale.x * 0.25 + 0.2;
        luz.u.uLuz.value = tl.get('luz', p);
        luz.u.uRed.value = tl.get('red', p);
        luz.u.uApaga.value = tl.get('apaga', p);
        luz.u.uSizeUnit.value = uniG.scale.x;
        // «Tú» keeps a few pixels, however close.
        tu.u.uSizeUnit.value = (8 * camera.position.distanceTo(rinconW)) / f.focal / 0.006;
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.25 * Math.sin(t * 1.5));
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        // A flood of light first (soft and wide), then a web of fine points.
        luz.u.uMaxPx.value = (3.2 + 20 * (1 - tl.get('red', p))) * f.dpr;
      },
      placa(g, f) {
        // The card: Infinito, where the point is.
        const a = tl.get('tarjeta', f.p);
        if (a > 0.01) {
          const u = f.u;
          g.save();
          g.globalAlpha = a;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.font = FONT.mono(11 * u);
          g.letterSpacing = `${1.8 * u}px`;
          g.fillStyle = 'rgba(201,180,255,0.9)';
          g.fillText('CONTINÚA EN', f.W / 2, f.H * 0.68);
          g.letterSpacing = '0px';
          g.font = FONT.serif(64 * u);
          g.fillStyle = ink(0.95);
          g.fillText('Infinito', f.W / 2, f.H * 0.68 + 52 * u);
          g.font = FONT.italic(24 * u);
          g.fillStyle = ink(0.7);
          g.fillText('¿Qué hay más allá?', f.W / 2, f.H * 0.68 + 100 * u);
          g.restore();
        }
      },
      dispose() {},
    };
  },
};
