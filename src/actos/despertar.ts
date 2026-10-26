import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { lerp, smoothstep } from '../engine/math';
import { mezcla, type Vista } from '../engine/vista';
import { E, deriva, noche } from '../mundo/mundo';
import { R_E } from '../mundo/obras';
import type { Acto } from './tipos';

/**
 * Act I · La materia despierta (provisional). Short, as an origin: how the matter of a planet began
 * to notice. For now the camera drifts round the dark Earth while the clock counts the watts of
 * thinking (one rule from end to end: energy): a cell, a brain, all our brains, the machines. Phase 4
 * gives it its own images (the camera among cells, a neuron, a city, a data centre).
 *
 * Figures (orders of magnitude, to verify in phase 4): a bacterium ~1 pW; a human brain ~20 W; 8 200
 * million brains ~1.6 × 10¹¹ W [calc]; data centres ~415 TWh in 2024 ≈ 47 GW (IEA, Energy and AI,
 * 2025).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function despertar(): Acto {
  let tl: Timeline;
  let P: (l: string) => number;
  const ease = smoothstep;
  // Where the opening left the camera (the Earth's night side, the Sun behind it), and where «Hoy» wants it.
  const desde = (): Vista => ({ pos: E.clone().addScaledVector(E.clone().normalize(), 4.2 * R_E), target: E.clone(), up: V(0, 1, 0), fov: 40 });
  const hacia = (p: number): Vista => noche(4.6, deriva(p));

  const MOMENTOS: [string, string, number, string][] = [
    ['Una célula', 'En ese planeta, hace unos 3 500 millones de años, la materia empezó a reaccionar: una célula vive con una billonésima de vatio.', -12, 'una célula · alrededor de un picovatio'],
    ['Un cerebro', 'Unos 86 000 millones de neuronas, lo más complejo que conocemos, piensan con unos 20 vatios: lo que gasta una bombilla.', Math.log10(20), 'un cerebro humano · unos 20 W'],
    ['Ocho mil millones de cerebros', 'Todos nuestros cerebros juntos, pensando a la vez: una central eléctrica grande.', Math.log10(8.2e9 * 20), 'todos los cerebros humanos · 1,6 × 10¹¹ W'],
    ['Las máquinas que piensan', 'Hoy los centros de datos ya gastan casi un tercio de lo que gastan todos nuestros cerebros. Y crecen.', Math.log10(4.7e10), 'centros de datos · unos 47 GW (2024)'],
  ];

  return {
    id: 'a1',
    numero: 'I',
    nombre: 'La materia despierta',
    provisional: true,
    coreografia(t) {
      tl = t;
      P = (l) => tl.at(l);
      tl.label('a1');
      MOMENTOS.forEach(([n, f], i) => {
        tl.caption(1.5, n, f);
        tl.label(`a1.${i}`).to(1.5, { 'a1.k': i + 1 });
      });
      tl.label('a1.fin');
    },
    montar() {},
    vista(p) {
      return mezcla(desde(), hacia(p), ease(P('a1'), P('a1.fin'), p));
    },
    lectura: () => null,
    libre(p) {
      const k = tl.get('a1.k', p);
      const i = Math.min(MOMENTOS.length - 1, Math.max(0, Math.round(k) - 1));
      // The figure glides from one to the next as the moment begins.
      const prev = MOMENTOS[Math.max(0, i - 1)][2];
      const t = ease(P(`a1.${i}`), P(`a1.${i}`) + 0.6, p);
      return { lp: i === 0 ? MOMENTOS[0][2] : lerp(prev, MOMENTOS[i][2], t), linea: MOMENTOS[i][3], tipo: 'vatios de pensar' };
    },
    estado(m, p) {
      // Before us, the night is dark; the machines bring the first lights.
      m.estado.luces = 0.02 * ease(P('a1.3'), P('a1.fin'), p);
    },
  };
}
