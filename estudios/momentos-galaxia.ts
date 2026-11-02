import * as THREE from 'three';
import { rng } from './motor/math';
import { materiaBuilder } from './motor/materia';
import { DECADAS, LOG0, frente } from './burbuja';

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

/**
 * The spark's branch in the bubble (burbuja.ts): the same stars, drawn from the same seed in the same
 * order, the same tree; the stars along the branch from the Sun to its last star, each with the time
 * (in the front's own `red`) the copies reach it. Positions relative to the Sun.
 */
export function ramaBurbuja(hacia: THREE.Vector3) {
  const b = materiaBuilder(301);
  const r = b.r;
  const N = 6000;
  const pos: THREE.Vector3[] = [];
  const t: number[] = [];
  for (let i = 0; i < N; i++) {
    const u = (i + r()) / N;
    const d = Math.pow(10, LOG0 + 0.12 + u * (DECADAS - 0.12));
    const [x, y, z] = b.onSphere();
    const grueso = Math.min(1, 0.12 / d);
    pos.push(new THREE.Vector3(x, y * Math.max(grueso, 0.06), z).normalize().multiplyScalar(d));
    t.push(Math.min(1, Math.max(0, (Math.log10(d) - LOG0) / DECADAS + (r() - 0.5) * 0.025)));
  }
  const orden = pos.map((_, i) => i).sort((a, c) => pos[a].length() - pos[c].length());
  const padre = new Int32Array(N).fill(-1);
  for (let k = 1; k < N; k++) {
    const i = orden[k];
    let mejor = -1;
    let mejorD = Infinity;
    const di = pos[i].length();
    for (let m = Math.max(0, k - 900); m < k; m++) {
      const j = orden[m];
      const d = pos[i].distanceTo(pos[j]) + 0.25 * Math.abs(di - pos[j].length());
      if (d < mejorD) {
        mejorD = d;
        mejor = j;
      }
    }
    padre[i] = pos[i].length() < pos[i].distanceTo(pos[mejor]) * 1.2 ? -1 : mejor;
  }
  const dir = hacia.clone().normalize();
  let hojaI = 0;
  let mejor = -Infinity;
  for (let i = 0; i < N; i++) {
    const d = pos[i].length();
    const score = Math.log10(d) * 1.0 + 3 * pos[i].clone().divideScalar(d).dot(dir);
    if (d > frente(0.97) && score > mejor) {
      mejor = score;
      hojaI = i;
    }
  }
  const camino: { p: THREE.Vector3; t: number }[] = [];
  for (let i = hojaI; i >= 0; i = padre[i]) camino.unshift({ p: pos[i], t: t[i] });
  return { camino, estrellas: pos.map((p, i) => ({ p, t: t[i] })) };
}

/**
 * The copies: at every star of the spark's branch, the moment it gets there, a burst of probes leaves
 * in all directions (flattened into the disc as the stars are), each a short streak of teal that
 * flies out about as far as the next star and fades. `uRed` the front's time; `uOn` their light.
 * Units: the galaxy's, round the Sun (place the cloud there).
 */
export function copiasDatos(camino: { p: THREE.Vector3; t: number }[], porEstrella: number, teal: THREE.Color) {
  const b = materiaBuilder(311);
  const r = b.r;
  const origen: number[] = [];
  const dirs: number[] = [];
  const largo: number[] = [];
  const t0: number[] = [];
  const TRAZO = 7;
  camino.forEach((c, k) => {
    const sig = camino[Math.min(camino.length - 1, k + 1)].p;
    const L = Math.max(c.p.distanceTo(sig), c.p.length() * 0.35, 0.0008);
    for (let i = 0; i < porEstrella; i++) {
      const [x, y, z] = b.onSphere();
      const grueso = Math.min(1, 0.12 / Math.max(c.p.length(), 1e-4));
      const d = new THREE.Vector3(x, y * Math.max(grueso, 0.12), z).normalize();
      const l = L * (0.55 + 0.6 * r());
      for (let j = 0; j < TRAZO; j++) {
        b.push(c.p.x, c.p.y, c.p.z, teal, 0.00001, (j === 0 ? 1.6 : 1.0) * (1 - j / TRAZO), { delay: j / TRAZO });
        origen.push(c.p.x, c.p.y, c.p.z);
        dirs.push(d.x, d.y, d.z);
        largo.push(l);
        t0.push(c.t);
      }
    }
  });
  return { data: b.data(), extra: { aO: [new Float32Array(origen), 3], aD: [new Float32Array(dirs), 3], aL: [new Float32Array(largo), 1], aT0: [new Float32Array(t0), 1] } as Record<string, [Float32Array, number]> };
}

/** The copies' motion (materia `move`): out from their star, a streak, flashing as they leave. */
export const COPIAS_MOVE = /* glsl */ `
  float dt = uRed - aT0;
  float f = clamp(dt / 0.07, 0.0, 1.0);
  float ff = clamp(f - aDelay * 0.22, 0.0, 1.0);
  ff = 1.0 - (1.0 - ff) * (1.0 - ff);
  p = aO + aD * aL * ff;
  em *= uOn * step(0.0, dt) * (1.0 - smoothstep(0.55, 1.0, f)) * (1.0 + 2.5 * exp(-max(dt, 0.0) * 140.0));
`;

/**
 * A smooth curve through keys [beat, value], its slopes at the two ends given (value per beat) and
 * monotone in between (Fritsch–Butland, as the timeline's tracks): for a clock or a pace that must
 * take up exactly where another leaves off.
 */
export function curva(keys: [number, number][], m0: number, m1: number) {
  const n = keys.length;
  const m = new Array<number>(n).fill(0);
  m[0] = m0;
  m[n - 1] = m1;
  for (let k = 1; k < n - 1; k++) {
    const h0 = keys[k][0] - keys[k - 1][0];
    const h1 = keys[k + 1][0] - keys[k][0];
    const d0 = (keys[k][1] - keys[k - 1][1]) / h0;
    const d1 = (keys[k + 1][1] - keys[k][1]) / h1;
    if (d0 * d1 <= 0) continue;
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    m[k] = (w1 + w2) / (w1 / d0 + w2 / d1);
  }
  return (p: number) => {
    if (p <= keys[0][0]) return keys[0][1] + m0 * (p - keys[0][0]);
    if (p >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (keys[i + 1][0] <= p) i++;
    const [pa, a] = keys[i];
    const [pb, b] = keys[i + 1];
    const h = pb - pa;
    const t = (p - pa) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * b + (t3 - t2) * h * m[i + 1];
  };
}

/**
 * The copies that leave a star the spark touches, each a streak of teal flying to a star near it
 * (and from there, a few more): beat-driven, so a burst plays out whatever the front's own clock
 * does. `vuelos`: from, to, the beat it leaves and the beat it gets there, and how bright.
 */
export function saltosDatos(vuelos: { de: THREE.Vector3; a: THREE.Vector3; p0: number; p1: number; luz: number }[], teal: THREE.Color) {
  const b = materiaBuilder(331);
  const O: number[] = [];
  const T: number[] = [];
  const P: number[] = [];
  const TRAZO = 24;
  for (const v of vuelos) {
    for (let j = 0; j < TRAZO; j++) {
      b.push(v.de.x, v.de.y, v.de.z, teal, 0.00001, v.luz * (j === 0 ? 2.6 : 1.3) * Math.pow(1 - j / TRAZO, 1.2), { delay: j / TRAZO });
      O.push(v.de.x, v.de.y, v.de.z);
      T.push(v.a.x, v.a.y, v.a.z);
      P.push(v.p0, v.p1);
    }
  }
  return { data: b.data(), extra: { aO: [new Float32Array(O), 3], aA: [new Float32Array(T), 3], aP: [new Float32Array(P), 2] } as Record<string, [Float32Array, number]> };
}

/** Their motion: shot out fast, slowing as they reach their star; a flash as they leave and as they arrive. */
export const SALTOS_MOVE = /* glsl */ `
  float dur = max(aP.y - aP.x, 0.05);
  float f = clamp((uP - aP.x) / dur, 0.0, 1.0);
  float g = clamp(f - aDelay * 0.22, 0.0, 1.0);
  g = 1.0 - (1.0 - g) * (1.0 - g) * (1.0 - g);
  p = mix(aO, aA, g);
  float vivo = step(aP.x, uP) * (1.0 - smoothstep(0.92, 1.0, f - aDelay * 0.22));
  float sale = exp(-max(uP - aP.x, 0.0) * 5.0);
  float lf = (f - 1.0) / 0.06;
  float llega = exp(-lf * lf) * step(aDelay, 0.01);
  em *= uOn * vivo * (1.0 + 2.0 * sale + 2.5 * llega);
`;

/** Their sizes in pixels (the head larger, the streak thinning behind it), wherever they are. */
export const SALTOS_POST = /* glsl */ `
  float ddS = max(-mv.z, 1e-14);
  sz = (aDelay < 0.01 ? 4.2 : 2.6 - 1.2 * aDelay) * (uMinPx / 1.6) * ddS / max(uSizeUnit * uEscalaMundo * uFocal, 1e-20);
`;

/**
 * The stars the spark touches, drawn as stars (a core and a soft glow, warm), each turning ours as it
 * is touched: a flare, then teal. `estrellas`: where, the beat it is touched, its size (world units).
 */
export function tocadasDatos(estrellas: { p: THREE.Vector3; pt: number; r: number }[]) {
  const b = materiaBuilder(337);
  const PT: number[] = [];
  const calida = new THREE.Color(1.0, 0.86, 0.66);
  for (const e of estrellas) {
    b.push(e.p.x, e.p.y, e.p.z, calida, e.r * 0.3, 2.6, { kind: 1 });
    PT.push(e.pt);
    for (let i = 0; i < 160; i++) {
      const [x, y, z] = b.onSphere();
      const q = Math.pow(b.r(), 1.6) * e.r;
      b.push(e.p.x + x * q, e.p.y + y * q, e.p.z + z * q, calida, e.r * 0.05, 0.03);
      PT.push(e.pt);
    }
  }
  return { data: b.data(), extra: { aPt: [new Float32Array(PT), 1] } as Record<string, [Float32Array, number]> };
}

export const TOCADAS_MOVE = /* glsl */ `
  float dt = uP - aPt;
  float tocada = smoothstep(-0.04, 0.25, dt);
  float luzE = max(max(em.r, em.g), em.b);
  em = mix(em, uTeal * min(luzE * 1.3, 1.5), tocada);
  float flare = step(0.0, dt) * exp(-max(dt, 0.0) * 3.5);
  em *= (1.0 + 1.4 * flare) * uOn;
  sz *= 1.0 + 0.5 * flare;
`;
