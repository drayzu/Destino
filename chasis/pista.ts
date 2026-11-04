/**
 * A baked track (tools/hornear.mjs, chasis/camaras.json): values at keys, read in between by the same
 * monotone cubic as the acts' timelines (estudios/timeline.ts), so a camera flows through its keys
 * and never overshoots them. Changing a key changes the film only between its two neighbours.
 */
export class Pista {
  private m: Float64Array;
  constructor(
    readonly p: number[],
    readonly v: number[],
  ) {
    const n = p.length;
    this.m = new Float64Array(n);
    for (let k = 1; k < n - 1; k++) {
      const h0 = p[k] - p[k - 1];
      const h1 = p[k + 1] - p[k];
      if (h0 <= 0 || h1 <= 0) continue;
      const d0 = (v[k] - v[k - 1]) / h0;
      const d1 = (v[k + 1] - v[k]) / h1;
      if (d0 * d1 <= 0) continue;
      const w1 = 2 * h1 + h0;
      const w2 = h1 + 2 * h0;
      this.m[k] = (w1 + w2) / (w1 / d0 + w2 / d1);
    }
  }

  get(x: number) {
    const { p, v, m } = this;
    const n = p.length;
    if (x <= p[0]) return v[0];
    if (x >= p[n - 1]) return v[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (p[mid] <= x) lo = mid;
      else hi = mid;
    }
    const h = p[hi] - p[lo];
    const t = (x - p[lo]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * v[hi] + (t3 - t2) * h * m[hi];
  }
}

/** An act's baked camera: position, orientation (quaternion), fov, log of its distance to what it frames, how much it follows the spark. */
export interface CamaraHorneada {
  p: number[];
  x: number[];
  y: number[];
  z: number[];
  qx: number[];
  qy: number[];
  qz: number[];
  qw: number[];
  fov: number[];
  ld: number[];
  lw: number[];
}

export function pistasDe(c: CamaraHorneada) {
  const P = (k: keyof Omit<CamaraHorneada, 'p'>) => new Pista(c.p, c[k]);
  return { x: P('x'), y: P('y'), z: P('z'), qx: P('qx'), qy: P('qy'), qz: P('qz'), qw: P('qw'), fov: P('fov'), ld: P('ld'), lw: P('lw') };
}
