import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';
import { gauss } from '../engine/math';

/**
 * Engineering a star (act III): taking matter out of the Sun through its poles (star lifting), and
 * moving it (stellar engines). Units: solar radii for the lifting (a group scaled to AU and placed
 * at the Sun), AU for the engines.
 *
 * - Star lifting (Criswell 1985; Scoggins & Kipping 2023): heated plasma channelled by a ring current
 *   at the equator into two jets along the magnetic poles; less mass, a slower burn, a longer life.
 * - Shkadov (1987): a huge mirror, held where the light's push balances gravity, sends part of the
 *   Sun's light back; more light leaves the other way, and the star drifts towards the mirror.
 * - Caplan (2019): fed by the lifted matter, a fusion rocket behind the star throws a fast jet back
 *   (the whole system moves forward) and a second jet pushes the star ahead of it, so they never meet.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Star lifting, in solar radii: two polar jets, the ring current, and the field lines (plate). */
export function levante() {
  const group = new THREE.Group();
  const b = materiaBuilder(919);
  const kind: number[] = [];
  // The jets: each particle rises along a pole, the cone widening with height.
  for (let i = 0; i < 9000; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    b.push(gauss(b.r), side, gauss(b.r), new THREE.Color(1.0, 0.85, 0.6), 0.05, 1.2);
    kind.push(0);
  }
  // The ring current at the equator.
  for (let i = 0; i < 3000; i++) {
    const a = b.r() * Math.PI * 2;
    const r = 1.7 + gauss(b.r) * 0.04;
    b.push(Math.cos(a) * r, gauss(b.r) * 0.02, Math.sin(a) * r, new THREE.Color(0.5, 1.0, 0.86), 0.035, 1.4);
    kind.push(1);
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute float aKindL; uniform float uOn;`,
    move: /* glsl */ `
      if (aKindL < 0.5) {
        float f = fract(uTime * 0.045 + seed);
        float r = 1.02 + 16.0 * f * f;
        float lat = 0.06 + 0.07 * r;
        p = vec3(position.x * lat, position.y * r, position.z * lat);
        // Hot where it leaves the surface; the civilization's colour where it is collected.
        em = mix(vec3(1.0, 0.85, 0.6) * 2.0, vec3(0.45, 1.0, 0.85), smoothstep(0.1, 0.7, f));
        em *= smoothstep(0.0, 0.04, f) * (1.0 - smoothstep(0.75, 1.0, f));
      } else {
        float a = atan(position.z, position.x) + uTime * 0.9;
        float r = length(position.xz);
        p = vec3(cos(a) * r, position.y, sin(a) * r);
      }
      em *= uOn;
      fuente = 1.0;`,
    uniforms: { uOn: { value: 0 } },
    extra: { aKindL: [new Float32Array(kind), 1] },
  });
  nube.u.uSpread.value = 0;
  group.add(nube.points);
  // The field lines that channel it (a dipole, r = L sin²θ): invisible, drawn as plate.
  const pts: number[] = [];
  for (const L of [1.9, 2.8, 4.2, 6.5]) {
    for (let k = 0; k < 10; k++) {
      const az = (k / 10) * Math.PI * 2;
      let prev: THREE.Vector3 | null = null;
      for (let s = 0; s <= 80; s++) {
        const th = 0.12 + (s / 80) * (Math.PI - 0.24);
        const r = L * Math.sin(th) ** 2;
        if (r < 1.0) {
          prev = null;
          continue;
        }
        const q = V(Math.sin(th) * Math.cos(az) * r, Math.cos(th) * r, Math.sin(th) * Math.sin(az) * r);
        if (prev) pts.push(prev.x, prev.y, prev.z, q.x, q.y, q.z);
        prev = q;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lineas = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(0.45, 1.0, 0.85), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
  lineas.frustumCulled = false;
  group.add(lineas);
  return {
    group,
    nube,
    set(on: number, lamina: number) {
      nube.u.uOn.value = on;
      (lineas.material as THREE.LineBasicMaterial).opacity = on * (0.06 + 0.3 * lamina);
      group.visible = on > 0.001;
    },
  };
}

/** Shkadov's mirror: a cap of a sphere around the Sun (radius 1, scaled), facing it, around +Y. */
export function espejoShkadov() {
  const LOG_V = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>`;
  const u = { uOn: { value: 0 } };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 128, 48, 0, Math.PI * 2, 0, (48 * Math.PI) / 180),
    new THREE.ShaderMaterial({
      uniforms: u,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vP; varying vec2 vUv;
        void main() { vP = position; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `#include <logdepthbuf_pars_fragment>
        uniform float uOn; varying vec3 vP; varying vec2 vUv;
        void main() {
          #include <logdepthbuf_fragment>
          // Facing the Sun: it shines with the light it sends back; its rim and its panels glow.
          float rim = smoothstep(0.62, 0.67, 1.0 - vP.y);
          float panel = smoothstep(0.47, 0.5, abs(fract(vUv.x * 64.0) - 0.5)) + smoothstep(0.47, 0.5, abs(fract(vUv.y * 10.0) - 0.5));
          vec3 col = vec3(1.0, 0.92, 0.75) * 0.05 * (0.6 + 0.4 * vP.y) + vec3(0.6, 1.0, 0.9) * (rim * 0.6 + panel * 0.05);
          gl_FragColor = vec4(col * uOn, 1.0);
        }`,
    }),
  );
  mesh.frustumCulled = false;
  return { mesh, u };
}

/**
 * Caplan's engine (AU, along local +Y): the fast jet thrown back (length `largo`), the thruster at the
 * origin, and the second jet towards the star (length `corto`), which keeps the star ahead.
 */
export function motorCaplan(largo: number, corto: number) {
  const b = materiaBuilder(717);
  const kind: number[] = [];
  for (let i = 0; i < 7000; i++) {
    b.push(gauss(b.r), 0, gauss(b.r), new THREE.Color(0.7, 1.0, 0.92), largo * 0.0009, 1.4);
    kind.push(0);
  }
  for (let i = 0; i < 1500; i++) {
    b.push(gauss(b.r), 0, gauss(b.r), new THREE.Color(1.0, 0.9, 0.7), largo * 0.0006, 1.0);
    kind.push(1);
  }
  for (let i = 0; i < 400; i++) {
    const [x, y, z] = b.onSphere();
    b.push(x * largo * 0.004, y * largo * 0.004, z * largo * 0.004, new THREE.Color(0.8, 1.0, 0.95), largo * 0.0012, 2.0);
    kind.push(2);
  }
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute float aKindJ; uniform float uOn, uLargo, uCorto;`,
    move: /* glsl */ `
      if (aKindJ < 0.5) {
        float f = fract(uTime * 0.5 + seed);
        p = vec3(position.x * uLargo * 0.004 * (0.3 + f), f * uLargo, position.z * uLargo * 0.004 * (0.3 + f));
        em *= smoothstep(0.0, 0.03, f) * (1.0 - smoothstep(0.6, 1.0, f));
      } else if (aKindJ < 1.5) {
        float f = fract(uTime * 0.35 + seed);
        p = vec3(position.x * uLargo * 0.002, -f * uCorto, position.z * uLargo * 0.002);
        em *= smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.7, 1.0, f)) * 0.7;
      }
      em *= uOn;
      fuente = 1.0;`,
    uniforms: { uOn: { value: 0 }, uLargo: { value: largo }, uCorto: { value: corto } },
    extra: { aKindJ: [new Float32Array(kind), 1] },
  });
  nube.u.uSpread.value = 0;
  const group = new THREE.Group();
  group.add(nube.points);
  return { group, nube };
}
