import { logDepth } from './motor/logdepth';
import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { luna as lunaH, marte as marteH, mercurio as mercurioH, sol as solH, tierra as tierraH, venus as venusH } from '../src/horizontes';
import { HORIZONTE, TEAL, caraHacia, dirLatLon, potencia, anioEn } from './remake';
import { angulos, aplicarToma, toma } from './rig';
import { crearChispa, type Camino } from './chispa';
import { CARA, SOL as SOL_TIERRA } from './tierra';
import { CIUDAD, COLOR, DIR_CIUDAD, E, FIN_RIEL_LUNA, LUNA, M, MA, N_LUNA, RE, RL, RM, RMA, RV, SOL_V, U_LUNA, VE, enOrbita, enRielLuna } from './interior';
import { DIR7, suelo, vueloInterior } from './vuelo';
import { enfocarMarcas, marcas, nombres, orbitas, type Nombre } from './revelar';
import type { Cuenta, Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scenes 8–10 of ESCALETA.md: the Solar System at work (GUION.md, moments 20–24), in the same frame
 * as Mercury's scene (solar radii, the Sun at the origin, distances drawn short), so the Earth hands
 * over to it and it hands Mercury over without a cut.
 *
 * One flight that never stops: from the Earth down onto the Moon's launcher and out on its stream of
 * rock towards Mars; once round Mars, under the ring of mirrors at its south pole; across to Venus
 * and round behind it, where the parasol hides the Sun, skimming a city on its limb; and on to
 * Mercury while the camera draws back to the whole inner system at work, all at once.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const D2R = THREE.MathUtils.degToRad;

/**
 * Mars' mirrors: a ring of them under its south pole, the cone of light they send down onto the
 * pole, the pole warming where it lands, and domes of light on its ground. Mars radii.
 * `aKind`: 0 mirror, 1 light, 2 dome, 3 the warm pole.
 */
function marteDatos(): MateriaData {
  const b = materiaBuilder(137);
  const r = b.r;
  for (let i = 0; i < 2600; i++) {
    const fi = r() * Math.PI * 2;
    const q = 0.9 + gauss(r) * 0.012;
    b.push(Math.cos(fi) * q, -1.7 + gauss(r) * 0.006, Math.sin(fi) * q, new THREE.Color(1.0, 0.96, 0.88), 0.006, 0.7, { kind: 0 });
  }
  for (let i = 0; i < 5000; i++) {
    const lat = -90 + Math.sqrt(r()) * 24;
    const c = dirLatLon(lat, r() * 360);
    b.push(c.x * 1.004, c.y * 1.004, c.z * 1.004, new THREE.Color(1.0, 0.55, 0.28), 0.006, 0.12 * (1 - (lat + 90) / 26), { kind: 3 });
  }
  for (let d = 0; d < 46; d++) {
    const c = dirLatLon(-40 + r() * 75, 20 + r() * 150);
    const t1 = Y.clone().cross(c).normalize();
    const t2 = c.clone().cross(t1);
    const rad = 0.025 + r() * 0.025;
    for (let i = 0; i < 300; i++) {
      const [x, y, z] = b.onSphere();
      const h = Math.abs(y);
      const p = c.clone().multiplyScalar(1.002 + h * rad * 0.8).addScaledVector(t1, x * rad).addScaledVector(t2, z * rad);
      b.push(p.x, p.y, p.z, TEAL, 0.0025, 0.4, { kind: 2 });
    }
  }
  return b.data();
}

/**
 * Mars warmed (its own units, radius 1): the light the ring of mirrors sends up onto its south pole,
 * a beam of light rather than points, shimmering upwards; and its air thickening, a glow round its
 * limb that grows (`uAire`).
 */
function marteLuz() {
  const haz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.9, 0.73, 96, 1, true),
    new THREE.ShaderMaterial({
      uniforms: { uMar: { value: 0 }, uTime: { value: 0 }, uFundido: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec3 vL;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vL = position;
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uMar, uTime, uFundido;
        varying vec3 vL;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float h = (vL.y + 0.365) / 0.73;
          float rim = 1.0 - abs(dot(normalize(vN), normalize(-vV)));
          // (rays, one from each group of mirrors up to the pole, light running up them)
          float ang = atan(vL.z, vL.x);
          float rayo = pow(0.5 + 0.5 * cos(ang * 23.0), 10.0) + 0.6 * pow(0.5 + 0.5 * cos(ang * 41.0 + 1.3), 16.0);
          float subir = 0.65 + 0.35 * sin(h * 14.0 - uTime * 3.0 + ang * 3.0);
          // (from close by, or from inside it, the beam is only a glow: no walls)
          float lejos = smoothstep(0.06, 0.4, length(vV));
          // (faint where it leaves the mirrors, gathering as it nears the pole)
          float luz = (0.025 + 0.5 * rayo * subir) * (0.15 + 0.85 * h * h) * (0.7 + 0.3 * rim) * smoothstep(0.0, 0.12, h) * lejos;
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * luz * 0.7 * uMar * uFundido, 0.0);
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
  haz.position.y = -1.335;
  haz.renderOrder = 6;
  const aire = new THREE.Mesh(
    new THREE.SphereGeometry(1.07, 96, 48),
    logDepth(new THREE.ShaderMaterial({
      uniforms: { uAire: { value: 0 }, uFundido: { value: 1 }, uSol: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        varying vec3 vW;
        varying vec3 vC;
        varying float vR;
        void main() {
          vN = normalize(normalMatrix * normal);
          vW = normalize(position);
          vC = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vR = length(modelViewMatrix[0].xyz);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAire, uFundido;
        uniform vec3 uSol;
        varying vec3 vN;
        varying vec3 vV;
        varying vec3 vW;
        varying vec3 vC;
        varying float vR;
        void main() {
          // (how close the line of sight passes to Mars' centre, in its radii: the haze is thickest
          // just over the limb and thins out above it, a thin veil over the disc)
          vec3 ray = normalize(vV);
          float b = length(vC - ray * dot(vC, ray)) / vR;
          float g = b > 1.0 ? exp(-(b - 1.0) / 0.018) : 0.5 * exp(-(1.0 - b) / 0.02);
          float dia = 0.3 + 0.7 * smoothstep(-0.3, 0.6, dot(vW, uSol));
          vec3 col = mix(vec3(1.0, 0.56, 0.42), vec3(0.95, 0.72, 0.85), smoothstep(1.0, 1.04, b));
          gl_FragColor = vec4(col * g * dia * 1.1 * uAire * uFundido, 0.0);
        }
      `,
      side: THREE.FrontSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    })),
  );
  aire.renderOrder = 5;
  return { haz, aire };
}

/** Venus' cloud tops, the cities floating in them and the shade between it and the Sun. Venus radii, the Sun towards `sol`. */
function venusDatos(sol: THREE.Vector3): MateriaData {
  const b = materiaBuilder(139);
  const r = b.r;
  for (let i = 0; i < 150000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 1.012 + r() * 0.035;
    b.push(x * q, y * q, z * q, new THREE.Color(0.95, 0.84, 0.56), 0.0009, 0.025 + r() * 0.05, { kind: 0 });
  }
  // The cities: discs of light floating on the cloud tops, sunward (in the parasol's shade); the
  // first is the spark's.
  const ciudades = [DIR_CIUDAD.clone()];
  // (round the limb as seen from behind, where the camera passes)
  while (ciudades.length < 34) {
    const c = V(gauss(r), gauss(r) * 0.7, gauss(r)).normalize();
    const k = c.dot(sol);
    if (k > -0.45 && k < 0.35) ciudades.push(c);
  }
  for (const [k, c] of ciudades.entries()) {
    const t1 = Y.clone().cross(c).normalize();
    const t2 = c.clone().cross(t1);
    const rad = k === 0 ? 0.022 : 0.01 + r() * 0.012;
    const n = k === 0 ? 900 : 360;
    for (let i = 0; i < n; i++) {
      const q = Math.sqrt(r());
      const fi = r() * Math.PI * 2;
      const p = c.clone().multiplyScalar(1.055 + gauss(r) * 0.0012).addScaledVector(t1, Math.cos(fi) * q * rad).addScaledVector(t2, Math.sin(fi) * q * rad);
      b.push(p.x, p.y, p.z, q < 0.35 ? new THREE.Color(0.85, 1.0, 0.95) : TEAL, 0.0008, 0.55, { kind: 1 });
    }
  }
  const t1 = Y.clone().cross(sol).normalize();
  const t2 = sol.clone().cross(t1);
  // The parasol's rim, ours (teal), between Venus and the Sun (its film is a membrane: parasolMalla).
  for (let i = 0; i < 6000; i++) {
    const borde = true;
    const q = borde ? 1.3 + gauss(r) * 0.006 : Math.sqrt(r()) * 1.3;
    const fi = r() * Math.PI * 2;
    const p = sol.clone().multiplyScalar(2.2).addScaledVector(t1, Math.cos(fi) * q).addScaledVector(t2, Math.sin(fi) * q);
    b.push(p.x, p.y, p.z, borde ? TEAL : new THREE.Color(0.7, 0.85, 0.9), borde ? 0.004 : 0.006, borde ? 0.32 : 0.05, { kind: 2 });
  }
  return b.data();
}

/**
 * The parasol as a membrane (Venus' own units: Venus is 1, the Sun along `sol`): a disc 1.3 across
 * at 2.2 towards the Sun. Its sunward face shines with the light it turns away (rings and struts);
 * its face towards Venus is dark.
 */
function parasolMalla(sol: THREE.Vector3) {
  // (a little wider than the parasol: round it, seen from behind, the Sun's glow it hides)
  const g = new THREE.CircleGeometry(1.3 * 1.5, 160);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), sol));
  g.translate(sol.x * 2.2, sol.y * 2.2, sol.z * 2.2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uFundido: { value: 1 }, uSol: { value: sol.clone() }, uOcc: { value: new THREE.Vector4() }, uDetras: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vL;
      varying vec3 vV;
      void main() {
        vL = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOn, uFundido, uDetras;
      uniform vec3 uSol;
      uniform vec4 uOcc;
      varying vec3 vL;
      varying vec3 vV;
      float raya(float x, float w) {
        float d = abs(fract(x + 0.5) - 0.5);
        float fw = max(fwidth(x), 1e-6);
        return 1.0 - smoothstep(w - fw, w + fw, d);
      }
      void main() {
        // Behind Venus (seen from its far side): hidden by it.
        vec3 ray = normalize(vV);
        float tt = dot(uOcc.xyz, ray);
        if (uOcc.w > 0.0 && tt > 0.0 && length(vV) > tt && length(uOcc.xyz - ray * tt) < uOcc.w) discard;
        vec3 c = vL - uSol * 2.2;
        float r = length(c) / 1.3;
        vec3 t1 = normalize(cross(uSol, vec3(0.0, 1.0, 0.0)));
        vec3 t2 = cross(uSol, t1);
        float fi = atan(dot(c, t2), dot(c, t1));
        if (r > 1.0) {
          // Beyond the rim: the corona of the hidden Sun, only from behind.
          float halo = exp(-(r - 1.0) * 7.0) * uDetras * (gl_FrontFacing ? 0.0 : 1.0);
          gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * halo * 0.55 * uOn * uFundido, 0.0);
          return;
        }
        float aros = raya(r * 9.0, 0.04);
        float varas = raya(fi / 6.2831853 * 16.0, 0.02);
        vec3 col;
        float a;
        if (gl_FrontFacing) {
          // Facing the Sun: the light it turns away, warm.
          col = vec3(1.0, 0.86, 0.6) * (0.16 + 0.08 * (1.0 - r)) + vec3(1.0, 0.92, 0.75) * (aros * 0.12 + varas * 0.1);
          a = 0.9;
        } else {
          // Facing Venus: its shadow side, dark; the struts barely there.
          // (near black: a shade, its struts barely there)
          col = vec3(0.006, 0.007, 0.009) + vec3(0.3, 0.34, 0.38) * (aros * 0.025 + varas * 0.025);
          // (its rim lit from behind by the Sun it hides)
          col += vec3(1.0, 0.78, 0.5) * smoothstep(0.93, 1.0, r) * uDetras * 0.9;
          a = 0.94;
        }
        gl_FragColor = vec4(col * uOn * uFundido, a * uOn * uFundido);
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
  const m = new THREE.Mesh(g, mat);
  // (after the Sun, so it covers it: from behind, an eclipse)
  m.renderOrder = 45;
  m.frustumCulled = false;
  return { mesh: m, u: mat.uniforms };
}

/**
 * Sunlight on its way to Venus (Venus' units), as a fine rain of light flowing from the Sun: what
 * meets the parasol stops there, so behind it a cylinder of shadow reaches down to Venus; the rest
 * goes past, or ends on Venus' clouds. `aOff`: where across the beam; `aKind`: its phase.
 */
function luzVenusDatos() {
  const b = materiaBuilder(141);
  const off: number[] = [];
  // (each grain a short streak: a few points one behind the other)
  for (let i = 0; i < 9000; i++) {
    // (a thick sheet through the axis, edge-on to the side the camera looks from: there the
    // parasol's shadow shows as a dark band down to Venus)
    const fase = b.r();
    const anillo = i % 3 === 0;
    const ang = b.r() * Math.PI * 2;
    const q = 1.34 + Math.pow(b.r(), 1.6) * 1.3;
    const x = anillo ? Math.cos(ang) * q : gauss(b.r) * 0.28;
    const y = anillo ? Math.sin(ang) * q : (b.r() * 2 - 1) * 2.6;
    const luz = 0.3 + 0.3 * b.r();
    for (let k = 0; k < 4; k++) {
      b.push(0, 0, 0, new THREE.Color(1.0, 0.9, 0.7), 0.008, luz * (1 - k * 0.22), { kind: fase - k * 0.0035 });
      off.push(x, y);
    }
  }
  return { data: b.data(), off: new Float32Array(off) };
}

/** The asteroid belt, with the sparks of its mines; and the first glints of a swarm by the Sun. */
function cinturonDatos(): MateriaData {
  const b = materiaBuilder(149);
  const r = b.r;
  for (let i = 0; i < 46000; i++) {
    const fi = r() * Math.PI * 2;
    const q = 60 + r() * 10;
    const mina = r() < 0.025;
    b.push(Math.sin(fi) * q, gauss(r) * 0.7, Math.cos(fi) * q, mina ? TEAL : new THREE.Color(0.6, 0.56, 0.5), 0.03, mina ? 1.2 : 0.32, { kind: mina ? 1 : 0 });
  }
  for (let i = 0; i < 6000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 2.6 + r() * 0.8;
    b.push(x * q, y * q, z * q, new THREE.Color(0.9, 0.97, 1.0), 0.01, 0.8, { kind: 2 });
  }
  return b.data();
}

export const sistema: Escena = {
  id: 'sistema',
  nombre: 'III · El sistema solar trabaja',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'Un vuelo sin pausas: la Luna y su lanzador, una vuelta a Marte, Venus por detrás y, al revelar, todo lo nuestro.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.5;
    stage.renderer.toneMappingExposure = 1.05;
    const base = `${import.meta.env.BASE_URL}texturas/`;

    // (the same Sun as Mercury's act draws: the flight goes on into it without its look changing)
    const sol = solH({ puntos: 320000, corona: 160000 });
    root.add(sol.group);
    sol.u.uBrillo.value = 2.2;
    const tierra = tierraH(base, { giro: 0, puntos: 260000 });
    const tierraG = new THREE.Group();
    tierraG.position.copy(E);
    tierraG.scale.setScalar(RE);
    tierraG.quaternion.copy(caraHacia(CARA.lat, CARA.lon));
    tierraG.add(tierra.group);
    root.add(tierraG);
    const luna = lunaH(base, { giro: 0, puntos: 180000 });
    luna.group.position.copy(LUNA);
    luna.group.scale.setScalar(0.1);
    root.add(luna.group);
    const marte = marteH(base, { giro: 0, puntos: 200000 });
    const marteG = new THREE.Group();
    marteG.position.copy(MA);
    marteG.scale.setScalar(RMA);
    marteG.add(marte.group);
    root.add(marteG);
    const venus = venusH(base, { giro: 0, puntos: 160000 });
    const venusG = new THREE.Group();
    venusG.position.copy(VE);
    venusG.scale.setScalar(RV);
    venusG.add(venus.group);
    root.add(venusG);
    const merc = mercurioH(base, { giro: 0, puntos: 160000 });
    merc.group.position.copy(M);
    merc.group.scale.setScalar(RM);
    root.add(merc.group);
    const cuerpos = [
      { c: tierra, g: tierraG, R: RE, q: tierraG.quaternion },
      { c: luna, g: luna.group, R: 0.1, q: new THREE.Quaternion() },
      { c: marte, g: marteG, R: RMA, q: new THREE.Quaternion() },
      { c: venus, g: venusG, R: RV, q: new THREE.Quaternion() },
      { c: merc, g: merc.group, R: RM, q: new THREE.Quaternion() },
    ];

    const nubes: Nube[] = [];
    const OCULTAN = [
      { pos: E, R: RE },
      { pos: LUNA, R: 0.1 },
      { pos: MA, R: RMA },
      { pos: VE, R: RV },
      { pos: M, R: RM },
    ];
    const add = (n: Nube, parent: THREE.Object3D = root) => {
      n.u.uSpread.value = 0;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };

    // The Earth's ring (type I), as scene 7 left it.
    const anilloB = materiaBuilder(151);
    for (let i = 0; i < 26000; i++) {
      const a = anilloB.r() * Math.PI * 2;
      const R = 6.6 + gauss(anilloB.r) * 0.05;
      anilloB.push(Math.cos(a) * R, gauss(anilloB.r) * 0.012, -Math.sin(a) * R, TEAL, 0.004, 0.35);
    }
    const anillo = add(materia(anilloB.data()), tierraG);
    anillo.u.uFuente.value = 0.35;


    const marteN = add(
      materia(marteDatos(), {
        pre: /* glsl */ `uniform float uMar; uniform vec3 uCamL; ${HORIZONTE}`,
        move: /* glsl */ `
          if (aKind < 0.5) em *= 0.7 + 1.4 * pow(max(0.0, sin(uTime * 1.3 + seed * 30.0)), 16.0);
          if (aKind > 1.5) em *= delante(p, uCamL);
          em *= uMar;
        `,
        uniforms: { uMar: { value: 0 }, uCamL: { value: V() } },
      }),
      marteG,
    );
    marteN.u.uFuente.value = 0.5;
    const mLuz = marteLuz();
    marteG.add(mLuz.haz, mLuz.aire);
    mLuz.aire.material.uniforms.uSol.value.copy(MA).negate().normalize();
    const solVenus = VE.clone().negate().normalize();
    const venusN = add(
      materia(venusDatos(solVenus), {
        pre: /* glsl */ `uniform float uVen, uSombra; uniform vec3 uCamL; ${HORIZONTE}`,
        move: /* glsl */ `
          if (aKind < 1.5) {
            float ag = uTime * 0.02 * (1.0 + 0.4 * p.y);
            p.xz = vec2(cos(ag) * p.x - sin(ag) * p.z, sin(ag) * p.x + cos(ag) * p.z);
            em *= delante(p, uCamL);
            em *= uVen;
          } else {
            em *= uSombra;
          }
        `,
        uniforms: { uVen: { value: 0 }, uSombra: { value: 0 }, uCamL: { value: V() } },
      }),
      venusG,
    );
    venusN.u.uFuente.value = 0.4;
    const parasol = parasolMalla(solVenus);
    venusG.add(parasol.mesh);
    const lv = luzVenusDatos();
    const luzVenus = add(
      materia(lv.data, {
        pre: /* glsl */ `attribute vec2 aOff; uniform vec3 uSol, uT1, uT2; uniform float uLuz, uSombra;`,
        move: /* glsl */ `
          // Down the beam from the Sun's side, each grain a short streak of its phase.
          float fase = fract(aKind + uTime * 0.09);
          float a = 6.0 - fase * 9.0;
          p = uSol * a + uT1 * aOff.x + uT2 * aOff.y;
          float rr = length(aOff);
          // Stopped by the parasol (behind it, its shadow); ended on Venus.
          float tapa = uSombra * step(rr, 1.3) * step(a, 2.2);
          float hunde = step(rr, 1.0) * step(a, sqrt(max(0.0, 1.0 - rr * rr)));
          em *= uLuz * (1.0 - tapa) * (1.0 - hunde) * smoothstep(0.0, 0.1, fase) * (1.0 - smoothstep(0.85, 1.0, fase));
        `,
        uniforms: { uSol: { value: solVenus.clone() }, uT1: { value: Y.clone().cross(solVenus).normalize() }, uT2: { value: solVenus.clone().cross(Y.clone().cross(solVenus).normalize()) }, uLuz: { value: 0 }, uSombra: { value: 0 } },
        extra: { aOff: [lv.off, 2] },
      }),
      venusG,
    );
    luzVenus.u.uFuente.value = 0.4;
    const cinturon = add(
      materia(cinturonDatos(), {
        pre: /* glsl */ `uniform float uTodo;`,
        move: /* glsl */ `
          if (aKind > 0.5) em *= 0.4 + 1.2 * pow(max(0.0, sin(uTime * 0.9 + seed * 40.0)), 8.0);
          em *= uTodo;
        `,
        uniforms: { uTodo: { value: 0 } },
      }),
    );
    cinturon.u.uFuente.value = 0.6;

    // The Moon's launcher: a strip on its surface, two fine rails and coils that fire as the loads go
    // by, faster towards its end, where the rock leaves for the cylinder (as Mercury's, smaller).
    const rielLuna = (() => {
      const n = 120;
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      const lado = U_LUNA.clone().cross(N_LUNA).normalize();
      for (let i = 0; i <= n; i++) {
        const v = i / n;
        const c = enRielLuna(v, 0.0004);
        for (const k of [0, 1]) {
          const q = c.clone().addScaledVector(lado, (k - 0.5) * 0.009);
          pos.push(q.x, q.y, q.z);
          uv.push(k, v);
        }
        if (i < n) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const m = new THREE.ShaderMaterial({
        uniforms: { uOn: { value: 0 }, uFundido: { value: 1 }, uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uOn, uFundido, uTime;
          varying vec2 vUv;
          float raya(float x, float w) {
            float d = abs(fract(x + 0.5) - 0.5);
            float fw = max(fwidth(x), 1e-6);
            return 1.0 - smoothstep(w - fw, w + fw, d);
          }
          void main() {
            float v = vUv.y;
            float rieles = raya(vUv.x - 0.2, 0.014) + raya(vUv.x - 0.8, 0.014);
            float bobina = raya(v * 60.0, 0.035) * step(0.2, vUv.x) * step(vUv.x, 0.8);
            float fuego = 0.0;
            for (int k = 0; k < 4; k++) {
              float fase = fract(uTime * 0.22 + float(k) / 4.0);
              float vk = fase * fase;
              fuego += exp(-pow((v - vk) / 0.025, 2.0));
            }
            vec3 col = vec3(0.42, 0.95, 0.85) * rieles * (0.45 + 0.5 * min(fuego, 1.0)) + vec3(0.6, 1.0, 0.92) * bobina * (0.05 + 0.8 * min(fuego, 1.0));
            gl_FragColor = vec4(col * uOn * uFundido, 0.0);
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
      const l = new THREE.Mesh(g, m);
      l.frustumCulled = false;
      l.renderOrder = 7;
      root.add(l);
      return m;
    })();

    // The map at the start: the orbits, a mark on each world (only the Earth ours yet, ringed in teal).
    const orbs = add(orbitas([{ r: M.length() }, { r: VE.length() }, { r: E.length() }, { r: Math.hypot(MA.x, MA.z), y: MA.y }]));
    const nuestras = add(marcas([{ pos: E, R: RE, color: COLOR.tierra, nuestro: true }]));
    const otras = add(
      marcas([
        { pos: MA, R: RMA, color: COLOR.marte },
        { pos: VE, R: RV, color: COLOR.venus },
        { pos: M, R: RM, color: COLOR.mercurio },
      ]),
    );
    const NOMBRES: Nombre[] = [
      { pos: E, texto: 'Tierra', nuestro: true },
      { pos: MA, texto: 'Marte' },
      { pos: VE, texto: 'Venus', lado: 'o' },
      { pos: M, texto: 'Mercurio', lado: 'o' },
      { pos: V(), texto: 'Sol', aire: 30 },
      { pos: enOrbita(64, 95), texto: 'Cinturón', lado: 'n' },
    ];
    const listo = Promise.all(cuerpos.map((x) => x.c.listo).concat(sol.listo));

    // ---------------------------------------------------------------- the moments (GUION.md 20–24)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const Cn = (v: THREE.Vector3) => ({ cx: v.x, cy: v.y, cz: v.z });
    const rel = (centro: THREE.Vector3, pos: THREE.Vector3) => {
      const a = angulos(pos.clone().sub(centro));
      return { az: a.az, el: a.el, ld: Math.log10(pos.distanceTo(centro)) };
    };
    // Where scene 7 leaves the camera: high over the Earth, the ring open (the same turn as there).
    const fin7 = angulos(DIR7);
    // The map: everything in one frame (centred between the Sun and Mars).
    const CMAPA = V(20, 0, -14);
    const cerca = (az: number, ref: number) => az + 360 * Math.round((ref - az) / 360);

    // The spark's flight through the inner system (vuelo.ts), the same one Mercury's act goes on with:
    // it waits on the Earth while the camera shows where it will go, then it never stops. Its clock is
    // the act's from T0 on.
    const vuelo = vueloInterior();
    const T0 = 12.6;
    const caminoCh: Camino = (sv, out) => vuelo.camino(sv - T0, out);
    const seguir = (p: number, l: THREE.Vector3, m: THREE.Vector3) => {
      const T = vuelo.seguir(p - T0, l, m);
      suelo(l);
      return T;
    };
    const T_RIEL0 = T0 + vuelo.tauDe('riel0');
    const T_MARTE = T0 + vuelo.tauDe('marte');
    const T_MARTE2 = T0 + vuelo.tauDe('marte2');
    const T_VENUS = T0 + vuelo.tauDe('venus');
    const T_CORTE = T0 + vuelo.tauDe('corte');
    const L_MARTE = T_MARTE - 2.6;
    const L_VENUS = T_VENUS - 2.6;

    // First, where we are and where we will go: out from the Earth decade after decade until the
    // inner system is one frame, the worlds named a moment; then down again onto the spark, which
    // leaves.
    tl.set({ ...Cn(E), ox: 0, oy: 0, oz: 0, az: fin7.az, el: fin7.el, ld: Math.log10(23 * RE), yaw: 90, pitch: -90, roll: 0, fov: 34, mw: 0, lw: 0, on: 1, mar: 0, todo: 0, ven: 0, sombra: 0, anillo: 1, hl: 0, mapa: 0, nombres: 0, aire: 0, velR: 0 });
    tl.label('mapa').caption(T0 - 0.8, 'El sistema solar', 'Con la Tierra ya no alcanza: lo que sigue está alrededor. La Luna, Marte, Venus, Mercurio y, al centro, el Sol.');
    const azR = cerca(-30, fin7.az);
    luego(0.3, 4.6, { ld: Math.log10(105), el: 50, az: azR, fov: 36 });
    luego(0.9, 1.4, { velR: 0.3 });
    luego(2.3, 1.6, { velR: 0 });
    luego(1.0, 3.4, { ...Cn(CMAPA) });
    luego(2.2, 2.0, { mapa: 1, todo: 1 });
    luego(3.6, 1.4, { nombres: 1 });
    luego(7.4, 1.0, { nombres: 0 });
    luego(7.8, 1.4, { mapa: 0, todo: 0 });
    // (down onto the chase as the spark is about to leave: the rig ends just where the chase is)
    const lug0 = V();
    const mir0 = V();
    seguir(T0, lug0, mir0);
    const a0 = rel(mir0, lug0);
    luego(8.2, 4.4, { ...Cn(mir0), ld: a0.ld, el: a0.el, az: cerca(a0.az, azR), fov: 44 });
    luego(8.8, 1.2, { velR: 0.22 });
    luego(10.0, 1.4, { velR: 0 });
    luego(10.9, 1.7, { lw: 1, mw: 1 });
    tl.keyAt(T_RIEL0 - 3.0, { hl: 0 });
    tl.keyAt(T_RIEL0 - 1.4, { hl: 1 });
    tl.keyAt(T_MARTE - 3.4, { mar: 0 });
    tl.keyAt(T_MARTE - 1.0, { mar: 1 });
    tl.keyAt(T_MARTE - 0.5, { aire: 0 });
    tl.keyAt(T_MARTE + 4.5, { aire: 1 });
    tl.keyAt(T_VENUS - 3.6, { ven: 0, sombra: 0 });
    tl.keyAt(T_VENUS - 1.0, { ven: 1, sombra: 1 });
    tl.wait(T0 - 0.6);
    tl.label('luna').caption(L_MARTE - T0 + 0.2, 'La Luna, cantera', 'La roca para construir afuera sale de la Luna: sin aire y con poca gravedad, lanzarla cuesta poco.');
    tl.wait(L_MARTE - T0 + 0.6);
    tl.label('marte').caption(L_VENUS - L_MARTE - 0.4, 'Calentar Marte', 'Unos espejos pueden calentar Marte, pero su aire nunca será como el nuestro: viviríamos bajo cúpulas.');
    tl.wait(L_VENUS - L_MARTE);
    tl.label('venus').caption(T_CORTE - L_VENUS - 0.3, 'Venus, a la sombra', 'Venus es un horno, pero en lo alto de sus nubes el aire es templado: ahí pueden flotar ciudades.');
    // (the act ends in mid air, on the way to Mercury: its act goes on with the same flight)
    tl.wait(T_CORTE - L_VENUS);

    const chispa = crearChispa();
    root.add(chispa.nube.points);
    const tm = toma(tl, 0);
    const lugar = V();
    const mira = V();
    const inv = new THREE.Quaternion();
    return {
      tl,
      listo,
      entrada: { pos: E.clone(), escala: RE },
      salida: { pos: M.clone(), escala: RM },
      escalera: false,
      efectos(p) {
        // (a little speed blur in the open, where the spark goes fastest)
        const rap = p > T0 ? vuelo.velEn(p - T0, V()).length() : 0;
        return { vel: Math.max(0.14 * THREE.MathUtils.smoothstep(rap, 4, 12), tl.get('velR', p)) };
      },
      cuenta(p) {
        const c: Cuenta = p < tl.at('marte') ? potencia(16.3) : potencia(16.5);
        // How far we reach: a world more each time the spark gets to one.
        const pasos = [T_RIEL0, T_MARTE, T_VENUS];
        const n = pasos.filter((x) => p >= x).length;
        c.alcance = n === 0 ? '1 mundo' : `${n + 1} mundos`;
        c.nuevo = n > 0 ? 1 - THREE.MathUtils.smoothstep(p, pasos[n - 1], pasos[n - 1] + 1.8) : 0;
        return c;
      },
      anio(p) {
        return anioEn(p, [[0, 2045], [T0, 2046], [L_MARTE, 2049], [L_VENUS, 2054], [tl.length, 2058]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'III · El sistema solar trabaja', name: c.name, fact: c.fact } : null;
      },
      placa(g, f) {
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-5;
        camera.far = 3000;
        const lw = tl.get('lw', p);
        const mw = tl.get('mw', p);
        const T = seguir(p, lugar, mira);
        const centro = V(tl.get('cx', p), tl.get('cy', p), tl.get('cz', p));
        if (lw < 0.999) mira.lerp(centro, 1 - lw);
        aplicarToma(camera, toma(tl, p, tm, { punto: mira, peso: mw, arriba: Y, delante: T.multiplyScalar(lw) }, { punto: lugar, peso: lw }));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        sol.update({ sol: V(1, 0, 0), camara: camera.position.clone(), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: f.fundido ?? 1 });
        // Coming from the Earth's own scene: its light comes at first from where that scene had the
        // Sun, turning slowly to where the Sun is here (the night side turns away, as the Earth
        // would); the Moon comes up out of the dark.
        const llega = THREE.MathUtils.smoothstep(p, 1.2, 5.0);
        const solTierra = SOL_TIERRA.clone().lerp(E.clone().negate().normalize(), llega).normalize();
        for (const x of cuerpos) {
          inv.copy(x.q).invert();
          const solL = (x.c === tierra ? solTierra.clone() : x.g.position.clone().negate().normalize()).applyQuaternion(inv);
          const camL = camera.position.clone().sub(x.g.position).divideScalar(x.R).applyQuaternion(inv);
          // Far bodies are a few pixels: skip their fine points.
          const lejos = camL.length() > 400;
          x.c.group.visible = !lejos || x.R > 0.3;
          // Venus under the parasol: its day side dims.
          const presencia = x.c === venus ? 1 - 0.35 * tl.get('sombra', p) : x.c === luna ? THREE.MathUtils.smoothstep(p, 0.3, 2.0) : 1;
          x.c.update({ sol: solL, camara: camL, focal: f.focal, dpr: f.dpr, tiempo: t, presencia });
        }
        const lejosDe = (q: THREE.Vector3, d0: number, k = 1) => Math.min(1, Math.pow(d0 / Math.max(1e-6, camera.position.distanceTo(q)), k));
        // (its wake a third of a beat long: shorter than the camera's lag, so it never reaches past it)
        chispa.update(caminoCh, p, 0.0065, tl.get('on', p), 0, camera.position, f.focal, f.dpr, t);
        // (handing the flight on to Mercury's act: the spark, the Sun and Mercury are its now)
        chispa.nube.points.visible = !f.saliente;
        sol.group.visible = !f.saliente;
        if (f.saliente) merc.group.visible = false;
        // (Mars' mirrors, pole and domes only as it nears: from afar their thousands of points would
        // pile up in a pixel and bloom into a ball)
        const cercaMarte = 1 - THREE.MathUtils.smoothstep(camera.position.distanceTo(MA), 3, 8);
        marteN.u.uMar.value = tl.get('mar', p) * cercaMarte;
        marteN.u.uCamL.value.copy(camera.position).sub(MA).divideScalar(RMA);
        venusN.u.uVen.value = tl.get('ven', p);
        venusN.u.uSombra.value = tl.get('sombra', p);
        parasol.u.uOn.value = tl.get('sombra', p);
        const vV = VE.clone().applyMatrix4(camera.matrixWorldInverse);
        parasol.u.uOcc.value.set(vV.x, vV.y, vV.z, RV * 1.04);
        parasol.u.uDetras.value = THREE.MathUtils.smoothstep(camera.position.clone().sub(VE).normalize().dot(SOL_V.clone().negate()), 0.92, 0.995);
        luzVenus.u.uSombra.value = tl.get('sombra', p);
        // (only near Venus: from afar the sheet of light would read as a box round it)
        luzVenus.u.uLuz.value = tl.get('ven', p) * (1 - tl.get('todo', p)) * (1 - THREE.MathUtils.smoothstep(camera.position.distanceTo(VE), 1.0, 2.2));
        luzVenus.u.uSizeUnit.value = RV;
        venusN.u.uCamL.value.copy(camera.position).sub(VE).divideScalar(RV);
        cinturon.u.uTodo.value = tl.get('todo', p);
        const mapa = tl.get('mapa', p);
        orbs.u.uOn.value = mapa;
        marteN.u.uSizeUnit.value = RMA;
        venusN.u.uSizeUnit.value = RV;
        anillo.u.uSizeUnit.value = RE;
        anillo.u.uGain.value = tl.get('anillo', p) * lejosDe(E, 10, 1);
        rielLuna.uniforms.uOn.value = tl.get('hl', p) * (1 - tl.get('todo', p));
        rielLuna.uniforms.uTime.value = t;
        mLuz.haz.material.uniforms.uMar.value = tl.get('mar', p) * cercaMarte;
        mLuz.haz.material.uniforms.uTime.value = t;
        mLuz.aire.material.uniforms.uAire.value = tl.get('aire', p) * cercaMarte;
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        // The points are drawn without depth: the world biggest in sight hides those behind it (the
        // Earth's ring and the threads seen past Mars, the spark going round behind it).
        let ocu = OCULTAN[0];
        let mayor = 0;
        for (const x of OCULTAN) {
          const k = x.R / Math.max(1e-9, camera.position.distanceTo(x.pos));
          if (k > mayor) {
            mayor = k;
            ocu = x;
          }
        }
        const oV = ocu.pos.clone().applyMatrix4(camera.matrixWorldInverse);
        for (const n of [...nubes, chispa.nube]) n.u.uOcc.value.set(oV.x, oV.y, oV.z, ocu.R * 0.995);
        enfocarMarcas(nuestras, f.dpr, mapa);
        enfocarMarcas(otras, f.dpr, mapa);
        cinturon.u.uMaxPx.value = 3 * f.dpr;
      },
      dispose() {},
    };
  },
};
