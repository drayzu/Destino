import * as THREE from 'three';
import { enfocar, materia, materiaBuilder, type Nube } from './motor/materia';
import { TEAL } from './remake';

/**
 * The spark: your thought, the thread of Destino (GUION.md v2). A small, lively teal light with a
 * short wake, smaller than «tú» and never lost. It lives on a path the scene gives it: its head is
 * at `camino(s)`, its wake along `camino(s − …)`, so it is reversible with the scroll like
 * everything else. It keeps its size in pixels whatever the distance.
 *
 * The head is light in points (a white heart and its halo); the wake is a stroke of light, not
 * dots: a ribbon drawn in pixels on the screen, white-hot at the head and thinning to a teal
 * thread, fading where it passes close to the camera (riding behind it, the wake runs under us).
 *
 * And the camera that rides it: just behind and a little above, looking a little ahead.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** Joints along the wake. */
const TRAZO = 120;
/** The wake's length, in the `paso` callers give (it was 56 points `paso` apart; a stroke reads longer). */
const LARGO = 40;

export type Camino = (s: number, out: THREE.Vector3) => THREE.Vector3;

export interface Chispa {
  nube: Nube;
  /** Where its head is (after the last `update`). */
  pos: THREE.Vector3;
  /**
   * Per frame: on `camino` at `s`, its wake `paso` long per point (in s), how present (0..1), how
   * much it flickers (0..1, at a wall), and where the camera is in the same frame (for its size in pixels).
   */
  update(camino: Camino, s: number, paso: number, on: number, titila: number, camPos: THREE.Vector3, focal: number, dpr: number, time: number): void;
}

const PARPADEO = /* glsl */ `mix(1.0, 0.15 + 0.85 * step(0.45, fract(sin(floor(uTime * 9.0) * 12.9898) * 43758.5453)), uTitila)`;

/** The wake: a ribbon whose joints sit on the path; its width is in pixels, worked out on the screen. */
function crearTrazo() {
  const n = TRAZO;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 2 * 3);
  const prev = new Float32Array(n * 2 * 3);
  const next = new Float32Array(n * 2 * 3);
  const lado = new Float32Array(n * 2);
  const t = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    lado[i * 2] = -1;
    lado[i * 2 + 1] = 1;
    t[i * 2] = t[i * 2 + 1] = i / (n - 1);
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPrev', new THREE.BufferAttribute(prev, 3));
  geo.setAttribute('aNext', new THREE.BufferAttribute(next, 3));
  geo.setAttribute('aLado', new THREE.BufferAttribute(lado, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uFocal: { value: 1000 },
      uDpr: { value: 1 },
      uAncho: { value: 1.7 },
      uOn: { value: 1 },
      uTitila: { value: 0 },
      uTime: { value: 0 },
      uGain: { value: 1 },
      uFundido: { value: 1 },
      uCerca: { value: 1 },
      uColor: { value: TEAL.clone() },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aPrev, aNext;
      attribute float aLado, aT;
      uniform float uFocal, uDpr, uAncho, uOn, uTitila, uTime, uGain, uFundido, uCerca;
      varying float vLado, vT, vLuz;
      vec2 pantalla(vec4 c, vec2 res) { return c.xy / max(abs(c.w), 1e-30) * res * 0.5; }
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec4 c = projectionMatrix * mv;
        vec4 cp = projectionMatrix * modelViewMatrix * vec4(aPrev, 1.0);
        vec4 cn = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);
        // The screen in pixels, from the focal length and the projection's own aspect.
        float H = 2.0 * uFocal / projectionMatrix[1][1];
        vec2 res = vec2(H * projectionMatrix[1][1] / projectionMatrix[0][0], H);
        vec2 d = pantalla(cn, res) - pantalla(cp, res);
        if (dot(d, d) < 1e-10) d = vec2(1.0, 0.0);
        vec2 nrm = normalize(vec2(-d.y, d.x));
        float w = uAncho * uDpr * mix(1.0, 0.35, aT);
        c.xy += nrm * aLado * w / res * 2.0 * c.w;
        gl_Position = c;
        vLado = aLado;
        vT = aT;
        // Bright at the head, gone at the tail; and gone where it comes near the camera (closer
        // than a part of the head's distance), so riding behind it we never see it run under us.
        float cerca = smoothstep(0.45 * uCerca, 0.95 * uCerca, -mv.z);
        vLuz = pow(1.0 - aT, 1.8) * 0.8 * uOn * ${PARPADEO} * uGain * uFundido * cerca;
        if (c.w <= 0.0 || cp.w <= 0.0 || cn.w <= 0.0 || vLuz < 1e-4) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vLado, vT, vLuz;
      void main() {
        float halo = exp(-vLado * vLado * 2.4);
        float alma = exp(-vLado * vLado * 12.0);
        vec3 col = mix(uColor * 0.9, vec3(0.85, 1.0, 0.95) * 1.4, alma * (1.0 - vT) * (1.0 - vT));
        gl_FragColor = vec4(col * vLuz * halo, 0.0);
      }
    `,
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
  mesh.renderOrder = 49;
  return { mesh, u: mat.uniforms, pos, prev, next };
}

export function crearChispa(): Chispa {
  const b = materiaBuilder(7);
  // Head (white at its heart) and its halo.
  b.push(0, 0, 0, new THREE.Color(0.85, 1.0, 0.95), 6, 2.6);
  b.push(0, 0, 0, TEAL, 26, 0.26);
  const data = b.data();
  // Sizes and light without the builder's random spread: the spark is exact.
  data.size[0] = 6;
  data.size[1] = 26;
  const nube = materia(data, {
    pre: /* glsl */ `uniform float uOn, uTitila;`,
    move: /* glsl */ `
      float parpadeo = ${PARPADEO};
      em *= uOn * parpadeo;
    `,
    uniforms: { uOn: { value: 1 }, uTitila: { value: 0 } },
  });
  nube.u.uSpread.value = 0;
  nube.u.uFuente.value = 1;
  nube.u.uMaxPx.value = 64;
  nube.points.renderOrder = 50;
  // The wake rides with the head (its joints relative to the head, for precision at tiny scales).
  const trazo = crearTrazo();
  nube.points.add(trazo.mesh);
  const posAttr = nube.points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const geoT = trazo.mesh.geometry;
  const pos = V();
  const tmp = V();
  const j = Array.from({ length: TRAZO }, () => V());
  return {
    nube,
    pos,
    update(camino, s, paso, on, titila, camPos, focal, dpr, time) {
      camino(s, pos);
      posAttr.setXYZ(0, pos.x, pos.y, pos.z);
      posAttr.setXYZ(1, pos.x, pos.y, pos.z);
      posAttr.needsUpdate = true;
      nube.points.geometry.computeBoundingSphere();
      trazo.mesh.position.copy(pos);
      const paso2 = (paso * LARGO) / (TRAZO - 1);
      for (let i = 0; i < TRAZO; i++) j[i].copy(camino(s - i * paso2, tmp)).sub(pos);
      for (let i = 0; i < TRAZO; i++) {
        const a = j[Math.max(0, i - 1)];
        const c = j[Math.min(TRAZO - 1, i + 1)];
        for (let k = 0; k < 2; k++) {
          const o = (i * 2 + k) * 3;
          trazo.pos[o] = j[i].x;
          trazo.pos[o + 1] = j[i].y;
          trazo.pos[o + 2] = j[i].z;
          trazo.prev[o] = a.x;
          trazo.prev[o + 1] = a.y;
          trazo.prev[o + 2] = a.z;
          trazo.next[o] = c.x;
          trazo.next[o + 1] = c.y;
          trazo.next[o + 2] = c.z;
        }
      }
      geoT.getAttribute('position').needsUpdate = true;
      geoT.getAttribute('aPrev').needsUpdate = true;
      geoT.getAttribute('aNext').needsUpdate = true;
      const d = Math.max(1e-12, camPos.distanceTo(pos));
      enfocar(nube, focal, dpr, time);
      // Sizes are pixels: the unit is the world size of one pixel at the spark's distance.
      nube.u.uSizeUnit.value = (d / focal) * dpr;
      nube.u.uMaxPx.value = 64 * dpr;
      nube.u.uOn.value = on;
      nube.u.uTitila.value = titila;
      const u = trazo.u;
      u.uFocal.value = focal;
      u.uDpr.value = dpr;
      u.uOn.value = on;
      u.uTitila.value = titila;
      u.uTime.value = time;
      u.uCerca.value = d;
      // (the journey's crossfade and the head's own gain reach the wake too)
      u.uFundido.value = nube.u.uFundido.value;
      u.uGain.value = nube.u.uGain.value;
    },
  };
}

/**
 * Riding the spark: the camera `atras` behind it on its path (in s), raised by `alto` (world units,
 * along `arriba`), looking `adelante` ahead. Returns the place and the point to look at, for the
 * rig's `lugar` and `mira`.
 *
 * The spark's paths have corners (it turns at a neuron, jumps star to star); a camera nailed to
 * them would turn on each corner at once. So the camera rides the path as a hand would: its place
 * and its gaze are the path averaged over a stretch (`suave`, in s), round the corner instead of on
 * it, and the spark drifts a little off the middle while it turns.
 */
export function montar(camino: Camino, s: number, atras: number, adelante: number, alto: number, arriba = V(0, 1, 0), suave = Math.max(atras, adelante * 0.35) * 1.4, radial = false, suaveLugar = suave * 2.2) {
  // (the place smoother than the gaze: the camera glides, the spark wanders a little in the frame;
  // on a way whose stretches go at very different paces in s, keep both windows short, or the
  // average reaches past the spark)
  const lugar = alisado(camino, s - atras, suaveLugar, V());
  // The gaze: mostly on the spark, a little ahead of it, so it stays near the middle of the frame.
  const mira = alisado(camino, s + adelante * 0.35, suave, V());
  // (a way over a sphere round the origin: the average cuts under its surface; back up to it)
  if (radial) {
    lugar.setLength(camino(s - atras, tmpA).length());
    mira.setLength(camino(s + adelante * 0.35, tmpA).length());
  }
  lugar.addScaledVector(arriba, alto);
  // «Up» for the frame: the way's own up; and which way is ahead (a camera that looks steeply down
  // takes that as its up).
  const delante = alisado(camino, s + suave, suave * 2, V()).sub(alisado(camino, s - suave, suave * 2, tmpB));
  if (delante.lengthSq() > 1e-30) delante.normalize();
  return { lugar, mira, arriba: arriba.clone().normalize(), delante };
}

const MUESTRAS = 16;
const PESOS = Array.from({ length: MUESTRAS }, (_, i) => {
  const u = ((i + 0.5) / MUESTRAS) * 2 - 1;
  return (1 - u * u) ** 2;
});
const SUMA = PESOS.reduce((a, b) => a + b, 0);
const tmpA = V();
const tmpB = V();
/** The path round s, averaged over ±w with a smooth bell (so a corner becomes a curve). */
function alisado(camino: Camino, s: number, w: number, out: THREE.Vector3) {
  out.set(0, 0, 0);
  if (w <= 0) return camino(s, out);
  for (let i = 0; i < MUESTRAS; i++) {
    const u = ((i + 0.5) / MUESTRAS) * 2 - 1;
    out.addScaledVector(camino(s + u * w, tmpA), PESOS[i] / SUMA);
  }
  return out;
}
