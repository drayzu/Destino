import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { mercurio as mercurioHorizontes, sol as solHorizontes } from '../src/horizontes';
import { TEAL, potencia, anioEn } from './remake';
import { angulos, aplicarToma, toma } from './rig';
import { crearChispa, type Camino } from './chispa';
import { COLOR, E, MA, RE, RMA, RV, VE, M, RM, RA, RB, PHI0, PHI, RIEL_A, enRiel, caminoRio as camino, T_RIO as T, D_RIO as D, N_RIO as N_T } from './interior';
import { enfocarMarcas, marcas, nombres, orbitas, type Nombre } from './revelar';
import type { Cuenta, Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';
import { suelo, vueloInterior } from './vuelo';

/**
 * Study B of the remake: scenes 11 and 12 of ESCALETA.md, «Mercurio se deshace» and «El enjambre»
 * (GUION.md, moments 25–28).
 *
 * Mercury against the Sun, its night side towards us: teal machines that copy themselves spread over
 * it, veins of light behind a bright front, and the crust they take grows dark. A rail of light along
 * its equator throws the rock off with no rocket; the camera rides a load down the river of rock that
 * falls towards the Sun, the stream all round it. The river opens into the swarm: millions of
 * collectors, each in its own orbit, that glint when they turn to the Sun. They close round the star,
 * and from outside the Sun goes out behind them: from far away, a warm ember.
 *
 * Ways: 1 «Vidrio», the collectors as they would be, dark glass that glints; 2 «Verde agua», the
 * collectors in the work's light (ours is teal).
 *
 * Units: solar radii, the Sun at the origin. Distances are drawn short (Mercury at 18, the swarm at 3);
 * the plate keeps the true ones.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
// (Mercury's place, its rail and its river: interior.ts, shared with the flight that brings the spark here)

/** Where the scene leaves the camera: far away, the Sun an ember in its swarm (scene 13 starts here). */
export const LEJOS = V(Math.sin(PHI0 + PHI * 0.86 + 0.7), 0.35, Math.cos(PHI0 + PHI * 0.86 + 0.7)).multiplyScalar(160);

function rigDe(pos: THREE.Vector3) {
  const a = angulos(pos);
  return { az: a.az, el: a.el, ld: Math.log10(pos.length()) };
}

// ---------------------------------------------------------------- the pieces

/** The rail: an arc of Mercury's equator that ends where the river leaves, tangent to it. `aKind`: 0 at the end, 1 at the start. */
function rielDatos() {
  const b = materiaBuilder(31);
  for (let i = 0; i < 4200; i++) {
    const t = b.r();
    const a = t * 1.15;
    const p = N_T.clone().multiplyScalar(Math.cos(a)).addScaledVector(D, -Math.sin(a)).multiplyScalar(RM * 1.004).add(M);
    b.push(p.x, p.y + gauss(b.r) * 0.0012, p.z, TEAL, 0.0032, 0.8, { kind: t });
  }
  return b.data();
}

/** Where on the rail (v: 0 at its start, 1 at its end, where the river leaves), and a little above it. */
/** How many loads are on the rail at once, and how fast they go (cycles a second). */
const CARGAS = 5;
const CADENCIA = 0.16;

/**
 * The rail (a mass driver) as a structure: a strip along the arc with its two rails, and coils
 * across it every few metres that fire as each load passes, faster and faster towards its end.
 * Mercury hides what is behind it (`uOcc`, as the points do).
 */
function rielMalla() {
  const n = 360;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const lado = N_T.clone().cross(D).normalize();
  const ancho = 0.011;
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    const c = enRiel(v, 0.0006);
    for (const k of [0, 1]) {
      const p = c.clone().addScaledVector(lado, (k - 0.5) * ancho);
      pos.push(p.x, p.y, p.z);
      uv.push(k, v);
    }
    if (i < n) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uRiel: { value: 0 }, uTime: { value: 0 }, uFundido: { value: 1 }, uOcc: { value: new THREE.Vector4() } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRiel, uTime, uFundido;
      uniform vec4 uOcc;
      varying vec2 vUv;
      varying vec3 vV;
      float raya(float x, float w) {
        float d = abs(fract(x + 0.5) - 0.5);
        float fw = max(fwidth(x), 1e-6);
        return 1.0 - smoothstep(w - fw, w + fw, d);
      }
      void main() {
        // Behind Mercury: hidden.
        vec3 ray = normalize(vV);
        float tt = dot(uOcc.xyz, ray);
        if (uOcc.w > 0.0 && tt > 0.0 && length(vV) > tt && length(uOcc.xyz - ray * tt) < uOcc.w) discard;
        float v = vUv.y;
        // Built from its start: it lights up along its length as it comes on.
        if (v > uRiel * 1.05) discard;
        // Two fine rails; coils across them, faint until a load passes.
        float rieles = raya(vUv.x * 1.0 - 0.2, 0.012) + raya(vUv.x * 1.0 - 0.8, 0.012);
        float bobina = raya(v * 140.0, 0.03) * step(0.2, vUv.x) * step(vUv.x, 0.8);
        // Each load: where it is now (it accelerates: v = phase²), and the coils round it fire.
        float fuego = 0.0;
        for (int k = 0; k < ${CARGAS}; k++) {
          float fase = fract(uTime * ${CADENCIA.toFixed(3)} + float(k) / ${CARGAS.toFixed(1)});
          float vk = fase * fase;
          fuego += exp(-pow((v - vk) / 0.012, 2.0)) + 0.35 * exp(-max(0.0, vk - v) / 0.04) * step(v, vk) * step(0.02, vk - v);
        }
        vec3 col = vec3(0.42, 0.95, 0.85) * rieles * 0.42 + vec3(0.5, 0.56, 0.62) * bobina * 0.05;
        col += vec3(0.6, 1.0, 0.92) * bobina * min(fuego, 1.0) * 0.7 + vec3(0.42, 0.95, 0.85) * rieles * min(fuego, 1.0) * 0.4;
        // (the rail's bed: barely there, a darker band on the ground)
        gl_FragColor = vec4(col * uFundido, 0.25 * uFundido);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 6;
  m.frustumCulled = false;
  return { mesh: m, u: mat.uniforms };
}

/** The loads on the rail: bright capsules, each at its phase, accelerating to the end. */
function cargasDatos() {
  const b = materiaBuilder(33);
  for (let k = 0; k < CARGAS; k++) {
    for (let i = 0; i < 24; i++) b.push(gauss(b.r) * 0.0008, gauss(b.r) * 0.0008, (b.r() - 0.5) * 0.005, i < 5 ? 0xffffff : TEAL, 0.0012, i < 5 ? 0.9 : 0.4, { kind: k / CARGAS });
  }
  return b.data();
}

/** The river: rock in flight, each grain with its phase along the path (`aKind`) and its place across it (`aOff`). */
function rioDatos(n: number) {
  const b = materiaBuilder(37);
  const off: number[] = [];
  for (let i = 0; i < n; i++) {
    b.push(0, 0, 0, 0xffffff, 0.003 + b.r() * 0.005, 1, { kind: b.r() });
    off.push(gauss(b.r), gauss(b.r) * 0.5);
  }
  return { data: b.data(), off: new Float32Array(off) };
}

/**
 * The swarm: collectors in orbits of every tilt between 2.5 and 3.6 radii. `aU`, `aV`: each orbit's
 * plane; `aO`: radius, starting angle, angular speed. `aDelay`: when it arrives (with `uCubre`).
 */
function enjambreDatos(n: number) {
  const b = materiaBuilder(41);
  const U: number[] = [];
  const W: number[] = [];
  const O: number[] = [];
  const v = V();
  for (let i = 0; i < n; i++) {
    const [x, y, z] = b.onSphere();
    // (a sixth of them in a dense band of low orbits round the equator, where the camera flies
    // among them: the nearest pass large)
    const banda = i % 6 === 0;
    const nrm = banda ? V(gauss(b.r) * 0.12, b.r() < 0.5 ? 1 : -1, gauss(b.r) * 0.12).normalize() : v.set(x, y, z).clone();
    const u = Math.abs(nrm.y) < 0.9 ? Y.clone().cross(nrm).normalize() : V(1, 0, 0).cross(nrm).normalize();
    const w = nrm.clone().cross(u);
    const R = banda ? 2.75 + b.r() * 0.5 : Math.sqrt(2.5 * 2.5 + b.r() * (3.6 * 3.6 - 2.5 * 2.5));
    const th = b.r() * Math.PI * 2;
    b.push(Math.cos(th) * R * u.x + Math.sin(th) * R * w.x, Math.cos(th) * R * u.y + Math.sin(th) * R * w.y, Math.cos(th) * R * u.z + Math.sin(th) * R * w.z, 0xffffff, 0.011 + b.r() * 0.008, 1, { delay: b.r(), ink: 1 });
    U.push(u.x, u.y, u.z);
    W.push(w.x, w.y, w.z);
    O.push(R, th, 0.05 * Math.pow(3 / R, 1.5));
  }
  return { data: b.data(), U: new Float32Array(U), W: new Float32Array(W), O: new Float32Array(O) };
}

/** The swarm as a cloud (scene 12 and the Sun's, scene 13, use the same one, so they meet without a seam). */
export function enjambreNube(teal: boolean): Nube {
  const ed = enjambreDatos(380000);
  const enjambre = materia(ed.data, {
        pre: /* glsl */ `
          attribute vec3 aU, aV, aO;
          uniform vec3 uCam, uBase;
          uniform float uCubre, uIR;
          varying float vAng;
        `,
        move: /* glsl */ `
          float th = aO.y + aO.z * uTime;
          p = (aU * cos(th) + aV * sin(th)) * aO.x;
          vec3 rh = normalize(p);
          vec3 tilt = vec3(fract(seed * 13.1), fract(seed * 71.7), fract(seed * 37.3)) - 0.5;
          vec3 wob = vec3(sin(uTime * 0.6 + seed * 91.0), cos(uTime * 0.5 + seed * 53.0), sin(uTime * 0.4 + seed * 17.0));
          vec3 Nf = normalize(-rh + tilt * 0.55 + wob * 0.1);
          vec3 Vv = normalize(uCam - p);
          float frente = step(0.0, dot(Nf, Vv));
          float g = pow(max(dot(reflect(rh, Nf), Vv), 0.0), 90.0);
          float on = step(aDelay, uCubre);
          em = uBase * (0.35 + 0.65 * frente) + vec3(1.0, 0.95, 0.86) * g * 4.0 * frente;
          em += vec3(0.42, 0.09, 0.025) * uIR * (1.0 - 0.6 * frente);
          em *= on;
          occ = 0.92 * on;
          vAng = seed * 6.2831853 + uTime * (fract(seed * 7.3) - 0.5) * 0.6;
        `,
        // (each collector a flat panel: a square, turned its own way, its rim a little brighter)
        frag: /* glsl */ `
          varying vec3 vEm;
          varying float vOcc;
          varying float vAng;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float ca = cos(vAng);
            float sa = sin(vAng);
            c = vec2(ca * c.x - sa * c.y, sa * c.x + ca * c.y) * vec2(1.0, 1.45);
            float m = max(abs(c.x), abs(c.y));
            float f = 1.0 - smoothstep(0.27, 0.33, m);
            float borde = smoothstep(0.2, 0.3, m) * f;
            gl_FragColor = vec4(vEm * f * (0.85 + 0.6 * borde), vOcc * f);
          }
        `,
        uniforms: { uCam: { value: V() }, uBase: { value: teal ? TEAL.clone().multiplyScalar(0.16) : new THREE.Color(0.02, 0.022, 0.028) }, uCubre: { value: 0 }, uIR: { value: 0 } },
        extra: { aU: [ed.U, 3], aV: [ed.W, 3], aO: [ed.O, 3] },
      });
  enjambre.u.uInk.value = 1;
  enjambre.u.uFuente.value = 0.25;
  enjambre.points.renderOrder = 10;
  return enjambre;
}

const MINA = {
  pre: /* glsl */ `uniform vec3 uSem, uTeal; uniform float uMina, uLejos;`,
  glsl: /* glsl */ `
    float a = acos(clamp(dot(n, uSem), -1.0, 1.0)) / 3.14159265;
    float on = step(0.0005, uMina);
    float dentro = (1.0 - smoothstep(uMina - 0.015, uMina, a)) * on;
    float borde = smoothstep(uMina - 0.05, uMina - 0.004, a) * (1.0 - smoothstep(uMina - 0.004, uMina + 0.004, a)) * on;
    vec2 g = abs(fract(uvDe(n) * vec2(96.0, 48.0)) - 0.5);
    float malla = smoothstep(0.43, 0.5, max(g.x, g.y));
    float nodo = smoothstep(0.38, 0.5, min(g.x, g.y));
    float luz = step(0.9, hp);
    alb *= mix(1.0, 0.32, dentro);
    // (its grid of machines reads from afar; skimming the ground on the rail, only their dark ground
    // and the front where they advance)
    extra += uTeal * (dentro * (malla * 0.16 + nodo * 0.9 + luz * 0.12) * uLejos + borde * 1.2 * (0.35 + 0.65 * uLejos));
  `,
};

export const mercurio: Escena = {
  id: 'mercurio',
  nombre: 'B · Mercurio → el enjambre',
  estilos: [
    { key: '1', nombre: 'Vidrio', nota: 'Los colectores como serían: vidrio oscuro que destella cuando gira hacia el Sol. El verde agua queda en las máquinas y en el río.' },
    { key: '2', nombre: 'Verde agua', nota: 'Los colectores en la luz de la obra: el enjambre entero es verde agua, lo nuestro, y destella igual.' },
  ],
  montar(stage, estilo): Instancia {
    const teal = estilo === 1;
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.6;
    stage.bloom.radius = 0.55;
    stage.bloom.threshold = 0.62;
    stage.renderer.toneMappingExposure = 1.05;
    const base = `${import.meta.env.BASE_URL}texturas/`;

    const sol = solHorizontes({ puntos: 320000, corona: 160000 });
    root.add(sol.group);
    sol.u.uBrillo.value = 2.2;

    const minaU = { uSem: { value: M.clone().normalize().addScaledVector(Y, 0.15).normalize() }, uTeal: { value: TEAL.clone() }, uMina: { value: 0 }, uLejos: { value: 1 } };
    const merc = mercurioHorizontes(base, { giro: 0, superficie: { ...MINA, uniforms: minaU } });
    merc.group.position.copy(M);
    merc.group.scale.setScalar(RM);
    root.add(merc.group);

    const nubes: Nube[] = [];
    const add = (n: Nube, orden = 5) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      root.add(n.points);
      nubes.push(n);
      return n;
    };

    const riel = add(
      materia(rielDatos(), {
        pre: /* glsl */ `uniform float uRiel;`,
        move: /* glsl */ `
          float pulso = smoothstep(0.86, 1.0, fract(aKind * 6.0 + uTime * 1.1));
          em *= uRiel * (0.35 + 4.0 * pulso) * step(aKind, uRiel * 1.05);
        `,
        uniforms: { uRiel: { value: 0 } },
      }),
    );
    riel.u.uFuente.value = 0.25;
    riel.points.visible = false;
    const rielM = rielMalla();
    root.add(rielM.mesh);
    // (the loads ride the rail in the rail's own frame: along the arc, each by its phase)
    const cargas = add(
      materia(cargasDatos(), {
        pre: /* glsl */ `uniform float uRiel; uniform vec3 uM, uN, uD; uniform float uR;`,
        move: /* glsl */ `
          float fase = fract(uTime * ${CADENCIA.toFixed(3)} + aKind);
          float vv = fase * fase;
          float a = (1.0 - vv) * ${RIEL_A.toFixed(3)};
          vec3 rad = uN * cos(a) - uD * sin(a);
          vec3 tg = normalize(uN * sin(a) + uD * cos(a));
          vec3 lado = normalize(cross(rad, tg));
          p = uM + rad * (uR + 0.0016) + tg * position.z + lado * position.x + rad * position.y;
          em *= uRiel * smoothstep(0.0, 0.05, fase) * step(vv, uRiel);
        `,
        uniforms: { uRiel: { value: 0 }, uM: { value: M.clone() }, uN: { value: N_T.clone() }, uD: { value: D.clone() }, uR: { value: RM * 1.004 } },
      }),
    );
    cargas.u.uFuente.value = 0.6;

    const rd = rioDatos(90000);
    const rio = add(
      materia(rd.data, {
        pre: /* glsl */ `
          attribute vec2 aOff;
          uniform float uRio, uRioOn;
          uniform vec3 uTeal;
        `,
        move: /* glsl */ `
          float sv = fract(aKind + uTime * 0.016);
          float rv = ${RA.toFixed(2)} * pow(${(RB / RA).toFixed(5)}, sv);
          float ph = ${PHI0.toFixed(5)} + ${PHI.toFixed(5)} * sv;
          vec3 rh = vec3(sin(ph), 0.0, cos(ph));
          vec3 ee = vec3(cos(ph), 0.0, -sin(ph));
          float abre = 0.014 + 0.12 * sv + 0.9 * sv * sv * sv * sv;
          p = rh * rv + (ee * aOff.x + vec3(0.0, 1.0, 0.0) * aOff.y) * abre;
          em = mix(vec3(0.42, 0.4, 0.37), uTeal, smoothstep(0.0, 0.04, sv)) * (0.12 + 0.3 * fract(seed * 7.3));
          em *= step(sv, uRio) * (1.0 - smoothstep(0.8, 1.0, sv)) * uRioOn;
        `,
        uniforms: { uRio: { value: 0 }, uRioOn: { value: 1 }, uTeal: { value: TEAL.clone() } },
        extra: { aOff: [rd.off, 2] },
      }),
    );
    rio.u.uFuente.value = 0.15;

    const enjambre = add(enjambreNube(teal), 10);

    // Revealing: the orbits, the worlds as marks (all ours), and the Sun itself ours now, ringed.
    const orbs = add(orbitas([{ r: M.length() }, { r: VE.length() }, { r: E.length() }, { r: Math.hypot(MA.x, MA.z), y: MA.y }]));
    const lasMarcas = add(
      marcas([
        { pos: E, R: RE, color: COLOR.tierra, nuestro: true },
        { pos: MA, R: RMA, color: COLOR.marte, nuestro: true },
        { pos: VE, R: RV, color: COLOR.venus, nuestro: true },
        { pos: M, R: RM, color: COLOR.mercurio, nuestro: true },
        { pos: V(), R: 0, color: TEAL, nuestro: true, aro: 96, sinPunto: true },
      ]),
    );
    const NOMBRES: Nombre[] = [
      { pos: V(), texto: 'Sol · el enjambre', nuestro: true, aire: 40 },
      { pos: E, texto: 'Tierra', nuestro: true },
      { pos: MA, texto: 'Marte', nuestro: true },
      { pos: VE, texto: 'Venus', nuestro: true, lado: 'o' },
      { pos: M, texto: 'Mercurio', nuestro: true, lado: 'o' },
    ];

    const listo = Promise.all([sol.listo, merc.listo]);

    // ---------------------------------------------------------------- the moments (GUION.md 25–28)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const rM = M.clone().normalize();
    const eM = Y.clone().cross(rM).normalize();
    // Mercury half lit: the Sun off to the side, the terminator down the middle of the disc.
    const lado = eM.clone().multiplyScalar(eM.dot(D) > 0 ? -1 : 1);
    const c0 = rigDe(M.clone().addScaledVector(lado.clone().addScaledVector(Y, 0.3).addScaledVector(rM, 0.25).normalize(), 1.75));
    const c1 = rigDe(M.clone().addScaledVector(lado.clone().addScaledVector(Y, 0.42).addScaledVector(rM, 0.05).normalize(), 1.45));
    // The rail and the river leaving it: from above and to the side, Mercury on one side of the frame.
    const c2 = rigDe(M.clone().addScaledVector(Y, 1.7).addScaledVector(lado, 1.6).addScaledVector(D, -0.9));
    const fuera = (sv: number) => camino(sv).addScaledVector(Y, 0.08).addScaledVector(Y.clone().cross(camino(sv + 0.001).sub(camino(sv)).normalize()), 0.05);
    const c3 = rigDe(fuera(0.04));
    // Off the river, outside the swarm, the Sun ahead; then far away.
    const lejos = rigDe(LEJOS);
    // The spark comes on from the system's act in mid air (vuelo.ts: one flight), and the camera
    // chasing it with it: across to Mercury, down onto its rail as onto the Moon's, fired along it as
    // the coils light (the loads fly with it), and down the river of rock towards the Sun; then round
    // the Sun among the collectors (the orbit below takes it over).
    const vuelo = vueloInterior();
    const T_C = vuelo.tauDe('corte');
    const T_M0 = vuelo.tauDe('merc0') - T_C;
    const T_RIO = vuelo.tauDe('rio1') - T_C;
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, ...c0, yaw: 0, pitch: -40, roll: 0, fov: 44, vel: 0, sw: 0, swA: 0, swR: 0, swE: 0, swK: 0, swF: 40, mina: 0, riel: 0, rio: 0, rioOn: 1, cubre: 0, ir: 0, mapa: 0, nombres: 0 });
    tl.wait(T_M0 - 4.4);
    tl.label('mina').caption(3.2, 'Desarmar Mercurio', 'Para el enjambre hace falta materia. Máquinas que se copian deshacen Mercurio en menos de una vida.');
    luego(0, 4.4, { mina: 0.62 });
    // (the rail lights before the spark comes down onto it)
    luego(1.2, 1.6, { riel: 1 });
    tl.wait(3.4);
    const P_PARED = T_RIO - 3.4;
    tl.label('catapulta').caption(P_PARED - (T_M0 - 1.0) - 0.2, 'La catapulta', 'Sin aire que frene, un riel lanza la roca al espacio. Vamos en una carga.');
    luego(0.5, 5.0, { rio: 0.55 });
    tl.wait(P_PARED - tl.at('catapulta'));

    // The river carries the camera into the swarm's shell; off it, round the Sun among the
    // collectors (they cross its face, dark; they flash as they turn their light to us); and out
    // through the shell as it closes: from outside, the Sun goes out behind it.
    // One unbroken move from here to the end of the act (Diego, 30 Oct: the swarm is one of the
    // work's most important moments; fluid and cinematic, never back and forth): the river carries
    // the camera into the swarm's shell, and the camera goes on round the Sun, always the same way,
    // with the spark just ahead: down among the collectors (they cross the Sun's face, dark; they
    // flash as they turn its light to us; the nearest pass large), up through the shell as it
    // closes, and out, still turning, until the Sun is a dim point in its swarm far away.
    tl.label('pared').caption(12.6, 'La pared que tapa el Sol', 'No es una cáscara: es un enjambre, cada colector en su órbita. Desde afuera, el Sol se va apagando.');
    luego(0, 3.6, { rio: 1 });
    luego(0.4, 6.4, { cubre: 0.8 });
    tl.to(4.2, { sc: 0.93 });
    luego(-1.2, 1.4, { vel: 0.25 });
    luego(0.6, 1.6, { vel: 0 });
    luego(5.2, 3.2, { cubre: 1 });
    tl.wait(8.4);

    // The reveal: far out, the whole system ours, the Sun dim in its swarm; the names a moment; still.
    tl.label('lejos').caption(8.0, 'Visto desde lejos', 'Desde otra estrella, un Sol así se vería débil y tibio. Así buscamos a otros. Hasta ahora, nadie.');
    luego(0.6, 3.4, { ir: 1, rioOn: 0 });
    luego(2.6, 2.2, { mapa: 1 });
    luego(4.2, 1.4, { nombres: 1 });
    tl.wait(5.0);
    luego(1.6, 1.2, { nombres: 0 });
    luego(1.8, 1.2, { mapa: 0 });
    tl.wait(3.0);
    // The orbit's keys (laid over the moments above): its angle only grows; inside the shell, then
    // out to where the Sun's act takes over (LEJOS: the same place, one turn on).
    {
      const L0 = tl.at('lejos');
      const P0 = tl.at('pared');
      const fin = tl.length;
      const A_L = Math.atan2(LEJOS.x, LEJOS.z);
      const A0 = PHI0 + PHI * 0.95;
      const A_FIN = A_L + Math.PI * 2 * Math.ceil((A0 + 4 - A_L) / (Math.PI * 2));
      const E_L = THREE.MathUtils.radToDeg(Math.asin(LEJOS.y / LEJOS.length()));
      const clave = (b: number, v: Record<string, number>) => tl.keyAt(b, v);
      clave(P0 + 2.8, { sw: 0, swA: A0, swR: Math.log10(3.35), swE: 1.4, swK: 0.35, swF: 40 });
      clave(P0 + 5.6, { swK: 0.8 });
      clave(P0 + 4.8, { sw: 1 });
      clave(P0 + 6.8, { swR: Math.log10(2.9), swE: 4.5, swF: 54 });
      clave(P0 + 9.8, { swR: Math.log10(3.05), swE: -3.5, swK: 0.6 });
      clave(L0, { swA: A0 + (A_FIN - A0) * 0.62, swR: Math.log10(7.5), swE: 9, swK: 0.12, swF: 44 });
      clave(fin, { swA: A_FIN, swR: Math.log10(LEJOS.length()), swE: E_L, swK: 0, swF: 30 });
    }

    // The spark: the flight (on from the system's act), then round the Sun with the camera, a little
    // ahead of it, the same way (blended where the river's end meets the orbit).
    const orbitaEn = (q: number, out: THREE.Vector3) => {
      const a = tl.get('swA', q) + 0.05 + 0.37 * THREE.MathUtils.smoothstep(q, tl.at('pared') + 3.4, tl.at('pared') + 6.4);
      const R = THREE.MathUtils.lerp(3.2, 3.02, THREE.MathUtils.smoothstep(q, tl.at('pared') + 3.4, tl.at('pared') + 6.4));
      return out.set(Math.sin(a) * R, 0.02 + 0.12 * Math.sin(((q - tl.at('pared') - 3.4) / 8) * 2.2), Math.cos(a) * R);
    };
    const tmpO = V();
    const caminoCh: Camino = (sv, out) => {
      const tSw = tl.at('pared') + 3.4;
      vuelo.camino(T_C + sv, out);
      const k = THREE.MathUtils.smoothstep(sv, tSw - 0.5, tSw + 0.7);
      if (k > 0) out.lerp(orbitaEn(sv, tmpO), k);
      return out;
    };
    const chispa = crearChispa();
    root.add(chispa.nube.points);
    const tm = toma(tl, 0);
    const q = V();
    const solV = V();
    const mercV = V();
    const aqui = V();
    const adelante = V();
    return {
      tl,
      listo,
      entrada: { pos: M.clone(), escala: RM },
      salida: { pos: V(), escala: 1 },
      // (the system's act hands the flight over in mid air: its camera is already where this one is)
      continuo: true,
      escalera: false,
      efectos(p) {
        const rap = vuelo.velEn(T_C + p, V()).length() * (1 - tl.get('sw', p));
        return { vel: Math.max(0.14 * THREE.MathUtils.smoothstep(rap, 4, 12), tl.get('vel', p)) };
      },
      cuenta(p) {
        const c: Cuenta = p < tl.at('catapulta') ? potencia(16.6) : p < tl.at('pared') ? potencia(17.4) : potencia(18 + 8.58 * tl.get('cubre', p));
        // How far we reach: the five worlds, then the Sun itself, once the swarm closes.
        const sol1 = tl.at('pared') + 5.4;
        c.alcance = p < T_M0 ? '4 mundos' : p < sol1 ? '5 mundos' : '1 estrella';
        const desde = p >= sol1 ? sol1 : p >= T_M0 ? T_M0 : -1e9;
        c.nuevo = 1 - THREE.MathUtils.smoothstep(p, desde, desde + 1.8);
        return c;
      },
      placa(g, f) {
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
      },
      anio(p) {
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[0, 2058], [a('catapulta'), 2063], [a('pared'), 2070], [a('lejos'), 2085], [tl.length, 2090]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'III · El sistema solar trabaja', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-4;
        camera.far = 2000;
        // The chase (vuelo.ts), on from the system's act just as it left it.
        const lugarP = V();
        const objetivo = V();
        const Tv = vuelo.seguir(T_C + p, lugarP, objetivo);
        suelo(lugarP);
        chispa.update(caminoCh, p, 0.0065, 1, 0, camera.position, f.focal, f.dpr, f.time);
        // Round the Sun (see the orbit's keys): taking over from the river, then the whole way.
        const sw = tl.get('sw', p);
        if (sw > 0.0005) {
          const A = tl.get('swA', p);
          const R = Math.pow(10, tl.get('swR', p));
          const E = THREE.MathUtils.degToRad(tl.get('swE', p));
          const orbita = V(Math.sin(A) * Math.cos(E), Math.sin(E), Math.cos(A) * Math.cos(E)).multiplyScalar(R);
          // (the gaze on the Sun, turned a little ahead: the Sun to one side, the way ahead open)
          const ahead = V(Math.sin(A + 0.9), 0, Math.cos(A + 0.9)).multiplyScalar(R * 0.8);
          const mira = V().lerp(ahead, tl.get('swK', p));
          lugarP.lerp(orbita, sw);
          objetivo.lerp(mira, sw);
        }
        aplicarToma(camera, toma(tl, p, tm, { punto: objetivo, peso: 1, arriba: Y, delante: Tv.multiplyScalar(1 - sw) }, { punto: lugarP, peso: 1 }));
        if (sw > 0.0005) camera.fov = THREE.MathUtils.lerp(camera.fov, tl.get('swF', p), sw);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        // Seen from outside the swarm, the Sun goes out behind it as it closes.
        const afuera = THREE.MathUtils.smoothstep(camera.position.length(), 2.6, 3.9);
        sol.u.uBrillo.value = 2.2 * (1 - 0.86 * tl.get('cubre', p) * afuera);
        sol.update({ sol: V(1, 0, 0), camara: camera.position.clone(), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: f.fundido ?? 1 });
        merc.update({ sol: M.clone().negate().normalize(), camara: camera.position.clone().sub(M).divideScalar(RM), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: f.fundido ?? 1 });
        minaU.uMina.value = tl.get('mina', p);
        minaU.uLejos.value = 0.3 + 0.7 * THREE.MathUtils.smoothstep(camera.position.distanceTo(M) / RM, 1.9, 4.0);
        riel.u.uRiel.value = tl.get('riel', p) * tl.get('rioOn', p);
        rielM.u.uRiel.value = riel.u.uRiel.value;
        rielM.u.uTime.value = t;
        cargas.u.uRiel.value = riel.u.uRiel.value;
        rio.u.uRio.value = tl.get('rio', p);
        rio.u.uRioOn.value = tl.get('rioOn', p);
        enjambre.u.uCubre.value = tl.get('cubre', p);
        enjambre.u.uIR.value = tl.get('ir', p);
        enjambre.u.uCam.value.copy(camera.position);

        // The Sun hides what is behind it; Mercury hides the river behind it.
        solV.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
        mercV.copy(M).applyMatrix4(camera.matrixWorldInverse);
        enjambre.u.uOcc.value.set(solV.x, solV.y, solV.z, 1.0);
        rio.u.uOcc.value.set(mercV.x, mercV.y, mercV.z, RM);
        riel.u.uOcc.value.set(mercV.x, mercV.y, mercV.z, RM * 0.998);
        rielM.u.uOcc.value.set(mercV.x, mercV.y, mercV.z, RM * 0.998);
        cargas.u.uOcc.value.set(mercV.x, mercV.y, mercV.z, RM * 0.998);
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        // (among the collectors, the nearest pass large)
        enjambre.u.uMaxPx.value = 70 * f.dpr;
        const mapa = tl.get('mapa', p);
        orbs.u.uOn.value = mapa;
        enfocarMarcas(lasMarcas, f.dpr, mapa);
        void q;
      },
      dispose() {},
    };
  },
};
