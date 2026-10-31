import * as THREE from 'three';
import { rng } from './motor/math';

/**
 * Pieces for the galaxy act's moments (galaxia.ts), kept apart so the act stays readable.
 *
 * `escombros`: the wreck of a dead swarm, close up. Collectors as real panels (not points: the camera
 * passes a hand's breadth from them): dark glass in a frame, a grid of cells, many of them broken
 * (cells gone, a corner snapped off along a jagged line), each tumbling its own slow way round its own
 * axis and drifting round the star. Lit only by the dim red star at the origin: the face turned to it
 * glows a dull ember red, a glint where it mirrors the star at the camera; the face turned away is a
 * black silhouette against the star (they hide what is behind them).
 */
export function escombros(n: number, seed: number, dentro: number, fuera: number) {
  const r = rng(seed);
  const g = () => (r() + r() + r() + r() - 2) * 0.866;
  const base = new THREE.PlaneGeometry(1, 1, 1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  const c = new Float32Array(n * 3);
  const eje = new Float32Array(n * 3);
  const giro = new Float32Array(n * 4);
  const sem = new Float32Array(n);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    // In a thick broken ring round the star, flattened (a swarm's orbits, scattered when it died).
    const az = r() * Math.PI * 2;
    const el = THREE.MathUtils.degToRad(g() * 16);
    const q = dentro + (fuera - dentro) * Math.pow(r(), 0.8);
    c.set([Math.cos(el) * Math.sin(az) * q, Math.sin(el) * q, Math.cos(el) * Math.cos(az) * q], i * 3);
    v.set(g(), g(), g()).normalize();
    eje.set([v.x, v.y, v.z], i * 3);
    const w = 0.07 + 0.12 * Math.pow(r(), 1.6);
    giro.set([r() * Math.PI * 2, (0.05 + 0.25 * r()) * (r() < 0.5 ? -1 : 1), w, w * (1.3 + 0.5 * r())], i * 4);
    sem[i] = r();
  }
  geo.setAttribute('aC', new THREE.InstancedBufferAttribute(c, 3));
  geo.setAttribute('aEje', new THREE.InstancedBufferAttribute(eje, 3));
  geo.setAttribute('aGiro', new THREE.InstancedBufferAttribute(giro, 4));
  geo.setAttribute('aSem', new THREE.InstancedBufferAttribute(sem, 1));
  geo.instanceCount = n;
  const u = { uOn: { value: 0 }, uFundido: { value: 1 }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      attribute vec3 aC, aEje;
      attribute vec4 aGiro;
      attribute float aSem;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vP;
      varying float vSem;
      vec3 girar(vec3 x, vec3 k, float a) {
        return x * cos(a) + cross(k, x) * sin(a) + k * dot(k, x) * (1.0 - cos(a));
      }
      void main() {
        float a = aGiro.x + aGiro.y * uTime;
        vec3 w = girar(vec3(position.x * aGiro.z, position.y * aGiro.w, 0.0), aEje, a);
        vec3 n = girar(vec3(0.0, 0.0, 1.0), aEje, a);
        // (drifting round the star, slowly, each at its own pace)
        float d = uTime * (0.004 + 0.006 * aSem);
        vec3 c = vec3(cos(d) * aC.x - sin(d) * aC.z, aC.y, sin(d) * aC.x + cos(d) * aC.z);
        vP = c + w;
        vN = n;
        vUv = uv;
        vSem = aSem;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vP, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOn, uFundido, uTime;
      uniform vec3 uCam;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vP;
      varying float vSem;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 uv = clamp(vUv, 0.0, 1.0);
        // Broken: a corner snapped off along a jagged line (most of them), and cells gone.
        float ang = vSem * 40.0;
        vec2 dir = vec2(cos(ang), sin(ang));
        float linea = dot(uv - 0.5, dir) - (0.12 + 0.3 * fract(vSem * 7.3)) + 0.05 * sin(dot(uv, dir.yx) * 31.0 + vSem * 9.0);
        if (fract(vSem * 3.7) < 0.75 && linea > 0.0) discard;
        vec2 cel = uv * vec2(4.0, 6.0);
        vec2 id = floor(cel);
        if (h21(id + vSem * 17.0) < 0.16) discard;
        vec2 f = abs(fract(cel) - 0.5);
        float junta = smoothstep(0.38, 0.47, max(f.x, f.y));
        float marco = 1.0 - smoothstep(0.0, 0.03, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
        // Lit by the star at the origin: the face we see, if it is the one turned to the star.
        vec3 N = normalize(vN);
        vec3 V = normalize(uCam - vP);
        vec3 L = normalize(-vP);
        if (dot(N, V) < 0.0) N = -N;
        float luz = max(dot(N, L), 0.0);
        float brillo = pow(max(dot(reflect(-L, N), V), 0.0), 70.0);
        // (cold: dark glass, the light of the star only a dull red on the faces turned to it)
        vec3 vidrio = vec3(0.008, 0.007, 0.008) + vec3(0.22, 0.04, 0.018) * pow(luz, 1.5) * (0.5 + 0.5 * h21(id + 3.1));
        vec3 metal = vec3(0.022, 0.02, 0.02) + vec3(0.2, 0.05, 0.022) * luz * luz;
        vec3 col = mix(vidrio, metal, max(junta * 0.6, marco));
        col += vec3(1.0, 0.34, 0.15) * brillo * step(0.55, h21(id + 7.0)) * 1.2;
        float a = uOn * uFundido;
        gl_FragColor = vec4(col * a, 0.96 * a);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, u };
}
