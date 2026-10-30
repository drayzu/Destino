import * as THREE from 'three';
import { materia, materiaBuilder, type Nube } from './motor/materia';
import { TEAL } from './remake';
import { ink, nota, proyectar, texto, VIOLETA } from './placa';
import type { Frame } from './tipos';

/**
 * Revealing (GUION.md v2, the beat «revelar»): once an act, the camera lets go of the spark and
 * shows everything we reach. What a far shot needs to be read at a glance, the same in every act:
 *
 * - Orbits: fine dotted rings. Anyone reads rings round a star as a solar system.
 * - Marks: a world too small to see keeps a dot of its own colour a few pixels wide; what is ours
 *   wears a teal ring. The teal is always ours.
 * - Map labels (the way «El mapa»): a dot, a leader and a name, as on the plate.
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

export interface Mundo {
  pos: THREE.Vector3;
  /** Its radius (the mark fades as the world itself grows past a few pixels). */
  R: number;
  color: THREE.Color | number;
  /** Ours: a teal ring round its dot. */
  nuestro?: boolean;
}

/**
 * Marks for worlds seen from afar: a dot of each world's colour, 6 px, and a teal ring of 24 px
 * round ours. Sizes are pixels at any distance; a mark fades out as its world grows past ~10 px.
 * `uOn` lights them all.
 */
export function marcas(mundos: Mundo[]): Nube {
  const b = materiaBuilder(223);
  const radios: number[] = [];
  for (const m of mundos) {
    b.push(m.pos.x, m.pos.y, m.pos.z, m.color, 6, 1.0, { kind: 0 });
    radios.push(m.R);
    if (m.nuestro) {
      b.push(m.pos.x, m.pos.y, m.pos.z, TEAL, 24, 1.5, { kind: 1 });
      radios.push(m.R);
    }
  }
  const data = b.data();
  // Exact sizes: the builder spreads them.
  let k = 0;
  for (const m of mundos) {
    data.size[k++] = 6;
    if (m.nuestro) data.size[k++] = 24;
  }
  const nube = materia(data, {
    pre: /* glsl */ `
      attribute float aR;
      uniform float uOn, uDpr;
      varying float vAro;
    `,
    move: /* glsl */ `
      vAro = aKind;
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
      varying float vAro;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float f = vAro > 0.5 ? smoothstep(0.62, 0.74, d) * (1.0 - smoothstep(0.84, 0.98, d)) : 1.0 - smoothstep(0.55, 1.0, d);
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
  n.u.uMaxPx.value = 64 * dpr;
  n.u.uOn.value = on;
}

export interface RotuloMapa {
  pos: THREE.Vector3;
  texto: string;
  /** Where its label goes from the dot (layout px). */
  dx: number;
  dy: number;
  nuestro?: boolean;
}

/** The map's labels: a dot on each place, a leader and its name; ours with a teal dot. */
export function rotularMapa(g: CanvasRenderingContext2D, f: Frame, rotulos: RotuloMapa[], a: number, titulo?: string) {
  if (a <= 0.01) return;
  const q = { x: 0, y: 0, z: 0 };
  for (const r of rotulos) {
    proyectar(r.pos, f.camera, f.W, f.H, q);
    if (q.z > 1) continue;
    nota(g, f.u, q.x, q.y, r.texto, r.dx, r.dy, a, r.nuestro ? VIOLETA : ink(0.8));
  }
  if (titulo) texto(g, f.u, f.W / 2, 64 * f.u, titulo, ink(0.85), a, 11, 'center');
}
