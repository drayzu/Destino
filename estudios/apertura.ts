import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss, lerp } from './motor/math';
import { ease } from './comun';
import { FONT, ink, VIOLETA, type Cuenta, type Rotulo } from './placa';
import { TEAL, potencia } from './remake';
import { aplicarToma, toma } from './rig';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scenes 1–3 of ESCALETA.md: the opening and act 0 (GUION.md, moments 1–9).
 *
 * Black, and a teal point that breathes: you, thinking, twenty watts. The camera pulls back and the
 * point lets go of a shell of teal points, our radio, that grows; around it the stars come on, real
 * points that pass the camera. It leaves the disc from above and the whole galaxy is below, turning;
 * the bubble is a point beside the Sun. The title. Then down again among the stars: planets round
 * them, the small drop of teal we have listened to, a teal wave over the whole galaxy that should
 * be there and is not, and the dive towards one yellow star.
 *
 * Units: thousands of light years (kly). The galaxy lies in the XZ plane, the Sun 26 kly out.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PITCH = THREE.MathUtils.degToRad(13);
const KW = 1 / Math.tan(PITCH);
/** Where arm j's centre is at radius R. */
const brazo = (R: number, j: number) => KW * Math.log(R / 4) + j * Math.PI;
/** The Sun: 26 kly out, between the two main arms. */
const R_SOL = 26;
const PHI_SOL = brazo(R_SOL, 0) + Math.PI / 2 + 0.25;
const S = V(Math.sin(PHI_SOL) * R_SOL, 0.02, Math.cos(PHI_SOL) * R_SOL);
/** A neighbourhood a little way from the Sun, where the camera flies among stars with planets. */
const P = S.clone().add(V(0.09, 0.006, -0.07));
const R_VOZ = 0.1;

function angDif(a: number, b: number) {
  const d = (((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return Math.abs(d);
}

/** The Milky Way in points: a disc wound into arms, young blue stars and pink knots in them, a golden bar and bulge. */
function galaxiaDatos(): MateriaData {
  const b = materiaBuilder(71);
  const r = b.r;
  const c = new THREE.Color();
  const VIEJA = new THREE.Color(1.0, 0.74, 0.46);
  const AZUL = new THREE.Color(0.58, 0.72, 1.0);
  const ROSA = new THREE.Color(1.0, 0.45, 0.66);
  const ORO = new THREE.Color(1.0, 0.72, 0.38);
  let n = 0;
  while (n < 760000) {
    const R = 2.5 - 11 * Math.log(1 - r() * 0.985);
    if (R > 54) continue;
    const th = r() * Math.PI * 2;
    let A = 0;
    for (let j = 0; j < 2; j++) {
      const d = angDif(th, brazo(R, j)) * R;
      A = Math.max(A, Math.exp(-(d * d) / (2 * 3.2 * 3.2)));
    }
    if (r() > 0.38 + 0.62 * A) continue;
    n++;
    const h = gauss(r) * (0.12 + 0.012 * R);
    const joven = A > 0.5 && r() < 0.35;
    c.copy(VIEJA).lerp(AZUL, THREE.MathUtils.smoothstep(R, 6, 32));
    if (joven) c.copy(AZUL).multiplyScalar(1.15);
    b.push(Math.sin(th) * R, h, Math.cos(th) * R, c, 0.012, joven ? 0.42 : 0.1 + r() * 0.14, { kind: R });
  }
  // Pink knots where stars are born, strung along the arms.
  for (let k = 0; k < 900; k++) {
    const R = 5 + r() * 40;
    const th = brazo(R, r() < 0.5 ? 0 : 1) + gauss(r) * 0.05;
    const cx = Math.sin(th) * R;
    const cz = Math.cos(th) * R;
    for (let i = 0; i < 22; i++) b.push(cx + gauss(r) * 0.22, gauss(r) * 0.08, cz + gauss(r) * 0.22, ROSA, 0.012, 0.45, { kind: R });
  }
  // The bar and the bulge.
  const bar = 0.45;
  for (let i = 0; i < 90000; i++) {
    const x = gauss(r) * 4.2;
    const z = gauss(r) * 1.6;
    const y = gauss(r) * 1.25 * Math.exp(-(x * x + z * z) / 40);
    const nucleo = x * x + z * z < 2.5;
    b.push(x * Math.cos(bar) - z * Math.sin(bar), y, x * Math.sin(bar) + z * Math.cos(bar), ORO, 0.012, nucleo ? 0.2 : 0.11, { kind: Math.hypot(x, z) });
  }
  return b.data();
}

/** Dust along the inner edges of the arms: points that hide what is behind them (the dark lanes). */
function polvoDatos(): MateriaData {
  const b = materiaBuilder(73);
  const r = b.r;
  for (let i = 0; i < 110000; i++) {
    const R = 4 + r() * 34;
    const th = brazo(R, r() < 0.5 ? 0 : 1) - 0.22 + gauss(r) * 0.06;
    b.push(Math.sin(th) * R + gauss(r) * 0.3, gauss(r) * 0.05, Math.cos(th) * R + gauss(r) * 0.3, 0x000000, 0.14, 0, { ink: 0.5, kind: R });
  }
  return b.data();
}

/** The stars round the Sun, close enough to pass the camera: a flattened cloud 0.8 kly across. */
function localesDatos(): MateriaData {
  const b = materiaBuilder(79);
  const r = b.r;
  const c = new THREE.Color();
  for (let i = 0; i < 26000; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r()) * 0.8;
    const t = r();
    c.setRGB(1, 0.86, 0.7).lerp(new THREE.Color(0.75, 0.84, 1), t * t);
    b.push(S.x + x * q, S.y + y * q * 0.35, S.z + z * q, c, 0.00002, 0.45 + r() * 0.7);
  }
  return b.data();
}

/**
 * Stars with planets near P. Each star a point; each planet a spark on its orbit. `aO`: the orbit
 * (radius, phase, speed), `aU`/`aV` its plane, `aC` its star (stars have radius 0).
 */
function vecinasDatos() {
  const b = materiaBuilder(83);
  const r = b.r;
  const U: number[] = [];
  const W: number[] = [];
  const O: number[] = [];
  const C: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < 700; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r()) * 0.018;
    const e = V(P.x + x * q, P.y + y * q * 0.5, P.z + z * q);
    c.setRGB(1, 0.85, 0.66).lerp(new THREE.Color(0.78, 0.86, 1), r());
    b.push(e.x, e.y, e.z, c, 0.00003, 1.6);
    U.push(1, 0, 0);
    W.push(0, 0, 1);
    O.push(0, 0, 0);
    C.push(e.x, e.y, e.z);
    const nP = 1 + Math.floor(r() * 3);
    const [nx, ny, nz] = b.onSphere();
    const nrm = V(nx, ny * 0.3 + 1, nz).normalize();
    const u = V(1, 0, 0).cross(nrm).normalize();
    const w = nrm.clone().cross(u);
    for (let k = 0; k < nP; k++) {
      const R = 0.00012 + r() * 0.0005;
      b.push(e.x, e.y, e.z, r() < 0.3 ? new THREE.Color(0.55, 0.75, 1.0) : new THREE.Color(0.9, 0.82, 0.7), 0.00002, 1.5);
      U.push(u.x, u.y, u.z);
      W.push(w.x, w.y, w.z);
      O.push(R, r() * Math.PI * 2, 0.6 * Math.pow(0.0003 / R, 1.5));
      C.push(e.x, e.y, e.z);
    }
  }
  return { data: b.data(), U: new Float32Array(U), W: new Float32Array(W), O: new Float32Array(O), C: new Float32Array(C) };
}

/** Our radio: three thin shells of teal points (unit sphere; the scene scales them). */
function vozDatos(): MateriaData {
  const b = materiaBuilder(89);
  const ga = Math.PI * (3 - Math.sqrt(5));
  [1, 0.66, 0.33].forEach((R, k) => {
    const n = [22000, 9000, 3000][k];
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 2;
      const rr = Math.sqrt(1 - y * y);
      const th = ga * i;
      b.push(Math.cos(th) * rr * R, y * R, Math.sin(th) * rr * R, TEAL, 0.012, [0.5, 0.26, 0.14][k]);
    }
  });
  return b.data();
}

export const apertura: Escena = {
  id: 'apertura',
  nombre: 'Apertura · 0 Escuchar',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'Tú, nuestra voz, la galaxia, el título; las estrellas con planetas, lo que hemos escuchado, el silencio, una estrella amarilla.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.65;
    stage.bloom.threshold = 0.4;
    stage.renderer.toneMappingExposure = 1.1;

    const galaxia = new THREE.Group();
    root.add(galaxia);
    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root, orden = 0) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };

    const estrellas = add(
      materia(galaxiaDatos(), {
        pre: /* glsl */ `uniform float uGal, uOla, uOlaOn; uniform vec3 uSol, uTeal, uCamG;`,
        move: /* glsl */ `
          em *= smoothstep(0.25, 1.6, length(p - uCamG));
          // What should be there: one civilization's teal over the whole galaxy, a wave from the Sun.
          float dS = length(p - uSol);
          float frente = uOla * 110.0;
          float ola = (1.0 - smoothstep(frente - 4.0, frente, dS)) * step(0.62, fract(seed * 17.3)) * uOlaOn;
          em = mix(em, uTeal * 0.9, ola);
          em *= uGal;
        `,
        uniforms: { uGal: { value: 0 }, uOla: { value: 0 }, uOlaOn: { value: 0 }, uSol: { value: S.clone() }, uTeal: { value: TEAL.clone() }, uCamG: { value: V() } },
      }),
      galaxia,
    );
    estrellas.u.uFuente.value = 0.55;
    const polvo = add(materia(polvoDatos(), { pre: `uniform float uGal; uniform vec3 uCamG;`, move: `occ *= uGal * smoothstep(1.0, 4.0, length(p - uCamG));`, uniforms: { uGal: { value: 0 }, uCamG: { value: V() } } }), galaxia, 2);
    polvo.u.uInk.value = 1;

    const locales = add(materia(localesDatos(), { pre: `uniform float uLoc;`, move: `em *= uLoc;`, uniforms: { uLoc: { value: 0 } } }), galaxia, 3);
    locales.u.uFuente.value = 0.8;

    const vd = vecinasDatos();
    const vecinas = add(
      materia(vd.data, {
        pre: /* glsl */ `attribute vec3 aU, aV, aO, aC; uniform float uPla;`,
        move: /* glsl */ `
          float th = aO.y + aO.z * uTime;
          p = aC + (aU * cos(th) + aV * sin(th)) * aO.x;
          em *= mix(1.0, uPla, step(0.0000001, aO.x)) * step(0.001, uPla + step(aO.x, 0.0));
        `,
        uniforms: { uPla: { value: 0 } },
        extra: { aU: [vd.U, 3], aV: [vd.W, 3], aO: [vd.O, 3], aC: [vd.C, 3] },
      }),
      galaxia,
      3,
    );
    vecinas.u.uFuente.value = 0.9;

    const voz = add(materia(vozDatos(), { pre: `uniform float uR, uOn; uniform vec3 uC;`, move: `p = uC + p * uR; sz *= uR; em *= uOn;`, uniforms: { uR: { value: 0 }, uOn: { value: 0 }, uC: { value: S.clone() } } }), galaxia, 4);
    voz.u.uFuente.value = 0.4;

    // The Sun as a star, and «tú» beside it: both points whose size follows the camera.
    const punto = (col: THREE.Color, luz: number) => {
      const b = materiaBuilder(5);
      b.push(0, 0, 0, col, 1, luz);
      for (let i = 0; i < 30; i++) {
        const [x, y, z] = b.onSphere();
        const q = Math.sqrt(b.r()) * 0.9;
        b.push(x * q, y * q, z * q, col, 0.5, luz * 0.12);
      }
      const n = materia(b.data());
      n.u.uFuente.value = 1;
      return n;
    };
    const sol = add(punto(new THREE.Color(1.0, 0.86, 0.55), 2.2), galaxia, 5);
    const tu = add(punto(TEAL, 2.4), galaxia, 6);

    // ---------------------------------------------------------------- the moments (GUION.md 1–9)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const C = (v: THREE.Vector3) => ({ cx: v.x, cy: v.y, cz: v.z });
    const G = V();
    const hacia = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
    tl.set({ ...C(S), ox: 0, oy: 0, oz: 0, az: 0, el: 4, ld: -3.3, yaw: 90, pitch: -90, roll: 0, fov: 40, tu: 1, cue: 1, voz: 0, vozOn: 1, cielo: 0, gal: 0, titulo: 0, vatios: 0, giro: 0, pla: 0, vaso: 0, ola: 0, olaOn: 0, solp: 0 });

    tl.label('pensamiento').caption(3.4, 'Un pensamiento', 'Estás pensando. Eso cuesta unos veinte vatios.');
    luego(0.5, 1.4, { cue: 0 });
    tl.wait(3.4);

    tl.label('voz').caption(4.4, 'Nuestra voz', 'Y lo que pensamos, lo decimos. Hace un siglo que nuestra radio sale de aquí.');
    tl.with(4.4, { voz: 1 });
    luego(0.8, 3.2, { cielo: 1, gal: 1 });
    tl.to(4.4, { ld: -0.62, el: 9, az: 14 });

    // Pulling out, the centre moves late (while the camera is far enough for it not to swing); diving
    // in, it moves first, so it is on the target before the distance gets small.
    tl.label('cien').caption(4.2, 'Cien mil años luz', 'Pero la galaxia mide cien mil años luz. Toda nuestra voz cabe en un punto.');
    luego(1.8, 2.4, { ...C(hacia(S, G, 0.55)) });
    tl.to(4.2, { ld: 2.02, el: 56, az: 34 });

    tl.label('luz').caption(4.6, 'Toda esa luz', '');
    luego(0.5, 1.2, { titulo: 1 });
    luego(3.0, 1.2, { titulo: 2 });
    luego(0.6, 3.4, { vatios: 1 });
    tl.with(1.0, { vozOn: 0 });
    tl.to(4.6, { ...C(G), ld: 1.98, el: 60, az: 52, giro: 0.4 });

    tl.label('alguien').caption(3.8, '¿Hay alguien más?', 'Cientos de miles de millones de estrellas. Hasta donde sabemos, nadie usa su luz.');
    tl.to(3.8, { ...C(hacia(G, S, 0.75)), ld: 1.15, el: 24, az: 80, giro: 0.5 });

    tl.label('planetas').caption(4.8, 'Planetas por todas partes', 'Y planetas no faltan: al menos uno por estrella. Muchos, donde podría haber agua.');
    tl.with(1.1, { ...C(P) });
    tl.to(2.4, { ld: -2.1, el: 10, az: 96 });
    luego(-0.6, 1.6, { pla: 1 });
    tl.to(2.4, { ld: -2.4, el: 4, az: 150 });

    tl.label('escuchado').caption(4.4, 'Lo que hemos escuchado', 'Llevamos décadas escuchando. Es como sacar un vaso de agua del mar y decir que no hay peces.');
    luego(0.2, 1.2, { pla: 0 });
    luego(2.2, 1.4, { vaso: 1 });
    luego(0.3, 2.6, { ...C(S) });
    tl.to(4.4, { ld: -0.72, el: 14, az: 172 });

    tl.label('silencio').caption(5.0, 'El silencio', 'Una sola civilización habría tenido tiempo de llenar la galaxia miles de veces. ¿Dónde están todos?');
    luego(0.4, 1.0, { vaso: 0 });
    luego(1.0, 1.8, { ...C(hacia(S, G, 0.6)) });
    tl.to(2.6, { ld: 1.95, el: 52, az: 200 });
    luego(-0.6, 0.4, { olaOn: 1 });
    luego(-0.4, 2.6, { ola: 1 });
    tl.to(2.4, { az: 214 });
    luego(-0.4, 1.0, { olaOn: 0 });

    tl.label('amarilla').caption(4.6, 'Una estrella amarilla', 'No lo sabemos. Pero podemos imaginar cómo crecería una, empezando por la nuestra.');
    luego(0.6, 2.4, { solp: 1 });
    tl.with(1.8, { ...C(S) });
    tl.to(4.6, { ld: -3.5, el: 6, az: 236 });
    tl.label('fin');

    const tm = toma(tl, 0);
    const largo = tl.length;
    const Sw = V();
    return {
      tl,
      salida: { pos: S.clone(), escala: Math.pow(10, -3.5) },
      escalera: false,
      cuenta(p): Cuenta | null {
        if (p < tl.at('luz')) {
          const linea = p < tl.at('voz') + 1.2 ? 'tú, pensando' : 'nuestra radio · 100 años luz';
          return { pisos: ['20'], unidad: 'W', linea, h: 1 };
        }
        if (p < tl.at('alguien')) {
          const v = tl.get('vatios', p);
          if (v < 0.02) return { pisos: ['20'], unidad: 'W', linea: 'nuestra radio · 100 años luz', h: 1 };
          const lp = lerp(1.3, 37, v);
          return { pisos: ['10', String(Math.floor(lp))], unidad: 'W', linea: 'la Vía Láctea', h: 1 };
        }
        return potencia(37, 'la Vía Láctea · ', 1);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        if (!c || !c.fact) return null;
        return { capitulo: p >= tl.at('alguien') ? '0 · Escuchar' : '', name: c.name, fact: c.fact };
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-7;
        camera.far = 2000;
        galaxia.rotation.y = tl.get('giro', p);
        galaxia.updateMatrixWorld(true);
        // The rig works in the galaxy's frame: its centre turns with it.
        aplicarToma(camera, toma(tl, p, tm));
        camera.position.applyAxisAngle(V(0, 1, 0), galaxia.rotation.y);
        camera.up.applyAxisAngle(V(0, 1, 0), galaxia.rotation.y);
        camera.lookAt(camera.position.clone().add(tm.dir.clone().applyAxisAngle(V(0, 1, 0), galaxia.rotation.y)));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        const d = Math.pow(10, tl.get('ld', p));
        const gal = tl.get('gal', p);
        estrellas.u.uGal.value = gal;
        polvo.u.uGal.value = gal;
        estrellas.u.uOla.value = tl.get('ola', p);
        estrellas.u.uOlaOn.value = tl.get('olaOn', p);
        // The stars round the Sun: on with the sky, gone once the camera is far from them.
        Sw.copy(S).applyAxisAngle(V(0, 1, 0), galaxia.rotation.y);
        const dSol = camera.position.distanceTo(Sw);
        locales.u.uLoc.value = tl.get('cielo', p) * (1 - ease(1.2, 5, dSol));
        vecinas.u.uPla.value = tl.get('pla', p);
        // The bubble grows with the distance until it reaches its hundred light years, so it always fits.
        voz.u.uR.value = tl.get('vaso', p) > 0.001 ? R_VOZ * 0.03 : Math.min(R_VOZ, 0.28 * dSol) * ease(0, 0.35, tl.get('voz', p));
        voz.u.uOn.value = Math.min(1, tl.get('voz', p) * 3) * tl.get('vozOn', p) * (1 - ease(0.4, 3, dSol)) + tl.get('vaso', p) * 1.6;
        // The two points keep a few pixels whatever the distance.
        const px = (n: number) => (n * dSol) / f.focal;
        tu.points.position.copy(S).add(V(px(9), px(2), 0));
        tu.u.uSizeUnit.value = px(7);
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.22 * Math.sin(t * 1.5)) * (1 - 0.65 * tl.get('solp', p));
        sol.points.position.copy(S);
        sol.u.uSizeUnit.value = px(6 + 3 * tl.get('solp', p));
        sol.u.uGain.value = Math.max(tl.get('cielo', p), tl.get('solp', p)) * (0.5 + 0.8 * tl.get('solp', p));
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        for (const n of [estrellas, locales, vecinas]) n.u.uMaxPx.value = 3.2 * f.dpr;
        voz.u.uMaxPx.value = 4 * f.dpr;
        const camG = camera.position.clone().applyAxisAngle(V(0, 1, 0), -galaxia.rotation.y);
        estrellas.u.uCamG.value.copy(camG);
        polvo.u.uCamG.value.copy(camG);
        void d;
        void largo;
      },
      placa(g, f) {
        const u = f.u;
        // «Desliza para empezar», under the point.
        const cue = tl.get('cue', f.p);
        if (cue > 0.01) {
          g.save();
          g.globalAlpha = cue * 0.6;
          g.textAlign = 'center';
          g.font = FONT.mono(11 * u);
          g.letterSpacing = `${1.6 * u}px`;
          g.fillStyle = ink();
          g.fillText('DESLIZA PARA EMPEZAR', f.W / 2, f.H / 2 + 70 * u);
          g.restore();
        }
        // The title, over the whole galaxy.
        const ti = tl.get('titulo', f.p);
        const a = ease(0, 0.6, ti) * (1 - ease(1.2, 1.9, ti));
        if (a > 0.01) {
          g.save();
          g.globalAlpha = a;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.shadowColor = 'rgba(0,0,0,0.9)';
          g.shadowBlur = 24 * u;
          g.font = FONT.mono(11 * u);
          g.letterSpacing = `${1.8 * u}px`;
          g.fillStyle = VIOLETA;
          g.fillText('HORIZONTES · 03', f.W / 2, f.H * 0.18 - 92 * u);
          g.letterSpacing = '0px';
          g.font = FONT.serif(118 * u);
          g.fillStyle = ink(0.96);
          g.fillText('Destino', f.W / 2, f.H * 0.18);
          g.font = FONT.italic(30 * u);
          g.fillStyle = ink(0.78);
          g.fillText('¿Adónde podemos llegar?', f.W / 2, f.H * 0.18 + 84 * u);
          g.restore();
        }
      },
      dispose() {},
    };
  },
};
