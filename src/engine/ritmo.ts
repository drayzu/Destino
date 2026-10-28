import type { Caption } from './timeline';
import type { Vista } from './vista';

/**
 * The journey's pace. The acts are written in beats, but a beat is not always the same amount of
 * picture: in a moment the camera drifts; in a flight between worlds it crosses scales and turns in
 * a fraction of one. Read from the camera (how much it zooms and turns per beat) and from the
 * captions (journeys, and how long the words take to read), each beat gets its weight:
 *
 * - by hand, the page: a beat in flight takes more scroll than a still one, so a steady hand sees
 *   the flight unfold instead of a jump cut, and lingers less where nothing moves; and in a flight
 *   the film follows a flick at a pace it can be seen at, falling a little behind instead;
 * - with autoplay, the clock: flights keep their brisk pace (that is what makes the film lively),
 *   moments last about as long as their words take to read, and no longer.
 */
export interface Ritmo {
  /** Every array is sampled every `res` beats. */
  res: number;
  /** How much the picture changes per beat, in views (see `cambio`). */
  flujo: Float32Array;
  /** Page pixels per beat, by hand. */
  px: Float32Array;
  /** Beats per second with autoplay. */
  auto: Float32Array;
  /** The fastest the film follows the hand, in beats per second. */
  tope: Float32Array;
}

export const RES = 0.05;

/** How long a journey's name takes to fade in and out (beats): its stretch is short and in flight. */
export const FUNDIDO_VIAJE = 0.2;

export interface Peso {
  from: number;
  to: number;
  flujo: number;
}

/** The knobs (`ritmoDe` takes others, to try them from the console). */
export const AJUSTE = {
  // By hand: page pixels per beat where nothing moves, and per view of change; at most this many.
  pxQuieto: 330,
  pxVista: 400,
  pxMax: 1500,
  // The most views per second the film shows when the hand runs ahead (a flight seen whole, still brisk).
  vistasPorSegundo: 2.4,
  // A journey between moments always weighs as a flight, even when the camera stays (a fade between eras).
  viaje: 1.2,
  // Autoplay: the fastest it goes once the words are read, and the slowest (beats per second: low
  // enough that a long text in a short moment is still read whole); the views per second a flight may
  // show (it was tuned at 0.55 beats per second, and only the sharpest turns go slower); the reading:
  // a pause plus words per second (about a subtitle's pace, with the picture to look at too); a
  // journey's name, a shorter pause and the same pace.
  autoMax: 0.9,
  autoMin: 0.12,
  autoVistas: 1.75,
  leerPausa: 1.0,
  palabrasPorSegundo: 3.5,
  viajePausa: 0.5,
  // The most the autoplay changes its pace, in beats per second, each second.
  autoAcel: 0.3,
};

/** `vista(p)`: where the camera is at beat p, as the film shows it. */
export function medirRitmo(length: number, vista: (p: number) => Vista, momentos: readonly Caption[], k = AJUSTE, pesos: readonly Peso[] = []): Ritmo {
  const n = Math.ceil(length / RES) + 1;
  // How far the picture moves from each sample to the next.
  const crudo = new Float32Array(n);
  let a = vista(0);
  for (let i = 0; i < n - 1; i++) {
    const b = vista(Math.min(length, (i + 1) * RES));
    crudo[i] = cambio(a, b) / RES;
    a = b;
  }
  crudo[n - 1] = crudo[n - 2];
  return ritmoDe(crudo, momentos, k, pesos);
}

/** The pace from the camera's change per beat (sampled every `RES` beats) and the captions. */
export function ritmoDe(crudo: Float32Array, momentos: readonly Caption[], k = AJUSTE, pesos: readonly Peso[] = []): Ritmo {
  const n = crudo.length;
  const base = Float32Array.from(crudo);
  for (const c of momentos) if (c.viaje) for (let i = Math.max(0, Math.ceil(c.from / RES)); i <= Math.min(n - 1, Math.floor(c.to / RES)); i++) base[i] = Math.max(base[i], k.viaje);
  // (and what the acts say changes there though the camera hardly moves)
  for (const w of pesos) for (let i = Math.max(0, Math.ceil(w.from / RES)); i <= Math.min(n - 1, Math.floor(w.to / RES)); i++) base[i] = Math.max(base[i], w.flujo);
  // Its surroundings: a burst weighs on the beats around it, so the pace eases in before a flight
  // and out after it instead of braking at its edge.
  const flujo = suavizar(maximo(base, 6), 10);

  // How long each beat must last for the words on screen to be read (autoplay only).
  const leer = new Float32Array(n);
  // (and, for each, the samples where it is fully on screen and the seconds they must last)
  const lecturas: { a: number; b: number; s: number }[] = [];
  for (const c of momentos) {
    if (!c.viaje && !c.fact) continue;
    const palabras = `${c.name} ${c.fact}`.trim().split(/\s+/).length;
    // (it fades in and out at each end: a moment over 0.45 beats, a journey's name over `FUNDIDO_VIAJE`)
    const fundido = c.viaje ? FUNDIDO_VIAJE : 0.45;
    const necesita = (c.viaje ? k.viajePausa : k.leerPausa) + palabras / k.palabrasPorSegundo;
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
  // The autoplay changes pace gently (over about a beat and a half). Smoothing borrows pace from the
  // flights around a short moment, so a moment still read too fast is slowed again until it is not.
  const auto = new Float32Array(n);
  const ritmoAuto = () => {
    const lento = suavizar(segundos, 15);
    for (let i = 0; i < n; i++) auto[i] = Math.min(k.autoMax, Math.max(k.autoMin, 1 / lento[i]));
    // (and never speeds up or brakes harder than `autoAcel`: into a still moment it slows over a
    // couple of seconds, not in a jolt; only ever slower, so nothing is read faster)
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
  return { res: RES, flujo, px, auto, tope };
}

/**
 * How much the picture changes from one view to the next, in views: zooming by a factor of e, or
 * turning across a field of view. Each saturates (past a few views per beat it is all a rush), and
 * the camera moving along with what it looks at (riding a sail) changes nothing.
 */
function cambio(a: Vista, b: Vista) {
  const da = a.pos.distanceTo(a.target);
  const db = b.pos.distanceTo(b.target);
  if (!(da > 0 && db > 0)) return 0;
  const zoom = Math.abs(Math.log(db / da));
  const ua = a.target.clone().sub(a.pos).divideScalar(da);
  const ub = b.target.clone().sub(b.pos).divideScalar(db);
  const giro = Math.acos(Math.min(1, Math.max(-1, ua.dot(ub)))) / ((b.fov * Math.PI) / 180);
  const r = Math.hypot(saturar(zoom / RES) * RES, saturar(giro / RES) * RES);
  return Number.isFinite(r) ? r : 0;
}

const saturar = (x: number) => x / (1 + x / 4);

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
