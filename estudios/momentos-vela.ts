import * as THREE from 'three';
import { materia, materiaBuilder } from './motor/materia';
import { TEAL } from './remake';

/**
 * Pieces for the light-sail act's moment «La luz es lenta» (vela.ts), kept apart so the act stays
 * readable.
 *
 * Points whose size is given in pixels where they are (not in world units), shrinking with distance
 * past `uRef` down to `uMin` of it: so a pulse that leaves the sail and goes away gets smaller as
 * things do, yet never fades to nothing far off (they are light sources: `uFuente` 1).
 */
const POST_PX = /* glsl */ `
  float dz = max(-mv.z, 1e-14);
  sz *= dz / max(uSizeUnit * uEscalaMundo * uFocal, 1e-30) * uPx * clamp(uRef / dz, uMin, 1.0);
`;
const PRE_PX = /* glsl */ `attribute float aLuz; uniform float uPx, uRef, uMin;`;

/**
 * The messages home after the first (the echo, a spark of its own, goes ahead of them): `n` pulses of
 * light, each a small white-teal heart in a teal halo, like the spark's head. Each frame the act puts
 * them on the way home (`poner`): where each one is, and how much it is lit.
 */
export function pulsosNube(n: number, ref: number) {
  const b = materiaBuilder(211);
  for (let i = 0; i < n; i++) {
    b.push(0, 0, 0, 0xffffff, 1, 1, { kind: 2 });
    b.push(0, 0, 0, 0xffffff, 1, 1, { kind: 1 });
  }
  const data = b.data();
  // (exact, as the spark's head: no random spread)
  const corazon = new THREE.Color(0.9, 1.0, 0.96).multiplyScalar(2.4);
  const halo = TEAL.clone().multiplyScalar(0.2);
  for (let i = 0; i < n; i++) {
    data.size[i * 2] = 6;
    data.size[i * 2 + 1] = 24;
    data.color.set([corazon.r, corazon.g, corazon.b], i * 6);
    data.color.set([halo.r, halo.g, halo.b], i * 6 + 3);
  }
  const luz = new Float32Array(n * 2);
  const nube = materia(data, {
    pre: PRE_PX,
    move: /* glsl */ `em *= aLuz;`,
    post: POST_PX,
    uniforms: { uPx: { value: 1 }, uRef: { value: ref }, uMin: { value: 0.45 } },
    extra: { aLuz: [luz, 1] },
  });
  nube.u.uFuente.value = 1;
  const pos = nube.points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const luzA = nube.points.geometry.getAttribute('aLuz') as THREE.BufferAttribute;
  return {
    nube,
    /** Per frame: pulse i at `donde(i)`, lit `cuanto(i)` (0..1); the device pixel ratio. */
    poner(donde: (i: number, out: THREE.Vector3) => THREE.Vector3, cuanto: (i: number) => number, dpr: number) {
      const v = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        donde(i, v);
        pos.setXYZ(i * 2, v.x, v.y, v.z);
        pos.setXYZ(i * 2 + 1, v.x, v.y, v.z);
        const l = cuanto(i);
        luzA.setX(i * 2, l);
        luzA.setX(i * 2 + 1, l);
      }
      pos.needsUpdate = true;
      luzA.needsUpdate = true;
      nube.points.geometry.computeBoundingSphere();
      nube.u.uPx.value = dpr;
    },
  };
}

/**
 * A star seen from very far: a warm point with a faint glow round it, a few pixels across wherever it
 * is (its real disc is far below a pixel there). `luz` lights it (0..1) each frame.
 */
export function puntoLejano(color: THREE.Color, px = 4) {
  const b = materiaBuilder(213);
  b.push(0, 0, 0, 0xffffff, 1, 1, { kind: 2 });
  b.push(0, 0, 0, 0xffffff, 1, 1, { kind: 1 });
  const data = b.data();
  const nucleo = color.clone().multiplyScalar(1.7);
  const brillo = color.clone().lerp(new THREE.Color(1, 0.45, 0.2), 0.4).multiplyScalar(0.14);
  data.size[0] = px;
  data.size[1] = px * 5;
  data.color.set([nucleo.r, nucleo.g, nucleo.b], 0);
  data.color.set([brillo.r, brillo.g, brillo.b], 3);
  const luz = new Float32Array([1, 1]);
  const nube = materia(data, {
    pre: PRE_PX,
    move: /* glsl */ `em *= aLuz;`,
    post: POST_PX,
    // (no shrinking: it is far off whatever happens)
    uniforms: { uPx: { value: 1 }, uRef: { value: 1e30 }, uMin: { value: 1 } },
    extra: { aLuz: [luz, 1] },
  });
  nube.u.uFuente.value = 1;
  return nube;
}
