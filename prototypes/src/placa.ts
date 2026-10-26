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
const coma = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

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
  if (y < 1) return '2026 · hoy';
  if (y < 7000) return `año ${2026 + Math.round(y / 10) * 10}`;
  if (y < 1e6) return `dentro de ${group(Math.round(y / 1000) * 1000)} años`;
  if (y < 1e9) return `dentro de ${Math.round(y / 1e6)} millones de años`;
  return `dentro de 10${sup(Math.floor(ly))} años`;
}

const LY_M = 9.4607e15;
const AU_M = 1.496e11;
/** How far: «400 km», «1,3 UA», «12 años luz». */
export function alcance(lr: number) {
  const m = Math.pow(10, lr);
  if (m < 1e7) return `${group(Math.round(m / 1e3 / 10) * 10)} km`;
  if (m < 0.05 * AU_M) return `${group(Math.round(m / 1e3 / 1000) * 1000)} km`;
  if (m < 2000 * AU_M) return `${m < 10 * AU_M ? coma(m / AU_M, 1) : group(m / AU_M)} UA`;
  return `${m < 10 * LY_M ? coma(m / LY_M, 1) : group(m / LY_M)} años luz`;
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
  g.fillText(upper ? text.toUpperCase() : text, x, y);
  g.restore();
}

/** A big number written on the film (the numbers are the show): «2⁴⁰», «10¹²». */
export function cifra(g: CanvasRenderingContext2D, u: number, x: number, y: number, base: string, exp: string, px: number, alpha = 1, color = TEAL, under = '') {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 14 * u;
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
    g.fillText(under.toUpperCase(), x, y + 26 * u);
  }
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
}

export interface Rotulo {
  name: string;
  fact: string;
}

/** The reading at bottom left: the moment's name and sentence, the power, the type, when and how far. */
export function hud(g: CanvasRenderingContext2D, u: number, W: number, H: number, l: Lectura, cap: Rotulo | null, capAlpha = 1) {
  const x = 44 * u;
  g.save();
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 12 * u;
  if (cap && capAlpha > 0.01) {
    g.globalAlpha = capAlpha;
    g.font = FONT.italic(31 * u);
    g.fillStyle = ink();
    g.fillText(cap.name, x, H - 236 * u);
    g.font = FONT.sans(14 * u);
    g.fillStyle = ink(0.62);
    wrap(g, cap.fact, 470 * u).forEach((line, i) => g.fillText(line, x, H - 208 * u + i * 20 * u));
    g.globalAlpha = 1;
  }
  const lp = l.lp;
  const e = Math.floor(lp);
  const w = potencia(g, x, H - 86 * u, sup(e).replace(/^⁻/, '⁻'), 'W', 66 * u);
  const K = kardashev(lp);
  g.font = FONT.italic(24 * u);
  g.fillStyle = TEAL;
  g.fillText(`tipo ${coma(K, 2)}`, x + w + 22 * u, H - 92 * u);
  g.font = FONT.mono(11 * u);
  g.letterSpacing = `${0.9 * u}px`;
  g.fillStyle = ink(0.78);
  g.fillText(`${vatios(lp)}  ·  ${cuando(l.ly)}  ·  alcance ${alcance(l.lr)}`.toUpperCase(), x, H - 52 * u);
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
const II = 26;
const III = 36;

/** The power ladder at the right edge: fills with the civilization's colour up to where it is. */
export function escalera(g: CanvasRenderingContext2D, u: number, W: number, H: number, lp: number) {
  const x = W - 64 * u;
  const y0 = H - 70 * u;
  const y1 = 86 * u;
  const yOf = (v: number) => y0 + ((v - LP0) / (LP1 - LP0)) * (y1 - y0);
  g.save();
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
  g.fillRect(x - 1.6 * u, yp, 3.2 * u, y0 - yp);
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
    g.fillStyle = r.lp <= lp ? `rgba(111,227,193,${a})` : ink(a);
    g.fillText(r.label.toUpperCase(), x - 14 * u, yy);
    g.fillRect(x - (r.major ? 10 : 6) * u, yy - 0.5 * u, (r.major ? 10 : 6) * u, Math.max(1, u));
  }
  // You are here.
  g.fillStyle = TEAL;
  g.shadowColor = TEAL;
  g.shadowBlur = 10 * u;
  g.beginPath();
  g.arc(x, yp, 4 * u, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
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
  g.fillText('Civilización', 40 * u, 54 * u);
  const w = g.measureText('Civilización').width;
  g.font = FONT.mono(10.5 * u);
  g.letterSpacing = `${1.4 * u}px`;
  g.fillStyle = TEAL;
  g.fillText(concepto.toUpperCase(), 40 * u + w + 16 * u, 52 * u);
  g.fillStyle = ink(0.5);
  g.fillText(sub.toUpperCase(), 40 * u, 76 * u);
  g.restore();
}
