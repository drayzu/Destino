import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { luna as lunaH, marte as marteH, mercurio as mercurioH, sol as solH, tierra as tierraH, venus as venusH } from '../src/horizontes';
import { HORIZONTE, TEAL, caraHacia, dirLatLon, potencia } from './remake';
import { angulos, aplicarToma, toma } from './rig';
import { crearChispa, montar, type Camino } from './chispa';
import { CARA } from './tierra';
import { enfocarMarcas, marcas, orbitas, rotularMapa, type RotuloMapa } from './revelar';
import { M, RM } from './mercurio';
import type { Cuenta, Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scenes 8–10 of ESCALETA.md: the Solar System at work (GUION.md, moments 20–24), in the same frame
 * as Mercury's scene (solar radii, the Sun at the origin, distances drawn short), so the Earth hands
 * over to it and it hands Mercury over without a cut.
 *
 * From the Earth and its ring, to a world that turns: an O'Neill cylinder, land and windows in
 * strips, its mirrors. In along its axis: the land rises up the sides and passes overhead, clouds in
 * the middle. Out the far end, riding a thread of cargo to Mars: mirrors over its south pole, domes
 * of light on its red ground. Back out to the whole inner system at work, all at once: threads of
 * teal between the worlds, the Moon throwing rock, the belt being mined, the first glints of a swarm
 * by the Sun. Down to Venus, among its yellow clouds, where cities float; a shade between it and the
 * Sun. And on to Mercury.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const D2R = THREE.MathUtils.degToRad;
const enOrbita = (r: number, deg: number, y = 0) => V(Math.sin(D2R(deg)) * r, y, Math.cos(D2R(deg)) * r);

const E = enOrbita(36, 140);
const RE = 0.35;
const LUNA = E.clone().add(V(0.9, 0.12, 0.7));
const VE = enOrbita(26, 172);
const RV = 0.34;
const MA = enOrbita(50, 106, 0.4);
const RMA = 0.2;
/** The cylinder: beside the Earth, its axis to the Sun. */
const C = E.clone().add(enOrbita(1, 140 + 90).multiplyScalar(3.0)).add(V(0, 0.35, 0));
const EJE = C.clone().negate().normalize();
const LC = 0.9;
const RC = 0.13;

/** A quadratic arc between two places (bulging up and outwards), for the threads of cargo. */
function arco(a: THREE.Vector3, b: THREE.Vector3, alto = 0.15) {
  const L = a.distanceTo(b);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const fuera = mid.clone().setY(0).normalize();
  const c = mid.addScaledVector(Y, alto * L).addScaledVector(fuera, 0.08 * L);
  return { a: a.clone(), c, b: b.clone(), en: (t: number, out = V()) => out.copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(c, 2 * (1 - t) * t).addScaledVector(b, t * t) };
}

/** A thread: grains flowing along an arc (`aKind` its phase, `aOff` its place across). */
function hilo(a: THREE.Vector3, b: THREE.Vector3, n: number, ancho: number, alto = 0.15) {
  const r = arco(a, b, alto);
  const bld = materiaBuilder(Math.round(a.x * 100 + b.z * 10));
  const off: number[] = [];
  for (let i = 0; i < n; i++) {
    bld.push(0, 0, 0, TEAL, 0.006, 0.25 + bld.r() * 0.3, { kind: bld.r() });
    off.push(gauss(bld.r), gauss(bld.r));
  }
  const nube = materia(bld.data(), {
    pre: /* glsl */ `
      attribute vec2 aOff;
      uniform vec3 uA, uB, uC;
      uniform float uOn, uVel, uAncho;
    `,
    move: /* glsl */ `
      float sv = fract(aKind + uTime * uVel);
      float iv = 1.0 - sv;
      p = uA * iv * iv + uC * 2.0 * iv * sv + uB * sv * sv;
      vec3 tg = normalize(2.0 * iv * (uC - uA) + 2.0 * sv * (uB - uC));
      vec3 n1 = normalize(cross(tg, vec3(0.0, 1.0, 0.0)));
      vec3 n2 = cross(tg, n1);
      p += (n1 * aOff.x + n2 * aOff.y) * uAncho;
      em *= uOn * smoothstep(0.0, 0.06, sv) * (1.0 - smoothstep(0.94, 1.0, sv));
    `,
    uniforms: { uA: { value: r.a }, uB: { value: r.b }, uC: { value: r.c }, uOn: { value: 0 }, uVel: { value: 0.012 }, uAncho: { value: ancho } },
    extra: { aOff: [new Float32Array(off), 2] },
  });
  nube.u.uFuente.value = 0.5;
  return { nube, arco: r };
}

/**
 * The cylinder, in its own frame (axis +Z): three strips of land (fields, rivers, towns) and three
 * of windows, its end caps, clouds in the middle, and three mirrors hinged at the shaded end.
 * `aKind`: 0 land, 1 window, 2 cap, 3 cloud, 4 mirror.
 */
function cilindroDatos(): MateriaData {
  const b = materiaBuilder(131);
  const r = b.r;
  const c = new THREE.Color();
  const sector = (k: number) => (k * Math.PI) / 3;
  for (let i = 0; i < 150000; i++) {
    const k = 2 * Math.floor(r() * 3);
    const fi = sector(k) + r() * (Math.PI / 3);
    const z = (r() - 0.5) * LC;
    const campo = 0.5 + 0.5 * Math.sin(fi * 23 + Math.sin(z * 40) * 2) * Math.sin(z * 55 + fi * 7);
    c.setRGB(0.28 + 0.2 * campo, 0.46 + 0.12 * campo, 0.2 + 0.06 * campo);
    let luz = 0.42;
    if (Math.abs(Math.sin(z * 26 + fi * 5)) < 0.03) {
      c.setRGB(0.3, 0.55, 0.85);
      luz = 0.6;
    } else if (r() < 0.015) {
      c.setRGB(1.0, 0.78, 0.5);
      luz = 1.4;
    }
    b.push(Math.cos(fi) * RC, Math.sin(fi) * RC, z, c, 0.0016, luz, { kind: 0 });
  }
  for (let i = 0; i < 30000; i++) {
    const k = 2 * Math.floor(r() * 3) + 1;
    const fi = sector(k) + r() * (Math.PI / 3);
    const z = (r() - 0.5) * LC;
    b.push(Math.cos(fi) * RC, Math.sin(fi) * RC, z, new THREE.Color(0.62, 0.8, 1.0), 0.0016, 0.28, { kind: 1 });
  }
  for (const zc of [-LC / 2, LC / 2]) {
    for (let i = 0; i < 12000; i++) {
      const q = Math.sqrt(r()) * RC;
      const fi = r() * Math.PI * 2;
      b.push(Math.cos(fi) * q, Math.sin(fi) * q, zc, new THREE.Color(0.55, 0.58, 0.62), 0.0016, 0.14, { kind: 2 });
    }
  }
  for (let k = 0; k < 40; k++) {
    const fi = r() * Math.PI * 2;
    const q = RC * (0.5 + r() * 0.22);
    const z = (r() - 0.5) * LC * 0.9;
    for (let i = 0; i < 160; i++) b.push(Math.cos(fi) * q + gauss(r) * 0.006, Math.sin(fi) * q + gauss(r) * 0.006, z + gauss(r) * 0.012, 0xffffff, 0.002, 0.22, { kind: 3 });
  }
  // The mirrors: one beside each window, hinged at the shaded end (−Z), opened 28° outwards.
  for (let k = 0; k < 3; k++) {
    const fi0 = sector(2 * k + 1);
    for (let i = 0; i < 9000; i++) {
      const u = r();
      const v = r();
      const fi = fi0 + v * (Math.PI / 3);
      const along = u * LC;
      const abre = along * Math.sin(D2R(28));
      const rr = RC + abre;
      b.push(Math.cos(fi) * rr, Math.sin(fi) * rr, -LC / 2 + along * Math.cos(D2R(28)), new THREE.Color(0.78, 0.84, 0.9), 0.0016, 0.12, { kind: 4 });
    }
  }
  return b.data();
}

/** Mars' mirrors (a ring under its south pole), the light they send down, and domes on its ground. Mars radii. */
function marteDatos(): MateriaData {
  const b = materiaBuilder(137);
  const r = b.r;
  for (let i = 0; i < 900; i++) {
    const fi = r() * Math.PI * 2;
    b.push(Math.cos(fi) * 0.9, -1.7, Math.sin(fi) * 0.9, new THREE.Color(1.0, 0.95, 0.85), 0.006, 1.0, { kind: 0 });
  }
  for (let i = 0; i < 5000; i++) {
    const fi = r() * Math.PI * 2;
    const t = r();
    const a = V(Math.cos(fi) * 0.9, -1.7, Math.sin(fi) * 0.9);
    const p = a.lerp(V(0, -1.0, 0), t);
    b.push(p.x, p.y, p.z, new THREE.Color(1.0, 0.8, 0.55), 0.004, 0.06, { kind: 1 });
  }
  for (let d = 0; d < 34; d++) {
    const c = dirLatLon(-30 + r() * 60, 40 + r() * 110);
    const t1 = Y.clone().cross(c).normalize();
    const t2 = c.clone().cross(t1);
    for (let i = 0; i < 260; i++) {
      const [x, y, z] = b.onSphere();
      const h = Math.abs(y);
      const p = c.clone().multiplyScalar(1.002 + h * 0.03).addScaledVector(t1, x * 0.035).addScaledVector(t2, z * 0.035);
      b.push(p.x, p.y, p.z, TEAL, 0.0025, 0.22, { kind: 2 });
    }
  }
  return b.data();
}

/** Venus' cloud tops, the cities floating in them and the shade between it and the Sun. Venus radii, the Sun towards `sol`. */
function venusDatos(sol: THREE.Vector3): MateriaData {
  const b = materiaBuilder(139);
  const r = b.r;
  for (let i = 0; i < 70000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 1.012 + r() * 0.04;
    b.push(x * q, y * q, z * q, new THREE.Color(0.95, 0.84, 0.56), 0.003, 0.04 + r() * 0.07, { kind: 0 });
  }
  for (let d = 0; d < 26; d++) {
    const c = sol.clone().add(V(gauss(r) * 0.6, gauss(r) * 0.45, gauss(r) * 0.6)).normalize();
    const t1 = Y.clone().cross(c).normalize();
    const t2 = c.clone().cross(t1);
    for (let i = 0; i < 220; i++) {
      const [x, y, z] = b.onSphere();
      const p = c.clone().multiplyScalar(1.05 + Math.abs(y) * 0.008).addScaledVector(t1, x * 0.016).addScaledVector(t2, z * 0.016);
      b.push(p.x, p.y, p.z, TEAL, 0.0012, 0.3, { kind: 1 });
    }
  }
  const t1 = Y.clone().cross(sol).normalize();
  const t2 = sol.clone().cross(t1);
  for (let i = 0; i < 26000; i++) {
    const q = Math.sqrt(r()) * 1.3;
    const fi = r() * Math.PI * 2;
    const p = sol.clone().multiplyScalar(2.2).addScaledVector(t1, Math.cos(fi) * q).addScaledVector(t2, Math.sin(fi) * q);
    b.push(p.x, p.y, p.z, new THREE.Color(0.7, 0.85, 0.9), 0.006, 0.08, { kind: 2 });
  }
  return b.data();
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
  // The study of «revelar» (30 Oct): three ways to show, once an act, everything we reach.
  estilos: [
    { key: '1', nombre: 'Potencias de diez', nota: 'Revelar: la cámara suelta la chispa y se aleja de un tirón, década tras década, hasta que cabe todo lo nuestro. Venus queda como un punto.' },
    { key: '2', nombre: 'Mirar atrás', nota: 'Revelar: la cámara se queda con la chispa, pero se da vuelta y ve lo que deja atrás: Venus, la Tierra, Marte, los hilos.' },
    { key: '3', nombre: 'El mapa', nota: 'Revelar: la cámara sube hasta mirar desde arriba, como una lámina: las órbitas, los nombres, lo nuestro en verde agua.' },
  ],
  montar(stage, estilo): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.5;
    stage.renderer.toneMappingExposure = 1.05;
    const base = `${import.meta.env.BASE_URL}texturas/`;

    const sol = solH({ puntos: 200000, corona: 80000 });
    root.add(sol.group);
    sol.u.uBrillo.value = 2.0;
    const tierra = tierraH(base, { giro: 0, puntos: 260000 });
    const tierraG = new THREE.Group();
    tierraG.position.copy(E);
    tierraG.scale.setScalar(RE);
    tierraG.quaternion.copy(caraHacia(CARA.lat, CARA.lon));
    tierraG.add(tierra.group);
    root.add(tierraG);
    const luna = lunaH(base, { giro: 0, puntos: 90000 });
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

    // The cylinder.
    const cilG = new THREE.Group();
    cilG.position.copy(C);
    cilG.quaternion.setFromUnitVectors(V(0, 0, 1), EJE);
    root.add(cilG);
    const cilindro = add(
      materia(cilindroDatos(), {
        pre: /* glsl */ `uniform float uCil;`,
        move: /* glsl */ `
          float ag = uTime * 0.35;
          float cg = cos(ag);
          float sg = sin(ag);
          p.xy = vec2(cg * p.x - sg * p.y, sg * p.x + cg * p.y);
          em *= uCil;
        `,
        uniforms: { uCil: { value: 0 } },
      }),
      cilG,
    );
    cilindro.u.uFuente.value = 0.35;

    const marteN = add(
      materia(marteDatos(), {
        pre: /* glsl */ `uniform float uMar; uniform vec3 uCamL; ${HORIZONTE}`,
        move: /* glsl */ `
          if (aKind < 0.5) em *= 0.25 + 3.0 * pow(max(0.0, sin(uTime * 1.3 + seed * 30.0)), 24.0);
          if (aKind > 1.5) em *= delante(p, uCamL);
          em *= uMar;
        `,
        uniforms: { uMar: { value: 0 }, uCamL: { value: V() } },
      }),
      marteG,
    );
    marteN.u.uFuente.value = 0.5;
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

    // The threads of cargo.
    const salidaCil = C.clone().addScaledVector(EJE, -(LC / 2 + 0.3));
    const llegaMarte = MA.clone().add(V(-0.25, 0.45, 0.35));
    const hilos = {
      tierraCil: hilo(E.clone().addScaledVector(C.clone().sub(E).normalize(), RE * 1.4), C.clone().addScaledVector(EJE, LC / 2 + 0.1), 6000, 0.02, 0.1),
      cilMarte: hilo(salidaCil, llegaMarte, 16000, 0.04, 0.08),
      luna: hilo(LUNA, C.clone().addScaledVector(EJE, -LC / 2), 4000, 0.015, 0.2),
      cinturon: hilo(enOrbita(61, 120), MA, 9000, 0.12, 0.1),
      venus: hilo(E, VE, 9000, 0.06, 0.1),
      mercurio: hilo(M, enOrbita(3.2, 220), 9000, 0.05, 0.05),
      venusMerc: hilo(VE.clone().add(V(0, 0.3, 0)), M.clone().add(V(0, 0.25, 0)), 9000, 0.05, 0.06),
      marteVenus: hilo(llegaMarte, VE.clone().add(V(0.2, 0.45, 0.3)), 9000, 0.05, 0.08),
    };
    for (const h of Object.values(hilos)) add(h.nube);

    // Revealing: the orbits, a mark on each world (ours ringed in teal; Mercury's ring when the spark gets there).
    const orbs = add(orbitas([{ r: M.length() }, { r: VE.length() }, { r: E.length() }, { r: Math.hypot(MA.x, MA.z), y: MA.y }]));
    const AZUL = new THREE.Color(0.45, 0.68, 1.0);
    const nuestras = add(
      marcas([
        { pos: E, R: RE, color: AZUL, nuestro: true },
        { pos: MA, R: RMA, color: new THREE.Color(1.0, 0.52, 0.32), nuestro: true },
        { pos: VE, R: RV, color: new THREE.Color(1.0, 0.88, 0.62), nuestro: true },
      ]),
    );
    const mercMarca = add(marcas([{ pos: M, R: RM, color: new THREE.Color(0.78, 0.74, 0.7) }]));
    const mercAro = add(marcas([{ pos: M, R: RM, color: new THREE.Color(0.78, 0.74, 0.7), nuestro: true }]));
    const ROTULOS: RotuloMapa[] = [
      { pos: V(), texto: 'Sol', dx: -34, dy: 30 },
      { pos: M, texto: 'Mercurio', dx: -40, dy: -26 },
      { pos: VE, texto: 'Venus · ciudades en las nubes', dx: -30, dy: -40, nuestro: true },
      { pos: E, texto: 'Tierra · el anillo', dx: 26, dy: -44, nuestro: true },
      { pos: C, texto: 'Un mundo que gira', dx: 34, dy: 62, nuestro: true },
      { pos: MA, texto: 'Marte · cúpulas', dx: 30, dy: -34, nuestro: true },
      { pos: enOrbita(61, 120), texto: 'El cinturón · minas', dx: 22, dy: -24 },
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
    const cW = dirLatLon(0, 37).applyQuaternion(tierraG.quaternion);
    const norte = Y.clone().applyQuaternion(tierraG.quaternion);
    const fin7 = angulos(cW.clone().applyAxisAngle(norte, D2R(-75)).multiplyScalar(Math.cos(0.84)).addScaledVector(norte, Math.sin(0.84)));
    // The cylinder from outside, three-quarters, its mirrors open.
    const vistaCil = EJE.clone().cross(Y).normalize().addScaledVector(Y, 0.55).addScaledVector(EJE, -0.35).normalize();
    // Mercury as its scene starts (mercurio.ts, c0).
    const rM = M.clone().normalize();
    const eM = Y.clone().cross(rM).normalize();
    const D = (() => {
      const r0 = 18;
      const ph = THREE.MathUtils.degToRad(205);
      const p0 = V(Math.sin(ph) * r0, 0, Math.cos(ph) * r0);
      const p1 = V(Math.sin(ph + 1.45 * 0.002) * r0 * Math.pow(3 / 18, 0.002), 0, Math.cos(ph + 1.45 * 0.002) * r0 * Math.pow(3 / 18, 0.002));
      return p1.sub(p0).normalize();
    })();
    const ladoM = eM.clone().multiplyScalar(eM.dot(D) > 0 ? -1 : 1);
    // The reveal: everything ours in one frame (centred between the Sun and Mars).
    const CMAPA = V(20, 0, -14);
    // Looking back (way 2): towards where the spark comes from.
    const ATRAS = VE.clone().add(E).add(MA).multiplyScalar(1 / 3);
    const c0Merc = M.clone().addScaledVector(ladoM.clone().addScaledVector(Y, 0.3).addScaledVector(rM, 0.25).normalize(), 1.75);

    // The spark's way (GUION.md v2, 22–26): from the Earth's ring to the cylinder (ch 0..1), along its
    // axis (1..2), on the thread to Mars (2..3), on to Venus (3..4), and to Mercury (4..5).
    const entradaCil = C.clone().addScaledVector(EJE, LC / 2 + 0.25);
    const cilPath0 = (sv: number, out: THREE.Vector3) => out.copy(C).addScaledVector(EJE, LC / 2 + 0.25 - sv * (LC + 0.55));
    const caminoCh: Camino = (sv, out) => {
      if (sv <= 1) return hilos.tierraCil.arco.en(Math.max(0, sv), out).lerp(entradaCil, THREE.MathUtils.smoothstep(sv, 0.85, 1));
      if (sv <= 2) return cilPath0(sv - 1, out);
      if (sv <= 3) return hilos.cilMarte.arco.en(sv - 2, out);
      if (sv <= 4) return hilos.marteVenus.arco.en(sv - 3, out);
      return hilos.venusMerc.arco.en(Math.min(1, sv - 4), out);
    };
    tl.set({ ...Cn(E), ox: 0, oy: 0, oz: 0, az: fin7.az, el: fin7.el, ld: Math.log10(23 * RE), yaw: 90, pitch: -90, roll: 0, fov: 34, mw: 0, lw: 0, ch: 0, on: 1, cil: 0, mar: 0, todo: 0, ven: 0, sombra: 0, anillo: 1, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, vel: 0, mapa: 0, nombres: 0, vuelta: 0 });

    // From the ring, a beam carries the spark to a world that turns, seen from outside.
    tl.label('giran').caption(5.4, 'Mundos que giran', 'Para vivir lejos de la Tierra hacen falta mundos que giren: el giro hace de gravedad.');
    tl.with(1.4, { cil: 1, h1: 1 });
    tl.with(1.3, { ...Cn(C) });
    luego(0.6, 4.4, { ch: 1 });
    tl.to(5.4, { ...rel(C, C.clone().addScaledVector(vistaCil, 1.25)), fov: 40 });

    // In through the sunward cap with it, along the axis, out the shaded end.
    const entrada = C.clone().addScaledVector(EJE, LC / 2 + 0.6);
    tl.label('dentro').caption(5.6, 'Un mundo por dentro', 'Adentro, el paisaje sube por los lados y pasa por arriba.');
    tl.to(1.4, { ...rel(C, entrada) });
    tl.to(0.9, { lw: 1, mw: 1 });
    luego(1.6, 1.4, { h2: 1 });
    tl.to(3.3, { ch: 2 });

    // On the thread to Mars; mirrors over its pole, domes that light up.
    tl.label('marte').caption(6.0, 'Calentar Marte', 'Unos espejos pueden calentar Marte, pero su aire nunca será como el nuestro: viviríamos bajo cúpulas.');
    luego(0.6, 2.4, { mar: 1 });
    tl.to(3.0, { ch: 3, vel: 0.3 });
    tl.with(0.8, { ...Cn(MA) });
    tl.to(3.0, { lw: 0, mw: 0, vel: 0, ...rel(MA, MA.clone().add(V(0.25, -0.38, 0.62))), fov: 40 });

    // Across to Venus (the spark on its thread, seen going), into its clouds.
    tl.label('venus').caption(6.6, 'Venus, a la sombra', 'Venus es un horno, pero en lo alto de sus nubes el aire es templado: ahí pueden flotar ciudades.');
    tl.with(0.6, { h6: 1 });
    luego(0.2, 3.0, { ch: 4 });
    tl.with(1.6, { ...Cn(VE) });
    luego(1.6, 2.0, { ven: 1, sombra: 1 });
    tl.to(3.0, { ...rel(VE, VE.clone().addScaledVector(solVenus.clone().applyAxisAngle(Y, D2R(-55)).addScaledVector(Y, 0.3).normalize(), 0.62)), fov: 40 });
    tl.to(3.6, { ...rel(VE, VE.clone().addScaledVector(solVenus.clone().applyAxisAngle(Y, D2R(-30)).addScaledVector(Y, 0.18).normalize(), RV * 1.12)), pitch: -12, yaw: 60, fov: 48 });

    // The reveal: all the inner system woven with threads, the spark one point on its way to Mercury.
    const TODO = 'Todo ocurre a la vez: la Luna lanza roca, se minan los asteroides y, cerca del Sol, crece un enjambre.';
    tl.label('todo').caption(9.6, 'Todo a la vez', TODO);
    tl.with(1.6, { todo: 1, h3: 1, h4: 1, h5: 1, ven: 0 });
    const llegaM = estilo === 1 ? 11.0 : 8.0;
    luego(0.4, llegaM - 0.4, { ch: 5 });
    if (estilo === 0) {
      // Powers of ten: straight down at Venus, then out decade after decade (a little speed blur for
      // the vertigo); the centre slides to the whole once the distance is there. Then still.
      tl.with(1.4, { pitch: -90, yaw: 90 });
      luego(0.3, 4.6, { ld: Math.log10(105), el: 50, az: -30, fov: 36 });
      luego(0.9, 1.4, { vel: 0.35 });
      luego(2.3, 1.6, { vel: 0 });
      luego(2.6, 2.4, { ...Cn(CMAPA) });
      luego(2.2, 2.0, { mapa: 1 });
      tl.wait(4.9);
      tl.to(3.6, { az: -24 });
    } else if (estilo === 1) {
      // Looking back: on the spark again as it leaves Venus; the camera swings round ahead of it and
      // looks back at everything it leaves; then turns forward again.
      tl.with(1.6, { lw: 1, mw: 1, fov: 44 });
      luego(1.4, 3.4, { vuelta: 1, fov: 60 });
      luego(2.4, 2.0, { mapa: 1 });
      // (Out of sight while it rides: the rig waits where Mercury's scene starts.)
      luego(2.0, 0.5, { ...Cn(M), ...rel(M, c0Merc), pitch: -90, yaw: 90 });
      tl.wait(7.8);
      tl.to(2.0, { vuelta: 0, fov: 44 });
    } else {
      // The map: up until it looks straight down, like a plate (the orbits, the names); then still.
      tl.with(1.4, { pitch: -90, yaw: 90 });
      luego(0.3, 4.4, { ld: Math.log10(80), el: 89.5, az: 0, fov: 36 });
      luego(2.4, 2.4, { ...Cn(CMAPA) });
      luego(2.0, 2.0, { mapa: 1 });
      luego(3.6, 1.4, { nombres: 1 });
      tl.wait(5.0);
      tl.to(3.6, { az: 2 });
    }
    // And down to Mercury, where its scene starts.
    tl.with(1.2, { ...Cn(M), mapa: 0, nombres: 0 });
    luego(1.6, 1.4, { todo: 0.3, h3: 0.3, h4: 0.3 });
    if (estilo === 1) tl.to(2.6, { lw: 0, mw: 0, fov: 40 });
    else tl.to(3.0, { ...rel(M, c0Merc), fov: 40 });

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
        return { vel: tl.get('vel', p) };
      },
      cuenta(p) {
        const c: Cuenta = p < tl.at('marte') ? potencia(16.3) : p < tl.at('todo') ? potencia(16.5) : potencia(16.7);
        // How far we reach: a world more each time the spark gets to one.
        const pasos = [tl.at('giran') + 4.6, tl.at('marte') + 3.2, tl.at('venus') + 3.4, tl.at('todo') + llegaM - 0.1];
        const n = pasos.filter((x) => p >= x).length;
        c.alcance = n === 0 ? '1 mundo' : `${n + 1} mundos`;
        c.nuevo = n > 0 ? 1 - THREE.MathUtils.smoothstep(p, pasos[n - 1], pasos[n - 1] + 1.8) : 0;
        return c;
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'III · El sistema solar trabaja', name: c.name, fact: c.fact } : null;
      },
      placa(g, f) {
        rotularMapa(g, f, ROTULOS, tl.get('nombres', f.p), 'El sistema solar interior');
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-5;
        camera.far = 3000;
        const ch = tl.get('ch', p);
        const lw = tl.get('lw', p);
        const mw = tl.get('mw', p);
        const enCil = ch > 1 && ch <= 2;
        const m = montar(caminoCh, ch, enCil ? 0.08 : 0.025, enCil ? 0.25 : 0.06, enCil ? 0.0 : 0.04);
        lugar.copy(m.lugar);
        mira.copy(m.mira);
        const centro = V(tl.get('cx', p), tl.get('cy', p), tl.get('cz', p));
        if (lw < 0.999) mira.lerp(centro, 1 - lw);
        // Way 2: round from behind the spark to ahead of it, raised, looking back past it.
        const vuelta = tl.get('vuelta', p);
        if (vuelta > 0.0005) {
          const aqui = caminoCh(ch, V());
          const tg = caminoCh(ch + 0.01, V()).sub(aqui).normalize();
          const lado = Y.clone().cross(tg).normalize();
          const th = Math.PI * vuelta;
          const dist = 0.5 + 2.0 * vuelta;
          const giro = tg.clone().multiplyScalar(-Math.cos(th)).addScaledVector(lado, Math.sin(th)).multiplyScalar(dist).addScaledVector(Y, 0.04 + 1.5 * vuelta);
          const w = Math.min(1, vuelta * 6);
          lugar.lerp(aqui.clone().add(giro), w);
          // The gaze: through the spark, then (ahead of it) level out to 12° down and turn a little
          // towards what it leaves, so the spark sits low in the frame and the system fills the rest.
          const aSpark = aqui.clone().sub(lugar);
          const hor = aSpark.clone().setY(0).normalize();
          const haciaAtras = ATRAS.clone().sub(lugar).setY(0).normalize();
          hor.lerp(haciaAtras, 0.4 * vuelta).normalize();
          const baja = THREE.MathUtils.lerp(Math.atan2(-aSpark.y, Math.hypot(aSpark.x, aSpark.z)), THREE.MathUtils.degToRad(12), vuelta);
          const gaze = hor.multiplyScalar(Math.cos(baja)).addScaledVector(Y, -Math.sin(baja));
          mira.copy(lugar).addScaledVector(gaze, 10);
        }
        aplicarToma(camera, toma(tl, p, tm, { punto: mira, peso: mw }, { punto: lugar, peso: lw }));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        sol.update({ sol: V(1, 0, 0), camara: camera.position.clone(), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        for (const x of cuerpos) {
          inv.copy(x.q).invert();
          const solL = x.g.position.clone().negate().normalize().applyQuaternion(inv);
          const camL = camera.position.clone().sub(x.g.position).divideScalar(x.R).applyQuaternion(inv);
          // Far bodies are a few pixels: skip their fine points.
          const lejos = camL.length() > 400;
          x.c.group.visible = !lejos || x.R > 0.3;
          x.c.update({ sol: solL, camara: camL, focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        }
        const lejosDe = (q: THREE.Vector3, d0: number, k = 1) => Math.min(1, Math.pow(d0 / Math.max(1e-6, camera.position.distanceTo(q)), k));
        cilindro.u.uCil.value = tl.get('cil', p) * lejosDe(C, 5, 2);
        chispa.update(caminoCh, ch, enCil ? 0.0025 : 0.0012, tl.get('on', p), 0, camera.position, f.focal, f.dpr, t);
        hilos.marteVenus.nube.u.uOn.value = Math.max(tl.get('h6', p), tl.get('todo', p));
        marteN.u.uMar.value = tl.get('mar', p);
        marteN.u.uCamL.value.copy(camera.position).sub(MA).divideScalar(RMA);
        venusN.u.uVen.value = tl.get('ven', p);
        venusN.u.uSombra.value = tl.get('sombra', p);
        venusN.u.uCamL.value.copy(camera.position).sub(VE).divideScalar(RV);
        cinturon.u.uTodo.value = tl.get('todo', p);
        const mapa = tl.get('mapa', p);
        orbs.u.uOn.value = mapa;
        marteN.u.uSizeUnit.value = RMA;
        venusN.u.uSizeUnit.value = RV;
        anillo.u.uSizeUnit.value = RE;
        anillo.u.uGain.value = tl.get('anillo', p) * lejosDe(E, 10, 1);
        hilos.tierraCil.nube.u.uOn.value = tl.get('h1', p);
        hilos.cilMarte.nube.u.uOn.value = Math.max(tl.get('h2', p), tl.get('todo', p));
        for (const h of [hilos.luna, hilos.cinturon, hilos.venus]) h.nube.u.uOn.value = Math.max(tl.get('h3', p), tl.get('todo', p));
        hilos.mercurio.nube.u.uOn.value = tl.get('h4', p);
        hilos.venusMerc.nube.u.uOn.value = tl.get('h5', p);
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        // Mercury's ring once the spark is there.
        const llego = THREE.MathUtils.smoothstep(ch, 4.9, 5.0);
        enfocarMarcas(nuestras, f.dpr, mapa);
        enfocarMarcas(mercMarca, f.dpr, mapa * (1 - llego));
        enfocarMarcas(mercAro, f.dpr, mapa * llego);
        for (const h of Object.values(hilos)) {
          h.nube.u.uMaxPx.value = 3 * f.dpr;
          h.nube.u.uGain.value = lejosDe(h.arco.c, 14, 0.9);
        }
        cinturon.u.uMaxPx.value = 3 * f.dpr;
      },
      dispose() {},
    };
  },
};
