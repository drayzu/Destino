import * as THREE from 'three';
import { materiaBuilder } from '../../../estudios/motor/materia';
import { gauss } from '../../../estudios/motor/math';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const CORAL = new THREE.Color(1.0, 0.56, 0.45);
export const BLANCA = new THREE.Color(1.0, 0.86, 0.76);

export interface Neurona {
  c: THREE.Vector3;
}

/** Neurons in a volume, each with its dendrites (branching), and an axon to a neighbour. */
export function bosque() {
  const b = materiaBuilder(301);
  const r = b.r;
  const neuronas: Neurona[] = [];
  // The first one, «tú», at the origin; the rest round it.
  neuronas.push({ c: V() });
  // (wide enough for the way to arc right round inside it: DIRECCION.md, 2)
  while (neuronas.length < 230) {
    const p = V((r() - 0.5) * 15, (r() - 0.5) * 5, (r() - 0.5) * 15);
    if (neuronas.every((n) => n.c.distanceTo(p) > 0.9)) neuronas.push({ c: p });
  }
  const rama = (desde: THREE.Vector3, dir: THREE.Vector3, largo: number, nivel: number) => {
    const fin = desde.clone().addScaledVector(dir, largo);
    const n = Math.max(4, Math.round(largo * 180));
    for (let i = 0; i < n; i++) {
      const t = r();
      const p = desde.clone().lerp(fin, t);
      b.push(p.x + gauss(r) * 0.004, p.y + gauss(r) * 0.004, p.z + gauss(r) * 0.004, CORAL, 0.006, 0.16 + 0.1 * (4 - nivel), { kind: 1 });
    }
    if (nivel < 4) {
      const hijas = 2;
      for (let k = 0; k < hijas; k++) {
        const d2 = dir.clone().add(V(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.55)).normalize();
        rama(fin, d2, largo * (0.55 + r() * 0.2), nivel + 1);
      }
    }
  };
  for (const ne of neuronas) {
    // The body: a bright knot.
    for (let i = 0; i < 70; i++) {
      const [x, y, z] = b.onSphere();
      const q = Math.cbrt(r()) * 0.05;
      b.push(ne.c.x + x * q, ne.c.y + y * q, ne.c.z + z * q, BLANCA, 0.012, 0.9, { kind: 0 });
    }
    for (let k = 0; k < 6; k++) {
      const [x, y, z] = b.onSphere();
      rama(ne.c, V(x, y, z), 0.32 + r() * 0.2, 1);
    }
  }
  return { b, neuronas };
}

/** An axon between two neurons: a soft curve. */
export function axon(a: THREE.Vector3, c: THREE.Vector3, r: () => number) {
  const mid = a.clone().add(c).multiplyScalar(0.5).add(V(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.35));
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, c.clone());
}
