import { logDepth } from './motor/logdepth';
import * as THREE from 'three';

/**
 * The ship that is a world, from outside, as surfaces (Diego, 30 Oct: «mostraría la nave e intentaría
 * mejorar su diseño exterior para que parezca más nave»): a long spine, the rings (cilindro.ts) on
 * their spokes, a dish of shielding plates at the bow against the dust, two radiators glowing with
 * the heat of the life inside, and at the stern a drive with its long faint plume. Its own units:
 * 1 long, along +Z (the bow); the rings 0.13 in radius.
 */

const VERT = /* glsl */ `
  varying vec3 vL;
  varying vec3 vV;
  varying vec3 vN;
  varying vec2 vUv;
  void main() {
    vL = position;
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const COMUN = /* glsl */ `
  uniform float uOn, uFundido, uTime;
  varying vec3 vL;
  varying vec3 vV;
  varying vec3 vN;
  varying vec2 vUv;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float raya(float x, float w) {
    float d = abs(fract(x + 0.5) - 0.5);
    float fw = max(fwidth(x), 1e-6);
    return 1.0 - smoothstep(w - fw, w + fw, d);
  }
  float borde() { return pow(clamp(1.0 - abs(dot(normalize(vN), normalize(-vV))), 0.0, 1.0), 3.0); }
`;

/** Dark hull: panels in a grid on (u, v), fine seams, a cold rim of light, a few lit ports. */
const CASCO = /* glsl */ `
  ${COMUN}
  uniform vec2 uRejilla;
  void main() {
    vec2 q = vUv * uRejilla;
    vec2 id = floor(q);
    float tono = h21(id);
    float costura = max(raya(q.x, 0.02), raya(q.y, 0.02));
    vec3 col = vec3(0.03, 0.034, 0.04) * (0.75 + 0.5 * tono) + vec3(0.4, 0.45, 0.5) * costura * 0.12;
    float puerto = step(0.93, h21(id + 7.0)) * (1.0 - smoothstep(0.12, 0.2, length(fract(q) - 0.5)));
    col += vec3(1.0, 0.82, 0.55) * puerto * 0.9;
    col += vec3(0.32, 0.4, 0.5) * borde() * 0.7;
    gl_FragColor = vec4(col * uOn * uFundido, uOn * uFundido);
  }
`;

/** The shield: overlapping hexagonal plates, dark, scuffed; its rim catching the light. */
const ESCUDO = /* glsl */ `
  ${COMUN}
  vec3 hexa(vec2 p) {
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h;
    vec2 b = mod(p - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    vec2 q = abs(gv);
    return vec3(0.5 - max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x), p - gv);
  }
  void main() {
    vec3 hx = hexa(vL.xy * 60.0);
    float costura = 1.0 - smoothstep(0.02, 0.02 + 1.5 * fwidth(hx.x), hx.x);
    float tono = h21(hx.yz);
    float r = length(vL.xy) / 0.19;
    vec3 col = vec3(0.045, 0.045, 0.05) * (0.7 + 0.6 * tono) * (1.0 - costura * 0.6);
    col += vec3(0.75, 0.72, 0.66) * smoothstep(0.9, 1.0, r) * 0.35;
    col += vec3(0.35, 0.42, 0.5) * borde() * 0.6;
    gl_FragColor = vec4(col * uOn * uFundido, uOn * uFundido);
  }
`;

/** A radiator: long panels warm with the heat they shed, brighter near the spine, faintly pulsing. */
const RADIADOR = /* glsl */ `
  ${COMUN}
  void main() {
    float lejos = vUv.x;
    float tubos = raya(vUv.y * 14.0, 0.06);
    float marco = max(smoothstep(0.02, 0.0, vUv.y) + smoothstep(0.98, 1.0, vUv.y), smoothstep(0.98, 1.0, lejos));
    float calor = mix(1.0, 0.25, lejos) * (0.85 + 0.15 * sin(uTime * 0.7 + vUv.y * 3.0));
    vec3 col = vec3(0.03, 0.03, 0.035) + vec3(0.6, 0.18, 0.06) * calor * tubos * 0.45 + vec3(0.25, 0.27, 0.3) * marco * 0.35;
    gl_FragColor = vec4(col * uOn * uFundido, 0.9 * uOn * uFundido);
  }
`;

/** The drive's plume: a faint blue-white cone, brightest at the nozzle, flickering. */
const PENACHO = /* glsl */ `
  ${COMUN}
  void main() {
    // (guarded: a NaN here would spread through the film's glow and black out the frame)
    float t = clamp(vUv.y, 0.0, 1.0);
    float rim = clamp(1.0 - abs(dot(normalize(vN), normalize(-vV))), 0.0, 1.0);
    float luz = pow(t, 2.4) * (0.35 + 0.65 * pow(1.0 - rim, 1.5)) * (0.85 + 0.15 * sin(uTime * 23.0 + t * 40.0));
    // (faint, and fading where it comes near the camera, so flying past it never floods the frame)
    luz = clamp(luz, 0.0, 4.0) * smoothstep(0.2, 0.7, length(vV));
    gl_FragColor = vec4(vec3(0.62, 0.78, 1.0) * luz * 0.22 * uOn * uFundido, 0.0);
  }
`;

export interface NaveMalla {
  grupo: THREE.Group;
  update(on: number, time: number): void;
}

export function crearNaveMalla(anillos: number[], R: number): NaveMalla {
  const grupo = new THREE.Group();
  const uniforms = { uOn: { value: 0 }, uFundido: { value: 1 }, uTime: { value: 0 } };
  const mat = (frag: string, extra: Record<string, THREE.IUniform> = {}, aditivo = false, side: THREE.Side = THREE.FrontSide) =>
    logDepth(new THREE.ShaderMaterial({
      uniforms: { ...uniforms, ...extra },
      vertexShader: VERT,
      fragmentShader: frag,
      side,
      transparent: true,
      depthTest: !aditivo,
      depthWrite: !aditivo,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
  const hull = (rejilla: [number, number]) => mat(CASCO, { uRejilla: { value: new THREE.Vector2(...rejilla) } });

  // The spine.
  const espina = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.12, 32, 1), hull([24, 90]));
  espina.rotation.x = Math.PI / 2;
  grupo.add(espina);
  // A wider core section between the rings and the drive (tanks, machinery).
  const nucleo = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.16, 32, 1), hull([18, 10]));
  nucleo.rotation.x = Math.PI / 2;
  nucleo.position.z = -0.43;
  grupo.add(nucleo);
  // Spokes to each ring, and a hub.
  for (const z of anillos) {
    const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 24, 1), hull([12, 2]));
    cubo.rotation.x = Math.PI / 2;
    cubo.position.z = z;
    grupo.add(cubo);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const L = R - 0.02 - 0.03;
      const rayo = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, L, 8, 1), hull([2, 20]));
      rayo.position.set(Math.cos(a) * (0.03 + L / 2), Math.sin(a) * (0.03 + L / 2), z);
      rayo.rotation.z = a - Math.PI / 2;
      grupo.add(rayo);
    }
  }
  // The shield at the bow: a shallow dish facing forwards.
  const escudoG = new THREE.SphereGeometry(0.42, 96, 24, 0, Math.PI * 2, 0, Math.asin(0.19 / 0.42));
  escudoG.rotateX(Math.PI / 2);
  const escudo = new THREE.Mesh(escudoG, mat(ESCUDO, {}, false, THREE.DoubleSide));
  escudo.position.z = 0.6 - 0.42;
  grupo.add(escudo);
  // Radiators, aft, either side: the heat of everyone inside going out to space.
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(0.11, 0.15, 1, 1);
    const rad = new THREE.Mesh(g, mat(RADIADOR, {}, false, THREE.DoubleSide));
    rad.rotation.set(-Math.PI / 2, 0, 0);
    rad.position.set(s * (0.036 + 0.055), 0, -0.44);
    // (u runs out from the spine)
    if (s < 0) rad.scale.x = -1;
    grupo.add(rad);
  }
  // The drive: a nozzle and its plume.
  const tobera = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.05, 32, 1, true), hull([20, 3]));
  tobera.material.side = THREE.DoubleSide;
  tobera.rotation.x = Math.PI / 2;
  tobera.position.z = -0.56;
  grupo.add(tobera);
  const penachoG = new THREE.CylinderGeometry(0.022, 0.07, 0.6, 48, 1, true);
  const penacho = new THREE.Mesh(penachoG, mat(PENACHO, {}, true, THREE.DoubleSide));
  penacho.rotation.x = Math.PI / 2;
  penacho.position.z = -0.6 - 0.3;
  penacho.renderOrder = 3;
  grupo.add(penacho);
  return {
    grupo,
    update(on, time) {
      uniforms.uOn.value = on;
      uniforms.uTime.value = time;
      grupo.visible = on > 0.002;
    },
  };
}
