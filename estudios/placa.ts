import { tr } from './idioma';
import * as THREE from 'three';
import { clamp, smoothstep } from './motor/math';

/**
 * Infinito's plate: everything drawn in 2D over the film, in device pixels, so a capture holds it.
 * - The count (bottom left): how many, as a power of ten and, when that is not enough, as a tower
 *   of powers (10^10^29) with every floor raised by hand (Geist Mono lacks the superscripts).
 * - The ladder (right): a tower. Each floor is one more «10 to the»: 1, 10, 10¹⁰, 10^10^10…
 *   (the height is the super-logarithm, `slog`), and above the last floor, past a gap, the
 *   infinities (ℵ₀, 2^ℵ₀). Solid where counted, dashed where physics estimates, dotted beyond.
 */

export const FONT = {
  serif: (px: number) => `${px}px "Instrument Serif"`,
  italic: (px: number) => `italic ${px}px "Instrument Serif"`,
  mono: (px: number) => `500 ${px}px "Geist Mono Variable"`,
  sans: (px: number) => `500 ${px}px "Geist Variable"`,
};

/** The work's colour in the series: teal (VIOLETA keeps Infinito's name for the shared code). */
export const VIOLETA = '#6fe3c1';
export const violeta = (a = 1) => `rgba(111,227,193,${a})`;
export const ink = (a = 1) => `rgba(236,231,219,${a})`;

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export const sup = (n: number | string) => [...String(n)].map((ch) => SUP[ch] ?? ch).join('');
export const grupo = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Base-10 super-logarithm, linear between floors: slog(1) = 1, slog(10) = 2, slog(10¹⁰) = 3. */
export function slog(x: number) {
  let n = 0;
  while (x > 1) {
    x = Math.log10(x);
    n++;
  }
  return n + Math.max(0, x);
}
/** The ladder height of 10^e. */
export const h10 = (e: number) => 1 + slog(Math.max(e, 0));
/** The ladder height of 10^10^e. */
export const h1010 = (e: number) => 2 + slog(Math.max(e, 0));

/**
 * A count as tower floors, from a log10 (any size a double holds): 3 → ['1 000'],
 * 80 → ['10', '80'], 1e29 → ['10', '10', '29'].
 */
export function pisos(l: number): string[] {
  if (l < 6) return [grupo(Math.pow(10, l))];
  if (l < 1e6) return ['10', String(Math.floor(l))];
  return ['10', '10', String(Math.floor(Math.log10(l)))];
}

/**
 * A count as tower floors from its ladder height (the inverse of `slog`): 2.56 → ['4 096'],
 * 3.28 → ['10', '80'], 4.165 → ['10', '10', '29']. Lets a scene animate the height smoothly
 * across floors and still write the number right.
 */
export function deH(h: number): string[] {
  let k = Math.floor(h);
  let v = h - k;
  while (k > 0 && v < 6) {
    v = Math.pow(10, v);
    k--;
  }
  if (k === 0) return [grupo(v)];
  return [...new Array<string>(k).fill('10'), String(Math.round(v))];
}

// ---------------------------------------------------------------- drawing helpers

export function proyectar(v: THREE.Vector3, camera: THREE.Camera, W: number, H: number, out = { x: 0, y: 0, z: 0 }) {
  const p = v.clone().project(camera);
  out.x = ((p.x + 1) / 2) * W;
  out.y = ((1 - p.y) / 2) * H;
  out.z = p.z;
  return out;
}

/** A tower of powers at (x, y): every floor smaller and raised over the one below. Returns its width. */
export function torre(g: CanvasRenderingContext2D, x: number, y: number, floors: string[], px: number, color = ink()) {
  let cx = x;
  let cy = y;
  let s = px;
  g.fillStyle = color;
  for (const [i, f] of floors.entries()) {
    g.font = FONT.serif(s);
    g.fillText(f, cx, cy);
    cx += g.measureText(f).width + s * 0.03;
    if (i < floors.length - 1) {
      cy -= s * 0.42;
      s *= 0.54;
    }
  }
  return cx - x;
}

export function wrap(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** A line of text on the film (sans, or mono when `mono`), with a soft shadow. */
export function texto(g: CanvasRenderingContext2D, u: number, x: number, y: number, s: string, color: string, alpha: number, px = 13, align: CanvasTextAlign = 'left', mono = true) {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  g.font = mono ? FONT.mono(px * u) : FONT.sans(px * u);
  g.letterSpacing = mono ? `${1.1 * u}px` : '0px';
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.9)';
  g.shadowBlur = 10 * u;
  g.fillStyle = color;
  g.fillText(mono ? s.toUpperCase() : s, x, y);
  g.restore();
}

/** A note: a dot on the thing, a leader out to (x + dx, y + dy), and its label. */
export function nota(g: CanvasRenderingContext2D, u: number, x: number, y: number, text: string, dx: number, dy: number, alpha = 1, accent = VIOLETA) {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  const lx = x + dx * u;
  const ly = y + dy * u;
  g.strokeStyle = ink(0.55);
  g.lineWidth = Math.max(1, u * 0.9);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(lx, ly);
  g.stroke();
  g.fillStyle = accent;
  g.beginPath();
  g.arc(x, y, 2.4 * u, 0, Math.PI * 2);
  g.fill();
  g.font = FONT.mono(10.5 * u);
  g.letterSpacing = `${1.1 * u}px`;
  const label = text.toUpperCase();
  const w = g.measureText(label).width;
  const tx = dx >= 0 ? lx + 6 * u : lx - 6 * u - w;
  g.fillStyle = 'rgba(4,4,8,0.5)';
  g.fillRect(tx - 5 * u, ly - 9 * u, w + 10 * u, 17 * u);
  g.fillStyle = ink(0.92);
  g.textBaseline = 'middle';
  g.fillText(label, tx, ly + 0.5 * u);
  g.restore();
}

/** A big number on the film (the numbers are the show), centred on x: a tower too. */
export function cifra(g: CanvasRenderingContext2D, u: number, x: number, y: number, floors: string[], px: number, alpha = 1, color = VIOLETA, under = '') {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 14 * u;
  g.textBaseline = 'alphabetic';
  // Measure, then draw centred.
  const m = document.createElement('canvas').getContext('2d')!;
  const w = torre(m, 0, 0, floors, px * u);
  torre(g, x - w / 2, y, floors, px * u, color);
  if (under) {
    g.font = FONT.mono(10.5 * u);
    g.letterSpacing = `${1.2 * u}px`;
    g.textAlign = 'center';
    g.fillStyle = ink(0.75);
    g.fillText(under.toUpperCase(), x, y + 28 * u);
  }
  g.restore();
}

// ---------------------------------------------------------------- the count

export interface Rotulo {
  /** «II · Todas tus ramas». */
  capitulo?: string;
  name: string;
  fact: string;
}

/** What the clock reads: tower floors, a unit, a mono line, and the height on the ladder. */
export interface Cuenta {
  pisos: string[];
  unidad?: string;
  linea: string;
  /** Ladder height (super-logarithm; 5.7 = ℵ₀, 6.3 = 2^ℵ₀). */
  h: number;
  a?: number;
  /** Destino: the estimated year («año 2060»), first on the line. */
  anio?: string;
  /** Destino: how far we reach («3 mundos», «2 estrellas»), in teal after the line. */
  alcance?: string;
  /** 0..1: the reach just changed (it glows a moment). */
  nuevo?: number;
}

/** The count at bottom left, with the moment's chapter, name and sentence above it. */
export function cuenta(g: CanvasRenderingContext2D, u: number, H: number, c0: Cuenta | null, cap0: Rotulo | null, capAlpha = 1) {
  const x = 44 * u;
  // (in the journey's language)
  const cap = cap0 ? { capitulo: cap0.capitulo ? tr(cap0.capitulo) : cap0.capitulo, name: tr(cap0.name), fact: tr(cap0.fact) } : null;
  const c = c0 ? { ...c0, linea: tr(c0.linea), alcance: c0.alcance ? tr(c0.alcance) : c0.alcance } : null;
  g.save();
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 12 * u;
  if (cap && capAlpha > 0.01) {
    g.globalAlpha = capAlpha;
    if (cap.capitulo) {
      g.font = FONT.mono(10.5 * u);
      g.letterSpacing = `${1.6 * u}px`;
      g.fillStyle = VIOLETA;
      g.fillText(cap.capitulo.toUpperCase(), x, H - 272 * u);
      g.letterSpacing = '0px';
    }
    g.font = FONT.italic(31 * u);
    g.fillStyle = ink();
    g.fillText(cap.name, x, H - 236 * u);
    g.font = FONT.sans(14 * u);
    g.fillStyle = ink(0.62);
    wrap(g, cap.fact, 470 * u).forEach((line, i) => g.fillText(line, x, H - 208 * u + i * 20 * u));
    g.globalAlpha = 1;
  }
  if (c && (c.a ?? 1) > 0.01) {
    g.globalAlpha = c.a ?? 1;
    const w = torre(g, x, H - 86 * u, c.pisos, 66 * u);
    if (c.unidad) {
      g.font = FONT.serif(26 * u);
      g.fillStyle = ink(0.6);
      g.fillText(c.unidad, x + w + 14 * u, H - 88 * u);
    }
    g.font = FONT.mono(11 * u);
    g.letterSpacing = `${0.9 * u}px`;
    g.fillStyle = ink(0.78);
    const sep = '  ·  ';
    let x0 = x;
    if (c.anio) {
      g.fillStyle = ink(0.92);
      g.fillText(c.anio.toUpperCase(), x0, H - 52 * u);
      x0 += g.measureText(c.anio.toUpperCase()).width;
      g.fillStyle = ink(0.4);
      g.fillText(sep, x0, H - 52 * u);
      x0 += g.measureText(sep).width;
      g.fillStyle = ink(0.78);
    }
    g.fillText(c.linea.toUpperCase(), x0, H - 52 * u);
    if (c.alcance) {
      const x1 = x0 + g.measureText(c.linea.toUpperCase() + sep).width;
      g.fillStyle = ink(0.4);
      g.fillText(sep, x0 + g.measureText(c.linea.toUpperCase()).width, H - 52 * u);
      const n = c.nuevo ?? 0;
      g.shadowColor = n > 0.01 ? violeta(0.9 * n) : 'rgba(0,0,0,0.85)';
      g.shadowBlur = (12 + 10 * n) * u;
      g.fillStyle = VIOLETA;
      g.fillText(c.alcance.toUpperCase(), x1, H - 52 * u);
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- the ladder: a tower

interface Peldano {
  h: number;
  label: string;
}
/** Landmarks on the tower (estimates checked before the texts are written). */
const PELDANOS: Peldano[] = [
  { h: h10(80), label: 'protones del universo' },
  { h: h10(122), label: 'bits en el horizonte' },
  { h: h10(500), label: 'paisaje de cuerdas' },
  { h: h1010(29), label: 'hasta tu doble · m' },
  { h: h1010(50), label: 'cerebro de Boltzmann · años' },
  { h: h1010(122), label: 'estados de un universo' },
  { h: 2 + h10(7), label: 'universos · Linde' },
  { h: 5.75, label: 'ℵ₀ · lo contable' },
  { h: 6.3, label: '2^ℵ₀ · lo continuo' },
];
const FLOORS: string[][] = [['1'], ['10'], ['10', '10'], ['10', '10', '10'], ['10', '10', '10', '10']];
const H0 = 1;
const HTOP = 6.5;
const HCUT = 5.35;

/** The ladder at the right edge, filled in violet up to `h`. */
export function escalera(g: CanvasRenderingContext2D, u: number, W: number, H: number, h: number, alpha = 1) {
  if (alpha <= 0.01) return;
  const x = W - 64 * u;
  const y0 = H - 70 * u;
  const y1 = 86 * u;
  const yOf = (v: number) => y0 + ((v - H0) / (HTOP - H0)) * (y1 - y0);
  g.save();
  g.globalAlpha = alpha;
  g.lineWidth = Math.max(1, 1.1 * u);
  const seg = (a: number, b: number, dash: number[], al: number) => {
    g.setLineDash(dash.map((d) => d * u));
    g.strokeStyle = ink(al);
    g.beginPath();
    g.moveTo(x, yOf(a));
    g.lineTo(x, yOf(b));
    g.stroke();
  };
  seg(H0, h10(80), [], 0.45);
  seg(h10(80), HCUT, [5, 4], 0.4);
  seg(5.62, HTOP, [1.5, 4], 0.4);
  g.setLineDash([]);
  // The gap between the finite and the infinite.
  g.font = FONT.serif(16 * u);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = ink(0.5);
  g.fillText('∞', x, yOf(5.49));
  // Floors.
  g.textAlign = 'right';
  for (const [i, f] of FLOORS.entries()) {
    const yy = yOf(i + 1);
    g.strokeStyle = ink(0.32);
    g.beginPath();
    g.moveTo(x - 9 * u, yy);
    g.lineTo(x, yy);
    g.stroke();
    const near = 1 - smoothstep(0.6, 1.6, Math.abs(i + 1 - h));
    g.globalAlpha = alpha * (0.3 + 0.45 * near);
    const m = document.createElement('canvas').getContext('2d')!;
    const w = torre(m, 0, 0, f, 13 * u);
    torre(g, x - 16 * u - w, yy + 4 * u, f, 13 * u, ink(0.9));
    g.globalAlpha = alpha;
  }
  // The fill.
  const yp = yOf(clamp(h, H0, HTOP));
  const grd = g.createLinearGradient(0, y0, 0, yp);
  grd.addColorStop(0, violeta(0.05));
  grd.addColorStop(1, violeta(0.9));
  g.fillStyle = grd;
  g.fillRect(x - 1.6 * u, yp, 3.2 * u, y0 - yp);
  // Landmarks near where we are.
  g.font = FONT.mono(9 * u);
  g.letterSpacing = `${1 * u}px`;
  g.textAlign = 'left';
  // Only the landmark nearest to where we are (several sit close together on the tower).
  const cerca = PELDANOS.reduce((m, r) => (Math.abs(r.h - h) < Math.abs(m.h - h) ? r : m), PELDANOS[0]);
  for (const r of [cerca]) {
    const yy = yOf(r.h);
    const a = 0.75 * (1 - smoothstep(0.15, 0.55, Math.abs(r.h - h)));
    if (a < 0.02) continue;
    g.globalAlpha = alpha * a;
    g.fillStyle = r.h <= h + 1e-3 ? VIOLETA : ink(1);
    g.fillRect(x + 4 * u, yy - 0.5 * u, 6 * u, Math.max(1, u));
    g.fillText(r.label.toUpperCase(), x + 14 * u, yy);
  }
  g.globalAlpha = alpha;
  g.fillStyle = VIOLETA;
  g.shadowColor = VIOLETA;
  g.shadowBlur = 10 * u;
  g.beginPath();
  g.arc(x, yp, 4 * u, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** The brand and the study, top left. */
export function marca(g: CanvasRenderingContext2D, u: number, concepto: string, sub: string) {
  g.save();
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.8)';
  g.shadowBlur = 10 * u;
  g.font = FONT.serif(27 * u);
  g.fillStyle = ink();
  g.fillText('Destino', 40 * u, 54 * u);
  const w = g.measureText('Destino').width;
  g.font = FONT.mono(10.5 * u);
  g.letterSpacing = `${1.4 * u}px`;
  g.fillStyle = VIOLETA;
  g.fillText(concepto.toUpperCase(), 40 * u + w + 16 * u, 52 * u);
  g.fillStyle = ink(0.5);
  g.fillText(sub.toUpperCase(), 40 * u, 76 * u);
  g.restore();
}
