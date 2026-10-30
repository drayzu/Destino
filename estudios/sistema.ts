import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { luna as lunaH, marte as marteH, mercurio as mercurioH, sol as solH, tierra as tierraH, venus as venusH } from '../src/horizontes';
import { HORIZONTE, TEAL, caraHacia, dirLatLon, potencia } from './remake';
import { angulos, aplicarToma, toma } from './rig';
import { crearChispa, montar, type Camino } from './chispa';
import { CARA } from './tierra';
import { COLOR, E, MA, RE, RMA, RV, VE, enOrbita } from './interior';
import { enfocarMarcas, marcas, nombres, orbitas, type Nombre } from './revelar';
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

const LUNA = E.clone().add(V(0.9, 0.12, 0.7));
/** The cylinder: beside the Earth, its axis to the Sun. */
const C = E.clone().add(enOrbita(1, 140 + 90).multiplyScalar(3.0)).add(V(0, 0.35, 0));
const EJE = C.clone().negate().normalize();
const LC = 0.9;
const RC = 0.13;

/** Venus: the Sun's way from it, and the city the spark lands in (sunward, in the parasol's shade). */
const SOL_V = VE.clone().negate().normalize();
const DIR_CIUDAD = SOL_V.clone().applyAxisAngle(Y, D2R(-24)).addScaledVector(Y, 0.2).normalize();
const CIUDAD = VE.clone().addScaledVector(DIR_CIUDAD, RV * 1.055);

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
  for (let i = 0; i < 16000; i++) {
    const fi = r() * Math.PI * 2;
    const t = r();
    const a = V(Math.cos(fi) * 0.9, -1.7, Math.sin(fi) * 0.9);
    const p = a.lerp(V(Math.cos(fi) * 0.25, -0.97, Math.sin(fi) * 0.25), t);
    b.push(p.x, p.y, p.z, new THREE.Color(1.0, 0.82, 0.55), 0.004, 0.05, { kind: 1 });
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
  for (let d = 0; d < 30; d++) ciudades.push(sol.clone().add(V(gauss(r) * 0.55, gauss(r) * 0.4, gauss(r) * 0.55)).normalize());
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
  // The parasol: a thin film (faint), its rim ours (teal), between Venus and the Sun.
  for (let i = 0; i < 26000; i++) {
    const borde = r() < 0.22;
    const q = borde ? 1.3 + gauss(r) * 0.006 : Math.sqrt(r()) * 1.3;
    const fi = r() * Math.PI * 2;
    const p = sol.clone().multiplyScalar(2.2).addScaledVector(t1, Math.cos(fi) * q).addScaledVector(t2, Math.sin(fi) * q);
    b.push(p.x, p.y, p.z, borde ? TEAL : new THREE.Color(0.7, 0.85, 0.9), borde ? 0.004 : 0.006, borde ? 0.32 : 0.05, { kind: 2 });
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
  estilos: [{ key: '1', nombre: 'Guion', nota: 'El cilindro por fuera y por dentro, Marte, Venus y, al revelar, todo lo nuestro: las órbitas, los hilos, los nombres un momento.' }],
  montar(stage): Instancia {
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
          if (aKind < 0.5) em *= 0.7 + 1.4 * pow(max(0.0, sin(uTime * 1.3 + seed * 30.0)), 16.0);
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
      venusMerc: hilo(CIUDAD, M.clone().add(V(0, 0.25, 0)), 9000, 0.05, 0.06),
      marteVenus: hilo(llegaMarte, CIUDAD.clone().addScaledVector(DIR_CIUDAD, 0.16), 9000, 0.05, 0.08),
    };
    for (const h of Object.values(hilos)) add(h.nube);

    // Revealing: the orbits, a mark on each world (ours ringed in teal; Mercury's ring when the spark gets there).
    const orbs = add(orbitas([{ r: M.length() }, { r: VE.length() }, { r: E.length() }, { r: Math.hypot(MA.x, MA.z), y: MA.y }]));
    const nuestras = add(
      marcas([
        { pos: E, R: RE, color: COLOR.tierra, nuestro: true },
        { pos: MA, R: RMA, color: COLOR.marte, nuestro: true },
        { pos: VE, R: RV, color: COLOR.venus, nuestro: true },
      ]),
    );
    const mercMarca = add(marcas([{ pos: M, R: RM, color: COLOR.mercurio }]));
    const mercAro = add(marcas([{ pos: M, R: RM, color: COLOR.mercurio, nuestro: true }]));
    const NOMBRES: Nombre[] = [
      { pos: E, texto: 'Tierra', nuestro: true },
      { pos: MA, texto: 'Marte', nuestro: true },
      { pos: VE, texto: 'Venus', nuestro: true, lado: 'o' },
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
    const c0Merc = M.clone().addScaledVector(ladoM.clone().addScaledVector(Y, 0.3).addScaledVector(rM, 0.25).normalize(), 1.75);

    // The spark's way (GUION.md v2, 22–26): from the Earth's ring to the cylinder (ch 0..1), along its
    // axis (1..2), on the thread to Mars (2..3), on to Venus (3..4), and to Mercury (4..5).
    const entradaCil = C.clone().addScaledVector(EJE, LC / 2 + 0.25);
    const cilPath0 = (sv: number, out: THREE.Vector3) => out.copy(C).addScaledVector(EJE, LC / 2 + 0.25 - sv * (LC + 0.55));
    const caminoCh: Camino = (sv, out) => {
      if (sv <= 1) return hilos.tierraCil.arco.en(Math.max(0, sv), out).lerp(entradaCil, THREE.MathUtils.smoothstep(sv, 0.85, 1));
      if (sv <= 2) return cilPath0(sv - 1, out);
      if (sv <= 3) return hilos.cilMarte.arco.en(sv - 2, out);
      if (sv <= 4) {
        // Along the thread to above the city, then down into it.
        const s3 = sv - 3;
        if (s3 <= 0.85) return hilos.marteVenus.arco.en(s3 / 0.85, out);
        return out.copy(hilos.marteVenus.arco.b).lerp(CIUDAD, THREE.MathUtils.smoothstep(s3, 0.85, 1));
      }
      return hilos.venusMerc.arco.en(Math.min(1, sv - 4), out);
    };
    tl.set({ ...Cn(E), ox: 0, oy: 0, oz: 0, az: fin7.az, el: fin7.el, ld: Math.log10(23 * RE), yaw: 90, pitch: -90, roll: 0, fov: 34, mw: 0, lw: 0, ch: 0, on: 1, cil: 0, mar: 0, todo: 0, ven: 0, sombra: 0, anillo: 1, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, vel: 0, mapa: 0, nombres: 0, md: 0 });

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

    // Out the far end with the spark and along the thread to Mars, Mars ahead the whole way: a red
    // point that grows into a world. Then off the spark, round under its south pole: the ring of
    // mirrors, their light on the pole, and the domes.
    const solM = MA.clone().negate().normalize();
    const ladoM0 = Y.clone().cross(solM).normalize();
    const cMar = MA.clone().add(V(0, -0.1, 0));
    const vistaMarte = (giro: number, baja: number) => cMar.clone().addScaledVector(ladoM0.clone().applyAxisAngle(Y, D2R(giro)).addScaledVector(Y, -baja).normalize(), 0.92);
    tl.label('marte').caption(9.4, 'Calentar Marte', 'Unos espejos pueden calentar Marte, pero su aire nunca será como el nuestro: viviríamos bajo cúpulas.');
    tl.with(1.4, { md: 0.8, fov: 46 });
    luego(0.3, 4.4, { ch: 3 });
    luego(0.8, 1.6, { vel: 0.28 });
    luego(3.0, 1.6, { vel: 0 });
    luego(1.6, 2.8, { mar: 1 });
    // (Out of sight while it rides: the rig waits where the turn round Mars begins.)
    luego(1.0, 0.5, { ...Cn(cMar), ...rel(cMar, vistaMarte(-30, 0.55)), pitch: -90, yaw: 90 });
    tl.wait(3.8);
    tl.to(2.4, { lw: 0, mw: 0, md: 0, fov: 40 });
    tl.to(3.2, { ...rel(cMar, vistaMarte(-4, 0.7)) });

    // Back on the spark as it leaves for Venus, Venus ahead; then off it: Venus in the parasol's
    // shade, the parasol's rim ours; and closer, the cities floating on the cloud tops by the limb, the
    // spark dropping into one.
    const ladoV = Y.clone().cross(SOL_V).normalize();
    const cVen = VE.clone().addScaledVector(SOL_V, 0.3);
    const vistaVenus = cVen.clone().addScaledVector(ladoV, 1.75).addScaledVector(SOL_V, 0.2).addScaledVector(Y, 0.5);
    const vistaCiudad = CIUDAD.clone().addScaledVector(DIR_CIUDAD.clone().multiplyScalar(0.55).addScaledVector(ladoV, 0.75).addScaledVector(Y, 0.3).normalize(), RV * 2.2);
    tl.label('venus').caption(10.0, 'Venus, a la sombra', 'Venus es un horno, pero en lo alto de sus nubes el aire es templado: ahí pueden flotar ciudades.');
    tl.with(0.6, { h6: 1 });
    tl.with(1.6, { lw: 1, mw: 1, md: 0.75, fov: 46 });
    luego(0.2, 4.6, { ch: 3.85 });
    luego(1.0, 1.6, { vel: 0.28 });
    luego(3.0, 1.4, { vel: 0 });
    luego(2.4, 2.2, { ven: 1, sombra: 1 });
    luego(1.0, 0.5, { ...Cn(cVen), ...rel(cVen, vistaVenus), pitch: -90, yaw: 90 });
    tl.wait(3.8);
    tl.to(2.4, { lw: 0, mw: 0, md: 0, fov: 40 });
    luego(0.8, 2.6, { ch: 4 });
    luego(0, 2.0, { ...Cn(CIUDAD) });
    tl.to(3.8, { ...rel(CIUDAD, vistaCiudad), fov: 42 });

    // The reveal: all the inner system woven with threads, the spark one point on its way to Mercury.
    const TODO = 'Todo ocurre a la vez: la Luna lanza roca, se minan los asteroides y, cerca del Sol, crece un enjambre.';
    tl.label('todo').caption(9.6, 'Todo a la vez', TODO);
    tl.with(1.6, { todo: 1, h3: 1, h4: 1, h5: 1, ven: 0 });
    const llegaM = 8.0;
    luego(0.4, llegaM - 0.4, { ch: 5 });
    // Powers of ten: straight down at Venus, then out decade after decade (a little speed blur for
    // the vertigo); the centre slides to the whole once the distance is there. Then still, and the
    // names come for a moment.
    tl.with(1.4, { pitch: -90, yaw: 90 });
    luego(0.3, 4.6, { ld: Math.log10(105), el: 50, az: -30, fov: 36 });
    luego(0.9, 1.4, { vel: 0.35 });
    luego(2.3, 1.6, { vel: 0 });
    luego(2.6, 2.4, { ...Cn(CMAPA) });
    luego(2.2, 2.0, { mapa: 1 });
    luego(3.8, 1.6, { nombres: 1 });
    tl.wait(4.9);
    tl.to(3.6, { az: -24 });
    // And down to Mercury, where its scene starts.
    tl.with(1.2, { ...Cn(M), mapa: 0, nombres: 0 });
    luego(1.6, 1.4, { todo: 0.3, h3: 0.3, h4: 0.3 });
    tl.to(3.0, { ...rel(M, c0Merc), fov: 40 });

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
        const pasos = [tl.at('giran') + 4.6, tl.at('marte') + 3.2, tl.at('venus') + 3.4, tl.at('todo') + llegaM - 0.5];
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
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
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
        const m = montar(caminoCh, ch, enCil ? 0.08 : 0.025, enCil ? 0.25 : 0.06, enCil ? 0.0 : 0.04 + 0.2 * tl.get('md', p));
        lugar.copy(m.lugar);
        mira.copy(m.mira);
        const centro = V(tl.get('cx', p), tl.get('cy', p), tl.get('cz', p));
        // Riding to a world, the gaze leans to it, so where we go is in sight the whole way.
        const md = tl.get('md', p);
        if (md > 0.001) mira.lerp(MA.clone().lerp(VE, THREE.MathUtils.smoothstep(ch, 3.0, 3.3)), md);
        if (lw < 0.999) mira.lerp(centro, 1 - lw);
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
          // Venus under the parasol: its day side dims.
          x.c.update({ sol: solL, camara: camL, focal: f.focal, dpr: f.dpr, tiempo: t, presencia: x.c === venus ? 1 - 0.6 * tl.get('sombra', p) : 1 });
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
