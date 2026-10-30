import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { sol as solH } from '../src/horizontes';
import { TEAL, potencia, anioEn } from './remake';
import { angulos, aplicarToma, toma } from './rig';
import { crearChispa, type Camino } from './chispa';
import { LEJOS, enjambreNube } from './mercurio';
import type { Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scene 13 of ESCALETA.md, «El Sol trabajado» (GUION.md, moments 29–31). Same frame as Mercury's
 * scene (solar radii, the Sun at the origin), which hands over from far away.
 *
 * Back in, through the swarm, to the Sun. Matter is lifted off its poles in two jets and gathered
 * by rings of ours: with less mass it burns slower and lives longer (the star shrinks a little). On
 * one side a mirror, a vast curved sail of light, sends part of its light back, and the Sun moves,
 * slowly, its swarm with it, leaving a thread of teal where it was. Out again: all the Sun's light
 * is ours, type II; and the star is not enough.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const PLASMA = new THREE.Color(1.0, 0.62, 0.28);
/** Which way the mirror pushes (it sits on this side, the Sun moves away from it). */
const EMPUJE = V(-1, 0, 0.25).normalize();
const R_ESPEJO = 7.5;

/** The jets off the poles: grains with a phase (`aKind`), a pole (`aDelay` < 0.5 south) and a place across (`aOff`); and the rings that gather them. */
function chorrosDatos() {
  const b = materiaBuilder(161);
  const off: number[] = [];
  for (let i = 0; i < 46000; i++) {
    b.push(0, 0, 0, PLASMA, 0.014, 0.12 + b.r() * 0.22, { kind: b.r(), delay: b.r() });
    off.push(gauss(b.r), gauss(b.r));
  }
  return { data: b.data(), off: new Float32Array(off) };
}

function anillosDatos(): MateriaData {
  const b = materiaBuilder(163);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7000; i++) {
      const a = b.r() * Math.PI * 2;
      const R = 0.75 + gauss(b.r) * 0.02;
      b.push(Math.cos(a) * R * 1.6, s * 6.6 + gauss(b.r) * 0.01, Math.sin(a) * R * 1.6, TEAL, 0.012, 0.22);
    }
  }
  return b.data();
}

/** The mirror: a cap of a sphere, 110° across, on the side opposite the push. */
function espejoDatos(): MateriaData {
  const b = materiaBuilder(167);
  const eje = EMPUJE.clone().negate();
  for (let i = 0; i < 110000; i++) {
    const [x, y, z] = b.onSphere();
    const d = V(x, y, z);
    const c = d.dot(eje);
    if (c < Math.cos(THREE.MathUtils.degToRad(55))) continue;
    const borde = THREE.MathUtils.smoothstep(c, Math.cos(THREE.MathUtils.degToRad(55)), Math.cos(THREE.MathUtils.degToRad(48)));
    b.push(x * R_ESPEJO, y * R_ESPEJO, z * R_ESPEJO, borde < 0.99 ? TEAL : new THREE.Color(0.75, 0.88, 0.9), 0.02, borde < 0.99 ? 0.7 : 0.16 + b.r() * 0.1);
  }
  return b.data();
}

/** The thread left behind: where the Sun has been (`aKind`, how far back along the push). */
function estelaDatos(): MateriaData {
  const b = materiaBuilder(171);
  for (let i = 0; i < 9000; i++) {
    const d = b.r() * 4;
    const p = EMPUJE.clone().multiplyScalar(d).add(V(gauss(b.r) * 0.05, gauss(b.r) * 0.05, gauss(b.r) * 0.05));
    b.push(p.x, p.y, p.z, TEAL, 0.02, 0.35, { kind: d });
  }
  return b.data();
}

export const solTrabajado: Escena = {
  id: 'sol',
  nombre: 'III · El Sol trabajado',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'Los chorros de sus polos, el espejo que lo empuja, la estela; tipo II.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.65;
    stage.bloom.radius = 0.55;
    stage.bloom.threshold = 0.6;
    stage.renderer.toneMappingExposure = 1.05;

    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root, orden = 5) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };
    // Everything that moves with the Sun.
    const movil = new THREE.Group();
    root.add(movil);
    const sol = solH({ puntos: 300000, corona: 140000 });
    movil.add(sol.group);
    const enjambre = add(enjambreNube(false), movil, 10);
    const chispa = crearChispa();
    movil.add(chispa.nube.points);
    const caminoCh: Camino = (sv, out) => {
      const a = sv * 2.2;
      return out.set(Math.sin(a) * 3.1, 0.25 * Math.sin(sv * 3.1), Math.cos(a) * 3.1);
    };
    enjambre.u.uCubre.value = 1;

    const cd = chorrosDatos();
    const chorros = add(
      materia(cd.data, {
        pre: /* glsl */ `attribute vec2 aOff; uniform float uVida;`,
        move: /* glsl */ `
          float sv = fract(aKind + uTime * 0.06);
          float polo = aDelay < 0.5 ? -1.0 : 1.0;
          float abre = 0.12 + 0.75 * sv;
          p = vec3(aOff.x * abre, polo * (0.95 + sv * 5.7), aOff.y * abre);
          em = mix(vec3(1.0, 0.92, 0.75), em, smoothstep(0.0, 0.4, sv)) * (1.0 - smoothstep(0.75, 1.0, sv)) * uVida;
        `,
        uniforms: { uVida: { value: 0 } },
        extra: { aOff: [cd.off, 2] },
      }),
      movil,
    );
    chorros.u.uFuente.value = 0.5;
    const anillos = add(materia(anillosDatos(), { pre: `uniform float uVida;`, move: `em *= uVida;`, uniforms: { uVida: { value: 0 } } }), movil);
    anillos.u.uFuente.value = 0.4;
    const espejo = add(materia(espejoDatos(), { pre: `uniform float uEsp;`, move: `em *= uEsp; p *= mix(0.6, 1.0, uEsp);`, uniforms: { uEsp: { value: 0 } } }), movil);
    espejo.u.uFuente.value = 0.4;
    const estela = add(materia(estelaDatos(), { pre: `uniform float uMueve;`, move: `em *= step(aKind, uMueve) * (0.4 + 0.6 * smoothstep(uMueve - 1.5, uMueve, aKind));`, uniforms: { uMueve: { value: 0 } } }));
    estela.u.uFuente.value = 0.5;

    // ---------------------------------------------------------------- the moments (GUION.md 29–31)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const lejos = angulos(LEJOS);
    const MUEVE = 3.2;
    const fin = EMPUJE.clone().multiplyScalar(MUEVE);
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: lejos.az, el: lejos.el, ld: Math.log10(LEJOS.length()), yaw: 90, pitch: -90, roll: 0, fov: 30, ir: 1, vida: 0, encoge: 0, esp: 0, mueve: 0, satura: 0 });

    tl.label('vida').caption(5.6, 'Alargar la vida del Sol', 'Una estrella también se cuida: con menos masa arde más despacio, y vive más.');
    tl.with(2.0, { ir: 0 });
    luego(1.6, 2.4, { vida: 1 });
    luego(2.6, 3.0, { encoge: 1 });
    tl.to(5.6, { az: lejos.az + 40, el: 16, ld: Math.log10(11), fov: 40 });

    tl.label('mover').caption(6.0, 'Mover el Sol', 'Y se puede mover: un espejo le devuelve parte de su luz y lo empuja, despacio.');
    tl.with(2.0, { esp: 1 });
    luego(1.6, 4.4, { mueve: MUEVE, cx: fin.x, cy: fin.y, cz: fin.z });
    tl.to(6.0, { az: lejos.az + 110, el: 24, ld: Math.log10(21) });

    tl.label('tipo').caption(5.0, 'Tipo II', 'Toda la luz del Sol: tipo II. Y la estrella ya no alcanza.');
    luego(1.0, 2.4, { satura: 1 });
    luego(1.6, 3.0, { ir: 1 });
    tl.to(5.0, { az: lejos.az + 150, el: 30, ld: 2.2, fov: 34 });

    const tm = toma(tl, 0);
    return {
      tl,
      entrada: { pos: V(), escala: 1 },
      salida: { pos: fin.clone(), escala: 1 },
      escalera: false,
      cuenta(p) {
        return { ...(p < tl.at('tipo') ? potencia(25.6) : potencia(26.58)), alcance: '1 estrella' };
      },
      anio(p) {
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[0, 2090], [a('mover'), 2105], [a('tipo'), 2125], [tl.length, 2135]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'III · El sistema solar trabaja', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-4;
        camera.far = 4000;
        aplicarToma(camera, toma(tl, p, tm));
        // The spark keeps going round among the collectors; at type II it has nowhere left to go: it flickers.
        const camM = camera.position.clone().sub(EMPUJE.clone().multiplyScalar(tl.get('mueve', p)));
        chispa.update(caminoCh, p * 0.18 * (1 + 1.5 * tl.get('satura', p)), 0.01, 1, tl.get('satura', p), camM, f.focal, f.dpr, f.time);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        const mueve = tl.get('mueve', p);
        movil.position.copy(EMPUJE).multiplyScalar(mueve);
        movil.updateMatrixWorld(true);
        const camL = camera.position.clone().sub(movil.position);
        // Inside the swarm the Sun is bright; from outside it is dim behind it (as in scene 12).
        const afuera = THREE.MathUtils.smoothstep(camL.length(), 2.6, 3.9);
        const enc = tl.get('encoge', p);
        sol.group.scale.setScalar(1 - 0.12 * enc);
        sol.u.uBrillo.value = 2.2 * (1 - 0.86 * afuera) * (1 - 0.15 * enc);
        sol.update({ sol: V(1, 0, 0), camara: camL.clone().divideScalar(1 - 0.12 * enc), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        enjambre.u.uCam.value.copy(camL);
        enjambre.u.uIR.value = tl.get('ir', p);
        const solV = movil.position.clone().applyMatrix4(camera.matrixWorldInverse);
        enjambre.u.uOcc.value.set(solV.x, solV.y, solV.z, 1.0);
        chorros.u.uVida.value = tl.get('vida', p);
        anillos.u.uVida.value = tl.get('vida', p);
        espejo.u.uEsp.value = tl.get('esp', p);
        estela.u.uMueve.value = mueve;
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        void Y;
      },
      dispose() {},
    };
  },
};
