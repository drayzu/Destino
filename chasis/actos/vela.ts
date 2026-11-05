import * as THREE from 'three';
import { Timeline } from '../../estudios/timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from '../../estudios/motor/materia';
import { gauss } from '../../estudios/motor/math';
import { sol as solH } from '../../src/horizontes';
import { TEAL, potencia, puntoTu, anioEn } from '../../estudios/remake';
import { toma } from '../../estudios/rig';
import { crearChispa, montar, type Camino } from '../../estudios/chispa';
import { LEJOS, enjambreNube } from './mercurio';
import { angulos } from '../../estudios/rig';
import { enfocarMarcas, marcas, nombres, trazo, type Nombre } from '../../estudios/revelar';
import type { Cuenta, Rotulo } from '../../estudios/placa';
import { escribir, toma as plano } from '../toma';
import type { Acto, EscenaChasis, FrameActo } from '../tipos';
import { crearAnillo } from '../../estudios/cilindro';
import { crearNaveMalla } from '../../estudios/nave';
import { pulsosNube, puntoLejano } from '../../estudios/momentos-vela';

/**
 * Scenes 14–15 of ESCALETA.md, «La vela» and «La nave-mundo» (GUION.md, moments 32–35).
 *
 * From the Sun in its swarm, a beam of teal light pushes a sail of a few grams; the camera rides
 * behind it. The Sun falls away; at a fifth of the speed of light the sky bends: the stars crowd
 * ahead, bluer, and redden behind (aberration and Doppler, computed), while dust streaks past.
 * Alpha Centauri A and B come up ahead, two suns; the sail opens wide and brakes on their light.
 * Then something enormous passes, slowly: a ship that is a world, its wheels turning, and among its
 * lights, the point.
 *
 * Units: solar radii at the start (the Sun's scene hands over in them); the sail at the origin,
 * flying towards +Z. Distances to the stars are drawn short and move in logarithm.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const S0 = V(0, -1.2, -14);
/** Home seen from the sail: the Sun's direction (it only falls back along it). */
const U_CASA = V(S0.x / 14, S0.y / 14, -1).normalize();
/**
 * «La luz es lenta»: the messages home. The echo leaves the sail ECO_SALE beats into the moment, and
 * then one every CADA beats (PULSOS after it), all at VEL_MSG units a beat along the way home: fast
 * across the frame at first, then crawling towards the Sun, so far away, while the years go by. They
 * get smaller as they go, from REF_MSG (units from the camera) on.
 */
const ECO_SALE = 2.9;
const CADA = 0.75;
const PULSOS = 5;
const VEL_MSG = 0.5;
const REF_MSG = 0.45;

/** The sky: stars at «infinity» (a sphere far away), coloured by their temperature. */
function cieloDatos(): MateriaData {
  const b = materiaBuilder(181);
  const c = new THREE.Color();
  for (let i = 0; i < 60000; i++) {
    const [x, y, z] = b.onSphere();
    const t = b.r();
    c.setRGB(1, 0.84, 0.66).lerp(new THREE.Color(0.72, 0.82, 1), t);
    b.push(x * 9000, y * 9000, z * 9000, c, 1, 0.25 + 0.75 * b.r() * b.r());
  }
  return b.data();
}

/** The sail: a thin square of teal light with a chip at its middle (its own units: the sail is 1 across). */
function velaDatos(): MateriaData {
  const b = materiaBuilder(191);
  // (its film is a membrane, below; here only the chip at its middle and a few glints on its rim)
  for (let i = 0; i < 1600; i++) {
    const t = b.r() * 4;
    const k = Math.floor(t);
    const f = t - k - 0.5;
    const [x, y] = k === 0 ? [f, 0.5] : k === 1 ? [0.5, f] : k === 2 ? [f, -0.5] : [-0.5, f];
    b.push(x, y, 0, TEAL, 0.006, 0.5);
  }
  for (let i = 0; i < 300; i++) b.push(gauss(b.r) * 0.02, gauss(b.r) * 0.02, 0.01, 0xffffff, 0.006, 1.2);
  return b.data();
}

/**
 * The sail's film: a membrane a few atoms thick, nearly invisible, that shines where light falls
 * on it (the laser that pushes it, or Alpha Centauri's that brakes it): soft rainbow sheens as the
 * view slides over it, a bright frame, faint rigging to the chip.
 */
function velaMembrana() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uLuz: { value: 0 }, uLuzA: { value: 0 }, uGain: { value: 1 }, uFundido: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      varying vec3 vV;
      varying vec3 vN;
      void main() {
        vP = position.xy;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLuz, uLuzA, uGain, uFundido, uTime;
      varying vec2 vP;
      varying vec3 vV;
      varying vec3 vN;
      float raya(float x, float w) {
        float fw = max(fwidth(x), 1e-6);
        return 1.0 - smoothstep(w - fw, w + fw, abs(x));
      }
      void main() {
        vec3 n = normalize(vN);
        float c = min(abs(dot(n, normalize(-vV))), 1.0);
        // Thin-film sheens: colour that shifts with the angle and slides across the film.
        float fase = (1.0 - c) * 9.0 + (vP.x + vP.y) * 2.0 + uTime * 0.15;
        vec3 iris = 0.5 + 0.5 * cos(6.2831853 * (fase + vec3(0.0, 0.33, 0.67)));
        float luz = 0.05 + 0.6 * (uLuz + uLuzA);
        vec3 col = mix(vec3(0.55, 0.85, 0.8), iris, 0.42) * luz * (0.35 + 0.65 * pow(1.0 - c, 1.5));
        // Its frame, and rigging from the corners to the chip.
        float marco = max(raya(abs(vP.x) - 0.5, 0.006), raya(abs(vP.y) - 0.5, 0.006));
        float aparejo = max(raya(vP.x - vP.y, 0.003), raya(vP.x + vP.y, 0.003)) * 0.35;
        col += vec3(0.45, 0.95, 0.85) * (marco * (0.6 + 1.5 * (uLuz + uLuzA)) + aparejo * (0.2 + uLuz + uLuzA));
        gl_FragColor = vec4(col * uGain * uFundido, 0.0);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.02, 1, 1), mat);
  m.renderOrder = 5;
  m.frustumCulled = false;
  return { mesh: m, u: mat.uniforms };
}

/**
 * Interstellar dust streaming past, as fine streaks of light (not dots): each a short line along
 * the way, longer the faster we go, fading at both ends of the stretch round the sail.
 */
function polvoLineas() {
  const n = 1400;
  const pos = new Float32Array(n * 2 * 3);
  const off = new Float32Array(n * 2 * 2);
  const fase = new Float32Array(n * 2);
  const cola = new Float32Array(n * 2);
  let seed = 193;
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const q = 0.03 + Math.sqrt(r()) * 0.6;
    const f = r();
    for (let k = 0; k < 2; k++) {
      off[(i * 2 + k) * 2] = Math.cos(a) * q;
      off[(i * 2 + k) * 2 + 1] = Math.sin(a) * q;
      fase[i * 2 + k] = f;
      cola[i * 2 + k] = k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aOff', new THREE.BufferAttribute(off, 2));
  g.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
  g.setAttribute('aCola', new THREE.BufferAttribute(cola, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPolvo: { value: 0 }, uVel: { value: 0.4 }, uTime: { value: 0 }, uFundido: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec2 aOff;
      attribute float aFase, aCola;
      uniform float uVel, uTime;
      varying float vLuz;
      void main() {
        float zz = fract(aFase - uTime * uVel) * 4.0 - 2.0;
        float largo = 0.01 + uVel * 0.18;
        vec3 p = vec3(aOff.x, aOff.y, zz + aCola * largo);
        vLuz = (1.0 - aCola) * (1.0 - smoothstep(1.2, 2.0, abs(zz)));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPolvo, uFundido;
      varying float vLuz;
      void main() {
        gl_FragColor = vec4(vec3(0.72, 0.8, 0.9) * vLuz * 0.55 * uPolvo * uFundido, 0.0);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const lineas = new THREE.LineSegments(g, mat);
  lineas.frustumCulled = false;
  lineas.renderOrder = 3;
  return { lineas, u: mat.uniforms };
}

/** Interstellar dust that streams past (`aKind` phase; `aOff` place round the path). */
function polvoDatos() {
  const b = materiaBuilder(193);
  const off: number[] = [];
  for (let i = 0; i < 9000; i++) {
    b.push(0, 0, 0, new THREE.Color(0.75, 0.82, 0.9), 0.0015, 0.5, { kind: b.r() });
    const a = b.r() * Math.PI * 2;
    const q = 0.02 + Math.sqrt(b.r()) * 0.5;
    off.push(Math.cos(a) * q, Math.sin(a) * q);
  }
  return { data: b.data(), off: new Float32Array(off) };
}

/**
 * The ship that is a world (its own units: 1 long, along +Z): a spine, four wheels that turn, a
 * radiator fin and a shield at its bow. `aKind`: 0 spine, 1 wheel (turns), 2 light, 3 radiator.
 */
/** The ring the camera goes into (its z on the spine), and how fast the rings turn (radians a second). */
const ANILLO = 0.0;
const GIRO_ANILLO = 0.05;
// (three rings: Diego, 31 Oct)
const RINGS = [-0.22, ANILLO, 0.22];

function naveDatos(): MateriaData {
  const b = materiaBuilder(197);
  const r = b.r;
  const c = new THREE.Color();
  // The spine.
  for (let i = 0; i < 9000; i++) {
    const z = r() - 0.5;
    const a = r() * Math.PI * 2;
    b.push(Math.cos(a) * 0.012, Math.sin(a) * 0.012, z, new THREE.Color(0.6, 0.66, 0.75), 0.002, 0.14, { kind: 0 });
  }
  // Four rings (their land, walls and hull are surfaces: crearAnillo); here, their spokes.
  for (const zc of RINGS) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      for (let i = 0; i < 500; i++) {
        const q = 0.012 + r() * 0.1;
        b.push(Math.cos(a) * q, Math.sin(a) * q, zc, new THREE.Color(0.5, 0.56, 0.65), 0.002, 0.1, { kind: 1, delay: zc });
      }
    }
  }
  // The engine's glow behind, and the shield ahead.
  for (let i = 0; i < 6000; i++) {
    const z = -0.5 + r() * 0.35;
    const x = (r() - 0.5) * 0.5;
    b.push(x, 0, z, new THREE.Color(1.0, 0.4, 0.2), 0.002, 0.06, { kind: 3 });
  }
  for (let i = 0; i < 9000; i++) {
    const a = r() * Math.PI * 2;
    const q = Math.sqrt(r()) * 0.17;
    b.push(Math.cos(a) * q, Math.sin(a) * q, 0.55 - q * q * 1.5, new THREE.Color(0.65, 0.7, 0.78), 0.002, 0.12, { kind: 0 });
  }
  // Its teal lights along the spine.
  for (let i = 0; i < 400; i++) b.push(gauss(r) * 0.005, gauss(r) * 0.005, r() - 0.5, TEAL, 0.004, 1.0, { kind: 2 });
  return b.data();
}

/** The act's shot: p, az, el, ld, lw, mx, my, fov, roll (viaje.transcribir, then by hand). */
const TOMA_VELA: number[][] = [
  [0, 106.56, 30, 2.2, 0, -0.02, 0, 34, 0],
  [1.2, 77.98, 25.4, 1.227, 0.7, 0, -0.3, 37.8, 0.15],
  [2.4, 40.99, 15.39, -0.54, 0.95, 0, -0.09, 44.08, 0.01],
  [3.0, 32, 13, -0.9, 0.6, 0, 0, 45.2, 0],
  [3.6, 26.32, 11.49, -1.12, 0.05, 0, 0, 45.94, 0],
  [4.8, 22.64, 10.52, -1.185, 0, -0.04, 0, 46.03, 0],
  [6, 11.59, 9.67, -1.193, 0, -0.02, 0, 47.6, 0],
  [7.2, -22.84, 8.75, -1.168, 0, 0, 0, 54.17, 0],
  [8.4, -66.95, 7.84, -1.157, 0, 0, 0, 60.3, 0],
  [9.6, -111.58, 6.9, -1.192, 0, -0.01, 0, 63.58, 0],
  [10.8, -158.48, 6.24, -1.234, 0, 0, 0, 65.46, 0],
  [12, -206.3, 7.09, -1.195, 0, -0.03, 0, 64.44, 0.01],
  [13.2, -254.93, 10.73, -1.01, 0, -3.02, 0.05, 59.4, 0.01],
  [14.4, -299.09, 14.94, -0.806, 0, -11.53, -1.78, 54.23, 0],
  [15.6, -335.7, 18.54, -0.646, 0, -8.87, -5.59, 50.83, 0],
  [16.8, -368.63, 21.24, -0.532, 0, 4.3, -8.03, 48.6, 0],
  [18, -401.31, 21.59, -0.501, 0, 19.15, -8.04, 48.27, 0],
  [19.2, -433.63, 20.21, -0.5, 0, 24.86, -4.56, 49.08, 0.01],
  [20.4, -468.52, 18.52, -0.501, 0, 11.6, 0.17, 49.83, -0.01],
  [21.6, -515.35, 17.22, -0.527, 0, 0.82, 0.17, 50, -0.01],
  [22.8, -563.1, 16.28, -0.577, 0, 0.03, 0, 49.98, 0],
  [24, -580.22, 16.36, -0.437, 0, 0, 0, 49.06, 0],
  [25.2, -593.49, 18.02, 0.335, 0, 0, 0, 44.61, 0],
  [26.4, -611.32, 20.35, 1.411, 0, 0.01, 0, 38.41, 0],
  [27.6, -622.33, 21.78, 2.074, 0, 0.01, 0, 34.59, 0],
  [28.8, -624.33, 22, 2.175, 0, -0.01, 0, 34.01, 0],
  [30, -626.02, 22, 2.176, 0, 0, 0, 34, 0],
  [31.2, -628.96, 21.95, 2.167, 0, 0, 0, 34.02, 0],
  [32.4, -633.01, 20.98, 1.982, 0, 0, -0.01, 34.51, 0],
  [33.6, -638.97, 17.95, 1.398, 0, -0.01, 0, 36.02, 0],
  [34.8, -646.43, 14.05, 0.615, 0, 0, 0, 37.98, 0],
  [36, -654.58, 11.04, -0.057, 0, -0.01, 0, 39.49, 0],
  [37.2, -663.58, 10.78, -0.401, 0, -0.02, 0, 39.98, -0.01],
  [38.4, -673.62, 13.71, -0.549, 0, -0.01, 0, 40.01, 0],
  [39.6, -677.79, 16.77, -0.521, 0, 0.01, 0, 40.53, 0],
  [40.8, -678.02, 18.98, -0.229, 0, 0, 0, 42.57, 0],
  [42, -679.86, 19.77, -0.041, 0, -0.02, -0.01, 43.89, 0],
  [43.2, -692.88, 18.66, -0.045, 0, -0.04, -0.03, 44, 0],
  [44.4, -718.32, 16.43, -0.082, 0, -0.03, 0, 44, -0.01],
  [45.6, -748.35, 14.05, -0.122, 0, -0.05, -0.01, 44, -0.01],
  [46.8, -774.54, 12.43, -0.147, 0, -0.02, 0, 43.98, 0],
  [48, -792.47, 12.29, -0.119, 0, -0.01, 0, 43.44, 0],
  [49.2, -806.32, 13.16, -0.009, 0, 0.04, 0, 41.68, 0],
  [50.6, -815, 14, 0.097, 0, -0.33, 0.23, 40, 0.14]
];

export const vela: EscenaChasis = {
  id: 'vela',
  montar(stage): Acto {
    const root = stage.root;
    const { camera } = stage;

    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root, orden = 5) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };
    // The Sun and its swarm, falling behind.
    const casa = new THREE.Group();
    root.add(casa);
    const sol = solH({ puntos: 200000, corona: 90000 });
    casa.add(sol.group);
    const enjambre = add(enjambreNube(false), casa, 10);
    enjambre.u.uCubre.value = 1;
    // Alpha Centauri A and B, ahead.
    const alfa = new THREE.Group();
    root.add(alfa);
    const A = solH({ puntos: 220000, corona: 90000, semilla: 7 });
    const B = solH({ puntos: 160000, corona: 60000, semilla: 11, estilo: 'viva' });
    A.group.scale.setScalar(1.22);
    B.group.scale.setScalar(0.86);
    B.group.position.set(6.5, 1.2, 4);
    alfa.add(A.group, B.group);

    // Revealing: both stars ours, ringed, and the route between them.
    const aroSol = add(marcas([{ pos: V(), R: 0, color: TEAL, nuestro: true, aro: 84, sinPunto: true }]), casa, 40);
    const aroAlfa = add(
      marcas([
        { pos: V(), R: 0, color: TEAL, nuestro: true, aro: 40, sinPunto: true },
        { pos: B.group.position.clone(), R: 0, color: TEAL, nuestro: true, aro: 30, sinPunto: true },
      ]),
      alfa,
      40,
    );
    const ruta = add(trazo(), root, 4);
    const medio = V();
    const NOMBRES: Nombre[] = [
      { pos: casa.position, texto: 'Sol', nuestro: true, aire: 30 },
      // (a double star: its two suns, A and B, named as one pair)
      { pos: alfa.position, texto: 'Alfa Centauri A · B', nuestro: true, aire: 8 },
      { pos: medio, texto: '4,4 años luz', lado: 'n', aire: -6 },
    ];

    const cielo = add(materia(cieloDatos()), root, 1);
    cielo.u.uFuente.value = 1;
    const velaG = new THREE.Group();
    root.add(velaG);
    const velaN = add(materia(velaDatos(), { pre: `uniform float uLuzA;`, move: `em *= 1.0 + uLuzA * 2.5 * step(0.5, length(em));`, uniforms: { uLuzA: { value: 0 } } }), velaG, 6);
    velaN.u.uFuente.value = 0.4;
    const membrana = velaMembrana();
    velaG.add(membrana.mesh);
    // The beam that pushes it, from the swarm: a laser, one thin line of light with pulses running up
    // it to the sail (Diego, 31 Oct: as points, by the sail they swelled into blots like dust).
    const hazU = { uHaz: { value: 0 }, uTime: { value: 0 }, uFundido: { value: 1 } };
    const haz = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
      new THREE.ShaderMaterial({
        uniforms: hazU,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            vUv = uv;
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vV = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uHaz, uTime, uFundido;
          varying vec2 vUv;
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            // (a bright core along its middle, a soft glow round it; pulses running to the sail, at v = 1)
            float c = abs(dot(normalize(vN), normalize(-vV)));
            float luz = pow(c, 6.0) + 0.2 * pow(c, 1.5);
            float v = vUv.y;
            float pulso = (smoothstep(0.82, 0.928, fract(v * 18.0 - uTime * 1.6)) * (1.0 - smoothstep(0.928, 1.0, fract(v * 18.0 - uTime * 1.6))));
            float extremos = smoothstep(0.0, 0.1, v) * (1.0 - smoothstep(0.992, 1.0, v));
            gl_FragColor = vec4(vec3(0.45, 0.95, 0.82) * luz * (0.45 + 1.1 * pulso) * extremos * 0.8 * uHaz * uFundido, 0.0);
          }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    );
    haz.frustumCulled = false;
    haz.renderOrder = 4;
    root.add(haz);
    const hazA = V();
    const hazB = V(0, 0, -0.002);
    const pd = polvoDatos();
    const polvo = add(
      materia(pd.data, {
        pre: /* glsl */ `attribute vec2 aOff; uniform float uPolvo, uVel;`,
        move: /* glsl */ `
          float zz = fract(aKind - uTime * uVel) * 4.0 - 2.0;
          p = vec3(aOff.x, aOff.y, zz);
          em *= uPolvo * (1.0 - smoothstep(1.2, 2.0, abs(zz)));
        `,
        uniforms: { uPolvo: { value: 0 }, uVel: { value: 0.4 } },
        extra: { aOff: [pd.off, 2] },
      }),
      root,
      3,
    );
    polvo.u.uFuente.value = 0.6;
    polvo.points.visible = false;
    const polvoL = polvoLineas();
    root.add(polvoL.lineas);
    const naveG = new THREE.Group();
    root.add(naveG);
    const nave = add(
      materia(naveDatos(), {
        pre: /* glsl */ `uniform float uNave;`,
        move: /* glsl */ `
          if (aKind > 0.5 && aKind < 2.5 && abs(p.z - aDelay) < 0.05) {
            float ag = uTime * ${GIRO_ANILLO.toFixed(3)};
            p.xy = vec2(cos(ag) * p.x - sin(ag) * p.y, sin(ag) * p.x + cos(ag) * p.y);
          }
          em *= uNave;
        `,
        uniforms: { uNave: { value: 0 } },
      }),
      naveG,
      6,
    );
    nave.u.uFuente.value = 0.4;
    // The ship as surfaces (spine, spokes, shield, radiators, tanks, drive) and its jet in points; its
    // old points no longer drawn.
    nave.points.visible = false;
    const naveM = crearNaveMalla(RINGS, 0.13);
    naveG.add(naveM.grupo);
    add(naveM.chorro, naveG, 6);
    // The rings: land inside, hull outside, a glass roof; the one the camera enters finer.
    const anillos = RINGS.map((zc, k) => {
      const a = crearAnillo(0.13, 0.09, 0.018, k + 1, zc === ANILLO ? 1.6 : 0.7);
      a.grupo.position.z = zc;
      naveG.add(a.grupo);
      return a;
    });
    const A_TU = 1.15;
    /** Where in the ring the spark comes in from the spine (between two spokes). */
    const A_ENTRA = A_TU - 0.95;
    const Yv = V(0, 1, 0);
    const tu = add(puntoTu(V(Math.cos(A_TU) * 0.1285, Math.sin(A_TU) * 0.1285, ANILLO), 0.0012), naveG, 7);
    const eco = crearChispa();
    root.add(eco.nube.points);
    // The echo home, named while it goes; the messages after it; and home, a warm point far off.
    const NOMBRE_ECO: Nombre[] = [{ pos: eco.pos, texto: 'Mensaje a casa · llega en 4 años y medio', nuestro: true, aire: 6 }];
    const pulsos = pulsosNube(PULSOS, REF_MSG);
    add(pulsos.nube, root, 45);
    const solLejos = add(puntoLejano(new THREE.Color(1.0, 0.8, 0.58)), casa, 12);
    const NOMBRE_SOL: Nombre[] = [{ pos: casa.position, texto: 'Sol', nuestro: true, aire: 2 }];
    const miraP = V();

    const listo = Promise.all([sol.listo, A.listo, B.listo]);

    // ---------------------------------------------------------------- the moments (GUION.md 32–35)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    // Where the Sun's scene leaves the camera (sol.ts, «tipo»): relative to the Sun, here S0.
    tl.set({ cx: S0.x, cy: S0.y, cz: S0.z, ox: 0, oy: 0, oz: 0, az: angulos(LEJOS).az + 150, el: 30, ld: 2.2, yaw: 90, pitch: -90, roll: 0, fov: 34, haz: 0, lsol: Math.log10(14), lcen: 4.5, beta: 0, polvo: 0, abre: 1, luzA: 0, nave: 0, tu: 0, nz: -3, eco: 0, chH: 0, salta: 0, mapa: 0, nombres: 0, ecoN: 0, lw: 0, adentro: 0, sube: 0, mira: 0, solP: 0, solN: 0 });

    tl.label('velas').caption(5.6, 'Velas de luz', 'Para ir a otra estrella, un láser empuja una vela de pocos gramos. En minutos va a un quinto de la luz.');
    tl.with(1.2, { cx: 0, cy: 0, cz: 0 });
    luego(1.4, 1.2, { haz: 1 });
    luego(1.6, 1.6, { chH: 1 });
    tl.to(3.0, { az: 28, el: 12, ld: -1.1, fov: 46 });
    luego(0.2, 2.6, { lsol: 2.6, polvo: 1 });
    // (the camera turns one way all through this act: never back on itself)
    tl.to(2.6, { az: 20, el: 10, ld: -1.2 });

    tl.label('quinto').caption(5.8, 'A un quinto de la luz', 'Veinte años hasta Alfa Centauri. A esta velocidad el cielo se deforma: adelante, azul; atrás, rojo.');
    tl.with(1.0, { haz: 0 });
    tl.with(3.0, { beta: 0.2, lsol: 4.2 });
    tl.to(2.6, { az: -60, el: 8, ld: -1.15, fov: 60 });
    tl.to(3.2, { az: -182, el: 6, ld: -1.25, fov: 66 });

    // The wall: light is slow. The camera keeps turning, round the sail, until it looks back home
    // (behind us the sky is redder and sparser): the echo leaves the sail for home, then another
    // message, and another; fast across the frame at first, then crawling towards the Sun, a warm
    // point far off, while the years go by. The gaze leads the turn, looking between the sail and
    // home (`mira`: how far along the way home it looks, in camera distances).
    tl.label('lenta').caption(6.0, 'La luz es lenta', 'Cada mensaje a casa tarda más de cuatro años. Allá solo saben de nosotros lo que fuimos.');
    tl.with(0.8, { eco: 1 });
    luego(1.4, 4.2, { mira: 1 });
    luego(ECO_SALE - 0.7, 0.8, { solP: 1 });
    luego(ECO_SALE + 0.4, 0.8, { ecoN: 1 });
    luego(ECO_SALE + 1.1, 0.8, { solN: 1 });
    luego(5.6, 0.8, { ecoN: 0 });
    // (the dust thins while we look back: the messages are what moves there)
    luego(1.8, 1.4, { polvo: 0.22 });
    tl.to(3.0, { az: -300, el: 15, ld: -0.8, fov: 54 });
    tl.to(3.0, { az: -385, el: 22, ld: -0.5, fov: 48 });

    // On round the sail, the same way, until it is behind it again, looking ahead: home leaves the
    // frame, Alpha Centauri comes up, and the sail opens in its light.
    tl.label('freno').caption(6.0, 'Frenar con su luz', 'Al llegar no hay con qué frenar. Una vela más grande usa la luz de la estrella como freno.');
    luego(0.4, 3.6, { mira: 0 });
    luego(0.6, 0.8, { solN: 0 });
    luego(1.2, 1.4, { polvo: 1 });
    luego(1.4, 1.0, { eco: 0, solP: 0 });
    luego(1.0, 3.6, { lcen: 1.35, beta: 0.03 });
    luego(2.6, 2.4, { abre: 5, luzA: 1 });
    luego(3.0, 2.0, { polvo: 0 });
    tl.to(3.4, { az: -480, el: 18, ld: -0.5, fov: 50 });
    // (az a whole turn on from here: the same places, the camera never turning back)
    tl.to(2.6, { az: -578, el: 16, ld: -0.6, fov: 50 });

    // The reveal: out until both stars fit, the Sun drawn near (short), ours, with the route between
    // them; the names a moment; then back in to the sail, where something enormous passes.
    const enNaveW = (z: number) => V(0, 0, z).applyAxisAngle(V(0, 1, 0), 0.15).add(V(0.9, 0.1, 0.8));
    const proaC = enNaveW(0.5);
    const centroNave = enNaveW(0);
    const popaC = enNaveW(-0.5);
    // (three-quarters from ahead at the bow, the shield and the rings beyond; three-quarters from
    // behind at the stern, the drive and the rings ahead; turning the same way all along)
    const proa = { cx: proaC.x, cy: proaC.y, cz: proaC.z, az: -678, el: 20, ld: Math.log10(0.95) };
    const popa = { cx: popaC.x, cy: popaC.y, cz: popaC.z, az: -785, el: 12, ld: Math.log10(0.7) };
    const MEDIO = V(-1.5, -2.6, -29);
    tl.label('nave').caption(27.6, 'Naves que son mundos', 'El viaje dura siglos. Quien llega es nieto de los nietos de quien salió: alguien como tú, que nunca vio la Tierra.');
    tl.with(1.0, { beta: 0 });
    tl.with(3.6, { lsol: Math.log10(80) });
    luego(0.2, 4.2, { ld: Math.log10(150), el: 22, az: -624, fov: 34 });
    luego(1.8, 2.6, { cx: MEDIO.x, cy: MEDIO.y, cz: MEDIO.z });
    luego(2.6, 2.0, { mapa: 1 });
    luego(4.0, 1.4, { nombres: 1 });
    tl.wait(5.0);
    tl.to(3.2, { az: -630 });
    tl.with(1.0, { nombres: 0 });
    luego(0.4, 1.4, { mapa: 0 });
    luego(1.2, 4.0, { lsol: 4.2 });
    luego(0.4, 2.4, { cx: 0, cy: 0, cz: 0 });
    // The ship passes the sail, slowly: its shield, its turning rings, the lights along its spine.
    tl.with(1.6, { nave: 1 });
    tl.to(5.2, { nz: 0.6, cx: 0.9, cy: 0.1, cz: 0.2, az: -660, el: 10, ld: -0.35, fov: 40 });
    tl.to(2.4, { az: -678, el: 16, ld: -0.6 });
    // The spark jumps across to it and goes in through a ring's glass roof, to someone; the camera
    // flies down the ship, close: the shield at the bow, the rings turning past, the radiators
    // glowing with the heat of the life inside, the drive and its plume; then back, to see it whole
    // among the stars, where the galaxy takes over.
    luego(-0.4, 1.8, { salta: 1 });
    luego(1.6, 5.0, { adentro: 1 });
    tl.to(2.6, { ...proa, fov: 44 });
    tl.to(5.6, { ...popa });
    // (back to see it whole, from beside it: the galaxy takes over from here)
    tl.to(3.2, { fov: 40, cx: centroNave.x, cy: centroNave.y, cz: centroNave.z, az: -815, el: 14, ld: Math.log10(1.25) });
    // (and it fades there, before the galaxy takes over: still lit through the relay, it swept across
    // the frame as the camera turned to the galaxy's view)
    luego(-1.1, 1.1, { nave: 0 });

    /** The spark's way at beat p, ambient time t (see update), and how far along it is. */
    const rutaEn = (p: number, t: number) => {
      const dSol = Math.pow(10, tl.get('lsol', p));
      const casaP = V(S0.x * (dSol / 14), S0.y * (dSol / 14), -dSol);
      // (the ring turns by itself; towards the act's end the spark lets go of that turn, the short way
      // round, so the seam with the galaxy is the same picture whenever it is reached)
      const ag = t * GIRO_ANILLO;
      const suelta = THREE.MathUtils.smoothstep(p, tl.length - 2.0, tl.length - 0.3);
      const agCh = ag - suelta * (THREE.MathUtils.euclideanModulo(ag + Math.PI, Math.PI * 2) - Math.PI);
      const naveP = V(0.9, 0.1, 0.2 + tl.get('nz', p));
      const enAnillo = (ang: number, rr: number, out: THREE.Vector3, z = ANILLO) => out.set(Math.cos(ang + agCh) * rr, Math.sin(ang + agCh) * rr, z).applyAxisAngle(Yv, 0.15).add(naveP);
      const desde = casaP.clone().add(V(0, 0, 3.2));
      const enVela = V(0, 0, 0.004);
      const hub = enAnillo(A_ENTRA, 0.035, V(), ANILLO + 0.012);
      const arco = enVela.clone().lerp(hub, 0.5).add(V(0, 0.09, 0));
      const angIn = (w: number) => A_ENTRA + (A_TU - A_ENTRA) * THREE.MathUtils.smoothstep(w, 0.08, 1);
      const caminoCh: Camino = (sv, out) => {
        if (sv <= 1) return out.copy(desde).lerp(enVela, Math.max(0, sv) ** 0.5);
        if (sv <= 2) {
          const k = sv - 1;
          return out.copy(enVela).multiplyScalar((1 - k) * (1 - k)).addScaledVector(arco, 2 * (1 - k) * k).addScaledVector(hub, k * k);
        }
        const w = Math.min(1, sv - 2);
        const baja = THREE.MathUtils.smoothstep(w, 0, 0.32);
        const rr = 0.035 + (0.1222 - 0.035) * baja + (0.1279 - 0.1222) * THREE.MathUtils.smoothstep(w, 0.86, 1);
        return enAnillo(angIn(w), rr, out, ANILLO + 0.012 * (1 - baja));
      };
      const chS = Math.min(1, tl.get('chH', p)) + tl.get('salta', p) + tl.get('adentro', p);
      return { caminoCh, chS, ag, angIn, enVela, casaP };
    };
    // (the spark is lit the whole act)
    tl.keyAt(0, { on: 1 });
    // The shots (chasis/toma.ts): from the moved Sun down to the sail and along its beam, the sail
    // seen whole, out to Alpha Centauri, back, and into the ship's ring. (Where the spark rides the
    // ring it turns with the ring, by itself: the shot frames the ship, not the spark.)
    escribir(tl, TOMA_VELA);
    // The spark comes in where the Sun's act left it (the seam's picture: in this act's units, by the
    // moved Sun), and joins its own way within a beat and a half.
    const entra = V(3.098, -1.4195, -13.887).sub(rutaEn(0, 0).caminoCh(0, V()));
    const velV = V();
    const fwd = V(0, 0, 1);
    return {
      id: 'vela',
      tl,
      grupo: root as THREE.Group,
      listo,
      costura: 'mundo',
      cerca: 1e-5,
      lejos: 30000,
      film: { strength: 0.7, radius: 0.6, threshold: 0.55, exposure: 1.05 },
      presencias: ['haz', 'abre', 'luzA', 'polvo', 'nave', 'eco', 'ecoN', 'solN', 'solP', 'tu', 'mapa', 'nombres'],
      entrada: { pos: S0.clone(), escala: 1 },
      salida: { pos: V(0.9, 0.1, 0.8), escala: 0.05 * 3.5 },
      relevoMaxPx: 4,
      chispa(p, out, t) {
        const r = rutaEn(p, t);
        r.caminoCh(r.chS, out);
        if (p < 1.6) out.addScaledVector(entra, 1 - THREE.MathUtils.smoothstep(p, 0, 1.6));
        return true;
      },
      camara(p, ch, out) {
        plano(tl, p, ch, out);
      },
      escalera: false,
      cuenta(p) {
        const c: Cuenta = p < tl.at('nave') ? potencia(26.7, 'vela · ') : potencia(27.4);
        // How far we reach: the second star once the sail brakes there.
        const dos = tl.at('freno') + 3.4;
        c.alcance = p < dos ? '1 estrella' : '2 estrellas';
        c.nuevo = p >= dos ? 1 - THREE.MathUtils.smoothstep(p, dos, dos + 1.8) : 0;
        return c;
      },
      placa(g, f) {
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
        nombres(g, f, NOMBRE_ECO, tl.get('ecoN', f.p));
        nombres(g, f, NOMBRE_SOL, tl.get('solN', f.p));
      },
      // The years: the sail leaves, a fifth of the speed of light, twenty-odd years to arrive; the
      // ships that are worlds, centuries later.
      anio(p) {
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[0, 2135], [a('quinto'), 2137], [a('lenta'), 2145], [a('freno') + 3.4, 2160], [a('nave') + 10, 2165], [a('nave') + 13, 2400], [tl.length, 2500]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'IV · Estrellas vecinas', name: c.name, fact: c.fact } : null;
      },
      update(f: FrameActo) {
        const p = f.p;
        const t = f.time;
        const camera = f.camera;
        const r = rutaEn(p, t);
        const { caminoCh, chS, ag, enVela } = r;
        const lw = tl.get('lw', p);
        casa.position.copy(r.casaP);
        // The Sun falls behind and Alpha Centauri comes up ahead, both in logarithm.
        const dCen = Math.pow(10, tl.get('lcen', p));
        alfa.position.set(-3, 1.5, dCen);
        // (from home to the sail: the cylinder's +Y along it, its top at the sail)
        hazA.copy(casa.position).add(V(0, 0, 3.2));
        const dirH = hazB.clone().sub(hazA);
        const largoH = dirH.length();
        haz.position.copy(hazA).addScaledVector(dirH, 0.5);
        haz.quaternion.setFromUnitVectors(V(0, 1, 0), dirH.divideScalar(largoH));
        haz.scale.set(0.0025, largoH, 0.0025);
        const camC = camera.position.clone().sub(casa.position);
        sol.u.uBrillo.value = 2.2 * (1 - 0.86 * THREE.MathUtils.smoothstep(camC.length(), 2.6, 3.9));
        sol.update({ sol: V(1, 0, 0), camara: camC, focal: f.focal, dpr: f.dpr, tiempo: t, presencia: f.presencia });
        enjambre.u.uCam.value.copy(camC);
        const camA = camera.position.clone().sub(alfa.position);
        A.u.uBrillo.value = 2.6;
        B.u.uBrillo.value = 1.4;
        A.update({ sol: V(1, 0, 0), camara: camA.clone().divideScalar(1.22), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: f.presencia });
        B.update({ sol: V(1, 0, 0), camara: camA.clone().sub(B.group.position).divideScalar(0.86), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: f.presencia });
        // (at the very end both stars are far behind: not drawn, so the hand-over to the galaxy,
        // which rescales this world, never blows their glow up)
        const ultimo = p > tl.length - 1.0;
        alfa.visible = dCen < 20000 && !ultimo;
        casa.visible = !ultimo;

        // Aberration and Doppler for the sky: our speed along +Z, in view space.
        const beta = tl.get('beta', p);
        velV.copy(fwd).transformDirection(camera.matrixWorldInverse);
        cielo.u.uBeta.value = beta;
        cielo.u.uVelV.value.copy(velV);
        polvo.u.uPolvo.value = tl.get('polvo', p);
        polvo.u.uVel.value = 0.15 + beta * 4;
        polvoL.u.uPolvo.value = tl.get('polvo', p);
        polvoL.u.uVel.value = 0.15 + beta * 4;
        polvoL.u.uTime.value = t;
        velaG.scale.setScalar(0.02 * tl.get('abre', p));
        velaN.u.uSizeUnit.value = velaG.scale.x;
        velaN.u.uLuzA.value = tl.get('luzA', p);
        // From afar the sail is a speck, not a lamp.
        // (and once the spark has gone over to the ship, the sail falls behind, dimming)
        // (centuries later, when the ships come, the sail is long gone)
        velaN.u.uGain.value = Math.min(1, 2 / Math.max(1e-6, camera.position.length())) * (1 - THREE.MathUtils.smoothstep(p, tl.at('nave') - 0.4, tl.at('nave') + 1.6));
        hazU.uHaz.value = tl.get('haz', p);
        hazU.uTime.value = t;
        haz.visible = hazU.uHaz.value > 0.002;
        membrana.u.uLuz.value = 0.5 * tl.get('haz', p);
        membrana.u.uLuzA.value = 0.6 * tl.get('luzA', p);
        membrana.u.uGain.value = velaN.u.uGain.value;
        membrana.u.uTime.value = t;
        naveG.position.set(0.9, 0.1, 0.2 + tl.get('nz', p));
        // (the wake shorter inside the ring, where the way is short)
        // (its wake never reaches back through the sail: once on it, the beam behind is gone; and it
        // draws in as the spark comes to rest on it)
        // The messages home: the echo first, then one every CADA beats, all leaving the sail at the
        // same pace along the way home (its distance from the sail is the echo's `s`), born at the
        // chip and getting smaller as they go, like the pulses after it.
        const haciaCasa = casa.position.clone().sub(enVela).normalize();
        const caminoEco: Camino = (sv, out) => out.copy(enVela).addScaledVector(haciaCasa, Math.max(0, sv));
        const msgOn = tl.get('eco', p) * (1 - tl.get('salta', p));
        const sale = (i: number) => tl.at('lenta') + ECO_SALE + i * CADA;
        const nace = (i: number) => THREE.MathUtils.smoothstep(p - sale(i), 0, 0.15);
        eco.update(caminoEco, VEL_MSG * Math.max(0, p - sale(0)), 0.002, msgOn * nace(0), 0, camera.position, f.focal, f.dpr, f.time);
        eco.nube.u.uSizeUnit.value *= THREE.MathUtils.clamp(REF_MSG / Math.max(1e-9, camera.position.distanceTo(eco.pos)), 0.45, 1);
        pulsos.poner(
          (i, out) => caminoEco(VEL_MSG * Math.max(0, p - sale(i + 1)), out),
          (i) => msgOn * nace(i + 1),
          f.dpr,
        );
        pulsos.nube.points.visible = msgOn > 0.001;
        // Home, a warm point far off (its own disc is far below a pixel there).
        solLejos.u.uPx.value = f.dpr;
        solLejos.u.uGain.value = tl.get('solP', p);
        solLejos.points.visible = solLejos.u.uGain.value > 0.001;
        naveG.scale.setScalar(1);
        naveG.rotation.y = 0.15;
        nave.u.uNave.value = tl.get('nave', p);
        naveM.update(tl.get('nave', p), t);
        const dentroR = lw * THREE.MathUtils.smoothstep(chS, 2.2, 2.4) * (1 - 0.8 * tl.get('sube', p));
        for (const [k, a] of anillos.entries()) a.update(tl.get('nave', p), ag, RINGS[k] === ANILLO ? dentroR : 0);
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.25 * Math.sin(t * 1.5)) * tl.get('nave', p);
        tu.points.rotation.z = t * GIRO_ANILLO;
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        const mapa = tl.get('mapa', p);
        enfocarMarcas(aroSol, f.dpr, mapa);
        enfocarMarcas(aroAlfa, f.dpr, mapa);
        ruta.u.uOn.value = mapa;
        ruta.u.uA.value.copy(casa.position).add(V(0, 0, 3.6));
        ruta.u.uB.value.copy(alfa.position).add(V(0, 0, -1.6));
        medio.copy(ruta.u.uA.value).lerp(ruta.u.uB.value, 0.5);
        cielo.u.uMaxPx.value = 2.6 * f.dpr;
        polvo.u.uMaxPx.value = 3 * f.dpr;
      },
    };
  },
};
