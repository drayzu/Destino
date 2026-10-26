import * as THREE from 'three';
import { pantalla } from '../engine/pantalla';

/**
 * The sky at infinity: stars by their colour and a Milky Way band with dust, drawn per pixel from
 * the direction it looks (so it turns with the camera and never gets closer). Stars stay one or two
 * pixels wide whatever the lens.
 */
export function cielo(brillo = 1) {
  return pantalla(
    /* glsl */ `
    uniform float uTanHalf, uBrillo, uIR, uWipePx, uBanda, uBeta;
    uniform vec3 uVelW;
    float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float n3(vec3 p) {
      vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
    // One layer of stars: at most one per cell, placed in its middle so the glow never crosses a cell edge.
    vec3 capa(vec3 d, float scale, float thr, float pxRad, float gain) {
      vec3 q = d * scale;
      vec3 i = floor(q);
      float h = h13(i);
      if (h < thr) return vec3(0.0);
      vec3 c = vec3(h13(i + 1.7), h13(i + 3.1), h13(i + 5.3));
      vec3 sp = normalize((i + 0.25 + 0.5 * c) / scale);
      float dd = length(sp - d) * pxRad;
      float b = pow((h - thr) / (1.0 - thr), 4.0);
      float temp = h13(i + 9.9);
      vec3 col = temp < 0.25 ? vec3(1.0, 0.72, 0.5) : temp < 0.7 ? vec3(1.0, 0.93, 0.84) : vec3(0.72, 0.82, 1.0);
      return col * (0.04 + 2.5 * b) * exp(-dd * dd * 0.9) * gain;
    }
    void main() {
      vec3 d = normalize(vDir);
      // Moving fast, this pixel shows a star from further back (inverse aberration), Doppler-shifted.
      vec3 tint = vec3(1.0);
      if (uBeta > 0.0) {
        float c2 = dot(d, uVelW);
        float c = (c2 - uBeta) / (1.0 - uBeta * c2);
        vec3 perp = d - uVelW * c2;
        float pl = length(perp);
        if (pl > 1e-6) d = uVelW * c + perp / pl * sqrt(max(1.0 - c * c, 0.0));
        float D = sqrt(1.0 - uBeta * uBeta) / (1.0 - uBeta * c2);
        tint = D * D * D * vec3(pow(D, -2.0), pow(D, 0.5), pow(D, 2.5));
      }
      float pxRad = uRes.y * 0.5 / uTanHalf;
      // The galactic plane, tilted against the ecliptic as it is (≈ 60°).
      vec3 G = normalize(vec3(0.0, 0.5, 0.866));
      float lat = dot(d, G);
      float band = exp(-(lat / 0.16) * (lat / 0.16));
      vec3 col = capa(d, 200.0, 0.99, pxRad, 1.0) + capa(d, 480.0, 0.994, pxRad, 0.6) + capa(d, 900.0, 0.985, pxRad, 0.5 * band * uBanda);
      // The band: unresolved stars, warmer towards the centre, cut by dust lanes.
      vec3 gc = normalize(vec3(1.0, -0.3, 0.2) - G * dot(vec3(1.0, -0.3, 0.2), G));
      float toward = 0.5 + 0.5 * dot(d, gc);
      float glow = band * (0.35 + 0.65 * fbm(d * 7.0)) * (0.5 + 1.2 * toward * toward);
      float dust = smoothstep(0.45, 0.75, fbm(d * 11.0 + 3.0)) * exp(-(lat / 0.05) * (lat / 0.05));
      col += mix(vec3(0.55, 0.6, 0.75), vec3(1.0, 0.85, 0.62), toward) * glow * 0.055 * (1.0 - 0.8 * dust) * uBanda;
      if (uIR > 0.5 && gl_FragCoord.x > uWipePx) col = vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.5, 0.22, 0.12);
      gl_FragColor = vec4(col * tint * uBrillo, 1.0);
    }
  `,
    { uBrillo: { value: brillo }, uIR: { value: 0 }, uWipePx: { value: 1e9 }, uBanda: { value: 1 }, uBeta: { value: 0 }, uVelW: { value: new THREE.Vector3(0, 0, -1) } },
  );
}
