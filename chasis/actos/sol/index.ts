import * as THREE from 'three';
import { Timeline } from '../../../estudios/timeline';
import { enfocar, materia, type Nube } from '../../../estudios/motor/materia';
import { sol as solH } from '../../../src/horizontes';
import { potencia, anioEn } from '../../../estudios/remake';
import { angulos, toma } from '../../../estudios/rig';
import { type Camino } from '../../../estudios/chispa';
import { LEJOS, enjambreNube } from '../mercurio';
import type { Rotulo } from '../../../estudios/placa';
import { escribir, toma as plano } from '../../toma';
import type { Acto, EscenaChasis, FrameActo } from '../../tipos';
import { V, Y, EMPUJE, DESFASE, chorrosDatos, anillosDatos, espejoMalla, estelaDatos } from './mundo';
import { TOMA_SOL } from './camara';

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

export const solTrabajado: EscenaChasis = {
  id: 'sol',
  montar(stage): Acto {
    const root = stage.root;
    const { camera } = stage;

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
    const caminoCh: Camino = (sv, out) => {
      // (from where the swarm's act leaves it on its orbit, the same way round)
      const a = sv * 2.2 + DESFASE;
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
    const espejo = espejoMalla();
    movil.add(espejo.mesh);
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
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: lejos.az, el: lejos.el, ld: Math.log10(LEJOS.length()), yaw: 90, pitch: -90, roll: 0, fov: 30, ir: 1, vida: 0, encoge: 0, esp: 0, mueve: 0, satura: 0, orb: 0, oR: Math.log10(8), oEl: 12 });

    tl.label('vida').caption(7.4, 'Alargar la vida del Sol', 'Una estrella también se cuida: con menos masa arde más despacio, y vive más.');
    tl.with(2.0, { ir: 0 });
    luego(1.2, 2.4, { vida: 1 });
    luego(3.6, 3.0, { encoge: 1 });
    // The orbit: the camera goes round the Sun at the spark's pace, a little ahead of it, so the
    // spark stays in the left of the frame, going right, the Sun and all that works on it behind.
    luego(0.4, 3.6, { orb: 1 });
    luego(0, 7.4, { oR: Math.log10(6.4), oEl: 20 });
    tl.to(3.6, { az: lejos.az + 30, el: 14, ld: Math.log10(12), fov: 40 });
    // (up beside the north jet: the matter lifted off the pole, gathered by our ring)
    tl.to(3.8, { az: lejos.az + 62, el: 44, ld: Math.log10(6.2) });

    luego(0, 7.6, { oR: Math.log10(11.5), oEl: 10 });
    tl.label('mover').caption(7.6, 'Mover el Sol', 'Y se puede mover: un espejo le devuelve parte de su luz y lo empuja, despacio.');
    tl.with(2.4, { esp: 1 });
    luego(2.8, 4.8, { mueve: MUEVE, cx: fin.x, cy: fin.y, cz: fin.z });
    // (round to the mirror's open side: its glowing face behind the Sun; then the Sun comes towards
    // us as it moves, its thread behind it)
    const abierto = angulos(EMPUJE).az;
    tl.to(3.4, { az: abierto + 30, el: 14, ld: Math.log10(16) });
    tl.to(4.2, { az: abierto + 12, el: 20, ld: Math.log10(21) });

    tl.label('tipo').caption(5.6, 'Tipo II', 'Toda la luz del Sol: tipo II. Y la estrella ya no alcanza.');
    luego(0.4, 4.2, { orb: 0 });
    luego(1.0, 2.4, { satura: 1 });
    luego(1.6, 3.0, { ir: 1 });
    tl.to(5.6, { az: lejos.az + 150, el: 30, ld: 2.2, fov: 34 });

    // (the spark is lit the whole act)
    tl.keyAt(0, { on: 1 });
    // The shots (chasis/toma.ts): out of Mercury's last picture, round the Sun with the spark as it
    // circles it (the gaze on the spark, the Sun beside it), and back out to the whole Sun as it moves.
    escribir(tl, TOMA_SOL);
    return {
      id: 'sol',
      tl,
      grupo: root as THREE.Group,
      costura: 'mundo',
      cerca: 1e-4,
      lejos: 4000,
      film: { strength: 0.65, radius: 0.55, threshold: 0.6, exposure: 1.05 },
      presencias: ['orb', 'satura', 'ir', 'vida', 'esp'],
      entrada: { pos: V(), escala: 1 },
      salida: { pos: fin.clone(), escala: 1 },
      // The spark keeps going round among the collectors, round the Sun as it moves.
      camara(p, ch, out) {
        plano(tl, p, ch, out);
      },
      guia(p, out) {
        caminoCh(p * 0.18, out).addScaledVector(EMPUJE, tl.get('mueve', p));
        return true;
      },
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
      update(f: FrameActo) {
        const p = f.p;
        const t = f.time;
        const camera = f.camera;
        const mueve = tl.get('mueve', p);
        movil.position.copy(EMPUJE).multiplyScalar(mueve);
        movil.updateMatrixWorld(true);
        const camL = camera.position.clone().sub(movil.position);
        // Inside the swarm the Sun is bright; from outside it is dim behind it (as in scene 12).
        const afuera = THREE.MathUtils.smoothstep(camL.length(), 2.6, 3.9);
        const enc = tl.get('encoge', p);
        sol.group.scale.setScalar(1 - 0.12 * enc);
        sol.u.uBrillo.value = 2.2 * (1 - 0.86 * afuera) * (1 - 0.15 * enc);
        sol.update({ sol: V(1, 0, 0), camara: camL.clone().divideScalar(1 - 0.12 * enc), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: f.presencia });
        enjambre.u.uCam.value.copy(camL);
        enjambre.u.uIR.value = tl.get('ir', p);
        const solV = movil.position.clone().applyMatrix4(camera.matrixWorldInverse);
        enjambre.u.uOcc.value.set(solV.x, solV.y, solV.z, 1.0);
        chorros.u.uVida.value = tl.get('vida', p);
        anillos.u.uVida.value = tl.get('vida', p);
        const esp = tl.get('esp', p);
        espejo.u.uEsp.value = esp;
        espejo.mesh.scale.setScalar(THREE.MathUtils.lerp(0.6, 1.0, esp));
        espejo.mesh.visible = esp > 0.002;
        estela.u.uMueve.value = mueve;
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        void Y;
      },
    };
  },
};
