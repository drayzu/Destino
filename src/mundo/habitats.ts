import * as THREE from 'three';
import { enfocar, geometria, puntos, type Puntos, type Vista } from '../horizontes';

/**
 * The other habitats at L5 (act III), all of them turning for their gravity, in kilometres:
 *
 * - Bishop ring (Bishop 1997): a band 1 000 km in radius and 500 km wide, open to space, its air held
 *   by walls 200 km high; it needs carbon nanotubes. One turn every ~33 minutes.
 * - McKendree cylinder (McKendree 2000): an O'Neill cylinder of carbon nanotubes, 460 km in radius and
 *   4 600 km long. One turn every ~24 minutes.
 * - Stanford torus (NASA–Stanford summer study, 1975): a wheel 1.8 km across for 10 000 people,
 *   one turn a minute.
 * - Bernal sphere (Bernal 1929; Island One in O'Neill's version): a sphere ~500 m across, with its
 *   farms in rings at the ends.
 *
 * Drawn as the O'Neill cylinder is (cilindro.ts): points over a dim surface. Each surface is one
 * piece of GLSL, `vec3 sup(vec3 vP, vec3 vNW, bool fuera)` (its local position, its normal in the
 * world, which side is seen), that colours both the points and, dimmer, the surface under them.
 * Lit by `uSun`, the Sun's direction in the world (the pivot never rotates the world).
 */

const LOG_V = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>`;
const LOG_F = /* glsl */ `#include <logdepthbuf_pars_fragment>`;
const NOISE = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
  float fbm2(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
  vec3 grado(vec3 c) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, 0.6);
    return pow(max(c, vec3(0.0)), vec3(1.3)) * vec3(0.9, 0.96, 1.04);
  }`;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** Turns per second for 1 g at radius r (km). */
const omega = (r: number) => Math.sqrt(9.81 / (r * 1000));
/** How bright the surface under the points is. */
const FONDO = 0.25;

/**
 * A surface in points: the mesh stays as the dim surface under them; `n` points are spread over its
 * triangles by area (in its own frame, so they turn and move with it), each coloured by `sup`.
 */
function superficie(mesh: THREE.Mesh, uni: Record<string, THREE.IUniform>, sup: string, n: number, capas: Puntos[]) {
  mesh.material = new THREE.ShaderMaterial({
    uniforms: uni,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `${LOG_V}
      varying vec3 vP; varying vec3 vNW;
      void main() { vP = position; vNW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      ${NOISE}
      ${sup}
      varying vec3 vP; varying vec3 vNW;
      void main() {
        #include <logdepthbuf_fragment>
        gl_FragColor = vec4(sup(vP, normalize(vNW), gl_FrontFacing) * ${FONDO.toFixed(2)}, 1.0);
      }`,
  });
  // Points over its triangles, by area.
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const P = g.getAttribute('position');
  const N = g.getAttribute('normal');
  const tris = P.count / 3;
  const acc = new Float64Array(tris);
  const a = V();
  const b = V();
  const c = V();
  let total = 0;
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(P, t * 3);
    b.fromBufferAttribute(P, t * 3 + 1);
    c.fromBufferAttribute(P, t * 3 + 2);
    total += b.sub(a).cross(c.sub(a)).length() / 2;
    acc[t] = total;
  }
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const na = V();
  const nb = V();
  const nc = V();
  for (let i = 0; i < n; i++) {
    const x = Math.random() * total;
    let lo = 0;
    let hi = tris - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (acc[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    a.fromBufferAttribute(P, lo * 3);
    b.fromBufferAttribute(P, lo * 3 + 1);
    c.fromBufferAttribute(P, lo * 3 + 2);
    na.fromBufferAttribute(N, lo * 3);
    nb.fromBufferAttribute(N, lo * 3 + 1);
    nc.fromBufferAttribute(N, lo * 3 + 2);
    const p = a.clone().multiplyScalar(1 - u - v).addScaledVector(b, u).addScaledVector(c, v);
    const q = na.clone().multiplyScalar(1 - u - v).addScaledVector(nb, u).addScaledVector(nc, v).normalize();
    pos.set([p.x, p.y, p.z], i * 3);
    nrm.set([q.x, q.y, q.z], i * 3);
    seed[i] = Math.random();
  }
  const s = Math.sqrt(total / n) * 1.3;
  const geo = geometria({ position: pos, color: new Float32Array(n * 3).fill(1), size: Float32Array.from({ length: n }, () => s * (0.65 + Math.random() * 0.7)), seed, aKind: new Float32Array(n) }, { aNrm: [nrm, 3] });
  const nube = puntos(geo, {
    pre: /* glsl */ `attribute vec3 aNrm; ${NOISE} ${sup}`,
    cuerpo: /* glsl */ `{
      vec4 mvp = modelViewMatrix * vec4(p, 1.0);
      bool fuera = dot(normalMatrix * aNrm, -mvp.xyz) > 0.0;
      em = sup(p, normalize(mat3(modelMatrix) * aNrm), fuera) * (0.82 + 0.36 * seed);
    }`,
    uniforms: uni,
  });
  nube.points.position.copy(mesh.position);
  nube.points.quaternion.copy(mesh.quaternion);
  nube.points.scale.copy(mesh.scale);
  mesh.parent?.add(nube.points);
  capas.push(nube);
  return mesh;
}

/** A hull: dark panels, ribs, and three long windows glowing with the day inside. */
const HULL = (ribs: number, len: number) => /* glsl */ `
  uniform vec3 uSun;
  vec3 sup(vec3 vP, vec3 vNW, bool fuera) {
    float th = atan(vP.z, vP.x) + 3.14159265;
    float sec = mod(th, 2.0943951) / 2.0943951;
    float sun = max(dot(vNW, uSun), 0.0);
    vec3 col = vec3(0.3, 0.31, 0.32) * (0.12 + 0.8 * sun);
    float win = step(0.5, sec) * step(abs(vP.y), ${(len / 2).toFixed(1)} * 0.98);
    col = mix(col, vec3(0.42, 0.58, 0.72) * 0.6, win);
    float rib = smoothstep(0.46, 0.49, abs(fract(vP.y * ${ribs.toFixed(4)}) - 0.5));
    col += vec3(0.25) * rib * 0.25 * (0.3 + sun);
    return grado(col);
  }`;

// ---------------------------------------------------------------- Bishop ring

export function anilloBishop() {
  const R = 1000;
  const W = 500;
  const group = new THREE.Group();
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uSun: { value: V(1, 0, 0) }, uTime: { value: 0 } };
  const capas: Puntos[] = [];
  // The floor: land, seas and clouds inside; the hull outside.
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 720, 8, true));
  giro.add(floor);
  superficie(
    floor,
    uni,
    /* glsl */ `
    uniform vec3 uSun; uniform float uTime;
    vec3 sup(vec3 vP, vec3 vNW, bool fuera) {
      float th = atan(vP.z, vP.x);
      vec2 q = vec2(th * ${(R / 90).toFixed(2)}, vP.y / 90.0);
      vec3 col;
      if (fuera) {
        // Outside: the hull, its cables.
        float sun = max(dot(vNW, uSun), 0.0);
        col = vec3(0.3, 0.31, 0.32) * (0.12 + 0.8 * sun);
        col += vec3(0.2) * smoothstep(0.47, 0.5, abs(fract(q.x * 0.5) - 0.5)) * 0.15;
      } else {
        // Inside: a whole continent turned into a band. The day falls in from the open side.
        float f = fbm2(q * 0.6);
        float land = smoothstep(0.47, 0.52, f);
        col = mix(vec3(0.03, 0.09, 0.16), mix(vec3(0.12, 0.22, 0.09), vec3(0.32, 0.3, 0.16), smoothstep(0.55, 0.75, f)), land);
        float cl = smoothstep(0.55, 0.8, fbm2(q * 1.3 + vec2(uTime * 0.01, 0.0)));
        col = mix(col, vec3(0.85, 0.88, 0.9), cl * 0.7);
        // Towards the walls the land rises in terraces.
        float e = abs(vP.y) / ${(W / 2).toFixed(1)};
        col = mix(col, vec3(0.2, 0.2, 0.18), smoothstep(0.85, 0.98, e));
        col *= 0.8;
      }
      return grado(col);
    }`,
    420000,
    capas,
  );
  // The walls that hold the air: 200 km high, a line of light along their tops.
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.RingGeometry(R - 200, R, 720, 2));
    wall.rotation.x = Math.PI / 2;
    wall.position.y = (s * W) / 2;
    giro.add(wall);
    superficie(
      wall,
      uni,
      /* glsl */ `
      uniform vec3 uSun;
      vec3 sup(vec3 vP, vec3 vNW, bool fuera) {
        float r = length(vP.xy);
        float sun = abs(dot(vNW, uSun));
        vec3 col = grado(vec3(0.3, 0.31, 0.32) * (0.12 + 0.8 * sun));
        col += vec3(0.45, 1.0, 0.85) * (1.0 - smoothstep(0.0, 6.0, r - ${(R - 200).toFixed(1)})) * 0.9;
        return col;
      }`,
      90000,
      capas,
    );
  }
  return {
    group,
    uni,
    R,
    W,
    update(time: number, vista: Vista) {
      giro.rotation.y = time * omega(R);
      uni.uTime.value = time;
      for (const c of capas) enfocar(c, vista);
    },
  };
}

// ---------------------------------------------------------------- McKendree cylinder

export function cilindroMcKendree() {
  const R = 460;
  const L = 4600;
  const group = new THREE.Group();
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uSun: { value: V(1, 0, 0) } };
  const capas: Puntos[] = [];
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 256, 16, false));
  giro.add(hull);
  superficie(hull, uni, HULL(1 / 120, L), 300000, capas);
  return {
    group,
    uni,
    R,
    L,
    update(time: number, vista: Vista) {
      giro.rotation.y = time * omega(R);
      for (const c of capas) enfocar(c, vista);
    },
  };
}

// ---------------------------------------------------------------- Stanford torus

const METAL = (R: number, bandas: boolean) => /* glsl */ `
  uniform vec3 uSun;
  vec3 sup(vec3 vP, vec3 vNW, bool fuera) {
    float sun = max(dot(vNW, uSun), 0.0);
    vec3 col = vec3(0.45, 0.47, 0.5) * (0.12 + 0.8 * sun);
    ${
      bandas
        ? `// Windows in bands round its middle.
    float lat = vP.y / ${R.toFixed(3)};
    float band = step(abs(lat), 0.5) * smoothstep(0.3, 0.45, abs(fract(lat * 4.0) - 0.5));
    col = mix(col, vec3(0.6, 0.8, 0.9) * 0.55, band);`
        : `// The window band on the inner side of the wheel, glowing with the day inside.
    float inner = smoothstep(${(R - 0.03).toFixed(3)}, ${(R - 0.05).toFixed(3)}, length(vP.xy)) * step(abs(vP.z), 0.03);
    col = mix(col, vec3(0.6, 0.8, 0.9) * 0.6, inner);`
    }
    return grado(col);
  }`;

export function toroStanford() {
  const R = 0.895;
  const group = new THREE.Group();
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uSun: { value: V(1, 0, 0) } };
  const capas: Puntos[] = [];
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(R, 0.065, 24, 192));
  wheel.rotation.x = Math.PI / 2;
  giro.add(wheel);
  superficie(wheel, uni, METAL(R, false), 120000, capas);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 16));
  giro.add(hub);
  superficie(hub, uni, METAL(R, true), 8000, capas);
  for (let k = 0; k < 6; k++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, R - 0.1, 8, 4));
    const a = (k / 6) * Math.PI * 2;
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = a;
    spoke.position.set((Math.cos(a) * (R + 0.04)) / 2, 0, (-Math.sin(a) * (R + 0.04)) / 2);
    giro.add(spoke);
    superficie(spoke, uni, METAL(R, true), 3000, capas);
  }
  return {
    group,
    uni,
    update(time: number, vista: Vista) {
      giro.rotation.y = time * ((2 * Math.PI) / 60);
      for (const c of capas) enfocar(c, vista);
    },
  };
}

// ---------------------------------------------------------------- Bernal sphere

export function esferaBernal() {
  const R = 0.25;
  const group = new THREE.Group();
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uSun: { value: V(1, 0, 0) } };
  const capas: Puntos[] = [];
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 32));
  giro.add(esfera);
  superficie(esfera, uni, METAL(R, true), 40000, capas);
  // The farms: rings at both ends.
  for (const s of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 12, 64));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = s * (R + 0.06 + k * 0.06);
      giro.add(ring);
      superficie(ring, uni, METAL(R, true), 6000, capas);
    }
  return {
    group,
    uni,
    update(time: number, vista: Vista) {
      giro.rotation.y = time * 0.2;
      for (const c of capas) enfocar(c, vista);
    },
  };
}
