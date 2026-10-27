import * as THREE from 'three';
import { clamp, smoothstep } from './math';

/**
 * The plate: everything drawn in 2D over the film, in device pixels, so a capture holds it too.
 * - The reading (bottom left): the power of the civilization as a power of ten (watts), its
 *   Kardashev type (Sagan's K = (log10 P − 6) / 10), then «when · how far it reaches».
 * - The ladder (right): power from one person to a galaxy and beyond, filled with the
 *   civilization's colour up to where it is; solid where measured, dashed where physics allows it,
 *   dotted where it is speculation.
 * - Notes: a dot on the thing, a leader, a label (Potencias' plate).
 */

export const FONT = {
  serif: (px: number) => `${px}px "Instrument Serif"`,
  italic: (px: number) => `italic ${px}px "Instrument Serif"`,
  mono: (px: number) => `500 ${px}px "Geist Mono Variable"`,
  sans: (px: number) => `500 ${px}px "Geist Variable"`,
};

/** The work's colour in the series: teal (dark theme). */
export const TEAL = '#6fe3c1';
export const INK = 'rgba(236,231,219,1)';
export const ink = (a = 1) => `rgba(236,231,219,${a})`;

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export const sup = (n: number) => [...String(n)].map((ch) => SUP[ch] ?? ch).join('');
const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * The plate's language: the page hands over its dictionary (Spanish → current language) and every
 * label on the plate goes through it; numbers take the decimal point in English.
 */
let EN = false;
let dicc = (es: string) => es;
export function idioma(tx: (es: string) => string, en: boolean) {
  dicc = tx;
  EN = en;
}
/** A label in the current language. */
export const tr = (es: string) => dicc(es);
const coma = (v: number, d = 1) => (EN ? v.toFixed(d) : v.toFixed(d).replace('.', ','));

/** Sagan's interpolation of Kardashev's scale: K = (log10 P[W] − 6) / 10. */
export const kardashev = (lp: number) => (lp - 6) / 10;

/** Power in words: «19 TW», «1,7 × 10¹⁷ W». */
export function vatios(lp: number) {
  const P = Math.pow(10, lp);
  const pre: [number, string][] = [
    [1e24, 'YW'],
    [1e21, 'ZW'],
    [1e18, 'EW'],
    [1e15, 'PW'],
    [1e12, 'TW'],
    [1e9, 'GW'],
    [1e6, 'MW'],
    [1e3, 'kW'],
    [1, 'W'],
  ];
  if (lp >= 27) {
    const e = Math.floor(lp);
    return `${coma(P / Math.pow(10, e), 1)} × 10${sup(e)} W`;
  }
  const [k, name] = pre.find(([k]) => P >= k) ?? [1, 'W'];
  const v = P / k;
  return `${v >= 100 ? group(v) : v >= 10 ? Math.round(v) : coma(v, 1)} ${name}`;
}

/** When: «2026 · hoy», «año 2340», «dentro de 1 000 años», «dentro de 10⁷ años». */
export function cuando(ly: number) {
  const y = Math.pow(10, ly);
  if (y < 1) return EN ? '2026 · today' : '2026 · hoy';
  if (y < 7000) return `${EN ? 'year' : 'año'} ${2026 + Math.round(y / 10) * 10}`;
  if (y < 1e6) return EN ? `in ${group(Math.round(y / 1000) * 1000)} years` : `dentro de ${group(Math.round(y / 1000) * 1000)} años`;
  if (y < 1e9) return EN ? `in ${Math.round(y / 1e6)} million years` : `dentro de ${Math.round(y / 1e6)} millones de años`;
  return EN ? `in 10${sup(Math.floor(ly))} years` : `dentro de 10${sup(Math.floor(ly))} años`;
}

const LY_M = 9.4607e15;
const AU_M = 1.496e11;
/** How far: «400 km», «1,3 UA», «12 años luz». */
export function alcance(lr: number) {
  const m = Math.pow(10, lr);
  if (m < 1e7) return `${group(Math.round(m / 1e3 / 10) * 10)} km`;
  if (m < 0.05 * AU_M) return `${group(Math.round(m / 1e3 / 1000) * 1000)} km`;
  if (m < 2000 * AU_M) return `${m < 10 * AU_M ? coma(m / AU_M, 1) : group(m / AU_M)} ${EN ? 'AU' : 'UA'}`;
  return `${m < 10 * LY_M ? coma(m / LY_M, 1) : group(m / LY_M)} ${EN ? 'light years' : 'años luz'}`;
}

// ---------------------------------------------------------------- drawing helpers

export function proyectar(v: THREE.Vector3, camera: THREE.Camera, W: number, H: number, out = { x: 0, y: 0, z: 0 }) {
  const p = v.clone().project(camera);
  out.x = ((p.x + 1) / 2) * W;
  out.y = ((1 - p.y) / 2) * H;
  out.z = p.z;
  return out;
}

/** A power of ten with its exponent raised: returns the width drawn. */
function potencia(g: CanvasRenderingContext2D, x: number, y: number, exp: string, unit: string, px: number) {
  let cx = x;
  g.font = FONT.serif(px);
  g.fillStyle = ink();
  g.fillText('10', cx, y);
  cx += g.measureText('10').width + px * 0.02;
  g.font = FONT.serif(px * 0.52);
  g.fillText(exp, cx, y - px * 0.42);
  cx += g.measureText(exp).width + px * 0.12;
  g.font = FONT.serif(px * 0.4);
  g.fillStyle = ink(0.6);
  g.fillText(unit, cx, y);
  return cx + g.measureText(unit).width - x;
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number) {
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

/** A note: a dot on the thing, a leader out to (x + dx, y + dy), and its label. */
export function nota(g: CanvasRenderingContext2D, u: number, x: number, y: number, text: string, dx: number, dy: number, alpha = 1, accent = TEAL) {
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
  const label = tr(text).toUpperCase();
  const w = g.measureText(label).width;
  const tx = dx >= 0 ? lx + 6 * u : lx - 6 * u - w;
  g.fillStyle = 'rgba(4,4,8,0.5)';
  g.fillRect(tx - 5 * u, ly - 9 * u, w + 10 * u, 17 * u);
  g.fillStyle = ink(0.92);
  g.textBaseline = 'middle';
  g.fillText(label, tx, ly + 0.5 * u);
  g.restore();
}

/** A label alone (no leader), centred on (x, y). */
export function rotulo(g: CanvasRenderingContext2D, u: number, x: number, y: number, text: string, px = 10.5, alpha = 1, color = ink(0.85), upper = true) {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  g.font = FONT.mono(px * u);
  g.letterSpacing = upper ? `${1.1 * u}px` : '0px';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.9)';
  g.shadowBlur = 8 * u;
  g.fillStyle = color;
  g.fillText(upper ? tr(text).toUpperCase() : tr(text), x, y);
  g.restore();
}

/** A big number written on the film (the numbers are the show): «2⁴⁰», «10¹²». */
export function cifra(g: CanvasRenderingContext2D, u: number, x: number, y: number, base: string, exp: string, px: number, alpha = 1, color = TEAL, under = '') {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 14 * u;
  // Kept on the screen: its line under it is the widest part (narrow screens push it in).
  if (under) {
    g.font = FONT.mono(10.5 * u);
    g.letterSpacing = `${1.2 * u}px`;
    const half = g.measureText(tr(under).toUpperCase()).width / 2;
    const W = g.canvas.width;
    const m = 20 * u;
    x = half * 2 > W - 2 * m ? W / 2 : Math.min(Math.max(x, m + half), W - m - half);
    g.letterSpacing = '0px';
  }
  g.font = FONT.serif(px * u);
  const wb = g.measureText(base).width;
  g.font = FONT.serif(px * 0.52 * u);
  const we = exp ? g.measureText(exp).width : 0;
  const x0 = x - (wb + we) / 2;
  g.fillStyle = color;
  g.font = FONT.serif(px * u);
  g.fillText(base, x0, y);
  if (exp) {
    g.font = FONT.serif(px * 0.52 * u);
    g.fillText(exp, x0 + wb + px * 0.02 * u, y - px * 0.42 * u);
  }
  if (under) {
    g.font = FONT.mono(10.5 * u);
    g.letterSpacing = `${1.2 * u}px`;
    g.textAlign = 'center';
    g.fillStyle = ink(0.75);
    g.fillText(tr(under).toUpperCase(), x, y + 26 * u);
  }
  g.restore();
}

// ---------------------------------------------------------------- the view's width

/** A length in words, from micrometres to light years: «12 000 km», «3,4 UA», «100 000 años luz». */
export function medida(m: number) {
  if (m < 1e-3) return `${Math.round(m * 1e6)} µm`;
  if (m < 1) return m < 0.01 ? `${coma(m * 1e3, 1)} mm` : `${Math.round(m * 100)} cm`;
  if (m < 1e3) return `${Math.round(m)} m`;
  return alcance(Math.log10(m));
}

/**
 * How wide the view is, bottom right: a short rule with its length, so the jumps of scale read
 * («la vista mide 12 000 km»). Only where the world is drawn to scale.
 */
export function regla(g: CanvasRenderingContext2D, u: number, W: number, H: number, metros: number, alpha = 1) {
  // On a narrow (portrait) screen there is no room for it beside the clock.
  if (!(metros > 0) || alpha < 0.01 || W / H < 0.9) return;
  // Bottom right, under the ladder, away from the clock's line.
  const w = 90 * u;
  const x0 = W - 110 * u - w;
  const y = H - 46 * u;
  g.save();
  g.globalAlpha *= alpha;
  g.strokeStyle = ink(0.5);
  g.lineWidth = Math.max(1, u);
  g.beginPath();
  g.moveTo(x0, y - 4 * u);
  g.lineTo(x0, y);
  g.lineTo(x0 + w, y);
  g.lineTo(x0 + w, y - 4 * u);
  g.stroke();
  g.font = FONT.mono(10 * u);
  g.letterSpacing = `${1.2 * u}px`;
  g.fillStyle = ink(0.62);
  g.textAlign = 'right';
  g.fillText(`${EN ? 'the view is' : 'la vista mide'} ${medida(metros)}`.toUpperCase(), x0 + w, y - 10 * u);
  g.restore();
}

// ---------------------------------------------------------------- the reading

export interface Lectura {
  /** log10 of the civilization's power in watts. */
  lp: number;
  /** log10 of the years from now (≤ 0: today). */
  ly: number;
  /** log10 of its reach in metres. */
  lr: number;
  /** A year in the past (the clock reads it instead of the years from now). */
  anio?: number;
}

export interface Rotulo {
  name: string;
  fact: string;
  /** Where the fact comes from (only with the plate). */
  fuente?: string;
  /** The chapter it belongs to, above the name: «III · El sistema solar trabaja». */
  capitulo?: string;
  /** A journey between moments: an arrow and a name, nothing else. */
  viaje?: boolean;
}

/**
 * The moment's caption, above the clock: the chapter (small, in the work's colour), the name, the
 * sentence, and with the plate its source. Laid out from the bottom up, so a longer sentence grows
 * upwards and never runs into the clock.
 */
function rotuloMomento(g: CanvasRenderingContext2D, u: number, H: number, cap: Rotulo, alpha: number) {
  const x = 44 * u;
  g.save();
  g.globalAlpha *= alpha;
  g.font = FONT.sans(14.5 * u);
  // On a narrow screen the sentence keeps clear of the ladder at the right.
  const lines = wrap(g, cap.fact, Math.min(500 * u, g.canvas.width - 150 * u));
  const fuente = cap.fuente ? tr(cap.fuente) : '';
  const bottom = H - 174 * u - (fuente ? 20 * u : 0);
  const top = bottom - (lines.length - 1) * 21 * u;
  g.fillStyle = ink(0.7);
  lines.forEach((line, i) => g.fillText(line, x, top + i * 21 * u));
  if (fuente) {
    g.font = FONT.mono(10 * u);
    g.letterSpacing = `${0.6 * u}px`;
    g.fillStyle = ink(0.55);
    g.fillText(fuente, x, bottom + 22 * u);
    g.letterSpacing = '0px';
  }
  g.font = FONT.italic(32 * u);
  g.fillStyle = ink();
  if (cap.viaje) {
    // On the way: «→ Hacia Marte», where the sentence will be.
    g.font = FONT.italic(27 * u);
    g.fillStyle = ink(0.82);
    g.fillText(`→  ${cap.name}`, x, top - 30 * u);
  } else g.fillText(cap.name, x, top - 30 * u);
  if (cap.capitulo) {
    g.font = FONT.mono(10.5 * u);
    g.letterSpacing = `${1.6 * u}px`;
    g.fillStyle = TEAL;
    g.globalAlpha *= 0.85;
    g.fillText(cap.capitulo.toUpperCase(), x, top - 72 * u);
    g.letterSpacing = '0px';
  }
  g.restore();
}

/** The reading at bottom left: the moment's name and sentence, the power, the type, when and how far. */
export function hud(g: CanvasRenderingContext2D, u: number, W: number, H: number, l: Lectura, cap: Rotulo | null, capAlpha = 1) {
  const x = 44 * u;
  g.save();
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 12 * u;
  if (cap && capAlpha > 0.01) rotuloMomento(g, u, H, cap, capAlpha);
  const lp = l.lp;
  const e = Math.floor(lp);
  const w = potencia(g, x, H - 86 * u, sup(e).replace(/^⁻/, '⁻'), 'W', 66 * u);
  const K = kardashev(lp);
  g.font = FONT.italic(24 * u);
  g.fillStyle = TEAL;
  g.fillText(`${EN ? 'type' : 'tipo'} ${coma(K, 2)}`, x + w + 22 * u, H - 92 * u);
  g.font = FONT.mono(11 * u);
  g.letterSpacing = `${0.9 * u}px`;
  g.fillStyle = ink(0.78);
  const when = l.anio !== undefined ? (l.anio >= 2026 ? cuando(-1) : `${EN ? 'year' : 'año'} ${Math.round(l.anio)}`) : cuando(l.ly);
  const a = `${vatios(lp)} ${EN ? 'in use' : 'en uso'}  ·  ${when}`.toUpperCase();
  const b = `${EN ? 'reaching' : 'llega a'} ${alcance(l.lr)}`.toUpperCase();
  // On a narrow screen, in two lines.
  if (g.measureText(`${a}  ·  ${b}`).width > W - x - 90 * u) {
    g.fillText(a, x, H - 58 * u);
    g.fillText(b, x, H - 40 * u);
  } else g.fillText(`${a}  ·  ${b}`, x, H - 52 * u);
  g.restore();
}

// ---------------------------------------------------------------- the ladder

interface Peldano {
  lp: number;
  label: string;
  major?: boolean;
}
const PELDANOS: Peldano[] = [
  { lp: 2, label: 'una persona' },
  { lp: 13.3, label: 'hoy' },
  { lp: 14.1, label: 'fotosíntesis' },
  { lp: 16, label: 'I · un planeta', major: true },
  { lp: 17.24, label: 'luz del Sol en la Tierra' },
  { lp: 26, label: 'II · una estrella', major: true },
  { lp: 26.58, label: 'el Sol' },
  { lp: 36, label: 'III · una galaxia', major: true },
  { lp: 37.0, label: 'la Vía Láctea' },
];
const LP0 = 0;
const LP1 = 40;
const TODAY = 13.3;

export interface Muro {
  lp: number;
  label: string;
  a: number;
  choque?: number;
  fuera?: number;
}
const II = 26;
const III = 36;

/** The power ladder at the right edge: fills with the civilization's colour up to where it is. */
export function escalera(g: CanvasRenderingContext2D, u: number, W: number, H: number, lp: number, muro: Muro | null = null, vacia = 0) {
  const x = W - 64 * u;
  const y0 = H - 70 * u;
  const y1 = 86 * u;
  const yOf = (v: number) => y0 + ((v - LP0) / (LP1 - LP0)) * (y1 - y0);
  g.save();
  const A0 = g.globalAlpha;
  // The rail, by certainty: solid (measured) up to today, dashed (physics allows it) to II, dotted beyond.
  g.lineWidth = Math.max(1, 1.1 * u);
  const seg = (a: number, b: number, dash: number[], alpha: number) => {
    g.setLineDash(dash.map((d) => d * u));
    g.strokeStyle = ink(alpha);
    g.beginPath();
    g.moveTo(x, yOf(a));
    g.lineTo(x, yOf(b));
    g.stroke();
  };
  seg(LP0, TODAY, [], 0.45);
  seg(TODAY, II, [5, 4], 0.4);
  seg(II, LP1, [1.5, 4], 0.4);
  g.setLineDash([]);
  // Decade ticks.
  for (let v = LP0; v <= LP1; v++) {
    const yy = yOf(v);
    const len = v % 10 === 6 ? 9 : 4;
    g.strokeStyle = ink(0.28);
    g.beginPath();
    g.moveTo(x - len * u, yy);
    g.lineTo(x, yy);
    g.stroke();
  }
  // The fill: the civilization's power so far.
  const yp = yOf(clamp(lp, LP0, LP1));
  const grd = g.createLinearGradient(0, y0, 0, yp);
  grd.addColorStop(0, 'rgba(111,227,193,0.05)');
  grd.addColorStop(1, 'rgba(111,227,193,0.9)');
  g.fillStyle = grd;
  g.globalAlpha = A0 * (1 - vacia);
  g.fillRect(x - 1.6 * u, yp, 3.2 * u, y0 - yp);
  g.globalAlpha = A0;
  // Rungs: names show only near where we are (majors always, faint).
  g.font = FONT.mono(9 * u);
  g.letterSpacing = `${1 * u}px`;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  for (const r of PELDANOS) {
    const yy = yOf(r.lp);
    const near = 1 - smoothstep(1.2, 3.2, Math.abs(r.lp - lp));
    const a = r.major ? 0.38 + 0.5 * near : 0.7 * near;
    if (a < 0.02) continue;
    g.fillStyle = r.lp <= lp && vacia < 0.5 ? `rgba(111,227,193,${a})` : ink(a);
    g.fillText(tr(r.label).toUpperCase(), x - 14 * u, yy);
    g.fillRect(x - (r.major ? 10 : 6) * u, yy - 0.5 * u, (r.major ? 10 : 6) * u, Math.max(1, u));
  }
  // A wall: a line across the ladder where the climb meets a physical limit (it glows when the
  // fill presses on it); beyond it, the climb goes on outside, as an arc around the rail.
  if (muro && muro.a > 0.01) {
    const yw = yOf(muro.lp);
    const hit = muro.choque ?? 0;
    g.save();
    g.globalAlpha = muro.a;
    g.strokeStyle = `rgba(255,106,74,${0.55 + 0.45 * hit})`;
    g.lineWidth = Math.max(1, (1.4 + 1.6 * hit) * u);
    g.shadowColor = '#ff5b4a';
    g.shadowBlur = 12 * hit * u;
    g.beginPath();
    g.moveTo(x - 40 * u, yw);
    g.lineTo(x + 14 * u, yw);
    g.stroke();
    g.shadowBlur = 0;
    g.font = FONT.mono(9 * u);
    g.letterSpacing = `${1 * u}px`;
    g.textAlign = 'right';
    g.fillStyle = `rgba(255,140,110,${0.8 + 0.2 * hit})`;
    g.fillText(tr(muro.label).toUpperCase(), x - 46 * u, yw);
    const out = muro.fuera ?? 0;
    if (out > 0.01 && lp > muro.lp) {
      const y2 = yp;
      g.globalAlpha = muro.a * out;
      g.strokeStyle = TEAL;
      g.lineWidth = Math.max(1, 1.6 * u);
      g.setLineDash([3 * u, 3 * u]);
      g.beginPath();
      g.moveTo(x, yw + 10 * u);
      g.bezierCurveTo(x + 26 * u, yw + 4 * u, x + 26 * u, Math.min(yw - 6 * u, y2 + 10 * u), x, y2);
      g.stroke();
      g.setLineDash([]);
      // (on the left, under the wall's name: the right edge belongs to the screen's border)
      g.textAlign = 'right';
      g.fillStyle = TEAL;
      g.fillText(tr('fuera del planeta').toUpperCase(), x - 46 * u, yw - 14 * u);
    }
    g.restore();
  }
  // You are here (or, with an empty ladder, the power that is there and nobody uses: a hollow ring).
  if (vacia < 1) {
    g.globalAlpha = A0 * (1 - vacia);
    g.fillStyle = TEAL;
    g.shadowColor = TEAL;
    g.shadowBlur = 10 * u;
    g.beginPath();
    g.arc(x, yp, 4 * u, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }
  if (vacia > 0) {
    g.globalAlpha = A0 * vacia;
    g.strokeStyle = ink(0.85);
    g.lineWidth = Math.max(1, 1.2 * u);
    g.beginPath();
    g.arc(x, yp, 4.5 * u, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = A0;
  g.textAlign = 'left';
  g.font = FONT.serif(15 * u);
  g.fillStyle = ink(0.9);
  g.fillText(`10${sup(Math.floor(lp))}`, x + 9 * u, yp);
  g.restore();
}

/** A label for the brand and the concept, top left. */
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
  g.fillStyle = TEAL;
  g.fillText(concepto.toUpperCase(), 40 * u + w + 16 * u, 52 * u);
  g.fillStyle = ink(0.5);
  g.fillText(sub.toUpperCase(), 40 * u, 76 * u);
  g.restore();
}

/**
 * The power clock before there is a civilization: the power that is there (the galaxy, a star, the
 * light on a planet) and nobody uses. Same place and size as the HUD, «tipo —» instead of the type.
 */
export function hudLibre(g: CanvasRenderingContext2D, u: number, H: number, lp: number, linea: string, cap: Rotulo | null, capAlpha = 1, alpha = 1, tipo = 'tipo —') {
  const x = 44 * u;
  g.save();
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 12 * u;
  if (cap && capAlpha > 0.01) rotuloMomento(g, u, H, cap, capAlpha);
  g.globalAlpha = alpha;
  const w = potencia(g, x, H - 86 * u, sup(Math.floor(lp)), 'W', 66 * u);
  g.font = FONT.italic(24 * u);
  g.fillStyle = ink(0.45);
  g.fillText(tr(tipo), x + w + 22 * u, H - 92 * u);
  g.font = FONT.mono(11 * u);
  g.letterSpacing = `${0.9 * u}px`;
  g.fillStyle = ink(0.78);
  g.fillText(tr(linea).toUpperCase(), x, H - 52 * u);
  g.restore();
}

/**
 * A clock without power (before there is a civilization to measure): a big figure in Instrument
 * Serif with its unit, a mono line below, and the moment's name and sentence above, where the
 * power clock would put them.
 */
export function reloj(g: CanvasRenderingContext2D, u: number, H: number, cifra: string, unidad: string, linea: string, cap: Rotulo | null, capAlpha = 1, alpha = 1) {
  const x = 44 * u;
  g.save();
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 12 * u;
  if (cap && capAlpha > 0.01) rotuloMomento(g, u, H, cap, capAlpha);
  g.globalAlpha = alpha;
  g.font = FONT.serif(66 * u);
  g.fillStyle = ink();
  g.fillText(cifra, x, H - 86 * u);
  const w = g.measureText(cifra).width;
  g.font = FONT.serif(26 * u);
  g.fillStyle = ink(0.6);
  g.fillText(unidad, x + w + 14 * u, H - 88 * u);
  g.font = FONT.mono(11 * u);
  g.letterSpacing = `${0.9 * u}px`;
  g.fillStyle = ink(0.78);
  g.fillText(linea.toUpperCase(), x, H - 52 * u);
  g.restore();
}
