import * as THREE from 'three';
import { materiaBuilder, type MateriaData } from '../../../estudios/motor/materia';
import { gauss } from '../../../estudios/motor/math';
import { caraHacia } from '../../../estudios/remake';
import { CARA, luces } from '../tierra';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** What passes by the lens fades out instead of growing into a blot (the flight goes through it all). */
export const LENTE = /* glsl */ `
  float dCam = length(mv.xyz) / max(uEscalaMundo, 1e-30);
  em *= smoothstep(0.012, 0.06, dCam);
  occ *= smoothstep(0.012, 0.06, dCam);
`;
export const VIOLETA = new THREE.Color(0.66, 0.5, 1.0);
export const CORAL = new THREE.Color(1.0, 0.5, 0.42);
export const MAR = new THREE.Color(0.35, 0.62, 0.9);

/** The cell: a membrane, its inside and its nucleus; and motes in the water round it. */
export function celulaDatos(): MateriaData {
  const b = materiaBuilder(101);
  const r = b.r;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 9000; i++) {
    const y = 1 - ((i + 0.5) / 9000) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i;
    b.push(Math.cos(th) * rr * 0.42, y * 0.42, Math.sin(th) * rr * 0.42, new THREE.Color(0.6, 0.86, 1.0), 0.006, 0.55, { kind: 0 });
  }
  for (let i = 0; i < 2500; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r()) * 0.36;
    b.push(x * q, y * q, z * q, new THREE.Color(0.5, 0.75, 0.95), 0.005, 0.22, { kind: 1 });
  }
  for (let i = 0; i < 900; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r()) * 0.1;
    b.push(x * q + 0.06, y * q - 0.03, z * q, new THREE.Color(0.75, 0.82, 1.0), 0.006, 0.5, { kind: 1 });
  }
  // The sea: motes drifting, all round.
  for (let i = 0; i < 16000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 0.6 + Math.cbrt(r()) * 5;
    b.push(x * q, y * q, z * q, MAR, 0.004 + r() * 0.006, 0.12 + r() * 0.2, { kind: 2 });
  }
  return b.data();
}

/** The net: a bell of radial nerves and a ring at its rim, with fine threads between; `aKind` 0 nerve, 1 fine, 2 tentacle; `aDelay` how far along. */
export const campana = (t: number, a: number) => {
  const ph = t * 1.35;
  return V(Math.sin(ph) * Math.cos(a), Math.cos(ph) * 0.75 - 0.2, Math.sin(ph) * Math.sin(a)).multiplyScalar(1.1);
};

export function redNerviosaDatos(): MateriaData {
  const b = materiaBuilder(103);
  const r = b.r;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    for (let i = 0; i < 700; i++) {
      const t = r();
      const p = campana(t, a);
      b.push(p.x + gauss(r) * 0.006, p.y + gauss(r) * 0.006, p.z + gauss(r) * 0.006, VIOLETA, 0.008, 0.55, { kind: 0, delay: t });
    }
  }
  // (the ring that joins them grows out from each strand's tip, to meet the next one halfway: whole
  // at once it popped up from nothing)
  for (let i = 0; i < 4000; i++) {
    const a = r() * Math.PI * 2;
    const p = campana(1, a);
    const medio = Math.abs(((a / (Math.PI * 2)) * 16) % 1 - 0.5);
    b.push(p.x, p.y + gauss(r) * 0.01, p.z, VIOLETA, 0.008, 0.6, { kind: 0, delay: 1 + 0.18 * (1 - 2 * medio) });
  }
  for (let i = 0; i < 9000; i++) {
    const p = campana(0.15 + r() * 0.85, r() * Math.PI * 2);
    b.push(p.x, p.y, p.z, VIOLETA, 0.005, 0.18, { kind: 1, delay: r() });
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const p0 = campana(1, a);
    for (let i = 0; i < 260; i++) {
      const t = r();
      b.push(p0.x * (1 - 0.15 * t) + Math.sin(t * 9 + k) * 0.03, p0.y - t * 1.4, p0.z * (1 - 0.15 * t) + Math.cos(t * 7 + k) * 0.03, VIOLETA, 0.005, 0.3, { kind: 2, delay: t });
    }
  }
  return b.data();
}

/**
 * A point of the brain's surface from a direction: two hemispheres apart (the fissure), the temporal
 * lobes low at the sides, folds (gyri and sulci). Returns the place and how much it is a ridge (0..1),
 * so ridges shine and grooves stay dark: the folds read in points.
 */
export function corteza(d: THREE.Vector3): [THREE.Vector3, number] {
  const pliegue = Math.sin(10 * d.x + 3 * Math.sin(8 * d.y) + 2 * Math.sin(6 * d.z)) * Math.sin(12 * d.z + 2 * Math.sin(6 * d.x) + 3 * Math.sin(5 * d.y));
  const f = 1 + 0.045 * pliegue;
  const p = V(d.x * 0.78, d.y * 0.66, d.z * 1.0).multiplyScalar(f);
  p.x += Math.sign(d.x || 1) * 0.1;
  // The temporal lobes: lower and forward at the sides.
  const tem = Math.exp(-((d.y + 0.45) ** 2) / 0.05) * Math.exp(-((d.z - 0.1) ** 2) / 0.25) * Math.abs(d.x);
  p.y -= 0.12 * tem;
  p.x += Math.sign(d.x || 1) * 0.06 * tem;
  if (d.y < -0.25) p.y = -0.25 * 0.66 + (p.y + 0.25 * 0.66) * 0.55;
  return [p, Math.max(0, pliegue)];
}

/**
 * The brain: its folded cortex, and a network of neurons inside (knots and threads). The network's
 * points also know where they go on the night Earth (`position`) and start in the brain (`aFrom`):
 * the same light, reordered into our cities. `aDat`: kind (0 knot, 1 thread), along, phase, city size.
 */
export function cerebroDatos(img: ImageData) {
  const corteza0 = materiaBuilder(107);
  const r = corteza0.r;
  for (let i = 0; i < 70000; i++) {
    const [x, y, z] = corteza0.onSphere();
    const [p, g] = corteza(V(x, y, z));
    corteza0.push(p.x, p.y, p.z, CORAL, 0.006, 0.05 + 0.5 * g * g);
  }
  // The cerebellum, finely striped, low at the back.
  for (let i = 0; i < 9000; i++) {
    const [x, y, z] = corteza0.onSphere();
    const raya = 0.5 + 0.5 * Math.sin(y * 40);
    corteza0.push(x * 0.42, y * 0.2 - 0.42, z * 0.26 - 0.72, CORAL, 0.005, 0.06 + 0.35 * raya * raya);
  }
  // The network inside.
  const nodos: THREE.Vector3[] = [];
  while (nodos.length < 1800) {
    const p = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    const q = V(p.x / 0.8, p.y / 0.62, p.z / 0.96);
    if (q.lengthSq() < 0.92) nodos.push(p);
  }
  const red = materiaBuilder(109);
  const dat: number[] = [];
  const posiciones: [number, number, number][] = [];
  const BLANCO = new THREE.Color(1.0, 0.86, 0.76);
  for (const n of nodos) {
    for (let k = 0; k < 10; k++) {
      posiciones.push([n.x + gauss(r) * 0.008, n.y + gauss(r) * 0.008, n.z + gauss(r) * 0.008]);
      dat.push(0, 0, r(), 0);
    }
  }
  const hechos = new Set<string>();
  // (the links as continuous fibres too: drawn as lines while it is a brain)
  const fibras: number[] = [];
  const fibraT: number[] = [];
  nodos.forEach((n, i) => {
    const cerca = nodos
      .map((m, j) => ({ j, d: m.distanceTo(n) }))
      .filter((x) => x.j !== i)
      .sort((a, z) => a.d - z.d)
      .slice(0, 3);
    for (const { j, d } of cerca) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (hechos.has(key)) continue;
      hechos.add(key);
      const m = nodos[j];
      const cuantos = Math.round(d * 160);
      const fase = r();
      fibras.push(n.x, n.y, n.z, m.x, m.y, m.z);
      fibraT.push(i < j ? 0 : 1, fase, i < j ? 1 : 0, fase);
      for (let q = 0; q < cuantos; q++) {
        const t = r();
        posiciones.push([n.x + (m.x - n.x) * t, n.y + (m.y - n.y) * t, n.z + (m.z - n.z) * t]);
        dat.push(1, i < j ? t : 1 - t, fase, 0);
      }
    }
  });
  // Where each one goes: a light of the night Earth (the Earth turned as in scene 6).
  const l = luces(img, false);
  const n = posiciones.length;
  const q = caraHacia(CARA.lat, CARA.lon);
  const destino = V();
  const total = l.data.position.length / 3;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * total);
    destino.set(l.data.position[k * 3], l.data.position[k * 3 + 1], l.data.position[k * 3 + 2]).applyQuaternion(q);
    const [x, y, z] = posiciones[i];
    const nudo = dat[i * 4] < 0.5;
    const lc = new THREE.Color(l.data.color[k * 3], l.data.color[k * 3 + 1], l.data.color[k * 3 + 2]);
    red.push(destino.x, destino.y, destino.z, nudo ? BLANCO : CORAL, nudo ? 0.008 : 0.005, nudo ? 0.34 : 0.11, { from: [x, y, z], delay: r() });
    // The colour it ends with: the light's own (in `aDat.w`, its brightness).
    dat[i * 4 + 3] = (lc.r + lc.g + lc.b) / 3;
  }
  return { corteza: corteza0.data(), red: red.data(), dat: new Float32Array(dat), fibras: new Float32Array(fibras), fibraT: new Float32Array(fibraT) };
}
