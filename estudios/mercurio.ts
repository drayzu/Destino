import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { mercurio as mercurioHorizontes, sol as solHorizontes } from '../src/horizontes';
import { TEAL, potencia, anioEn } from './remake';
import { angulos, aplicarToma, toma } from './rig';
import { crearChispa, type Camino } from './chispa';
import { COLOR, E, MA, RE, RMA, RV, VE } from './interior';
import { enfocarMarcas, marcas, nombres, orbitas, type Nombre } from './revelar';
import type { Cuenta, Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';

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
const RA = 18;
const RB = 3.0;
const PHI0 = THREE.MathUtils.degToRad(205);
const PHI = 1.45;
export const RM = 0.42;

/** The river's path (a logarithmic spiral from Mercury down to the swarm), s = 0..1. */
function camino(s: number, out = V()) {
  const r = RA * Math.pow(RB / RA, s);
  const ph = PHI0 + PHI * s;
  return out.set(Math.sin(ph) * r, 0, Math.cos(ph) * r);
}

/** Where the river leaves Mercury, which way, and where Mercury is. */
const T = camino(0);
const D = camino(0.002).sub(T).normalize();
const N_T = (() => {
  const n = Y.clone().cross(D).normalize();
  return n.dot(T) < 0 ? n.negate() : n;
})();
export const M = T.clone().addScaledVector(N_T, -RM);

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
const RIEL_A = 1.15;
function enRiel(v: number, alto = 0, out = V()) {
  const a = (1 - Math.min(Math.max(v, 0), 1)) * RIEL_A;
  return out.copy(N_T).multiplyScalar(Math.cos(a)).addScaledVector(D, -Math.sin(a)).multiplyScalar(RM * 1.004 + alto).add(M);
}
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
        float rieles = raya(vUv.x * 1.0 - 0.18, 0.04) + raya(vUv.x * 1.0 - 0.82, 0.04);
        float bobina = raya(v * 140.0, 0.045);
        // Each load: where it is now (it accelerates: v = phase²), and the coils round it fire.
        float fuego = 0.0;
        for (int k = 0; k < ${CARGAS}; k++) {
          float fase = fract(uTime * ${CADENCIA.toFixed(3)} + float(k) / ${CARGAS.toFixed(1)});
          float vk = fase * fase;
          fuego += exp(-pow((v - vk) / 0.012, 2.0)) + 0.35 * exp(-max(0.0, vk - v) / 0.04) * step(v, vk) * step(0.02, vk - v);
        }
        vec3 col = vec3(0.02, 0.024, 0.028) + vec3(0.42, 0.95, 0.85) * rieles * 0.6 + vec3(0.5, 0.56, 0.62) * bobina * 0.1;
        col += vec3(0.6, 1.0, 0.92) * bobina * fuego * 1.1 + vec3(0.42, 0.95, 0.85) * rieles * fuego * 0.6;
        gl_FragColor = vec4(col * uFundido, 0.7 * uFundido);
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
    for (let i = 0; i < 40; i++) b.push(gauss(b.r) * 0.0012, gauss(b.r) * 0.0012, (b.r() - 0.5) * 0.006, i < 8 ? 0xffffff : TEAL, 0.0016, i < 8 ? 1.6 : 0.6, { kind: k / CARGAS });
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
  pre: /* glsl */ `uniform vec3 uSem, uTeal; uniform float uMina;`,
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
    extra += uTeal * (dentro * (malla * 0.16 + nodo * 0.9 + luz * 0.12) + borde * 1.2);
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

    const minaU = { uSem: { value: M.clone().normalize().addScaledVector(Y, 0.15).normalize() }, uTeal: { value: TEAL.clone() }, uMina: { value: 0 } };
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
    // Inside the shell, round the Sun: where the river leaves the camera, and further round.
    const enOrbitaSol = (ang: number, r: number, y: number) => V(Math.sin(ang) * r, y, Math.cos(ang) * r);
    const angRio = PHI0 + PHI * 0.93;
    const dentroA = rigDe(enOrbitaSol(angRio + 0.25, 3.05, 0.35));
    const dentroB = rigDe(enOrbitaSol(angRio + 1.25, 2.9, -0.25));
    const c5 = rigDe(V(Math.sin(PHI0 + PHI * 0.86), 0.32, Math.cos(PHI0 + PHI * 0.86)).multiplyScalar(6.4));
    const c6 = rigDe(V(Math.sin(PHI0 + PHI * 0.86 + 0.5), 0.3, Math.cos(PHI0 + PHI * 0.86 + 0.5)).multiplyScalar(5.6));
    const lejos = rigDe(LEJOS);
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, ...c0, yaw: 0, pitch: -40, roll: 0, fov: 40, mm: 0, ms: 0, lw: 0, sc: 0, lr: 0, cv: 0, vel: 0, mina: 0, riel: 0, rio: 0, rioOn: 1, cubre: 0, ir: 0, mapa: 0, nombres: 0 });

    tl.label('mina').caption(4.8, 'Desarmar Mercurio', 'Para el enjambre hace falta materia. Máquinas que se copian deshacen Mercurio en menos de una vida.');
    luego(0.3, 4.4, { mina: 0.62 });
    tl.to(4.8, { ...c1 });

    // The rail lights up along its length; the camera comes down by its start, gets on a load and
    // rides it as the coils fire, faster and faster, off the end of the rail into the river of rock.
    tl.label('catapulta').caption(8.2, 'La catapulta', 'Sin aire que frene, un riel lanza la roca al espacio. Vamos en una carga.');
    tl.with(1.6, { riel: 1 });
    luego(0.5, 5.0, { rio: 0.55 });
    tl.to(1.8, { ...c2, mm: 1 });
    tl.with(1.0, { lr: 1, fov: 50 });
    tl.to(3.4, { cv: 1 }, (x) => x * x);
    // Beside the river, carried along it: the grains stream past below, the Sun ahead.
    // (one ride hands over to the other while the load still flies: the two weights add to one)
    luego(-0.7, 1.8, { lr: 0, lw: 1 });
    tl.to(3.0, { ...c3, sc: 0.04, fov: 40 });

    // The river carries the camera into the swarm's shell; off it, round the Sun among the
    // collectors (they cross its face, dark; they flash as they turn their light to us); and out
    // through the shell as it closes: from outside, the Sun goes out behind it.
    tl.label('pared').caption(12.6, 'La pared que tapa el Sol', 'No es una cáscara: es un enjambre, cada colector en su órbita. Desde afuera, el Sol se va apagando.');
    luego(0, 3.6, { rio: 1 });
    luego(0.4, 6.4, { cubre: 0.8 });
    tl.to(4.2, { sc: 0.93 });
    luego(-1.2, 1.4, { vel: 0.3 });
    // (the gaze settles on the Sun first, still on the river; then the camera leaves the river)
    luego(-0.8, 1.0, { ms: 1 });
    tl.with(1.8, { lw: 0, ...dentroA, fov: 52 });
    luego(1.4, 1.4, { vel: 0 });
    tl.to(3.6, { ...dentroB });
    luego(0.4, 3.0, { cubre: 1 });
    tl.to(2.2, { ...c5, ms: 1, fov: 40 });
    tl.to(2.6, { ...c6 });

    // The reveal: far out, the whole system ours, the Sun dim in its swarm; the names a moment; still.
    tl.label('lejos').caption(8.0, 'Visto desde lejos', 'Desde otra estrella, un Sol así se vería débil y tibio. Así buscamos a otros. Hasta ahora, nadie.');
    luego(0.6, 3.4, { ir: 1, rioOn: 0 });
    luego(2.6, 2.2, { mapa: 1 });
    luego(4.2, 1.4, { nombres: 1 });
    tl.to(5.0, { ...lejos, fov: 30 });
    luego(1.6, 1.2, { nombres: 0 });
    luego(1.8, 1.2, { mapa: 0 });
    tl.wait(3.0);

    // The spark: from where scene 10 left it over Mercury, to the rail's end (ch 0..1), along the river
    // just ahead of the camera (1..2), and round the Sun among the collectors (2..3).
    const llega = M.clone().add(V(0, 0.25, 0));
    const inicioRiel = enRiel(0, 0.004);
    const caminoCh: Camino = (sv, out) => {
      if (sv <= 1) return out.copy(llega).lerp(inicioRiel, THREE.MathUtils.smoothstep(Math.max(0, sv), 0, 1));
      if (sv <= 2) return enRiel(sv - 1, 0.004, out);
      if (sv <= 3) return camino(Math.min(1, sv - 2), out).addScaledVector(Y, 0.02 * THREE.MathUtils.smoothstep(sv - 2, 0, 0.05)).addScaledVector(N_T, 0.004 * (1 - THREE.MathUtils.smoothstep(sv - 2, 0, 0.05)));
      const a = PHI0 + PHI + (sv - 3) * 2.2;
      return out.set(Math.sin(a) * 3.1, 0.2 * Math.sin((sv - 3) * 5), Math.cos(a) * 3.1);
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
      escalera: false,
      efectos(p) {
        return { vel: tl.get('vel', p) };
      },
      cuenta(p) {
        const c: Cuenta = p < tl.at('catapulta') ? potencia(16.6) : p < tl.at('pared') ? potencia(17.4) : potencia(18 + 8.58 * tl.get('cubre', p));
        // How far we reach: the five worlds, then the Sun itself, once the swarm closes.
        const sol1 = tl.at('pared') + 5.4;
        c.alcance = p < sol1 ? '5 mundos' : '1 estrella';
        c.nuevo = p >= sol1 ? 1 - THREE.MathUtils.smoothstep(p, sol1, sol1 + 1.8) : 0;
        return c;
      },
      placa(g, f) {
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
      },
      anio(p) {
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[0, 2066], [a('catapulta'), 2068], [a('pared'), 2070], [a('lejos'), 2085], [tl.length, 2090]]);
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
        // Where it looks: Mercury, the rail's end ahead, the river ahead, the Sun.
        const sc = tl.get('sc', p);
        camino(Math.min(1, sc + 0.16), adelante).lerp(V(), 0.25);
        const mm = tl.get('mm', p);
        const ms = tl.get('ms', p);
        const lw = tl.get('lw', p);
        const objetivo = M.clone().lerp(M.clone().lerp(T, 0.5).addScaledVector(D, 1.6), mm);
        objetivo.lerp(adelante, lw);
        objetivo.lerp(V(), ms);
        aqui.copy(fuera(sc));
        // The spark: to the rail while it fires, then just ahead of the camera on the river, then in the swarm.
        const cv = tl.get('cv', p);
        const lr = tl.get('lr', p);
        const llegaA = THREE.MathUtils.clamp((p - tl.at('mina') - 1) / (tl.at('catapulta') + 1.8 - tl.at('mina') - 1), 0, 1);
        const chP = p < tl.at('pared') + 3.4 ? llegaA + cv + Math.min(1, sc + 0.035 * lw) : 3 + (p - tl.at('pared') - 3.4) / 8;
        chispa.update(caminoCh, chP, chP > 1 && chP < 3 ? 0.0012 : 0.01, 1, 0, camera.position, f.focal, f.dpr, f.time);
        // On the load: just behind and above it, looking down the rail (the coils streaming by, the
        // end of the rail and the sky ahead); handed over to the river ride as it launches.
        let lugarP = aqui;
        let lugarW = lw;
        let arribaR: THREE.Vector3 | undefined;
        if (lr > 0.0005) {
          const rad = enRiel(cv, 0).sub(M).normalize();
          const railCam = enRiel(cv - 0.06, 0.032).addScaledVector(rad, 0.0);
          const railMira = enRiel(cv + 0.3, 0.0);
          const w = lr / Math.max(1e-6, lr + lw);
          lugarP = aqui.clone().lerp(railCam, w);
          lugarW = Math.max(lw, lr, Math.min(1, lr + lw));
          objetivo.lerp(railMira, lr);
          // (on the rail, «up» is Mercury's own: away from its ground)
          arribaR = Y.clone().lerp(rad, lr).normalize();
        }
        aplicarToma(camera, toma(tl, p, tm, { punto: objetivo, peso: 1, arriba: arribaR }, { punto: lugarP, peso: lugarW }));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        // Seen from outside the swarm, the Sun goes out behind it as it closes.
        const afuera = THREE.MathUtils.smoothstep(camera.position.length(), 2.6, 3.9);
        sol.u.uBrillo.value = 2.2 * (1 - 0.86 * tl.get('cubre', p) * afuera);
        sol.update({ sol: V(1, 0, 0), camara: camera.position.clone(), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        merc.update({ sol: M.clone().negate().normalize(), camara: camera.position.clone().sub(M).divideScalar(RM), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        minaU.uMina.value = tl.get('mina', p);
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
