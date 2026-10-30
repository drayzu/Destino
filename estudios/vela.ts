import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { sol as solH } from '../src/horizontes';
import { TEAL, potencia, puntoTu, anioEn } from './remake';
import { aplicarToma, toma } from './rig';
import { crearChispa, montar, type Camino } from './chispa';
import { LEJOS, enjambreNube } from './mercurio';
import { angulos } from './rig';
import { enfocarMarcas, marcas, nombres, trazo, type Nombre } from './revelar';
import type { Cuenta, Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';
import { crearAnillo } from './cilindro';
import { crearNaveMalla } from './nave';

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
        float c = abs(dot(n, normalize(-vV)));
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
const ANILLO = 0.1;
const GIRO_ANILLO = 0.05;
const RINGS = [-0.3, -0.1, ANILLO, 0.3];

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

export const vela: Escena = {
  id: 'vela',
  nombre: 'IV · La vela y la nave',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'El láser empuja la vela; a un quinto de la luz el cielo se deforma; frena con la luz de Alfa Centauri; pasa una nave que es un mundo.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.55;
    stage.renderer.toneMappingExposure = 1.05;

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
      { pos: alfa.position, texto: 'Alfa Centauri', nuestro: true, aire: 8 },
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
    // The beam that pushes it, from the swarm.
    const hazB = materiaBuilder(199);
    for (let i = 0; i < 12000; i++) hazB.push(gauss(hazB.r) * 0.004, gauss(hazB.r) * 0.004, hazB.r(), TEAL, 0.004, 0.5, { kind: hazB.r() });
    const haz = add(
      materia(hazB.data(), {
        pre: /* glsl */ `uniform vec3 uDesde; uniform float uHaz;`,
        move: /* glsl */ `
          p = mix(uDesde, vec3(0.0, 0.0, -0.002), position.z) + vec3(position.xy * (1.0 + 30.0 * (1.0 - position.z)), 0.0);
          em *= uHaz * (0.4 + 0.6 * smoothstep(0.86, 1.0, fract(position.z * 6.0 - uTime * 2.0)));
        `,
        uniforms: { uDesde: { value: S0.clone() }, uHaz: { value: 0 } },
      }),
      root,
      4,
    );
    haz.u.uFuente.value = 0.5;
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
    // The ship as surfaces (spine, spokes, shield, radiators, drive); its points no longer drawn.
    nave.points.visible = false;
    const naveM = crearNaveMalla(RINGS, 0.13);
    naveG.add(naveM.grupo);
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
    const chispa = crearChispa();
    root.add(chispa.nube.points);
    const eco = crearChispa();
    root.add(eco.nube.points);
    // The echo home, named while it goes.
    const NOMBRE_ECO: Nombre[] = [{ pos: eco.pos, texto: 'Mensaje a casa · llega en 4 años y medio', nuestro: true, aire: 6 }];

    const listo = Promise.all([sol.listo, A.listo, B.listo]);

    // ---------------------------------------------------------------- the moments (GUION.md 32–35)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    // Where the Sun's scene leaves the camera (sol.ts, «tipo»): relative to the Sun, here S0.
    tl.set({ cx: S0.x, cy: S0.y, cz: S0.z, ox: 0, oy: 0, oz: 0, az: angulos(LEJOS).az + 150, el: 30, ld: 2.2, yaw: 90, pitch: -90, roll: 0, fov: 34, haz: 0, lsol: Math.log10(14), lcen: 4.5, beta: 0, polvo: 0, abre: 1, luzA: 0, nave: 0, tu: 0, nz: -3, eco: 0, ecoS: 0, chH: 0, salta: 0, mapa: 0, nombres: 0, ecoN: 0, lw: 0, adentro: 0, sube: 0 });

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

    // The wall: light is slow. An echo goes home, so slowly the camera slows with it.
    tl.label('lenta').caption(6.0, 'La luz es lenta', 'Cada mensaje a casa tarda más de cuatro años. Allá solo saben de nosotros lo que fuimos.');
    tl.with(0.8, { eco: 1 });
    tl.with(6.0, { ecoS: 1 });
    luego(1.6, 1.2, { ecoN: 1 });
    luego(5.2, 1.0, { ecoN: 0 });
    tl.to(6.0, { az: -200, el: 12, ld: -0.42, fov: 46 });

    tl.label('freno').caption(6.0, 'Frenar con su luz', 'Al llegar no hay con qué frenar. Una vela más grande usa la luz de la estrella como freno.');
    tl.with(3.6, { lcen: 1.35, beta: 0.03 });
    luego(1.4, 2.4, { abre: 5, luzA: 1 });
    luego(3.0, 2.0, { polvo: 0 });
    tl.to(6.0, { az: -218, el: 16, ld: -0.6, fov: 50 });

    // The reveal: out until both stars fit, the Sun drawn near (short), ours, with the route between
    // them; the names a moment; then back in to the sail, where something enormous passes.
    const enNaveW = (z: number) => V(0, 0, z).applyAxisAngle(V(0, 1, 0), 0.15).add(V(0.9, 0.1, 0.8));
    const proaC = enNaveW(0.42);
    const centroNave = enNaveW(0);
    const popaC = enNaveW(-0.5);
    // (three-quarters from ahead at the bow, the shield and the rings beyond; three-quarters from
    // behind at the stern, the drive and the rings ahead; turning the same way all along)
    const proa = { cx: proaC.x, cy: proaC.y, cz: proaC.z, az: -318, el: 20, ld: Math.log10(0.95) };
    const popa = { cx: popaC.x, cy: popaC.y, cz: popaC.z, az: -425, el: 12, ld: Math.log10(0.7) };
    const MEDIO = V(-1.5, -2.6, -29);
    tl.label('nave').caption(27.6, 'Naves que son mundos', 'El viaje dura siglos. Quien llega es nieto de los nietos de quien salió: alguien como tú, que nunca vio la Tierra.');
    tl.with(1.0, { beta: 0 });
    tl.with(3.6, { lsol: Math.log10(80) });
    luego(0.2, 4.2, { ld: Math.log10(150), el: 22, az: -264, fov: 34 });
    luego(1.8, 2.6, { cx: MEDIO.x, cy: MEDIO.y, cz: MEDIO.z });
    luego(2.6, 2.0, { mapa: 1 });
    luego(4.0, 1.4, { nombres: 1 });
    tl.wait(5.0);
    tl.to(3.2, { az: -270 });
    tl.with(1.0, { nombres: 0 });
    luego(0.4, 1.4, { mapa: 0 });
    luego(1.2, 4.0, { lsol: 4.2 });
    luego(0.4, 2.4, { cx: 0, cy: 0, cz: 0 });
    // The ship passes the sail, slowly: its shield, its turning rings, the lights along its spine.
    tl.with(1.6, { nave: 1 });
    tl.to(5.2, { nz: 0.6, cx: 0.9, cy: 0.1, cz: 0.2, az: -300, el: 10, ld: -0.35, fov: 40 });
    tl.to(2.4, { az: -318, el: 16, ld: -0.6 });
    // The spark jumps across to it and goes in through a ring's glass roof, to someone; the camera
    // flies down the ship, close: the shield at the bow, the rings turning past, the radiators
    // glowing with the heat of the life inside, the drive and its plume; then back, to see it whole
    // among the stars, where the galaxy takes over.
    luego(-0.4, 1.8, { salta: 1 });
    luego(1.6, 5.0, { adentro: 1 });
    tl.to(2.6, { ...proa, fov: 44 });
    tl.to(5.6, { ...popa });
    // (back to see it whole, from beside it: the galaxy takes over from here)
    tl.to(3.2, { fov: 40, cx: centroNave.x, cy: centroNave.y, cz: centroNave.z, az: -455, el: 14, ld: Math.log10(1.25) });

    const tm = toma(tl, 0);
    const velV = V();
    const fwd = V(0, 0, 1);
    return {
      tl,
      listo,
      entrada: { pos: S0.clone(), escala: 1 },
      salida: { pos: V(0.9, 0.1, 0.8), escala: 0.05 * 3.5 },
      relevoMaxPx: 4,
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
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-5;
        camera.far = 30000;
        // (where home is now: the Sun falls behind in logarithm)
        const dSol = Math.pow(10, tl.get('lsol', p));
        casa.position.set(S0.x * (dSol / 14), S0.y * (dSol / 14), -dSol);
        // The spark's way (GUION.md v2, 32–35): along the beam into the sail (0..1); across to the
        // ship's spine (1..2); then into the ring (2..3): in among its spokes, down through its glass
        // roof, low over the land to «tú». Inside, everything turns with the ring.
        const ag = t * GIRO_ANILLO;
        const naveP = V(0.9, 0.1, 0.2 + tl.get('nz', p));
        const enAnillo = (ang: number, rr: number, out: THREE.Vector3, z = ANILLO) => out.set(Math.cos(ang + ag) * rr, Math.sin(ang + ag) * rr, z).applyAxisAngle(Yv, 0.15).add(naveP);
        const desde = casa.position.clone().add(V(0, 0, 3.2));
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
        const lw = tl.get('lw', p);
        if (lw > 0.0005) {
          // Riding it: «up» is the ship's way while it jumps, then towards the spine inside the ring
          // (away from the land below); at the end the camera lifts towards the spine, looking down.
          const kIn = THREE.MathUtils.smoothstep(chS, 1.85, 2.3);
          const radial = V(Math.cos(angIn(Math.max(0, chS - 2)) + ag), Math.sin(angIn(Math.max(0, chS - 2)) + ag), 0).applyAxisAngle(Yv, 0.15);
          const arriba = Yv.clone().lerp(radial.clone().negate(), kIn).normalize();
          // (inside, looking well ahead, where the land rises; high enough to see it as land)
          const alto = THREE.MathUtils.lerp(0.012, 0.0075, kIn) + 0.006 * THREE.MathUtils.smoothstep(chS, 2.84, 3) + 0.07 * tl.get('sube', p);
          const m = montar(caminoCh, chS, 0.05, THREE.MathUtils.lerp(0.12, 0.5, kIn), alto, arriba, 0.035, false, 0.05);
          aplicarToma(camera, toma(tl, p, tm, { punto: m.mira, peso: lw, arriba: m.arriba, delante: m.delante }, { punto: m.lugar, peso: lw }));
        } else aplicarToma(camera, toma(tl, p, tm));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        // The Sun falls behind and Alpha Centauri comes up ahead, both in logarithm.
        const dCen = Math.pow(10, tl.get('lcen', p));
        alfa.position.set(-3, 1.5, dCen);
        haz.u.uDesde.value.copy(casa.position).add(V(0, 0, 3.2));
        const camC = camera.position.clone().sub(casa.position);
        sol.u.uBrillo.value = 2.2 * (1 - 0.86 * THREE.MathUtils.smoothstep(camC.length(), 2.6, 3.9));
        sol.update({ sol: V(1, 0, 0), camara: camC, focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        enjambre.u.uCam.value.copy(camC);
        const camA = camera.position.clone().sub(alfa.position);
        A.u.uBrillo.value = 2.6;
        B.u.uBrillo.value = 1.4;
        A.update({ sol: V(1, 0, 0), camara: camA.clone().divideScalar(1.22), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        B.update({ sol: V(1, 0, 0), camara: camA.clone().sub(B.group.position).divideScalar(0.86), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
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
        haz.u.uHaz.value = tl.get('haz', p);
        membrana.u.uLuz.value = 0.5 * tl.get('haz', p);
        membrana.u.uLuzA.value = 0.6 * tl.get('luzA', p);
        membrana.u.uGain.value = velaN.u.uGain.value;
        membrana.u.uTime.value = t;
        naveG.position.set(0.9, 0.1, 0.2 + tl.get('nz', p));
        // (the wake shorter inside the ring, where the way is short)
        // (its wake never reaches back through the sail: once on it, the beam behind is gone; and it
        // draws in as the spark comes to rest on it)
        const piso = chS >= 1 ? 1 : 0;
        const cola: Camino = (sv, out) => caminoCh(Math.max(sv, piso), out);
        const pasoCola = chS > 2 ? 0.0012 : chS < 1 ? 0.004 * THREE.MathUtils.clamp((1 - chS) / 0.15, 0.12, 1) : 0.004;
        chispa.update(cola, chS, pasoCola, 1, 0, camera.position, f.focal, f.dpr, f.time);
        // The echo home: from the sail back towards the Sun, slow.
        // (slow, and in sight: it crawls back towards home while the camera watches from the side)
        const haciaCasa = casa.position.clone().sub(enVela).normalize();
        const caminoEco: Camino = (sv, out) => out.copy(enVela).addScaledVector(haciaCasa, 0.13 * Math.max(0, sv));
        eco.update(caminoEco, tl.get('ecoS', p), 0.002, tl.get('eco', p) * (1 - tl.get('salta', p)), 0, camera.position, f.focal, f.dpr, f.time);
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
      dispose() {},
    };
  },
};
