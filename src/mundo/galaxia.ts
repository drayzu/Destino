import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';
import { gauss } from '../engine/math';
import { pantalla } from '../engine/pantalla';

/**
 * The Milky Way for the studies, in light years with the Sun at the origin (so a dive to the Sun and
 * the Earth stays precise); the galactic centre is 26 000 ly away along −Z, the disk in the XZ plane.
 *
 * - Stars as particles of light whose brightness falls with distance (flux ∝ L / d², softened), so
 *   from inside the disk the near ones stream past and from outside the arms sparkle.
 * - The light of the hundreds of billions that are not drawn: a screen shader that marches each ray
 *   through the disk, gathering starlight and losing it to dust (the band and its rift from inside,
 *   the spiral from outside). Adapted from Tiempo's galaxia.ts to world space.
 * - A bubble: points of light inside a sphere turn teal (a civilization lights its stars) and its
 *   front glows; used for the bubble that should exist and does not, and for ours (act V). A hole in
 *   it (`uHueco`: centre and radius) is left as it was (a reserve). The diffuse light takes its tint.
 * - Seen as Type III: behind a curtain (`uWipePx`), the visible light dims and the infrared glows.
 */

export const CENTRO = new THREE.Vector3(0, 0, -26000);
const RD = 8500; // disk scale length (2.6 kpc)
const ARM_K = 4.7; // 1 / tan(12°): a pitch of 12°

const arms = (R: number, phi: number) => {
  const a = 0.5 + 0.5 * Math.cos(4 * (phi - ARM_K * Math.log(Math.max(R, 500) / 8000)));
  return a * a * a;
};

export interface Galaxia {
  nube: ReturnType<typeof materia>;
  luz: ReturnType<typeof pantalla>;
  /** Stars that host the drawn planets (positions, ly): near the Sun, then across the disk. */
  conPlanetas: THREE.Vector3[];
  /** For each of them: older than the Sun. */
  viejos: boolean[];
  /** Per frame: the world scale (scene units per ly) and where the camera is (ly). */
  update(scale: number, cam: THREE.Vector3): void;
}

/**
 * `ruta` (two points, ly): the stretch the camera flies through first-person; the local stars crowd
 * around it so they stream past.
 */
export function galaxia(ruta: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 3000)]): Galaxia {
  const b = materiaBuilder(4051);
  const lum: number[] = [];
  const old: number[] = [];
  const loc: number[] = [];
  const conPlanetas: THREE.Vector3[] = [];
  const viejos: boolean[] = [];
  const put = (x: number, y: number, z: number, c: THREE.Color | number, l: number, o = 0, local = 0) => {
    b.push(x, y, z, c, 0.012, 1);
    lum.push(l);
    old.push(o);
    loc.push(local);
  };
  const toWorld = (gx: number, gy: number, gz: number): [number, number, number] => [gx + CENTRO.x, gy + CENTRO.y, gz + CENTRO.z];
  const col = new THREE.Color();
  // The old disk: warm white, thick.
  for (let i = 0; i < 110000; ) {
    const R = -RD * Math.log(b.r() * b.r() + 1e-9);
    if (R > 52000 || R < 1200) continue;
    const phi = b.r() * Math.PI * 2;
    if (b.r() > 0.45 + 0.55 * arms(R, phi)) continue;
    const y = gauss(b.r) * 900;
    col.setRGB(1.0, 0.88 + 0.06 * b.r(), 0.72 + 0.1 * b.r());
    put(...toWorld(Math.cos(phi) * R, y, Math.sin(phi) * R), col, 0.5 + 0.6 * b.r() * b.r(), b.r() < 0.75 ? 1 : 0);
    i++;
  }
  // The young disk: blue-white, thin, in the arms.
  for (let i = 0; i < 70000; ) {
    const R = -RD * Math.log(b.r() * b.r() + 1e-9) * 1.1;
    if (R > 52000 || R < 2500) continue;
    const phi = b.r() * Math.PI * 2;
    const a = arms(R, phi);
    if (b.r() > a * a) continue;
    const y = gauss(b.r) * 260;
    col.setRGB(0.62 + 0.1 * b.r(), 0.76 + 0.08 * b.r(), 1.0);
    put(...toWorld(Math.cos(phi) * R, y, Math.sin(phi) * R), col, 1.0 + 2.5 * b.r() * b.r() * b.r(), 0);
    i++;
  }
  // Where stars are born: pink knots in the arms.
  for (let i = 0; i < 3000; ) {
    const R = 4000 + b.r() * 40000;
    const phi = b.r() * Math.PI * 2;
    if (arms(R, phi) < 0.75) continue;
    const cx = Math.cos(phi) * R;
    const cz = Math.sin(phi) * R;
    for (let k = 0; k < 6; k++) put(...toWorld(cx + gauss(b.r) * 160, gauss(b.r) * 90, cz + gauss(b.r) * 160), new THREE.Color(1.0, 0.36, 0.52), 2.2, 0);
    i += 6;
  }
  // The bulge and the bar (27° to the line to the Sun): gold, old.
  const bar = 27 * (Math.PI / 180);
  for (let i = 0; i < 45000; i++) {
    let x: number;
    let y: number;
    let z: number;
    if (b.r() < 0.55) {
      x = gauss(b.r) * 5200;
      z = gauss(b.r) * 1700;
      y = gauss(b.r) * 1300;
    } else {
      const r = -2600 * Math.log(b.r() + 1e-9);
      const [ux, uy, uz] = b.onSphere();
      x = ux * r;
      y = uy * r * 0.6;
      z = uz * r;
    }
    const xr = x * Math.cos(bar) - z * Math.sin(bar);
    const zr = x * Math.sin(bar) + z * Math.cos(bar);
    col.setRGB(1.0, 0.78 + 0.08 * b.r(), 0.5 + 0.12 * b.r());
    put(...toWorld(xr, y, zr), col, 0.7 + 0.5 * b.r(), 1);
  }
  // Our neighbourhood: real colours (mostly red dwarfs), crowding the stretch the camera flies.
  const [r0, r1] = ruta;
  const seg = r1.clone().sub(r0);
  for (let i = 0; i < 46000; i++) {
    const t = b.r();
    const along = r0.clone().addScaledVector(seg, t);
    const wide = b.r() < 0.7 ? 520 : 2200;
    const x = along.x + gauss(b.r) * wide;
    const y = along.y + gauss(b.r) * Math.min(wide, 600);
    const z = along.z + gauss(b.r) * wide;
    const k = b.r();
    if (k < 0.7) col.setRGB(1.0, 0.58, 0.38);
    else if (k < 0.9) col.setRGB(1.0, 0.84, 0.6);
    else if (k < 0.99) col.setRGB(1.0, 0.96, 0.9);
    else col.setRGB(0.68, 0.8, 1.0);
    const l = k < 0.7 ? 0.12 : k < 0.9 ? 0.45 : k < 0.99 ? 1.1 : 4.0;
    const o = b.r() < 0.75 ? 1 : 0;
    put(x, y, z, col, l, o, 1);
    if (i % 9 === 0) {
      conPlanetas.push(new THREE.Vector3(x, y, z));
      viejos.push(o === 1);
    }
  }
  const data = b.data();
  const nube = materia(data, {
    pre: /* glsl */ `attribute float aLum, aOld, aLoc;
      uniform float uLocal;
      float pow2(float x) { return x * x; }
      uniform float uScale, uFlux, uFloor, uOld, uNear;
      uniform vec3 uBub; uniform float uBubR, uBubOn, uBubFront;
      uniform vec4 uHueco;
      uniform float uIR, uWipePx, uResX;`,
    move: /* glsl */ `
      vec4 mq = modelViewMatrix * vec4(p, 1.0);
      float dly = length(mq.xyz) / uScale;
      // Flux: L / d², softened near and with a floor far away (the texture of the arms).
      float f = aLum * (uFlux / (1.0 + dly * dly / (uNear * uNear)) + uFloor);
      em = color * f * mix(1.0, uLocal, aLoc);
      // The stars older than the Sun, in amber (lámina).
      em = mix(em, vec3(1.0, 0.6, 0.24) * (dot(em, vec3(0.33)) * 1.4 + 0.02 * aLum), uOld * aOld);
      // Inside a civilization's bubble its stars shine teal; its front glows.
      if (uBubOn > 0.001) {
        float dd = distance(position, uBub);
        float inside = 1.0 - smoothstep(uBubR * 0.97, uBubR, dd);
        if (uHueco.w > 0.0) inside *= smoothstep(uHueco.w, uHueco.w * 1.05, distance(position, uHueco.xyz));
        float front = exp(-pow2((dd - uBubR) / (uBubR * 0.04 + 1.0)));
        // (the neighbourhood drawn denser than it is stays faded from afar, even lit)
        em = mix(em, vec3(0.4, 1.0, 0.82) * (dot(em, vec3(0.33)) * 1.6 + 0.01 * mix(1.0, uLocal, aLoc)), inside * uBubOn);
        em += vec3(0.5, 1.0, 0.85) * front * uBubFront * uBubOn * (0.02 + f * 2.0);
      }
      // Near ones grow a little: they pass by.
      sz = size * (1.6 + 60.0 / max(dly, 0.5));
      fuente = 1.0;`,
    uniforms: {
      uScale: { value: 1 },
      uFlux: { value: 1 },
      uFloor: { value: 0.02 },
      uOld: { value: 0 },
      uNear: { value: 400 },
      uBub: { value: new THREE.Vector3() },
      uBubR: { value: 0 },
      uBubOn: { value: 0 },
      uBubFront: { value: 1 },
      uLocal: { value: 1 },
      uHueco: { value: new THREE.Vector4(0, 0, 0, 0) },
      uIR: { value: 0 },
      uWipePx: { value: 1e9 },
      uResX: { value: 1 },
    },
    // Type III: to the right of the curtain, the infrared (the heat of all of it); to the left, dimmed.
    post: /* glsl */ `
      if (uIR > 0.0) {
        float sx = (gl_Position.x / gl_Position.w * 0.5 + 0.5) * uResX;
        float lum = dot(em, vec3(0.33));
        if (sx > uWipePx) em = mix(em, vec3(1.0, 0.42, 0.14) * lum * 1.5, uIR);
        else em *= 1.0 - 0.85 * uIR;
      }`,
    extra: { aLum: [new Float32Array(lum), 1], aOld: [new Float32Array(old), 1], aLoc: [new Float32Array(loc), 1] },
  });
  nube.u.uSpread.value = 0;
  // A few planets across the whole disk too (for the views from outside).
  for (let k = 0; k < 2500; k++) {
    const i = Math.floor(b.r() * 180000);
    conPlanetas.push(new THREE.Vector3(data.position[i * 3], data.position[i * 3 + 1], data.position[i * 3 + 2]));
    viejos.push(old[i] === 1);
  }

  const luz = pantalla(
    /* glsl */ `
    uniform vec3 uCam, uBub;
    uniform float uLight, uDustK, uAlpha, uBar, uBubR, uBubOn, uIR, uWipePx;
    float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float n3(vec3 p) {
      vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    float armsG(float R, float phi) { float a = 0.5 + 0.5 * cos(4.0 * (phi - ${ARM_K.toFixed(2)} * log(max(R, 0.06)))); return a * a * a; }
    // Units inside: scale lengths of 8 500 ly, measured from the centre.
    void main() {
      vec3 d = normalize(vDir);
      vec3 O = uCam / ${RD.toFixed(1)};
      // The volume: a slab |y| < 0.6 within a sphere of radius 7.
      float b = dot(O, d), c = dot(O, O) - 49.0, disc = b * b - c;
      vec3 col = vec3(0.0);
      if (disc > 0.0) {
        float s = sqrt(disc);
        float t0 = max(-b - s, 0.0), t1 = -b + s;
        if (abs(d.y) > 1e-4) {
          float ta = (0.6 - O.y) / d.y, tb = (-0.6 - O.y) / d.y;
          t0 = max(t0, min(ta, tb));
          t1 = min(t1, max(ta, tb));
        } else if (abs(O.y) > 0.6) { t1 = -1.0; }
        if (t1 > t0) {
          float T = 1.0;
          const int K = 48;
          float span = t1 - t0;
          float cb = cos(${bar.toFixed(4)}), sb = sin(${bar.toFixed(4)});
          for (int k = 0; k < K; k++) {
            float u = (float(k) + 0.5) / float(K);
            // Denser samples near the camera when it is inside (near dust matters), even otherwise.
            float w = t0 > 0.0 ? u : u * u;
            float t = t0 + span * w;
            float dt = span * (t0 > 0.0 ? 1.0 : 2.0 * u) / float(K);
            vec3 q = O + d * t;
            float R = length(q.xz);
            float phi = atan(q.z, q.x);
            float arm = armsG(R / 0.94, phi);
            float disk = exp(-R) * exp(-abs(q.y) / 0.1) * (0.35 + 0.65 * arm) * (1.0 - smoothstep(4.6, 6.2, R));
            vec2 bq = vec2(q.x * cb + q.z * sb, -q.x * sb + q.z * cb);
            float bul = 1.1 * exp(-length(vec3(bq.x / 0.5, q.y / 0.11, bq.y / 0.18))) + 0.45 * exp(-length(vec3(q.x, q.y * 1.8, q.z)) / 0.2);
            float dust = uDustK * exp(-R / 1.4) * exp(-abs(q.y) / 0.035) * (0.3 + 0.7 * armsG(R / 0.94, phi + 0.35)) * (0.45 + 0.55 * n3(q * 9.0)) * smoothstep(0.15, 0.5, R);
            vec3 lit = mix(vec3(1.0, 0.8, 0.58), vec3(0.72, 0.82, 1.0), smoothstep(0.4, 2.6, R)) * disk + vec3(1.0, 0.8, 0.56) * bul * uBar;
            // Inside our bubble the galaxy's light takes the civilization's tint.
            if (uBubOn > 0.001) {
              float inb = 1.0 - smoothstep(uBubR * 0.97, uBubR, distance(q * ${RD.toFixed(1)}, uBub));
              lit = mix(lit, vec3(0.4, 1.0, 0.82) * dot(lit, vec3(0.4)), inb * uBubOn * 0.85);
            }
            col += T * lit * dt;
            T *= exp(-dust * dt);
          }
        }
      }
      if (uIR > 0.0) {
        float lum = dot(col, vec3(0.33));
        if (gl_FragCoord.x > uWipePx) col = mix(col, vec3(1.0, 0.42, 0.14) * lum * 1.6, uIR);
        else col *= 1.0 - 0.85 * uIR;
      }
      gl_FragColor = vec4(col * uLight * uAlpha, 1.0);
    }`,
    { uCam: { value: new THREE.Vector3() }, uLight: { value: 1 }, uDustK: { value: 45 }, uAlpha: { value: 1 }, uBar: { value: 1 }, uBub: { value: new THREE.Vector3() }, uBubR: { value: 0 }, uBubOn: { value: 0 }, uIR: { value: 0 }, uWipePx: { value: 1e9 } },
  );
  (luz.mesh.material as THREE.ShaderMaterial).blending = THREE.AdditiveBlending;
  (luz.mesh.material as THREE.ShaderMaterial).transparent = true;
  luz.mesh.renderOrder = -95;

  return {
    nube,
    luz,
    conPlanetas,
    viejos,
    update(scale, cam) {
      nube.u.uScale.value = scale;
      luz.u.uCam.value.copy(cam).sub(CENTRO);
      // Our neighbourhood is drawn denser than it is (so it streams past): seen from afar, it fades.
      nube.u.uLocal.value = 1 - Math.min(1, Math.max(0, (cam.length() - 4000) / 9000));
    },
  };
}

/** A sphere drawn in the plate's language: dotted rings of light (local radius 1; scale the group). */
export function esferaLamina(color = new THREE.Color(0.45, 1.0, 0.84)) {
  const b = materiaBuilder(77);
  for (let la = -75; la <= 75; la += 15) {
    const y = Math.sin((la * Math.PI) / 180);
    const rr = Math.cos((la * Math.PI) / 180);
    const n = Math.round(320 * rr) + 20;
    for (let k = 0; k < n; k++) {
      if (k % 4 === 3) continue; // dotted
      const a = (k / n) * Math.PI * 2;
      b.push(Math.cos(a) * rr, y, Math.sin(a) * rr, color, 0.002, 1);
    }
  }
  for (let m = 0; m < 12; m++) {
    const a = (m / 12) * Math.PI;
    for (let k = 0; k < 160; k++) {
      if (k % 4 === 3) continue;
      const t = (k / 160) * Math.PI * 2;
      b.push(Math.cos(a) * Math.cos(t), Math.sin(t), Math.sin(a) * Math.cos(t), color, 0.002, 1);
    }
  }
  const n = materia(b.data(), { move: 'fuente = 1.0;' });
  n.u.uSpread.value = 0;
  const group = new THREE.Group();
  group.add(n.points);
  return { group, nube: n };
}
