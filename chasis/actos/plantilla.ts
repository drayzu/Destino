import * as THREE from 'three';
import { Timeline } from '../../estudios/timeline';
import { enfocar, materia, materiaBuilder, type Nube } from '../../estudios/motor/materia';
import type { Rotulo } from '../../estudios/placa';
import { CONTRATO, toma } from '../toma';
import type { Acto, EscenaChasis, FrameActo } from '../tipos';

/**
 * A new scene, from scratch: the template for extending Destino (CHASIS.md, «Una escena nueva»).
 *
 * It knows nothing of the acts round it. It keeps the contract at both ends (`costura: 'cuadro'`:
 * its first and its last picture have the spark where CONTRATO puts it on the screen, with
 * CONTRATO's lens), so it can go between any two acts that keep it too: add it to the list in
 * chasis/main.ts and the guards check the rest.
 *
 * Here: a ring of light, and the spark flying through it while the camera comes round.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const plantilla: EscenaChasis = {
  id: 'plantilla',
  montar(stage): Acto {
    const root = stage.root;
    const nubes: Nube[] = [];

    // What the act shows: its own world, its own units (here, about the ring's size).
    const b = materiaBuilder(7);
    for (let i = 0; i < 900; i++) {
      const a = (i / 900) * Math.PI * 2;
      const r = 1 + (b.r() - 0.5) * 0.06;
      b.push(Math.cos(a) * r, Math.sin(a) * r, -2 + (b.r() - 0.5) * 0.06, new THREE.Color(0.75, 0.95, 1), 0.012, 0.9);
    }
    const anillo = materia(b.data(), { pre: `uniform float uOn;`, move: `em *= uOn;`, uniforms: { uOn: { value: 0 } } });
    anillo.u.uSpread.value = 0;
    root.add(anillo.points);
    nubes.push(anillo);

    // The spark's way: through the ring and on.
    const camino = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.3, 0.15, -1.2), V(0, 0, -2), V(-0.3, -0.1, -3), V(0, 0, -4)]);

    // The moments, and the shots (chasis/toma.ts): it starts and ends on the contract.
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: 0, az: 0, el: 8, ld: -0.4, lw: 1, ...CONTRATO, roll: 0, sc: 0, on: 1, anillo: 0 });
    tl.label('nueva').caption(4.0, 'Una escena nueva', 'Esta escena no conoce a sus vecinas: entra y sale por el mismo cuadro.');
    tl.with(4.0, { sc: 1 });
    luego(0.3, 1.2, { anillo: 1 });
    luego(2.6, 1.2, { anillo: 0 });
    // (round the spark as it goes through the ring, and back behind it to hand over)
    luego(0.4, 1.6, { az: 55, el: 16, ld: -0.2, my: -4 });
    luego(2.2, 1.6, { az: 0, el: 8, ld: -0.4, ...CONTRATO });
    tl.wait(4.0);

    return {
      id: 'plantilla',
      tl,
      grupo: root as THREE.Group,
      costura: 'cuadro',
      cerca: 1e-3,
      lejos: 100,
      film: { strength: 0.75, radius: 0.6, threshold: 0.45, exposure: 1.1 },
      presencias: ['anillo'],
      chispa(p, out) {
        camino.getPointAt(THREE.MathUtils.clamp(tl.get('sc', p), 0, 1), out);
        return true;
      },
      camara(p, ch, out) {
        toma(tl, p, ch, out);
      },
      escalera: false,
      cuenta() {
        return { pisos: ['20'], unidad: 'W', linea: 'una escena nueva', h: 1 };
      },
      anio() {
        return 2026;
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: '', name: c.name, fact: c.fact } : null;
      },
      update(f: FrameActo) {
        anillo.u.uOn.value = tl.get('anillo', f.p) * f.presencia;
        for (const n of nubes) enfocar(n, f.focal, f.dpr, f.time);
      },
    };
  },
};
