import * as THREE from 'three';
import { EASE, type Timeline } from '../timeline';
import { smoothstep } from '../math';
import { FONT, TEAL, ink, proyectar } from '../placa';

/**
 * The plate's drawing tools for the studies: lines, arrows and the station's indicator, in device
 * pixels, plus the station's clock (which step, how far into it). Stations were the grammar of the
 * old plan (Despertar); Destino keeps their drawings as lámina over the journey, which never stops.
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

/** A label in the plate's mono, left-aligned at (x, y), with a soft backing. */
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
  g.fillText(upper ? text.toUpperCase() : text, x, y);
  g.restore();
}

/** Projects a world point; null when it is behind the camera. */
export function pr(v: THREE.Vector3, camera: THREE.Camera, W: number, H: number): P2 | null {
  const q = proyectar(v, camera, W, H);
  return q.z < 1 ? { x: q.x, y: q.y } : null;
}

/** «CÓMO FUNCIONA · OBRA» at the top, and one dot per step (the current one bigger). */
export function indicador(g: CanvasRenderingContext2D, u: number, W: number, titulo: string, n: number, k: number, a: number) {
  if (a < 0.01) return;
  g.save();
  g.globalAlpha = a;
  g.textAlign = 'center';
  g.font = FONT.mono(10.5 * u);
  g.letterSpacing = `${1.6 * u}px`;
  g.fillStyle = TEAL;
  g.shadowColor = 'rgba(0,0,0,0.9)';
  g.shadowBlur = 8 * u;
  g.fillText(`CÓMO FUNCIONA · ${titulo.toUpperCase()}`, W / 2, 58 * u);
  g.shadowBlur = 0;
  for (let i = 0; i < n; i++) {
    const x = W / 2 + (i - (n - 1) / 2) * 18 * u;
    const on = Math.round(k) === i + 1;
    g.beginPath();
    g.arc(x, 76 * u, (on ? 4 : 3) * u, 0, Math.PI * 2);
    if (k >= i + 0.6) {
      g.fillStyle = on ? TEAL : 'rgba(111,227,193,0.45)';
      g.fill();
    } else {
      g.strokeStyle = ink(0.5);
      g.lineWidth = Math.max(1, u);
      g.stroke();
    }
  }
  g.restore();
}

/**
 * The station's clock on a timeline: writes the steps (a caption each, the `paso` track moving to
 * the step at its start) and returns readers for it.
 * - `k(p)`: the `paso` track (eased between steps): for the camera between shots.
 * - `t(p)`: linear progress (1 at the start, n + 1 at the end): what moves within a step.
 * - `win(c, p)`: 0..1 while step c is shown (fades in after its transition, out at its end).
 */
export function estacion(tl: Timeline, label: string, pasos: [string, string][], dur = 1.75, trans = 0.4) {
  tl.label(label);
  const start = tl.at(label);
  pasos.forEach(([n, f], i) => {
    tl.caption(dur, n, f);
    tl.to(trans, { paso: i + 1 }, EASE.inOut).to(dur - trans, {});
  });
  const end = start + pasos.length * dur;
  const t = (p: number) => 1 + (p - start) / dur;
  return {
    n: pasos.length,
    start,
    end,
    dur,
    k: (p: number) => tl.get('paso', p),
    t,
    /** 0..1: how much the station is on (eases in before it and out after it). */
    on: (p: number, pre = 0.35, post = 0.5) => smoothstep(start - pre, start, p) * (1 - smoothstep(end - 0.05, end + post, p)),
    win: (c: number, p: number) => {
      const kt = t(p);
      return smoothstep(c + 0.12, c + 0.28, kt) * (1 - smoothstep(c + 0.94, c + 1.04, kt));
    },
  };
}
