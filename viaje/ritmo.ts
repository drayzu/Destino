import type { Caption } from '../estudios/timeline';

/**
 * The journey's pace (Destino's own, 28 Oct 2026, brought to the remake). The acts are written in
 * beats, but a beat is not always the same amount of picture: in a moment the camera drifts; in a
 * flight it turns or crosses scales in a fraction of one. Read from the camera (how much it zooms
 * and turns per beat) and from the captions (how long the words take to read), each beat gets its
 * weight:
 *
 * - by hand, the page: a beat in flight takes more scroll than a still one, so a steady hand sees
 *   the flight unfold instead of a jump cut; and when the hand runs ahead (a flick of the wheel),
 *   the film follows at a pace it can be seen at, falling a little behind instead of jumping;
 * - with autoplay, the clock: flights keep their brisk pace, moments last about as long as their
 *   words take to read.
 */
export interface Ritmo {
  /** Every array is sampled every `RES` beats. */
  flujo: Float32Array;
  /** Page pixels per beat, by hand. */
  px: Float32Array;
  /** Beats per second with autoplay. */
  auto: Float32Array;
  /** The fastest the film follows the hand, in beats per second. */
  tope: Float32Array;
}

export const RES = 0.05;

export const AJUSTE = {
  // By hand: page pixels per beat where nothing moves, and per view of change; at most this many.
  pxQuieto: 360,
  pxVista: 420,
  pxMax: 1600,
  // The most views per second the film shows when the hand runs ahead.
  vistasPorSegundo: 2.2,
  // Autoplay: fastest and slowest (beats per second), the views per second a flight may show, the
  // reading (a pause plus words per second), and the most it changes pace per second.
  autoMax: 0.6,
  autoMin: 0.12,
  autoVistas: 1.75,
  leerPausa: 1.0,
  palabrasPorSegundo: 3.5,
  autoAcel: 0.3,
};

/** One view: where the camera looks (unit vector), the log of how far it is from what it frames, its fov (degrees). */
export interface Vista {
  dir: { x: number; y: number; z: number };
  lz: number;
  fov: number;
}

/**
 * How much the picture changes from one view to the next, in views: zooming by a factor of e, or
 * turning across a field of view. Each saturates (past a few views per beat it is all a rush).
 */
export function cambio(a: Vista, b: Vista) {
  const zoom = Math.abs(b.lz - a.lz);
  const d = a.dir.x * b.dir.x + a.dir.y * b.dir.y + a.dir.z * b.dir.z;
  const giro = Math.acos(Math.min(1, Math.max(-1, d))) / ((b.fov * Math.PI) / 180);
  const r = Math.hypot(saturar(zoom / RES) * RES, saturar(giro / RES) * RES);
  return Number.isFinite(r) ? r : 0;
}

const saturar = (x: number) => x / (1 + x / 4);

/** The pace from the camera's change per beat (`crudo`, sampled every `RES` beats) and the captions (journey beats). */
export function ritmoDe(crudo: Float32Array, momentos: readonly Caption[], k = AJUSTE): Ritmo {
  const n = crudo.length;
  // A burst weighs on the beats around it, so the pace eases in before a flight and out after it.
  const flujo = suavizar(maximo(crudo, 6), 10);

  // How long each beat must last for the words on screen to be read (autoplay only).
  const leer = new Float32Array(n);
  const lecturas: { a: number; b: number; s: number }[] = [];
  for (const c of momentos) {
    if (!c.fact) continue;
    const palabras = `${c.name} ${c.fact}`.trim().split(/\s+/).length;
    const fundido = 0.45;
    const necesita = k.leerPausa + palabras / k.palabrasPorSegundo;
    const s = necesita / Math.max(0.5, c.to - c.from - 1.3 * fundido);
    for (let i = Math.max(0, Math.ceil(c.from / RES)); i <= Math.min(n - 1, Math.floor(c.to / RES)); i++) leer[i] = Math.max(leer[i], s);
    const a = Math.max(0, Math.ceil((c.from + fundido) / RES));
    const b = Math.min(n - 1, Math.floor((c.to - fundido) / RES));
    if (b > a) lecturas.push({ a, b, s: necesita });
  }

  const px = new Float32Array(n);
  const tope = new Float32Array(n);
  const segundos = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = flujo[i];
    px[i] = Math.min(k.pxMax, Math.hypot(k.pxQuieto, f * k.pxVista));
    tope[i] = k.vistasPorSegundo / Math.max(f, 1e-3);
    segundos[i] = Math.max(1 / k.autoMax, f / k.autoVistas, leer[i]);
  }
  const auto = new Float32Array(n);
  const ritmoAuto = () => {
    const lento = suavizar(segundos, 15);
    for (let i = 0; i < n; i++) auto[i] = Math.min(k.autoMax, Math.max(k.autoMin, 1 / lento[i]));
    for (let i = 1; i < n; i++) auto[i] = Math.min(auto[i], auto[i - 1] + (k.autoAcel * RES) / auto[i - 1]);
    for (let i = n - 2; i >= 0; i--) auto[i] = Math.min(auto[i], auto[i + 1] + (k.autoAcel * RES) / auto[i + 1]);
  };
  ritmoAuto();
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    let corto = false;
    for (const l of lecturas) {
      let dura = 0;
      for (let i = l.a; i <= l.b; i++) dura += RES / auto[i];
      if (dura >= 0.97 * l.s) continue;
      corto = true;
      for (let i = l.a; i <= l.b; i++) segundos[i] *= l.s / dura;
    }
    if (!corto) break;
    ritmoAuto();
  }
  return { flujo, px, auto, tope };
}

/** The page: pixels from the top to each sample (cumulative), and back. */
export class Pagina {
  private y: Float64Array;
  constructor(private r: Ritmo) {
    const n = r.px.length;
    this.y = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) this.y[i + 1] = this.y[i] + r.px[i] * RES;
  }
  get alto() {
    return this.y[this.y.length - 1];
  }
  /** Page pixels at beat P. */
  yDe(P: number) {
    const x = P / RES;
    const i = Math.max(0, Math.min(this.y.length - 2, Math.floor(x)));
    return this.y[i] + (this.y[i + 1] - this.y[i]) * (x - i);
  }
  /** The beat at page pixels y. */
  pDe(y: number) {
    let lo = 0;
    let hi = this.y.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.y[m] <= y) lo = m;
      else hi = m;
    }
    const d = this.y[hi] - this.y[lo];
    return (lo + (d > 0 ? (y - this.y[lo]) / d : 0)) * RES;
  }
  /** Any per-sample value at beat P. */
  en(a: Float32Array, P: number) {
    const i = Math.max(0, Math.min(a.length - 1, Math.round(P / RES)));
    return a[i];
  }
}

function maximo(x: Float32Array, r: number) {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let m = 0;
    for (let k = Math.max(0, i - r); k <= Math.min(x.length - 1, i + r); k++) m = Math.max(m, x[k]);
    out[i] = m;
  }
  return out;
}

function suavizar(x: Float32Array, r: number) {
  const s = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) s[i + 1] = s[i] + x[i];
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const a = Math.max(0, i - r);
    const b = Math.min(x.length, i + r + 1);
    out[i] = (s[b] - s[a]) / (b - a);
  }
  return out;
}
