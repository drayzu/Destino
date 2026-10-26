import * as THREE from 'three';
import { materia, materiaBuilder } from '../engine/materia';

/**
 * An O'Neill cylinder (Island Three: 8 km across, 32 km long; O'Neill 1976), in kilometres, its
 * axis along local Y. Inside, three valleys of land alternate with three long windows; the whole
 * world turns once every ~2 minutes (√(g/R) for 1 g at 4 km), and that turn is its gravity, so the
 * land climbs up the sides and overhead. Outside, three mirrors hinged at the windows throw the
 * sunlight in. The air inside fades what is far into a pale haze.
 *
 * `giro` is the part that turns; the group's own orientation puts the axis towards the Sun.
 */

const R = 4;
const L = 32;
/** Turns per second for 1 g at 4 km: ω = √(g/R). */
export const OMEGA = Math.sqrt(9.81 / 4000);

const LOG_V = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>`;
const LOG_F = /* glsl */ `#include <logdepthbuf_pars_fragment>`;
const NOISE = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`;

export function cilindro() {
  const group = new THREE.Group();
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uCamL: { value: new THREE.Vector3(0, -40, 0) }, uDay: { value: 1 }, uTime: { value: 0 } };

  // ------------------------------------------------------------ inside: valleys and windows
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, L, 256, 96, true),
    new THREE.ShaderMaterial({
      uniforms: uni,
      side: THREE.BackSide,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vP;
        void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform vec3 uCamL; uniform float uDay, uTime;
        varying vec3 vP;
        ${NOISE}
        void main() {
          #include <logdepthbuf_fragment>
          float th = atan(vP.z, vP.x) + 3.14159265;
          float y = vP.y;
          float sec = mod(th, 2.0943951) / 2.0943951;
          float s = sec < 0.5 ? sec / 0.5 : (sec - 0.5) / 0.5;
          vec3 col;
          // A window: space beyond (seen through, so it is cut away), crossed by its ribs.
          if (sec >= 0.5) {
            float rib = smoothstep(0.46, 0.49, abs(fract(y * 1.5) - 0.5));
            float edge = 1.0 - smoothstep(0.0, 0.02, min(s, 1.0 - s));
            float frame = max(rib, edge);
            if (frame < 0.05) discard;
            col = vec3(0.32, 0.36, 0.4) * frame * 0.35;
          } else {
            vec2 q = vec2(th * ${R.toFixed(1)}, y);
            float f = n2(q * 1.4) * 0.6 + n2(q * 5.0) * 0.4;
            col = mix(vec3(0.1, 0.2, 0.07), vec3(0.28, 0.3, 0.13), smoothstep(0.35, 0.62, f));
            col = mix(col, vec3(0.46, 0.38, 0.2), smoothstep(0.68, 0.86, n2(q * 0.6 + 3.0)));
            // Fields.
            vec2 plot = fract(q * vec2(2.2, 1.3) + n2(q * 0.3) * 0.3);
            col *= 0.84 + 0.16 * step(0.07, min(plot.x, plot.y));
            // A river winding down the valley.
            float river = abs(s - 0.5 - 0.17 * sin(y * 0.33) - 0.05 * sin(y * 1.27 + 1.0));
            col = mix(col, vec3(0.08, 0.2, 0.32), 1.0 - smoothstep(0.012, 0.028, river));
            // Towards the windows the valley rises in terraces.
            float rise = smoothstep(0.0, 0.14, s) * smoothstep(1.0, 0.86, s);
            col *= 0.6 + 0.4 * rise;
            col *= uDay * 1.25;
            // Towns: lights where the houses are (warm and teal).
            vec2 cell = floor(q * 12.0);
            float dot0 = 1.0 - smoothstep(0.06, 0.16, length(fract(q * 12.0) - 0.5));
            float town = step(0.82, h21(cell)) * smoothstep(0.35, 0.75, n2(q * 0.45 + 7.0)) * rise * dot0;
            col += town * mix(vec3(1.0, 0.78, 0.5), vec3(0.45, 1.0, 0.85), step(0.55, h21(cell + 3.0))) * (0.35 + 0.25 * (1.0 - uDay));
          }
          // The air: what is far fades into a pale haze.
          float d = distance(vP, uCamL);
          float haze = 1.0 - exp(-d / 16.0);
          col = mix(col, vec3(0.5, 0.64, 0.82) * 0.5 * uDay, haze * 0.6);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  giro.add(inner);

  // The two end caps, inside: terraced bowls with a docking port at the axis.
  const capMat = new THREE.ShaderMaterial({
    uniforms: uni,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `${LOG_V}
      varying vec3 vP; varying vec3 vW;
      void main() { vP = position; vW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      uniform vec3 uCamL; uniform float uDay;
      varying vec3 vP;
      ${NOISE}
      void main() {
        #include <logdepthbuf_fragment>
        float r = length(vP.xy);
        if (r < 0.25) discard;
        float terr = fract(r * 3.0);
        vec3 col = mix(vec3(0.16, 0.18, 0.12), vec3(0.32, 0.3, 0.24), step(0.5, terr)) * uDay;
        col += vec3(0.5, 1.0, 0.85) * (1.0 - smoothstep(0.25, 0.32, r)) * 0.9;
        col += vec3(1.0, 0.8, 0.5) * step(0.94, h21(floor(vP.xy * 6.0))) * 0.4;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  for (const sign of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(R * 0.999, 128), capMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.y = sign * (L / 2 - 0.03);
    giro.add(cap);
  }

  // ------------------------------------------------------------ outside: the hull and the mirrors
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.004, R * 1.004, L, 192, 1, false),
    new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec3 vP; varying vec3 vN;
        void main() { vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        varying vec3 vP; varying vec3 vN;
        void main() {
          #include <logdepthbuf_fragment>
          float th = atan(vP.z, vP.x) + 3.14159265;
          float sec = mod(th, 2.0943951) / 2.0943951;
          bool side = abs(vN.y) < 0.5;
          // The docking port at the axis: open.
          if (!side && length(vP.xz) < 0.3) discard;
          vec3 col = vec3(0.05, 0.055, 0.06);
          // From outside, the windows glow with the daylight inside.
          if (side && sec >= 0.5) col = vec3(0.45, 0.62, 0.75) * 0.5;
          float rib = side ? smoothstep(0.46, 0.49, abs(fract(vP.y * 0.5) - 0.5)) : 0.0;
          col += vec3(0.2) * rib * 0.3;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  giro.add(hull);
  const mirrorMat = new THREE.ShaderMaterial({
    uniforms: uni,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `${LOG_V}
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      varying vec2 vUv;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = 1.0 - smoothstep(0.0, 0.01, min(e.x, e.y));
        float panel = 1.0 - smoothstep(0.0, 0.004, abs(fract(vUv.y * 24.0) - 0.5) - 0.49);
        vec3 col = vec3(0.55, 0.62, 0.7) * 0.05 + vec3(0.9, 0.95, 1.0) * (edge * 0.35 + panel * 0.05);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  for (let k = 0; k < 3; k++) {
    // Each window's mirror: hinged at the window's edge, opened outwards.
    const a0 = (k * 2 * Math.PI) / 3 + Math.PI / 3 - Math.PI;
    const hinge = new THREE.Group();
    hinge.rotation.y = -a0;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.2, L), mirrorMat);
    plane.position.set(R * 1.01 + R * 1.1 * Math.cos(0.5), 0, R * 1.1 * Math.sin(0.5));
    plane.rotation.y = -0.5 - Math.PI / 2;
    hinge.add(plane);
    giro.add(hinge);
  }

  // Who lives here: lights of homes along the valleys, seen from inside as a scatter of points.
  const b = materiaBuilder(808);
  for (let i = 0; i < 9000; ) {
    const th = b.r() * Math.PI * 2;
    const sec = (((th + Math.PI) % (2.0943951)) + 2.0943951) % 2.0943951;
    if (sec / 2.0943951 >= 0.5) continue;
    const y = (b.r() - 0.5) * L * 0.96;
    const warm = b.r() < 0.6;
    b.push(Math.cos(th) * R * 0.998, y, Math.sin(th) * R * 0.998, warm ? new THREE.Color(1.0, 0.8, 0.55) : new THREE.Color(0.5, 1.0, 0.85), 0.012, 0.5);
    i++;
  }
  const casas = materia(b.data(), { pre: `uniform float uNight;`, move: `em *= uNight;`, uniforms: { uNight: { value: 0.3 } } });
  giro.add(casas.points);

  return {
    group,
    giro,
    uni,
    casas,
    R,
    L,
    /** Per frame: the camera in the cylinder's frame (km, the turning part), the ambient time. */
    update(camL: THREE.Vector3, time: number, night = 0.3) {
      giro.rotation.y = time * OMEGA;
      uni.uCamL.value.copy(camL);
      uni.uTime.value = time;
      // The homes are points (they do not hide behind the hull): only seen from inside.
      const inside = Math.abs(camL.y) < L / 2 && Math.hypot(camL.x, camL.z) < R;
      casas.u.uNight.value = inside ? night : 0;
    },
  };
}
