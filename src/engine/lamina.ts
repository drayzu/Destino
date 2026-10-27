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

/**
 * A small list on the plate, under a dotted rule: a title and a few short lines. On a wide screen it
 * sits at (fx, fy) of the frame; in portrait it moves left of the ladder, between its rungs, so it
 * neither runs off the edge nor over the rungs' names.
 */
export function panel(g: CanvasRenderingContext2D, u: number, W: number, H: number, fx: number, fy: number, title: string, lines: string[], a: number) {
  if (a < 0.01) return;
  const vertical = W < H;
  const x = vertical ? W * 0.42 : W * fx;
  let y = vertical ? H * 0.44 : H * fy;
  const half = (vertical ? 0.4 * W : 130 * u);
  g.save();
  g.globalAlpha = a * 0.6;
  g.strokeStyle = ink(0.7);
  g.lineWidth = Math.max(1, u);
  g.setLineDash([3 * u, 4 * u]);
  g.beginPath();
  g.moveTo(x - half, y - 15 * u);
  g.lineTo(x + half, y - 15 * u);
  g.stroke();
  g.restore();
  texto(g, u, x, y, title, ink(0.85), a, 10.5, 'center');
  for (const t of lines) {
    y += 19 * u;
    texto(g, u, x, y, t, ink(0.62), a, vertical ? 9 : 10, 'center', false);
  }
}
