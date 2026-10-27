import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';
import { gauss } from '../engine/math';
import { esferaLamina } from './galaxia';

/**
 * The galaxy of possibilities (act V): answers to Fermi's question as places our front finds. They
 * are hypotheses, so they are drawn in the plate's language (dotted spheres), with their authors in
 * the captions.
 *
 * - A reserve (the zoo hypothesis, Ball 1973): a young yellow star the front leaves untouched.
 * - The silent ones (Brin 1983): systems that send nothing out, on purpose; pale among ours.
 * - The Great Filter (Hanson 1996): a dead swarm round a dead star (a white dwarf): ruins.
 *
 * Positions in light years (the galaxy's frame, the Sun at the origin).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const RESERVA = V(1400, 60, 4300);
export const SILENCIO = V(-2400, 40, 2600);
export const RUINAS = V(3200, -120, -2200);
/** The silent systems, around SILENCIO. */
export const CALLADAS = [V(0, 0, 0), V(70, 18, -40), V(-55, -10, 60), V(30, -25, 95), V(-90, 12, -70)].map((v) => v.add(SILENCIO));

/** The reserve's star and the silent systems (dark, they hide what is behind), as points (ly). */
export function lugares() {
  const b = materiaBuilder(1973);
  // The reserve: one bright yellow star.
  b.push(RESERVA.x, RESERVA.y, RESERVA.z, new THREE.Color(1.0, 0.9, 0.7), 0.6, 2.4);
  // The silent ones: stars we did not light (they are someone's), pale among ours.
  for (const c of CALLADAS) b.push(c.x, c.y, c.z, new THREE.Color(0.9, 0.9, 0.95), 0.4, 0.9);
  const nube = materia(b.data(), {
    pre: /* glsl */ `uniform float uOn, uScale;`,
    move: /* glsl */ `
      em *= uOn;
      occ *= uOn;
      // A few pixels at least, so they read as places.
      vec4 mq = modelViewMatrix * vec4(p, 1.0);
      sz = max(sz, length(mq.xyz) / uScale * 0.01);
      fuente = 1.0;`,
    uniforms: { uOn: { value: 0 }, uScale: { value: 1 } },
  });
  nube.u.uSpread.value = 0;
  nube.u.uInk.value = 1;
  // Their dotted spheres: teal round the reserve, grey round the silent ones.
  const zoo = esferaLamina(new THREE.Color(0.45, 1.0, 0.84));
  zoo.group.position.copy(RESERVA);
  zoo.group.scale.setScalar(34);
  const calladas = CALLADAS.map((c) => {
    const e = esferaLamina(new THREE.Color(0.55, 0.58, 0.62));
    e.group.position.copy(c);
    e.group.scale.setScalar(16);
    return e;
  });
  return { nube, zoo, calladas };
}

/**
 * The ruins (AU, centred on the dead star): a white dwarf, and round it what is left of a swarm —
 * dark broken collectors in torn rings, a few lights still blinking.
 */
export function ruinas() {
  const b = materiaBuilder(1996);
  const kind: number[] = [];
  for (let ring = 0; ring < 9; ring++) {
    const r = 0.3 + ring * 0.05;
    const tilt = (ring % 3) * 0.5 + gauss(b.r) * 0.15;
    const node = b.r() * Math.PI * 2;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, node, 0));
    const n = 1800;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + gauss(b.r) * 0.01;
      // Torn: whole stretches gone.
      if (Math.sin(a * 3 + ring) + Math.sin(a * 7 + ring * 2.3) > 0.9) continue;
      // Each wreck a little off its ring's plane (orbits loosened over the ages): a torn cloud, not wire.
      const p = V(Math.cos(a) * r, gauss(b.r) * 0.004, Math.sin(a) * r)
        .applyAxisAngle(V(gauss(b.r), gauss(b.r), gauss(b.r)).normalize(), gauss(b.r) * 0.12)
        .applyQuaternion(q);
      // Debris drifting off the ring.
      if (b.r() < 0.25) p.add(V(gauss(b.r), gauss(b.r), gauss(b.r)).multiplyScalar(0.02));
      const lit = b.r() < 0.004;
      b.push(p.x, p.y, p.z, lit ? new THREE.Color(1.0, 0.3, 0.2) : new THREE.Color(0.55, 0.6, 0.7), lit ? 0.004 : 0.0034, lit ? 2.0 : 0.45, { ink: lit ? 0 : 0.85 });
      kind.push(lit ? 1 : 0);
    }
  }
  // The white dwarf: what is left of its star, Earth-sized, a cold white point.
  b.push(0, 0, 0, new THREE.Color(0.8, 0.88, 1.0), 0.01, 6.0);
  kind.push(2);
  const nube = materia(b.data(), {
    pre: /* glsl */ `attribute float aLit; uniform float uOn;`,
    move: /* glsl */ `
      // The last lights blink, slowly.
      if (aLit > 0.5 && aLit < 1.5) em *= 0.3 + 0.7 * step(0.6, fract(uTime * 0.35 + seed * 7.0));
      // The pieces facing the dwarf catch a little of its light.
      if (aLit < 0.5) {
        em *= 0.5 + 0.5 * fract(seed * 13.0);
        // A few wrecks still tumble: as a flat face turns to the dwarf, a brief glint.
        float vuelta = sin(uTime * (0.5 + 1.3 * fract(seed * 31.0)) + seed * 50.0);
        float brillo = pow(max(vuelta, 0.0), 60.0) * step(0.93, fract(seed * 91.7));
        em += vec3(0.85, 0.92, 1.0) * brillo * 5.0;
        fuente = brillo;
      }
      if (aLit > 1.5) fuente = 1.0;
      em *= uOn;
      occ *= uOn;`,
    uniforms: { uOn: { value: 0 } },
    extra: { aLit: [new Float32Array(kind), 1] },
  });
  nube.u.uSpread.value = 0;
  nube.u.uInk.value = 1;
  return { nube };
}

/**
 * Our front: the surface where the probes are arriving, a sphere (radius 1, scaled in light years)
 * drawn as a thin glowing membrane, brightest where it is seen edge-on, with slow patches like an
 * aurora.
 */
export function frente(color = new THREE.Color(0.4, 1.0, 0.82)) {
  const u = { uOn: { value: 0 }, uTime: { value: 0 }, uColor: { value: color.clone() } };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 128, 96),
    new THREE.ShaderMaterial({
      uniforms: u,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() { vP = position; vN = normalMatrix * normal;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform float uOn, uTime; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main() {
          #include <logdepthbuf_fragment>
          float edge = 1.0 - abs(dot(normalize(vN), normalize(vV)));
          float aur = n3(vP * 9.0 + vec3(0.0, uTime * 0.03, 0.0)) * 0.6 + n3(vP * 23.0) * 0.4;
          float g = pow(max(edge, 0.0), 5.0) * 0.55 + 0.012 + 0.03 * smoothstep(0.55, 0.8, aur);
          gl_FragColor = vec4(uColor * g * uOn, 1.0);
        }`,
    }),
  );
  mesh.frustumCulled = false;
  return { mesh, u };
}
