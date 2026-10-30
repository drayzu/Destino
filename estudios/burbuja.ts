import * as THREE from 'three';
import { materia, materiaBuilder, type Nube } from './motor/materia';
import { TEAL } from './remake';

/**
 * The bubble that grows (GUION.md v2, 39, «La burbuja»): probes that copy themselves at every star
 * they reach and go on to the stars around it. A tree of teal threads among the stars near the Sun,
 * from a few light years to a few thousand, that grows as `uRed` goes from 0 to 1: its front moves
 * out in logarithm, so a camera that pulls back at the same pace sees the same thing at every scale,
 * a network branching like an organism. The stars it reaches turn teal.
 *
 * Units: the galaxy's (~830 light years). The front at `red` is 10^(LOG0 + red · DECADAS).
 */

export const LOG0 = -3.2;
export const DECADAS = 3.6;
export const frente = (red: number) => Math.pow(10, LOG0 + Math.min(1, Math.max(0, red)) * DECADAS);

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export interface Burbuja {
  estrellas: Nube;
  hilos: Nube;
  /** The spark's way out along one branch: at `red`, where the front has carried it. */
  rama(red: number, out: THREE.Vector3): THREE.Vector3;
  /** The branch's last star. */
  hoja: THREE.Vector3;
}

/** `centro`: the Sun; `hacia`: roughly where the spark's branch should go. */
export function crearBurbuja(centro: THREE.Vector3, hacia: THREE.Vector3): Burbuja {
  const b = materiaBuilder(301);
  const r = b.r;
  const N = 6000;
  // The stars: as many in every decade of distance, flattened into the disc past ~80 light years.
  const pos: THREE.Vector3[] = [];
  const t: number[] = [];
  for (let i = 0; i < N; i++) {
    const u = (i + r()) / N;
    const d = Math.pow(10, LOG0 + 0.12 + u * (DECADAS - 0.12));
    const [x, y, z] = b.onSphere();
    const grueso = Math.min(1, 0.12 / d);
    const p = V(x, y * Math.max(grueso, 0.06), z).normalize().multiplyScalar(d);
    pos.push(p);
    // When the front reaches it (a little ragged).
    t.push(Math.min(1, Math.max(0, (Math.log10(d) - LOG0) / DECADAS + (r() - 0.5) * 0.025)));
  }
  // Each star hangs from the nearest star nearer the Sun (biased to the Sun): a tree that branches outwards.
  const orden = pos.map((_, i) => i).sort((a, c) => pos[a].length() - pos[c].length());
  const padre = new Int32Array(N).fill(-1);
  for (let k = 1; k < N; k++) {
    const i = orden[k];
    let mejor = -1;
    let mejorD = Infinity;
    const di = pos[i].length();
    for (let m = Math.max(0, k - 900); m < k; m++) {
      const j = orden[m];
      const d = pos[i].distanceTo(pos[j]) + 0.25 * Math.abs(di - pos[j].length());
      if (d < mejorD) {
        mejorD = d;
        mejor = j;
      }
    }
    // The nearest ones hang from the Sun itself.
    padre[i] = pos[i].length() < pos[i].distanceTo(pos[mejor]) * 1.2 ? -1 : mejor;
  }

  const sb = materiaBuilder(303);
  const tAttr: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    c.setRGB(1, 0.88, 0.74).lerp(new THREE.Color(0.78, 0.86, 1), r());
    sb.push(pos[i].x, pos[i].y, pos[i].z, c, 0.00001, 0.45 + 0.9 * Math.pow(r(), 3));
    tAttr.push(t[i]);
  }
  const estrellas = materia(sb.data(), {
    pre: /* glsl */ `attribute float aT; uniform float uRed, uOn; uniform vec3 uTeal;`,
    move: /* glsl */ `
      float llegada = smoothstep(aT - 0.004, aT, uRed);
      float destello = exp(-pow((uRed - aT) / 0.012, 2.0)) * step(aT, uRed + 0.03);
      em = mix(em, uTeal * 1.3, llegada) * (1.0 + 3.0 * destello);
      // What the front left far behind (decades inside) crowds into a few pixels: it fades, so the
      // network shows at the scale where it grows.
      em *= uOn * mix(1.0, 0.05, smoothstep(0.16, 0.42, uRed - aT));
    `,
    uniforms: { uRed: { value: 0 }, uOn: { value: 1 }, uTeal: { value: TEAL.clone() } },
    extra: { aT: [new Float32Array(tAttr), 1] },
  });
  estrellas.u.uSpread.value = 0;
  estrellas.u.uFuente.value = 1;
  estrellas.points.position.copy(centro);

  // The threads: from each star's parent (or the Sun) to it, grown from the parent's time to its own.
  const hb = materiaBuilder(307);
  const t0: number[] = [];
  const t1: number[] = [];
  const PASOS = 16;
  for (let i = 0; i < N; i++) {
    const a = padre[i] >= 0 ? pos[padre[i]] : V();
    const ta = padre[i] >= 0 ? t[padre[i]] : 0;
    for (let k = 0; k < PASOS; k++) {
      const s = (k + 0.5) / PASOS;
      const p = a.clone().lerp(pos[i], s);
      hb.push(p.x, p.y, p.z, TEAL, 0.00001, 0.3, { kind: s });
      t0.push(ta);
      t1.push(Math.max(t[i], ta + 0.002));
    }
  }
  const hilos = materia(hb.data(), {
    pre: /* glsl */ `attribute float aT0, aT1; uniform float uRed, uOn;`,
    move: /* glsl */ `
      // Grown as far as the front has come along it; brightest at its growing tip.
      float llega = mix(aT0, aT1, aKind);
      float hecho = step(llega, uRed);
      float punta = exp(-pow((uRed - llega) / 0.01, 2.0));
      em *= uOn * hecho * (0.55 + 2.5 * punta) * mix(1.0, 0.04, smoothstep(0.14, 0.4, uRed - llega));
    `,
    uniforms: { uRed: { value: 0 }, uOn: { value: 1 } },
    extra: { aT0: [new Float32Array(t0), 1], aT1: [new Float32Array(t1), 1] },
  });
  hilos.u.uSpread.value = 0;
  hilos.u.uFuente.value = 1;
  hilos.points.position.copy(centro);

  // The spark's branch: from the farthest star roughly `hacia`, back to the Sun.
  const dir = hacia.clone().normalize();
  let hojaI = 0;
  let mejor = -Infinity;
  for (let i = 0; i < N; i++) {
    const d = pos[i].length();
    const score = Math.log10(d) * 1.0 + 3 * pos[i].clone().divideScalar(d).dot(dir);
    if (d > frente(0.97) && score > mejor) {
      mejor = score;
      hojaI = i;
    }
  }
  const camino: { p: THREE.Vector3; t: number }[] = [];
  for (let i = hojaI; i >= 0; i = padre[i]) camino.unshift({ p: pos[i], t: t[i] });
  camino.unshift({ p: V(), t: 0 });
  const rama = (red: number, out: THREE.Vector3) => {
    const x = Math.min(camino[camino.length - 1].t, Math.max(0, red));
    let k = 0;
    while (k < camino.length - 2 && camino[k + 1].t <= x) k++;
    const a = camino[k];
    const c2 = camino[k + 1];
    const s = c2.t > a.t ? (x - a.t) / (c2.t - a.t) : 1;
    return out.copy(a.p).lerp(c2.p, THREE.MathUtils.smoothstep(s, 0, 1)).add(centro);
  };
  return { estrellas, hilos, rama, hoja: pos[hojaI].clone().add(centro) };
}
