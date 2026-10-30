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
/** Points in the wake (as long as it always was: 56 points `paso` apart, now closer together). */
const ESTELA = 96;
const LARGO = 55;

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

/**
 * Still points, as Diego chose (a stroke had too many glitches), but finer: a white heart with a
 * small four-pointed glint and a teal halo; a wake of close points that reads as one thread, from
 * pale to deep teal, each one its size in pixels wherever it is (so where the wake runs towards the
 * camera it does not swell into blobs) and fading near the camera; a faint shimmer along it.
 * `aKind`: 2 the heart, 1 the halo, 0 the wake (`aDelay`: how far down it).
 */
export function crearChispa(): Chispa {
  const b = materiaBuilder(7);
  b.push(0, 0, 0, new THREE.Color(0.92, 1.0, 0.97), 7, 2.8, { kind: 2 });
  b.push(0, 0, 0, TEAL, 30, 0.2, { kind: 1 });
  const palido = new THREE.Color(0.8, 1.0, 0.94);
  const c = new THREE.Color();
  for (let i = 0; i < ESTELA; i++) {
    const t = i / (ESTELA - 1);
    c.copy(palido).lerp(TEAL, Math.min(1, t * 1.6));
    b.push(0, 0, 0, c, 1, 1.5 * Math.pow(1 - t, 1.5), { kind: 0, delay: t });
  }
  const data = b.data();
  // Sizes and light without the builder's random spread: the spark is exact.
  data.size[0] = 7;
  data.size[1] = 30;
  for (let i = 0; i < ESTELA; i++) {
    const t = i / (ESTELA - 1);
    data.size[i + 2] = 4.2 * (1 - t) + 1.1;
  }
  const nube = materia(data, {
    pre: /* glsl */ `uniform float uOn, uTitila, uDCab; varying float vKind;`,
    move: /* glsl */ `
      float parpadeo = mix(1.0, 0.15 + 0.85 * step(0.45, fract(sin(floor(uTime * 9.0) * 12.9898) * 43758.5453)), uTitila);
      em *= uOn * parpadeo;
      // (a faint shimmer running down the wake)
      if (aKind < 0.5) em *= 0.8 + 0.35 * sin(aDelay * 40.0 - uTime * 7.0);
      vKind = aKind;
    `,
    post: /* glsl */ `
      // Each point its size in pixels where it is (not swelling as the wake comes near the camera),
      // and the wake fading as it does.
      float dd = max(-mv.z, 1e-14);
      if (aKind < 0.5) {
        sz *= dd / max(uDCab, 1e-14);
        float cerca = smoothstep(0.3, 0.75, dd / max(uDCab, 1e-14));
        em *= cerca;
      }
    `,
    frag: /* glsl */ `
      varying vec3 vEm;
      varying float vOcc;
      varying float vKind;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r2 = dot(c, c);
        float f = exp(-r2 * 14.0);
        if (vKind > 1.5) {
          // The heart: a soft core, and a small four-pointed glint.
          float cruz = exp(-abs(c.x) * 60.0) * exp(-abs(c.y) * 5.0) + exp(-abs(c.y) * 60.0) * exp(-abs(c.x) * 5.0);
          f = exp(-r2 * 30.0) + 0.45 * cruz;
        }
        gl_FragColor = vec4(vEm * f, vOcc * f);
      }
    `,
    uniforms: { uOn: { value: 1 }, uTitila: { value: 0 }, uDCab: { value: 1 } },
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
      const p2 = (paso * LARGO) / (ESTELA - 1);
      for (let i = 0; i < ESTELA; i++) {
        camino(s - i * p2, tmp);
        posAttr.setXYZ(i + 2, tmp.x, tmp.y, tmp.z);
      }
      posAttr.needsUpdate = true;
      nube.points.geometry.computeBoundingSphere();
      const d = Math.max(1e-12, camPos.distanceTo(pos));
      enfocar(nube, focal, dpr, time);
      // Sizes are pixels: the unit is the world size of one pixel at the spark's distance.
      nube.u.uSizeUnit.value = (d / focal) * dpr;
      nube.u.uDCab.value = d;
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
