import * as THREE from 'three';
import { geometria, puntos, type Puntos } from '../horizontes';

/**
 * A kit to build engineered things in points, so a structure reads as built, not as a geometric
 * solid: beams, trusses, hoops, tubes, boxes, panels, steady and blinking lights, and traffic (small
 * craft moving along a path, a scale and a sign of life). Every point carries its normal, so the
 * shader lights it by the Sun (`uSun`), in the object's frame (`mundo: false`) or the world's.
 *
 * Kinds: 0 lit by the Sun; 1 a steady light; 2 a blinking light; 3 traffic (from `position` to `aVia`,
 * over and over, its light fading in and out at the ends).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export type RGB = [number, number, number];
export const METAL: RGB = [0.5, 0.52, 0.56];
export const OSCURO: RGB = [0.24, 0.25, 0.27];
export const LUZ: RGB = [0.45, 1.0, 0.85];
export const CALIDA: RGB = [1.25, 0.9, 0.55];

/** Two unit vectors square to `d` (and to each other). */
function base(d: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const a = Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  const u = a.cross(d).normalize();
  return [u, d.clone().cross(u).normalize()];
}

export class Obra {
  private pos: number[] = [];
  private col: number[] = [];
  private size: number[] = [];
  private nrm: number[] = [];
  private kind: number[] = [];
  private via: number[] = [];
  private seed: number[] = [];
  /** `paso`: the spacing of points (and their size), in the object's units. */
  constructor(public paso: number) {}
  get n() {
    return this.size.length;
  }

  punto(p: THREE.Vector3, n: THREE.Vector3, c: RGB, s = this.paso, kind = 0, via = p) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.col.push(c[0], c[1], c[2]);
    this.size.push(s);
    this.kind.push(kind);
    this.via.push(via.x, via.y, via.z);
    this.seed.push(Math.random());
  }
  /** A straight member from a to b; `n` its face normal (default: square to it, towards +Y or +X). */
  viga(a: THREE.Vector3, b: THREE.Vector3, c: RGB = METAL, s = this.paso, n?: THREE.Vector3) {
    const d = b.clone().sub(a);
    const L = d.length();
    const nn = n ?? base(d.clone().normalize())[1];
    for (let t = 0; t <= L; t += s * 0.8) this.punto(a.clone().addScaledVector(d, t / L), nn, c, s);
  }
  /** A truss from a to b, `w` across: three longerons and the zigzag braces between them. */
  celosia(a: THREE.Vector3, b: THREE.Vector3, w: number, c: RGB = METAL, s = this.paso) {
    const d = b.clone().sub(a);
    const L = d.length();
    const [u, v] = base(d.clone().normalize());
    const esq = [0, 1, 2].map((k) => u.clone().multiplyScalar(Math.cos((k * 2 * Math.PI) / 3) * w * 0.58).addScaledVector(v, Math.sin((k * 2 * Math.PI) / 3) * w * 0.58));
    for (const e of esq) this.viga(a.clone().add(e), b.clone().add(e), c, s, e.clone().normalize());
    const tramos = Math.max(1, Math.round(L / w));
    for (let i = 0; i < tramos; i++)
      for (let k = 0; k < 3; k++) {
        const p0 = a.clone().addScaledVector(d, i / tramos).add(esq[k]);
        const p1 = a.clone().addScaledVector(d, (i + 1) / tramos).add(esq[(k + 1) % 3]);
        this.viga(p0, p1, c, s * 0.8, esq[k].clone().add(esq[(k + 1) % 3]).normalize());
      }
  }
  /** A hoop (a circle of points) round `eje` through `c`, radius r; its normal points outwards. */
  aro(c: THREE.Vector3, eje: THREE.Vector3, r: number, col: RGB = METAL, s = this.paso, kind = 0) {
    const [u, v] = base(eje.clone().normalize());
    const n = Math.max(12, Math.round((2 * Math.PI * r) / (s * 0.8)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const d = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      this.punto(c.clone().addScaledVector(d, r), d, col, s, kind);
    }
  }
  /** The surface of a tube from a to b, radius r (open ends). */
  tubo(a: THREE.Vector3, b: THREE.Vector3, r: number, col: RGB = METAL, s = this.paso, kind = 0) {
    const d = b.clone().sub(a);
    const L = d.length();
    const [u, v] = base(d.clone().normalize());
    const na = Math.max(8, Math.round((2 * Math.PI * r) / s));
    const nl = Math.max(2, Math.round(L / s));
    for (let j = 0; j <= nl; j++)
      for (let i = 0; i < na; i++) {
        const t = (i + (j % 2) * 0.5) / na;
        const ang = t * Math.PI * 2;
        const n = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(v, Math.sin(ang));
        this.punto(a.clone().addScaledVector(d, j / nl).addScaledVector(n, r), n, col, s, kind);
      }
  }
  /** A box: centre, and its three half-axes (vectors); faces lit by their normals. */
  caja(c: THREE.Vector3, ax: THREE.Vector3, ay: THREE.Vector3, az: THREE.Vector3, col: RGB = METAL, s = this.paso) {
    const ejes = [ax, ay, az];
    for (let f = 0; f < 3; f++) {
      const n0 = ejes[f];
      const e1 = ejes[(f + 1) % 3];
      const e2 = ejes[(f + 2) % 3];
      const n1 = Math.max(1, Math.round((2 * e1.length()) / s));
      const n2 = Math.max(1, Math.round((2 * e2.length()) / s));
      for (const sg of [-1, 1]) {
        const nn = n0.clone().normalize().multiplyScalar(sg);
        // each face a little its own shade, its edges brighter
        const f0 = 0.85 + 0.3 * Math.random();
        for (let i = 0; i <= n1; i++)
          for (let j = 0; j <= n2; j++) {
            const borde = i === 0 || j === 0 || i === n1 || j === n2;
            const k = borde ? 1.25 : f0;
            const p = c.clone().addScaledVector(n0, sg).addScaledVector(e1, (i / n1) * 2 - 1).addScaledVector(e2, (j / n2) * 2 - 1);
            this.punto(p, nn, [col[0] * k, col[1] * k, col[2] * k], s);
          }
      }
    }
  }
  /** A flat panel (a grid of points) with darker seams every `celda`; `n` its normal. */
  panel(c: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, celda: number, col: RGB, s = this.paso, n?: THREE.Vector3) {
    const nn = n ?? a.clone().cross(b).normalize();
    const la = a.length() * 2;
    const lb = b.length() * 2;
    for (let x = 0; x <= la; x += s)
      for (let y = 0; y <= lb; y += s) {
        const seam = Math.abs(((x / celda) % 1) - 0.5) > 0.44 || Math.abs(((y / celda) % 1) - 0.5) > 0.44;
        const k = seam ? 0.45 : 1;
        const p = c.clone().addScaledVector(a, x / la * 2 - 1).addScaledVector(b, y / lb * 2 - 1);
        this.punto(p, nn, [col[0] * k, col[1] * k, col[2] * k], s);
      }
  }
  /** Lights along a circle: steady (kind 1) or blinking (kind 2). */
  luces(c: THREE.Vector3, eje: THREE.Vector3, r: number, cuantas: number, col: RGB = LUZ, s = this.paso * 1.8, kind = 2) {
    const [u, v] = base(eje.clone().normalize());
    for (let i = 0; i < cuantas; i++) {
      const a = (i / cuantas) * Math.PI * 2;
      const d = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      this.punto(c.clone().addScaledVector(d, r), d, col, s, kind);
    }
  }
  /** Traffic: `cuantas` craft going from a towards b (spread a little), each a light. */
  trafico(a: THREE.Vector3, b: THREE.Vector3, cuantas: number, ancho: number, col: RGB = CALIDA, s = this.paso * 2) {
    const [u, v] = base(b.clone().sub(a).normalize());
    for (let i = 0; i < cuantas; i++) {
      const o = u.clone().multiplyScalar((Math.random() - 0.5) * ancho).addScaledVector(v, (Math.random() - 0.5) * ancho);
      this.punto(a.clone().add(o), V(0, 1, 0), col, s, 3, b.clone().add(o.multiplyScalar(0.15)));
    }
  }

  /**
   * The points. `uni` must hold `uSun` (and `uTime` for lights and traffic); `mundo`: the Sun is
   * given in the world's frame (the normals are turned by the object's matrix), else in its own.
   * `relleno`: the light on what the Sun does not reach.
   */
  build(uni: Record<string, THREE.IUniform>, mundo = false, relleno = 0.22): Puntos {
    const n = this.n;
    const geo = geometria(
      { position: new Float32Array(this.pos), color: new Float32Array(this.col), size: new Float32Array(this.size), seed: new Float32Array(this.seed), aKind: new Float32Array(this.kind) },
      { aNrm: [new Float32Array(this.nrm), 3], aVia: [new Float32Array(this.via), 3] },
    );
    void n;
    return puntos(geo, {
      pre: /* glsl */ `attribute vec3 aNrm, aVia; uniform vec3 uSun; uniform float uTime;`,
      cuerpo: /* glsl */ `
        if (aKind < 0.5) {
          vec3 nW = normalize(${mundo ? 'mat3(modelMatrix) * aNrm' : 'aNrm'});
          em = color * (${relleno.toFixed(2)} + ${(1 - relleno).toFixed(2)} * max(dot(nW, uSun), 0.0));
        } else if (aKind < 1.5) {
        } else if (aKind < 2.5) {
          em = color * (0.15 + 0.85 * step(0.82, fract(uTime * 0.7 + seed * 7.0)));
        } else {
          float f = fract(uTime * 0.05 + seed);
          p = mix(position, aVia, f);
          em = color * smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.85, 1.0, f));
        }`,
      uniforms: { uTime: { value: 0 }, ...uni },
    });
  }
}
