import { FONT, ink, tr } from './placa';

/**
 * The plate's drawing tools, in device pixels: lines, arrows and labels. The plate (lámina) is the
 * layer for learning (key I): it draws the mechanism of what is on screen over the living scene,
 * without stopping the journey; it is also the language of what is hypothetical or invisible.
 */

export type P2 = { x: number; y: number };

export function linea(g: CanvasRenderingContext2D, u: number, pts: P2[], color: string, a: number, dash: number[] = [], width = 1.4, offset = 0) {
  if (a < 0.01 || pts.length < 2) return;
  g.save();
  g.globalAlpha = a;
  g.strokeStyle = color;
  g.lineWidth = Math.max(1, width * u);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.setLineDash(dash.map((d) => d * u));
  g.lineDashOffset = -offset * u;
  g.beginPath();
  pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
  g.stroke();
  g.restore();
}

/** An arrowhead at b, pointing from a. */
export function punta(g: CanvasRenderingContext2D, u: number, a: P2, b: P2, color: string, al: number, size = 9) {
  if (al < 0.01) return;
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  g.save();
  g.globalAlpha = al;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(b.x, b.y);
  g.lineTo(b.x - Math.cos(ang - 0.42) * size * u, b.y - Math.sin(ang - 0.42) * size * u);
  g.lineTo(b.x - Math.cos(ang + 0.42) * size * u, b.y - Math.sin(ang + 0.42) * size * u);
  g.closePath();
  g.fill();
  g.restore();
}

/** A force or a flow: a line from a to b with its head (none if too short to read). */
export function flecha(g: CanvasRenderingContext2D, u: number, a: P2, b: P2, color: string, al: number, width = 1.6, dash: number[] = [], offset = 0) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (al < 0.01 || len < 2 * u) return;
  const head = Math.min(10, 3 + len / (3 * u));
  // Stop the shaft short of the tip so the head stays sharp.
  const k = Math.max(0, 1 - (head * 0.6 * u) / len);
  linea(g, u, [a, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }], color, al, dash, width, offset);
  punta(g, u, a, b, color, al, head);
}

/** A label in the plate's mono at (x, y), with a soft shadow. */
export function texto(g: CanvasRenderingContext2D, u: number, x: number, y: number, text: string, color = ink(0.9), a = 1, px = 10.5, align: CanvasTextAlign = 'left', upper = true) {
  if (a < 0.01) return;
  g.save();
  g.globalAlpha = a;
  g.font = FONT.mono(px * u);
  g.letterSpacing = upper ? `${1.1 * u}px` : '0px';
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.95)';
  g.shadowBlur = 8 * u;
  g.fillStyle = color;
  g.fillText(upper ? tr(text).toUpperCase() : tr(text), x, y);
  g.restore();
}
