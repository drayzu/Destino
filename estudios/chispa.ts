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
 *
 * The spark's paths have corners (it turns at a neuron, jumps star to star); a camera nailed to
 * them would turn on each corner at once. So the camera rides the path as a hand would: its place
 * and its gaze are the path averaged over a stretch (`suave`, in s), round the corner instead of on
 * it, and the spark drifts a little off the middle while it turns.
 */
export function montar(camino: Camino, s: number, atras: number, adelante: number, alto: number, arriba = V(0, 1, 0), suave = Math.max(atras, adelante * 0.35) * 1.4, radial = false, suaveLugar = suave * 2.2) {
  // (the place smoother than the gaze: the camera glides, the spark wanders a little in the frame;
  // on a way whose stretches go at very different paces in s, keep both windows short, or the
  // average reaches past the spark)
  const lugar = alisado(camino, s - atras, suaveLugar, V());
  // The gaze: mostly on the spark, a little ahead of it, so it stays near the middle of the frame.
  const mira = alisado(camino, s + adelante * 0.35, suave, V());
  // (a way over a sphere round the origin: the average cuts under its surface; back up to it)
  if (radial) {
    lugar.setLength(camino(s - atras, tmpA).length());
    mira.setLength(camino(s + adelante * 0.35, tmpA).length());
  }
  lugar.addScaledVector(arriba, alto);
  // «Up» for the frame: the way's own up; and which way is ahead (a camera that looks steeply down
  // takes that as its up).
  const delante = alisado(camino, s + suave, suave * 2, V()).sub(alisado(camino, s - suave, suave * 2, tmpB));
  if (delante.lengthSq() > 1e-30) delante.normalize();
  return { lugar, mira, arriba: arriba.clone().normalize(), delante };
}

const MUESTRAS = 16;
const PESOS = Array.from({ length: MUESTRAS }, (_, i) => {
  const u = ((i + 0.5) / MUESTRAS) * 2 - 1;
  return (1 - u * u) ** 2;
});
const SUMA = PESOS.reduce((a, b) => a + b, 0);
const tmpA = V();
const tmpB = V();
/** The path round s, averaged over ±w with a smooth bell (so a corner becomes a curve). */
function alisado(camino: Camino, s: number, w: number, out: THREE.Vector3) {
  out.set(0, 0, 0);
  if (w <= 0) return camino(s, out);
  for (let i = 0; i < MUESTRAS; i++) {
    const u = ((i + 0.5) / MUESTRAS) * 2 - 1;
    out.addScaledVector(camino(s + u * w, tmpA), PESOS[i] / SUMA);
  }
  return out;
}
