import { clamp, damp } from './math';
import type { Ritmo } from './ritmo';

/**
 * Native page scroll drives the journey: trackpads, touch, keyboard and the scrollbar all work,
 * however long the page gets. A spacer gives the document its length; progress (in beats) glides
 * after the scroll position. Once the journey's pace is known (`ritmo`), a beat in flight takes
 * more page than a still one, the film never follows a flick faster than it can be seen, and
 * autoplay changes its speed with the film.
 */

// How much page one beat takes, and the autoplay's speed, until the pace is known.
const PX_PER_BEAT = 460;
const AUTO = 0.55;
// In a flight the film may fall behind a fast hand, but by no more than about this many seconds; and
// far behind (a jump, the scrollbar: this many beats and more) it hurries as before.
const ATRASO = 1.2;
const SALTO = 6;

export function createScroll(spacer: HTMLElement, length: number) {
  let r: Ritmo = {
    res: length,
    flujo: new Float32Array([0, 0]),
    px: new Float32Array([PX_PER_BEAT, PX_PER_BEAT]),
    auto: new Float32Array([AUTO, AUTO]),
    tope: new Float32Array([1e6, 1e6]),
  };
  // Where each sample's stretch of page starts.
  let inicio = new Float64Array(0);
  const medir = () => {
    inicio = new Float64Array(r.px.length + 1);
    for (let i = 0; i < r.px.length; i++) inicio[i + 1] = inicio[i] + r.px[i] * r.res;
    spacer.style.height = `${aPx(length) + innerHeight}px`;
  };
  const muestra = (b: number) => clamp(Math.floor(b / r.res), 0, r.px.length - 1);
  const aPx = (b: number) => {
    b = clamp(b, 0, length);
    const i = muestra(b);
    return inicio[i] + (b - i * r.res) * r.px[i];
  };
  const aBeat = (y: number) => {
    let lo = 0;
    let hi = r.px.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (inicio[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    return clamp(lo * r.res + (y - inicio[lo]) / r.px[lo], 0, length);
  };
  medir();

  let target = 0;
  let p = 0;
  let autoplay = false;
  // Autoplay keeps its own place (the page rounds the scroll to whole pixels) and where it put the page.
  let cabeza = 0;
  let puesto = 0;

  const read = () => {
    if (!autoplay) target = aBeat(scrollY);
  };
  addEventListener('scroll', read, { passive: true });
  addEventListener('resize', () => (spacer.style.height = `${aPx(length) + innerHeight}px`));
  // Any manual input takes over from autoplay (keys only when they move the page: turning on the
  // sound or the plate must not stop the film).
  addEventListener('wheel', () => (autoplay = false), { passive: true });
  // A tap on the buttons is not a scroll (or tapping "play" could never pause).
  addEventListener('touchstart', (ev) => !(ev.target as Element | null)?.closest?.('.chips') && (autoplay = false), { passive: true });
  const MOVES = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
  addEventListener('keydown', (ev) => {
    if (MOVES.has(ev.key)) autoplay = false;
  });

  const params = new URLSearchParams(location.search);
  // ?ver=6 freezes the journey at beat 6 without scrolling the page (for reviewing a moment).
  let frozen = params.has('ver') ? clamp(Number(params.get('ver')), 0, length) : null;
  if (params.has('p')) {
    const start = clamp(Number(params.get('p')), 0, length);
    const go = () => {
      scrollTo(0, aPx(start));
      p = target = start;
    };
    // Now, a frame later, and once loaded (a reload would otherwise put back the old position).
    history.scrollRestoration = 'manual';
    go();
    requestAnimationFrame(go);
    addEventListener('load', go, { once: true });
  }

  const sample = (a: Float32Array, b: number) => a[muestra(b)];

  return {
    length,
    get progress() {
      return p;
    },
    get playing() {
      return autoplay;
    },
    /** The journey's pace: the page is laid out again, keeping the beat where it is. */
    ritmo(nuevo: Ritmo) {
      const b = target;
      r = nuevo;
      medir();
      scrollTo(0, aPx(b));
      target = cabeza = b;
      puesto = aPx(b);
    },
    get ritmoActual() {
      return r;
    },
    jump(beat: number) {
      autoplay = false;
      scrollTo({ top: aPx(beat), behavior: 'smooth' });
    },
    /** Back to the beginning at once, without travelling back through everything (the loop). */
    restart() {
      scrollTo(0, 0);
      p = target = cabeza = puesto = 0;
    },
    togglePlay() {
      if (!autoplay && target >= length - 0.05) {
        scrollTo(0, 0);
        p = target = 0;
      }
      autoplay = !autoplay;
      cabeza = target;
      puesto = scrollY;
    },
    /** Holds the journey at a beat (null lets the scroll drive it again). */
    freeze(beat: number | null) {
      frozen = beat === null ? null : clamp(beat, 0, length);
    },
    get held() {
      return frozen;
    },
    /** Returns the progress for this frame. */
    update(dt: number) {
      if (frozen !== null) return (p = frozen);
      if (autoplay) {
        // The scrollbar moved the page under it: go on from there.
        if (Math.abs(scrollY - puesto) > 2) cabeza = aBeat(scrollY);
        cabeza = Math.min(length, cabeza + dt * sample(r.auto, cabeza));
        puesto = aPx(cabeza);
        scrollTo(0, puesto);
        target = cabeza;
        // (at the end it keeps playing: the page loops back to the cover)
      } else read();
      // Follows the hand closely (a long glide reads as lag), still smoothing a wheel's steps; but in
      // a flight, never faster than the picture can be followed, unless that leaves it far behind.
      const gap = target - p;
      let paso = damp(p, target, 4.6, dt) - p;
      if (!autoplay) {
        const lejos = Math.abs(gap) / SALTO;
        const tope = Math.max(sample(r.tope, p), (Math.abs(gap) / ATRASO) * (1 + lejos * lejos)) * dt;
        paso = clamp(paso, -tope, tope);
      }
      p += paso;
      return p;
    },
  };
}
