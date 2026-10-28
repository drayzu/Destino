import * as THREE from 'three';
import { enfocar, geometria, puntos, type Puntos, type Vista } from '../horizontes';
import { CALIDA, LUZ, METAL as ACERO, OSCURO, Obra } from './obra';

/**
 * The other habitats at L5 (act III), all of them turning for their gravity, in kilometres:
 *
 * - Bishop ring (Bishop 1997): a band 1 000 km in radius and 500 km wide, open to space, its air held
 *   by walls 200 km high; it needs carbon nanotubes. One turn every ~33 minutes. Here still being
 *   built: a stretch of it is bare frames between two bulkheads.
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
        // A hair behind its own points (a fraction of the distance): exactly under them, it hid them
        // from afar, where depth is coarse, and a habitat sprang out of nothing as we came close.
        #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
          gl_FragDepth += 3e-6;
        #endif
        gl_FragColor = vec4(sup(vP, normalize(vNW), gl_FrontFacing) * ${FONDO.toFixed(2)}, 1.0);
      }`,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
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

/** Where it stands in its turn: the gap on the near side as we pass. */
const FASE = 3.0;
export function anilloBishop() {
  const R = 1000;
  const W = 500;
  const group = new THREE.Group();
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uSun: { value: V(1, 0, 0) }, uTime: { value: 0 } };
  const capas: Puntos[] = [];
  const h = W / 2;
  // Not closed yet: a stretch of it (2 HUECO round angle 0) is still being built, its bare frames
  // between two bulkheads, the cables already across. Angles `a` as in obra.ts: (cos a, 0, sin a).
  const HUECO = 0.22;
  const PHI0 = HUECO - 1.5 * Math.PI;
  const PHI = 2 * Math.PI - 2 * HUECO;
  const en = (a: number, r: number, y: number) => V(Math.cos(a) * r, y, Math.sin(a) * r);
  // The cross-section of the hull (r, y), from the crest of one wall round to the other's: each wall a
  // dam, thick at its foot, leaning, rounded at its crest; the keel under the land bulging a little.
  const medio: [number, number][] = [
    [R + 30, 0], [R + 27, 100], [R + 18, 190], [R + 2, 252], [R - 26, 296], [R - 62, 306],
    [R - 122, 288], [R - 180, 268], [R - 201, 261], [R - 207, 254], [R - 200, 250],
  ];
  const ctrl = [...medio.slice(1).reverse().map(([r, y]) => V(r, -y, 0)), ...medio.map(([r, y]) => V(r, y, 0))];
  const perfil = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal').getSpacedPoints(400).map((p) => new THREE.Vector2(p.x, p.y));
  /** The keel's radius at y (under the land). */
  const quilla = (y: number) => perfil.reduce((b, p) => (p.x > R - 5 && Math.abs(p.y - y) < Math.abs(b.y - y) ? p : b), perfil[200]).x;
  // The floor: land, seas and clouds inside (its outside is behind the hull).
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 720, 8, true, PHI0, PHI));
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
        // Outside: the same light metal as the others, in 120 segments round the ring (each its own
        // shade, so the turning shows), ribbed along its width, a row of lights along each edge.
        float sun = max(dot(vNW, uSun), 0.0);
        float a = (th + 3.14159265) / 6.2831853 * 120.0;
        float seam = smoothstep(0.43, 0.5, abs(fract(a) - 0.5));
        float rib = smoothstep(0.44, 0.5, abs(fract(vP.y / 125.0) - 0.5));
        float shade = 0.8 + 0.4 * h21(vec2(floor(a), floor(vP.y / 125.0)));
        col = vec3(0.45, 0.47, 0.5) * shade * (0.18 + 0.82 * sun);
        col *= 1.0 - 0.55 * max(seam, rib);
        float borde = 1.0 - smoothstep(${(W / 2 - 12).toFixed(1)}, ${(W / 2 - 4).toFixed(1)}, abs(vP.y));
        float luz = step(0.7, fract(a * 2.0));
        return grado(col) + vec3(0.45, 1.0, 0.85) * (1.0 - borde) * luz * 0.9;
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
        col *= 1.15;
      }
      return grado(col);
    }`,
    340000,
    capas,
  );
  // The walls that hold the air: 200 km high, a line of light along their tops.
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.RingGeometry(R - 200, R, 720, 2, HUECO, PHI));
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
        // The walls, in the same metal, in segments; along their tops a dashed line of lights.
        float a = (atan(vP.y, vP.x) + 3.14159265) / 6.2831853 * 120.0;
        float seam = smoothstep(0.43, 0.5, abs(fract(a) - 0.5));
        vec3 col = grado(vec3(0.45, 0.47, 0.5) * (0.18 + 0.82 * sun) * (1.0 - 0.5 * seam));
        col += vec3(0.45, 1.0, 0.85) * (1.0 - smoothstep(0.0, 6.0, r - ${(R - 200).toFixed(1)})) * step(0.55, fract(a * 2.0)) * 1.2;
        return col;
      }`,
      90000,
      capas,
    );
  }
  // The hull: one piece round the section, from wall crest to wall crest; people live in the dams.
  {
    const casco = new THREE.LatheGeometry(perfil, 720, PHI0, PHI);
    // (its normals outwards: the keel's, mid-section of the first meridian, away from the axis)
    const pn = casco.getAttribute('normal');
    const pp = casco.getAttribute('position');
    if (pn.getX(200) * pp.getX(200) + pn.getZ(200) * pp.getZ(200) < 0) for (let i = 0; i < pn.count; i++) pn.setXYZ(i, -pn.getX(i), -pn.getY(i), -pn.getZ(i));
    const mesh = new THREE.Mesh(casco);
    giro.add(mesh);
    superficie(
      mesh,
      uni,
      /* glsl */ `
      uniform vec3 uSun;
      vec3 sup(vec3 vP, vec3 vNW, bool fuera) {
        float r = length(vP.xz);
        float sun = max(dot(vNW, uSun), 0.0);
        float a = (atan(vP.z, vP.x) + 3.14159265) / 6.2831853 * 240.0;
        // how far round the section from the keel's middle (up a dam's face, on from |y|)
        float s = abs(vP.y) + max(0.0, ${R.toFixed(1)} - r);
        float seam = smoothstep(0.43, 0.5, abs(fract(a) - 0.5));
        float rib = smoothstep(0.44, 0.5, abs(fract(s / 64.0) - 0.5));
        float shade = 0.78 + 0.44 * h21(vec2(floor(a), floor(s / 64.0)));
        float dique = smoothstep(${(R - 5).toFixed(1)}, ${(R - 30).toFixed(1)}, r);
        vec3 col = vec3(0.45, 0.47, 0.5) * shade * (0.42 + 0.58 * sun) * (1.0 - 0.12 * dique);
        col = grado(col * (1.0 - 0.55 * max(seam, rib)));
        float ven = step(0.9, h21(floor(vec2(a * 6.0, s / 5.0)))) * step(0.5, fract(s / 5.0)) * dique;
        return col + vec3(1.25, 0.9, 0.55) * ven * 0.55;
      }`,
      380000,
      capas,
    );
  }
  // The two bulkheads where the built part ends: the section closed, up to the walls' crests (above
  // the land, the dam that holds the air); a row of lights along the land's edge.
  for (const a of [HUECO, -HUECO]) {
    const tapa = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(perfil), 1));
    tapa.rotation.y = -a;
    giro.add(tapa);
    superficie(
      tapa,
      uni,
      /* glsl */ `
      uniform vec3 uSun;
      vec3 sup(vec3 vP, vec3 vNW, bool fuera) {
        float sun = abs(dot(vNW, uSun));
        vec2 g = abs(fract(vP.xy / 24.0) - 0.5);
        float seam = smoothstep(0.42, 0.5, max(g.x, g.y));
        float aire = step(vP.x, ${R.toFixed(1)});
        vec3 col = vec3(0.42, 0.44, 0.47) * (0.8 + 0.4 * h21(floor(vP.xy / 24.0))) * (0.2 + 0.8 * sun) * (1.0 - 0.5 * seam) * (1.0 - 0.3 * aire);
        float suelo = 1.0 - smoothstep(0.0, 5.0, abs(vP.x - ${R.toFixed(1)}));
        return grado(col) + vec3(1.25, 0.9, 0.55) * suelo * step(0.5, fract(vP.y / 9.0)) * 0.9;
      }`,
      30000,
      capas,
    );
  }
  // What makes it built: the cables that hold it (carbon nanotube, in bundles round its keel, already
  // across the gap), ribs round its section every 3°, towns and towers along the walls' crests, docks
  // standing off the keel with craft coming in; in the gap, the bare frames, the hull's first panels
  // creeping in from both ends, the lights of the work and the craft that bring more.
  {
    const o = new Obra(3);
    const hecho = (a: number) => {
      const b = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return b > HUECO + 0.004 && b < 2 * Math.PI - HUECO - 0.004;
    };
    // The section, coarser, and its outward normal at each point (r, y).
    const cp = perfil.filter((_, i) => i % 8 === 0);
    const nrm2 = (j: number) => {
      const t = cp[Math.min(j + 1, cp.length - 1)].clone().sub(cp[Math.max(j - 1, 0)]);
      return new THREE.Vector2(t.y, -t.x).normalize();
    };
    const sobre = (a: number, j: number, d: number) => {
      const n = nrm2(j);
      return en(a, cp[j].x + n.x * d, cp[j].y + n.y * d);
    };
    const nrm3 = (a: number, j: number) => {
      const n = nrm2(j);
      return en(a, n.x, n.y);
    };
    for (const y of [-200, -100, 0, 100, 200]) {
      const rc = quilla(y) + 8;
      o.tubo(V(0, y - 7, 0), V(0, y + 7, 0), rc, ACERO, 3.2);
      o.luces(V(0, y, 0), V(0, 1, 0), rc + 9, 48, y === 0 ? LUZ : [1.4, 0.4, 0.3], 9);
    }
    for (let k = 0; k < 120; k++) {
      const a = (k / 120) * Math.PI * 2;
      if (!hecho(a)) continue;
      const c: [number, number, number] = k % 10 === 0 ? [0.7, 0.72, 0.76] : OSCURO;
      for (let j = 0; j < cp.length - 1; j++) o.viga(sobre(a, j, 3), sobre(a, j + 1, 3), c, 2.6, nrm3(a, j));
    }
    // Along each wall's crest: a rim, and every 9° a town on it, a few of them tall.
    for (const sg of [-1, 1]) {
      for (let a = HUECO; a < 2 * Math.PI - HUECO; a += 2 / (R - 207)) o.punto(en(a, R - 208, sg * 254), en(a, -1, 0), [0.7, 0.72, 0.76], 2.5);
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2 + (sg > 0 ? 0.04 : 0);
        if (!hecho(a - 0.03) || !hecho(a + 0.03)) continue;
        const rad = V(Math.cos(a), 0, Math.sin(a));
        const tan = V(-Math.sin(a), 0, Math.cos(a));
        const alto = k % 5 === 0 ? 30 : 8 + 6 * ((k * 3) % 2);
        const c = rad.clone().multiplyScalar(R - 200 - alto).setY(sg * (h + 4));
        o.caja(c, rad.clone().multiplyScalar(alto), V(0, 6, 0), tan.clone().multiplyScalar(k % 5 === 0 ? 8 : 18), [0.42, 0.43, 0.46], 3);
        o.punto(c.clone().addScaledVector(rad, -alto - 2), rad.clone().negate(), CALIDA, 8, k % 5 === 0 ? 2 : 1);
      }
    }
    // Six docks off the keel, their beacons, craft coming in.
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.35;
      const rad = V(Math.cos(a), 0, Math.sin(a));
      const tan = V(-Math.sin(a), 0, Math.cos(a));
      const y0 = (k % 2 ? 1 : -1) * 120;
      const rq = quilla(y0);
      o.celosia(rad.clone().multiplyScalar(rq + 1).setY(y0), rad.clone().multiplyScalar(rq + 60).setY(y0), 14, ACERO, 2.5);
      o.caja(rad.clone().multiplyScalar(rq + 70).setY(y0), rad.clone().multiplyScalar(10), V(0, 18, 0), tan.clone().multiplyScalar(26), [0.55, 0.56, 0.6], 2.8);
      o.punto(rad.clone().multiplyScalar(rq + 82).setY(y0), rad, LUZ, 10, 2);
      o.trafico(rad.clone().multiplyScalar(rq + 1400).setY(y0 + 300), rad.clone().multiplyScalar(rq + 82).setY(y0), 6, 300);
    }
    // The gap. Frames every ~1.2° (0 and NF are the bulkheads), and the floor's beams.
    const NF = 12;
    const aF = (i: number) => -HUECO + (2 * HUECO * i) / NF;
    for (let i = 1; i < NF; i++) {
      for (let j = 0; j < cp.length - 1; j++) o.viga(sobre(aF(i), j, 0), sobre(aF(i), j + 1, 0), i % 3 === 0 ? [0.85, 0.87, 0.9] : [0.62, 0.64, 0.68], 2.8, nrm3(aF(i), j));
      o.viga(en(aF(i), R, -h), en(aF(i), R, h), ACERO, 2.4, en(aF(i), -1, 0));
    }
    // Trusses along it, at stations round the section; beams along the floor.
    for (let i = 0; i < NF; i++) {
      for (let j = 0; j < cp.length; j += 5) o.celosia(sobre(aF(i), j, 0), sobre(aF(i + 1), j, 0), 7, ACERO, 2.2);
      for (const y of [-200, -100, 0, 100, 200]) o.viga(en(aF(i), R, y), en(aF(i + 1), R, y), OSCURO, 2.2, en(aF(i), -1, 0));
    }
    // The hull's panels creeping in from each bulkhead, raggedly.
    for (const lado of [0, 1])
      for (let j = 0; j < cp.length - 1; j++) {
        const hondo = Math.max(0, Math.min(5, Math.floor(2.2 + 1.8 * Math.sin(j * 0.37 + lado * 2.1) + 1.4 * (Math.random() - 0.5))));
        const n2 = nrm2(j);
        for (let q = 0; q < hondo; q++) {
          const i0 = lado ? NF - q - 1 : q;
          const A0 = aF(i0);
          const A1 = aF(i0 + 1);
          const nu = Math.ceil(((A1 - A0) * cp[j].x) / 3);
          const nv = Math.ceil(cp[j + 1].distanceTo(cp[j]) / 3);
          const tono = 0.8 + 0.4 * Math.random();
          for (let u = 0; u <= nu; u++)
            for (let v = 0; v <= nv; v++) {
              const a = A0 + ((A1 - A0) * u) / nu;
              const p2 = cp[j].clone().lerp(cp[j + 1], v / nv);
              const k = (u === 0 || v === 0 || u === nu || v === nv ? 0.55 : 1) * tono;
              o.punto(en(a, p2.x + n2.x, p2.y + n2.y), en(a, n2.x, n2.y), [0.45 * k, 0.47 * k, 0.5 * k], 3);
            }
        }
      }
    // The lights of the work, and craft bringing more.
    for (let k = 0; k < 140; k++) {
      const j = Math.floor(Math.random() * cp.length);
      const a = aF(1 + Math.floor(Math.random() * (NF - 1)));
      o.punto(sobre(a, j, 4), nrm3(a, j), CALIDA, 7, 2);
    }
    for (let k = 0; k < 16; k++) {
      const j = Math.floor(Math.random() * cp.length);
      const a = (Math.random() - 0.5) * 2 * HUECO;
      const lejos = en(a + (Math.random() - 0.5) * 0.4, cp[j].x + 900 + 600 * Math.random(), cp[j].y * 2 + (Math.random() - 0.5) * 600);
      o.trafico(lejos, sobre(a, j, 4), 1, 40, CALIDA, 7);
    }
    const obra = o.build(uni, true, 0.25);
    giro.add(obra.points);
    capas.push(obra);
  }
  return {
    group,
    uni,
    R,
    W,
    update(time: number, vista: Vista) {
      // (sped up: at its real pace, a turn in 33 minutes, it looked still; one turn in about two and
      // a half minutes reads as turning)
      giro.rotation.y = time * Math.max(omega(R), 0.04) + FASE;
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

const METAL = (R: number, bandas: boolean, luz = 1) => /* glsl */ `
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
    return grado(col * ${luz.toFixed(2)});
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
  // (as dense for its size as the ring and the torus: sparser, it sparkled like a cloud of points)
  // (the light metal of the torus and the ring's outside; window bands all over it outshone them)
  superficie(esfera, uni, METAL(R, false), 90000, capas);
  // The farms: rings at both ends.
  for (const s of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 12, 64));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = s * (R + 0.06 + k * 0.06);
      giro.add(ring);
      // (thin tubes seen edge-on pile their points up: dimmer, or they outshine the sphere)
      superficie(ring, uni, METAL(R, false, 0.3), 6000, capas);
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
