import * as THREE from 'three';
import { enfocar, materia, materiaBuilder, type Nube } from './motor/materia';
import { TEAL } from './remake';

/**
 * The spark: your thought, the thread of Destino (GUION.md v2). A small, lively teal point with a
 * short wake, smaller than «tú» and never lost. It lives on a path the scene gives it: its head is
 * at `camino(s)`, its wake along `camino(s − i·paso)`, so it is reversible with the scroll like
 * everything else. It keeps its size in pixels whatever the distance.
 *
 * And the camera that rides it: just behind and a little above, looking a little ahead.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ESTELA = 56;

export type Camino = (s: number, out: THREE.Vector3) => THREE.Vector3;

export interface Chispa {
  nube: Nube;
  /** Where its head is (after the last `update`). */
  pos: THREE.Vector3;
  /**
   * Per frame: on `camino` at `s`, its wake `paso` long per point (in s), how present (0..1), how
   * much it flickers (0..1, at a wall), and where the camera is in the same frame (for its size in pixels).
   */
  update(camino: Camino, s: number, paso: number, on: number, titila: number, camPos: THREE.Vector3, focal: number, dpr: number, time: number): void;
}

export function crearChispa(): Chispa {
  const b = materiaBuilder(7);
  // Head (white at its heart), its halo, and the wake.
  b.push(0, 0, 0, new THREE.Color(0.85, 1.0, 0.95), 6, 2.6);
  b.push(0, 0, 0, TEAL, 26, 0.16);
  for (let i = 0; i < ESTELA; i++) {
    const t = i / (ESTELA - 1);
    b.push(0, 0, 0, TEAL, 5 * (1 - t) + 1, 1.4 * Math.pow(1 - t, 1.6));
  }
  const data = b.data();
  // Sizes and light without the builder's random spread: the spark is exact.
  data.size[0] = 6;
  data.size[1] = 26;
  for (let i = 0; i < ESTELA; i++) data.size[i + 2] = 5 * (1 - i / (ESTELA - 1)) + 1;
  const nube = materia(data, {
    pre: /* glsl */ `uniform float uOn, uTitila;`,
    move: /* glsl */ `
      float parpadeo = mix(1.0, 0.15 + 0.85 * step(0.45, fract(sin(floor(uTime * 9.0) * 12.9898) * 43758.5453)), uTitila);
      em *= uOn * parpadeo;
    `,
    uniforms: { uOn: { value: 1 }, uTitila: { value: 0 } },
  });
  nube.u.uSpread.value = 0;
  nube.u.uFuente.value = 1;
  nube.u.uMaxPx.value = 64;
  nube.points.renderOrder = 50;
  const posAttr = nube.points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const pos = V();
  const tmp = V();
  return {
    nube,
    pos,
    update(camino, s, paso, on, titila, camPos, focal, dpr, time) {
      camino(s, pos);
      posAttr.setXYZ(0, pos.x, pos.y, pos.z);
      posAttr.setXYZ(1, pos.x, pos.y, pos.z);
      for (let i = 0; i < ESTELA; i++) {
        camino(s - i * paso, tmp);
        posAttr.setXYZ(i + 2, tmp.x, tmp.y, tmp.z);
      }
      posAttr.needsUpdate = true;
      nube.points.geometry.computeBoundingSphere();
      const d = Math.max(1e-12, camPos.distanceTo(pos));
      enfocar(nube, focal, dpr, time);
      // Sizes are pixels: the unit is the world size of one pixel at the spark's distance.
      nube.u.uSizeUnit.value = (d / focal) * dpr;
      nube.u.uMaxPx.value = 64 * dpr;
      nube.u.uOn.value = on;
      nube.u.uTitila.value = titila;
    },
  };
}

/**
 * Riding the spark: the camera `atras` behind it on its path (in s), raised by `alto` (world units,
 * along `arriba`), looking `adelante` ahead. Returns the place and the point to look at, for the
 * rig's `lugar` and `mira`.
 */
export function montar(camino: Camino, s: number, atras: number, adelante: number, alto: number, arriba = V(0, 1, 0)) {
  const lugar = camino(s - atras, V()).addScaledVector(arriba, alto);
  // The gaze: mostly on the spark, a little ahead of it, so it stays near the middle of the frame.
  const aqui = camino(s, V());
  const mira = aqui.clone().lerp(camino(s + adelante, V()), 0.35);
  return { lugar, mira };
}
