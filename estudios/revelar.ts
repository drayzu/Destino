import * as THREE from 'three';
import { materia, materiaBuilder, type Nube } from './motor/materia';
import { TEAL } from './remake';
import { FONT, ink, proyectar, violeta } from './placa';
import { smoothstep } from './motor/math';
import type { Frame } from './tipos';

/**
 * Revealing (GUION.md v2, the beat «revelar»): once an act, the camera lets go of the spark and
 * shows everything we reach. What a far shot needs to be read at a glance, the same in every act:
 *
 * - Orbits: fine dotted rings. Anyone reads rings round a star as a solar system.
 * - Marks: a world too small to see keeps a dot of its own colour a few pixels wide; what is ours
 *   wears a teal ring. The teal is always ours.
 * - Names, for a moment: quiet capitals beside the marks (ours in teal).
 * - The clock says how far we reach (`Cuenta.alcance`).
 */

/** Dotted rings round the origin (radius `r`, at height `y`), lit by `uOn`. */
export function orbitas(anillos: { r: number; y?: number }[], color = new THREE.Color(0.78, 0.8, 0.84)): Nube {
  const b = materiaBuilder(211);
  for (const { r, y = 0 } of anillos) {
    const n = Math.round(Math.PI * 2 * r * 14);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      b.push(Math.sin(a) * r, y, Math.cos(a) * r, color, 0.0001, 0.22);
    }
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `uniform float uOn;`,
    move: /* glsl */ `em *= uOn;`,
    uniforms: { uOn: { value: 0 } },
  });
  nube.u.uSpread.value = 0;
  nube.u.uFuente.value = 1;
  return nube;
}

/** A dashed route between two places that may move (`uA`, `uB`), lit by `uOn`. */
export function trazo(n = 1600, color = TEAL): Nube {
  const b = materiaBuilder(229);
  for (let i = 0; i < n; i++) b.push(i / (n - 1), 0, 0, color, 0.0001, 0.42);
  const nube = materia(b.data(), {
    pre: /* glsl */ `uniform vec3 uA, uB; uniform float uOn;`,
    move: /* glsl */ `
      float tt = position.x;
      p = mix(uA, uB, tt);
      em *= uOn * (0.25 + 0.75 * step(0.45, fract(tt * 90.0))) * smoothstep(0.0, 0.04, tt) * (1.0 - smoothstep(0.96, 1.0, tt));
    `,
    uniforms: { uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uOn: { value: 0 } },
  });
  nube.u.uSpread.value = 0;
  nube.u.uFuente.value = 1;
  return nube;
}

export interface Mundo {
  pos: THREE.Vector3;
  /** Its radius (the mark fades as the world itself grows past a few pixels). */
  R: number;
  color: THREE.Color | number;
  /** Ours: a teal ring round its dot. */
  nuestro?: boolean;
  /** The ring's size in px (24), for something bigger than a world (a star in its swarm). */
  aro?: number;
  /** No dot: the thing shows itself (a star), only its ring. */
  sinPunto?: boolean;
}

/**
 * Marks for worlds seen from afar: a dot of each world's colour, 6 px, and a teal ring of 24 px
 * round ours. Sizes are pixels at any distance; a mark fades out as its world grows past ~10 px.
 * `uOn` lights them all.
 */
export function marcas(mundos: Mundo[]): Nube {
  const b = materiaBuilder(223);
  const radios: number[] = [];
  const tallas: number[] = [];
  for (const m of mundos) {
    if (!m.sinPunto) {
      b.push(m.pos.x, m.pos.y, m.pos.z, m.color, 6, 1.0, { kind: 0 });
      radios.push(m.R);
      tallas.push(6);
    }
    if (m.nuestro) {
      b.push(m.pos.x, m.pos.y, m.pos.z, TEAL, m.aro ?? 24, 1.1, { kind: 1 });
      radios.push(m.R);
      tallas.push(m.aro ?? 24);
    }
  }
  const data = b.data();
  // Exact sizes: the builder spreads them.
  tallas.forEach((x, i) => (data.size[i] = x));
  const nube = materia(data, {
    pre: /* glsl */ `
      attribute float aR;
      uniform float uOn, uDpr;
      varying float vAro, vPx;
    `,
    move: /* glsl */ `
      vAro = aKind;
      vPx = size * uDpr;
      em *= uOn;
    `,
    post: /* glsl */ `
      // Pixels at any distance; gone as the world itself shows (its disc past ten pixels or so).
      float dm = max(-mv.z, 1e-14);
      float disco = aR * uEscalaMundo * uFocal / dm;
      em *= 1.0 - smoothstep(9.0 * uDpr, 22.0 * uDpr, disco);
      sz *= uDpr * dm / max(uSizeUnit * uEscalaMundo * uFocal, 1e-20);
    `,
    frag: /* glsl */ `
      varying vec3 vEm;
      varying float vOcc;
      varying float vAro, vPx;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        // The ring keeps a line of about a pixel and a half whatever its size.
        float w = 3.4 / max(vPx, 1.0);
        float f = vAro > 0.5 ? 1.0 - smoothstep(0.0, w, abs(d - 0.84)) : 1.0 - smoothstep(0.55, 1.0, d);
        gl_FragColor = vec4(vEm * f, vOcc * f);
      }
    `,
    uniforms: { uOn: { value: 0 }, uDpr: { value: 1 } },
    extra: { aR: [new Float32Array(radios), 1] },
  });
  nube.u.uSpread.value = 0;
  nube.u.uFuente.value = 1;
  nube.points.renderOrder = 40;
  return nube;
}

/** Per frame, after `enfocar`: the marks' pixels need the dpr and room to be drawn whole. */
export function enfocarMarcas(n: Nube, dpr: number, on: number) {
  n.u.uDpr.value = dpr;
  n.u.uMinPx.value = 1;
  n.u.uMaxPx.value = 160 * dpr;
  n.u.uOn.value = on;
}

/**
 * A count in words, to one significant figure: 2 estrellas, mil estrellas, 40 mil estrellas,
 * 3 millones de estrellas, 400 mil millones de estrellas.
 */
export function cuantas(n: number, una: string, varias: string) {
  if (n < 1.5) return `1 ${una}`;
  const e = Math.floor(Math.log10(n));
  const v = Math.round(n / 10 ** e) * 10 ** e;
  if (v < 1e3) return `${v} ${varias}`;
  if (v < 1e6) return v < 1.5e3 ? `mil ${varias}` : `${Math.round(v / 1e3)} mil ${varias}`;
  if (v < 1e9) return v < 1.5e6 ? `1 millón de ${varias}` : `${Math.round(v / 1e6)} millones de ${varias}`;
  if (v < 1e12) return v < 1.5e9 ? `mil millones de ${varias}` : `${Math.round(v / 1e9)} mil millones de ${varias}`;
  return v < 1.5e12 ? `1 billón de ${varias}` : `${Math.round(v / 1e12)} billones de ${varias}`;
}

export interface Nombre {
  pos: THREE.Vector3;
  texto: string;
  /** Ours: in teal. */
  nuestro?: boolean;
  /** Which side of its place the name sits: east (default), west, north, south. */
  lado?: 'e' | 'o' | 'n' | 's';
  /** More room from its place (layout px), for something bigger than a mark. */
  aire?: number;
}

/**
 * The names, for a moment (`a`, 0..1): small, spaced capitals just past each mark's ring, no box and
 * no leader, ours in teal and the rest in a dim ink. They come one after another as `a` rises.
 */
export function nombres(g: CanvasRenderingContext2D, f: Frame, lista: Nombre[], a: number) {
  if (a <= 0.01) return;
  const q = { x: 0, y: 0, z: 0 };
  const u = f.u;
  const paso = Math.min(0.08, 0.45 / Math.max(1, lista.length));
  g.save();
  g.font = FONT.mono(9.5 * u);
  g.letterSpacing = `${1.8 * u}px`;
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.9)';
  g.shadowBlur = 8 * u;
  for (const [i, n] of lista.entries()) {
    const ai = smoothstep(i * paso, i * paso + 0.55, a);
    if (ai <= 0.01) continue;
    proyectar(n.pos, f.camera, f.W, f.H, q);
    if (q.z > 1) continue;
    // Past the ring (12 px at this dpr) and a little air.
    const off = 15 * f.dpr + (3 + (n.aire ?? 0)) * u;
    const lado = n.lado ?? 'e';
    const sube = (1 - ai) * 4 * u;
    let x = q.x;
    let y = q.y + sube;
    g.textAlign = lado === 'e' ? 'left' : lado === 'o' ? 'right' : 'center';
    if (lado === 'e') x += off;
    else if (lado === 'o') x -= off;
    else if (lado === 'n') y -= off;
    else y += off;
    g.globalAlpha = ai;
    g.fillStyle = n.nuestro ? violeta(0.85) : ink(0.55);
    g.fillText(n.texto.toUpperCase(), x, y);
  }
  g.restore();
}
