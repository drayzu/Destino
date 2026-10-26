import * as THREE from 'three';

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
 * Each turns about its local Y. Lit by `uSun`, the Sun's direction in the world (the pivot never
 * rotates the world, so world normals can be compared with it).
 */

const LOG_V = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>`;
const LOG_F = /* glsl */ `#include <logdepthbuf_pars_fragment>`;
const NOISE = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
  float fbm2(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }`;
const VERT = /* glsl */ `${LOG_V}
  varying vec3 vP; varying vec3 vNW;
  void main() { vP = position; vNW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** Turns per second for 1 g at radius r (km). */
const omega = (r: number) => Math.sqrt(9.81 / (r * 1000));

function material(uni: Record<string, THREE.IUniform>, frag: string, side: THREE.Side = THREE.FrontSide) {
  return new THREE.ShaderMaterial({ uniforms: uni, side, vertexShader: VERT, fragmentShader: `${LOG_F}\n${NOISE}\n${frag}` });
}

/** A hull: dark panels, ribs, and three long windows glowing with the day inside. */
const HULL = (ribs: number, len: number) => /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vP; varying vec3 vNW;
  void main() {
    #include <logdepthbuf_fragment>
    float th = atan(vP.z, vP.x) + 3.14159265;
    float sec = mod(th, 2.0943951) / 2.0943951;
    float sun = max(dot(normalize(vNW), uSun), 0.0);
    vec3 col = vec3(0.07, 0.075, 0.08) * (0.25 + 0.75 * sun);
    float win = step(0.5, sec) * step(abs(vP.y), ${(len / 2).toFixed(1)} * 0.98);
    col = mix(col, vec3(0.45, 0.62, 0.75) * 0.45, win);
    float rib = smoothstep(0.46, 0.49, abs(fract(vP.y * ${ribs.toFixed(4)}) - 0.5));
    col += vec3(0.25) * rib * 0.25 * (0.3 + sun);
    gl_FragColor = vec4(col, 1.0);
  }`;

// ---------------------------------------------------------------- Bishop ring

export function anilloBishop() {
  const R = 1000;
  const W = 500;
  const group = new THREE.Group();
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uSun: { value: V(1, 0, 0) }, uTime: { value: 0 } };
  // The floor: land, seas and clouds inside; the hull outside.
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, W, 720, 1, true),
    material(
      uni,
      /* glsl */ `
      uniform vec3 uSun; uniform float uTime;
      varying vec3 vP; varying vec3 vNW;
      void main() {
        #include <logdepthbuf_fragment>
        float th = atan(vP.z, vP.x);
        vec2 q = vec2(th * ${(R / 90).toFixed(2)}, vP.y / 90.0);
        vec3 col;
        if (gl_FrontFacing) {
          // Outside: the hull, its cables.
          float sun = max(dot(normalize(vNW), uSun), 0.0);
          col = vec3(0.05, 0.055, 0.06) * (0.3 + 0.7 * sun);
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
          col *= 0.42;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
      THREE.DoubleSide,
    ),
  );
  giro.add(floor);
  // The walls that hold the air: 200 km high, a line of light along their tops.
  const wallMat = material(
    uni,
    /* glsl */ `
    uniform vec3 uSun;
    varying vec3 vP; varying vec3 vNW;
    void main() {
      #include <logdepthbuf_fragment>
      float r = length(vP.xy);
      float sun = abs(dot(normalize(vNW), uSun));
      vec3 col = vec3(0.06, 0.065, 0.07) * (0.3 + 0.7 * sun);
      col += vec3(0.45, 1.0, 0.85) * (1.0 - smoothstep(0.0, 6.0, r - ${(R - 200).toFixed(1)})) * 0.9;
      gl_FragColor = vec4(col, 1.0);
    }`,
    THREE.DoubleSide,
  );
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.RingGeometry(R - 200, R, 720, 1), wallMat);
    wall.rotation.x = Math.PI / 2;
    wall.position.y = (s * W) / 2;
    giro.add(wall);
  }
  return {
    group,
    uni,
    R,
    W,
    update(time: number) {
      giro.rotation.y = time * omega(R);
      uni.uTime.value = time;
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
  giro.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 256, 1, false), material(uni, HULL(1 / 120, L))));
  return {
    group,
    uni,
    R,
    L,
    update(time: number) {
      giro.rotation.y = time * omega(R);
    },
  };
}

// ---------------------------------------------------------------- Stanford torus

export function toroStanford() {
  const R = 0.895;
  const group = new THREE.Group();
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uSun: { value: V(1, 0, 0) } };
  const metal = /* glsl */ `
    uniform vec3 uSun;
    varying vec3 vP; varying vec3 vNW;
    void main() {
      #include <logdepthbuf_fragment>
      float sun = max(dot(normalize(vNW), uSun), 0.0);
      vec3 col = vec3(0.5, 0.52, 0.55) * (0.08 + 0.5 * sun);
      // The window band on the inner side of the wheel, glowing with the day inside.
      float inner = smoothstep(${(R - 0.03).toFixed(3)}, ${(R - 0.05).toFixed(3)}, length(vP.xz)) * step(abs(vP.y), 0.03);
      col = mix(col, vec3(0.6, 0.8, 0.9) * 0.55, inner);
      gl_FragColor = vec4(col, 1.0);
    }`;
  const mat = material(uni, metal);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(R, 0.065, 24, 192), mat);
  wheel.rotation.x = Math.PI / 2;
  giro.add(wheel);
  giro.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 16), mat));
  for (let k = 0; k < 6; k++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, R - 0.1, 8), mat);
    const a = (k / 6) * Math.PI * 2;
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = a;
    spoke.position.set((Math.cos(a) * (R + 0.04)) / 2, 0, (-Math.sin(a) * (R + 0.04)) / 2);
    giro.add(spoke);
  }
  return {
    group,
    uni,
    update(time: number) {
      giro.rotation.y = time * ((2 * Math.PI) / 60);
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
  const mat = material(
    uni,
    /* glsl */ `
    uniform vec3 uSun;
    varying vec3 vP; varying vec3 vNW;
    void main() {
      #include <logdepthbuf_fragment>
      float sun = max(dot(normalize(vNW), uSun), 0.0);
      vec3 col = vec3(0.5, 0.52, 0.55) * (0.08 + 0.5 * sun);
      // Windows in bands round its middle.
      float lat = vP.y / ${R.toFixed(3)};
      float band = step(abs(lat), 0.5) * smoothstep(0.3, 0.45, abs(fract(lat * 4.0) - 0.5));
      col = mix(col, vec3(0.6, 0.8, 0.9) * 0.5, band);
      gl_FragColor = vec4(col, 1.0);
    }`,
  );
  giro.add(new THREE.Mesh(new THREE.SphereGeometry(R, 64, 32), mat));
  // The farms: rings at both ends.
  for (const s of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 12, 64), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = s * (R + 0.06 + k * 0.06);
      giro.add(ring);
    }
  return {
    group,
    uni,
    update(time: number) {
      giro.rotation.y = time * 0.2;
    },
  };
}
