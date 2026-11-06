import * as THREE from 'three';
import { Timeline } from '../../estudios/timeline';
import { enfocar, materia, materiaBuilder, type Nube } from '../../estudios/motor/materia';
import type { Rotulo } from '../../estudios/placa';
import { mezclar, toma, vuelo } from '../toma';
import type { Acto, EscenaChasis, FrameActo, PlanoCamara } from '../tipos';

/**
 * A new scene, from scratch: the template for extending Destino (CHASIS.md, «Cambios comunes»).
 *
 * It knows nothing of the acts round it. It goes between any two through the frame (`costura:
 * 'cuadro'`): the engine lays its first picture on the last act's last one, turned and scaled to fit
 * (here by what the two cameras frame), so it begins where that one left the viewer; the guards check
 * the picture holds at the seam. Add it to the list in chasis/main.ts.
 *
 * Here: a ring of light. You come round it, fly through it first person (`vuelo`), and look back.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const plantilla: EscenaChasis = {
  id: 'plantilla',
  montar(stage): Acto {
    const root = stage.root;
    const nubes: Nube[] = [];

    // What the act shows: its own world, its own units (here, about the ring's size). Points that pass
    // by the lens fade (`post`), so a flight through them never bursts into a blot.
    const b = materiaBuilder(7);
    for (let i = 0; i < 900; i++) {
      const a = (i / 900) * Math.PI * 2;
      const r = 1 + (b.r() - 0.5) * 0.06;
      b.push(Math.cos(a) * r, Math.sin(a) * r, -2 + (b.r() - 0.5) * 0.06, new THREE.Color(0.75, 0.95, 1), 0.012, 0.9);
    }
    const anillo = materia(b.data(), {
      pre: `uniform float uOn;`,
      move: `em *= uOn;`,
      post: /* glsl */ `em *= smoothstep(0.02, 0.12, length(mv.xyz) / max(uEscalaMundo, 1e-30));`,
      uniforms: { uOn: { value: 0 } },
    });
    anillo.u.uSpread.value = 0;
    root.add(anillo.points);
    nubes.push(anillo);

    // The way through it: a smooth curve with no corners (the flight reads it by its length).
    const camino = new THREE.CatmullRomCurve3([V(1.6, 0.4, 0.6), V(0.5, 0.15, -1.0), V(0, 0, -2), V(-0.4, -0.1, -3.2), V(-0.6, 0.1, -4.4)], false, 'centripetal');

    // The moments and the camera: round the ring (`toma`), then into the flight (`fp` 0 → 1) along
    // `vu`, and out of it again to look back at the ring (`vm`: the gaze drawn to `cx…`).
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: -2, az: 40, el: 12, ld: 0.5, lw: 0, mx: 0, my: 0, fov: 40, roll: 0, anillo: 0, fp: 0, vu: 0, vm: 0, vh: 0 });
    tl.label('nueva').caption(6.0, 'Una escena nueva', 'Esta escena no conoce a sus vecinas: entra y sale por el cuadro.');
    luego(0.3, 1.2, { anillo: 1 });
    tl.to(2.0, { az: 60, el: 10, ld: 0.4 });
    luego(0, 1.0, { fp: 1 });
    tl.to(3.0, { vu: 1 });
    luego(-1.0, 1.0, { vm: 0.9 });
    luego(4.6, 1.2, { anillo: 0 });
    tl.wait(1.0);

    const enToma: PlanoCamara = { pos: V(), quat: new THREE.Quaternion(), fov: 40, dist: 1, lw: 0 };

    return {
      id: 'plantilla',
      tl,
      grupo: root as THREE.Group,
      costura: 'cuadro',
      cerca: 1e-3,
      lejos: 100,
      film: { strength: 0.75, radius: 0.6, threshold: 0.45, exposure: 1.1 },
      presencias: ['anillo'],
      // (no guide: nothing to ride, the camera is written)
      guia() {
        return false;
      },
      camara(p, _ch, out) {
        const fp = tl.get('fp', p);
        if (fp <= 0) {
          toma(tl, p, null, out);
          return;
        }
        vuelo(tl, p, camino, out, { adelante: 0.08, alabeo: 12, nivel: true });
        if (fp < 1) mezclar(toma(tl, p, null, enToma), out, fp, out);
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
