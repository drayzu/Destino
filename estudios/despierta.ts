import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { ease, mapaTierra } from './comun';
import { pantalla, FONDOS } from './motor/pantalla';
import { tierra as tierraHorizontes } from '../src/horizontes';
import { FONT, ink, type Cuenta, type Rotulo } from './placa';
import { TEAL, caraHacia, potencia, puntoTu, anioEn } from './remake';
import { aplicarToma, toma } from './rig';
import { CARA, SOL, S_CAIRO, luces, montarTierra, rutaTierra } from './tierra';
import { crearChispa, montar, type Camino } from './chispa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scenes 4–5 of ESCALETA.md: «Lo que piensa» and «Ocho mil millones» (GUION.md, moments 10–14).
 *
 * The yellow star's light fills the frame, and that light is the light coming down into the sea of
 * the young Earth. In the blue, a cell: a membrane of points that shrinks when the light touches it.
 * It becomes many, joined by threads, a net like a jellyfish of light with sparks running along it.
 * The net grows and folds into a brain; the camera goes inside, among neurons and pulses, and there
 * the teal point lights: twenty watts, like yours. Pulling back out, the same network of light lays
 * itself over the night Earth: its knots are our cities. Some turn a colder white and grow: the
 * machines that think.
 *
 * Units: Earth radii at the end (the brain is drawn the size of the Earth it turns into).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const VIOLETA = new THREE.Color(0.66, 0.5, 1.0);
const CORAL = new THREE.Color(1.0, 0.5, 0.42);
const MAR = new THREE.Color(0.35, 0.62, 0.9);

/** The cell: a membrane, its inside and its nucleus; and motes in the water round it. */
function celulaDatos(): MateriaData {
  const b = materiaBuilder(101);
  const r = b.r;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 9000; i++) {
    const y = 1 - ((i + 0.5) / 9000) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i;
    b.push(Math.cos(th) * rr * 0.42, y * 0.42, Math.sin(th) * rr * 0.42, new THREE.Color(0.6, 0.86, 1.0), 0.006, 0.55, { kind: 0 });
  }
  for (let i = 0; i < 2500; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r()) * 0.36;
    b.push(x * q, y * q, z * q, new THREE.Color(0.5, 0.75, 0.95), 0.005, 0.22, { kind: 1 });
  }
  for (let i = 0; i < 900; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r()) * 0.1;
    b.push(x * q + 0.06, y * q - 0.03, z * q, new THREE.Color(0.75, 0.82, 1.0), 0.006, 0.5, { kind: 1 });
  }
  // The sea: motes drifting, all round.
  for (let i = 0; i < 16000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 0.6 + Math.cbrt(r()) * 5;
    b.push(x * q, y * q, z * q, MAR, 0.004 + r() * 0.006, 0.12 + r() * 0.2, { kind: 2 });
  }
  return b.data();
}

/** The net: a bell of radial nerves and a ring at its rim, with fine threads between; `aKind` 0 nerve, 1 fine, 2 tentacle; `aDelay` how far along. */
const campana = (t: number, a: number) => {
  const ph = t * 1.35;
  return V(Math.sin(ph) * Math.cos(a), Math.cos(ph) * 0.75 - 0.2, Math.sin(ph) * Math.sin(a)).multiplyScalar(1.1);
};

function redNerviosaDatos(): MateriaData {
  const b = materiaBuilder(103);
  const r = b.r;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    for (let i = 0; i < 700; i++) {
      const t = r();
      const p = campana(t, a);
      b.push(p.x + gauss(r) * 0.006, p.y + gauss(r) * 0.006, p.z + gauss(r) * 0.006, VIOLETA, 0.008, 0.55, { kind: 0, delay: t });
    }
  }
  for (let i = 0; i < 4000; i++) {
    const a = r() * Math.PI * 2;
    const p = campana(1, a);
    b.push(p.x, p.y + gauss(r) * 0.01, p.z, VIOLETA, 0.008, 0.6, { kind: 0, delay: 1 });
  }
  for (let i = 0; i < 9000; i++) {
    const p = campana(0.15 + r() * 0.85, r() * Math.PI * 2);
    b.push(p.x, p.y, p.z, VIOLETA, 0.005, 0.18, { kind: 1, delay: r() });
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const p0 = campana(1, a);
    for (let i = 0; i < 260; i++) {
      const t = r();
      b.push(p0.x * (1 - 0.15 * t) + Math.sin(t * 9 + k) * 0.03, p0.y - t * 1.4, p0.z * (1 - 0.15 * t) + Math.cos(t * 7 + k) * 0.03, VIOLETA, 0.005, 0.3, { kind: 2, delay: t });
    }
  }
  return b.data();
}

/**
 * A point of the brain's surface from a direction: two hemispheres apart (the fissure), the temporal
 * lobes low at the sides, folds (gyri and sulci). Returns the place and how much it is a ridge (0..1),
 * so ridges shine and grooves stay dark: the folds read in points.
 */
function corteza(d: THREE.Vector3): [THREE.Vector3, number] {
  const pliegue = Math.sin(10 * d.x + 3 * Math.sin(8 * d.y) + 2 * Math.sin(6 * d.z)) * Math.sin(12 * d.z + 2 * Math.sin(6 * d.x) + 3 * Math.sin(5 * d.y));
  const f = 1 + 0.045 * pliegue;
  const p = V(d.x * 0.78, d.y * 0.66, d.z * 1.0).multiplyScalar(f);
  p.x += Math.sign(d.x || 1) * 0.1;
  // The temporal lobes: lower and forward at the sides.
  const tem = Math.exp(-((d.y + 0.45) ** 2) / 0.05) * Math.exp(-((d.z - 0.1) ** 2) / 0.25) * Math.abs(d.x);
  p.y -= 0.12 * tem;
  p.x += Math.sign(d.x || 1) * 0.06 * tem;
  if (d.y < -0.25) p.y = -0.25 * 0.66 + (p.y + 0.25 * 0.66) * 0.55;
  return [p, Math.max(0, pliegue)];
}

/**
 * The brain: its folded cortex, and a network of neurons inside (knots and threads). The network's
 * points also know where they go on the night Earth (`position`) and start in the brain (`aFrom`):
 * the same light, reordered into our cities. `aDat`: kind (0 knot, 1 thread), along, phase, city size.
 */
function cerebroDatos(img: ImageData) {
  const corteza0 = materiaBuilder(107);
  const r = corteza0.r;
  for (let i = 0; i < 70000; i++) {
    const [x, y, z] = corteza0.onSphere();
    const [p, g] = corteza(V(x, y, z));
    corteza0.push(p.x, p.y, p.z, CORAL, 0.006, 0.05 + 0.5 * g * g);
  }
  // The cerebellum, finely striped, low at the back.
  for (let i = 0; i < 9000; i++) {
    const [x, y, z] = corteza0.onSphere();
    const raya = 0.5 + 0.5 * Math.sin(y * 40);
    corteza0.push(x * 0.42, y * 0.2 - 0.42, z * 0.26 - 0.72, CORAL, 0.005, 0.06 + 0.35 * raya * raya);
  }
  // The network inside.
  const nodos: THREE.Vector3[] = [];
  while (nodos.length < 1800) {
    const p = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    const q = V(p.x / 0.8, p.y / 0.62, p.z / 0.96);
    if (q.lengthSq() < 0.92) nodos.push(p);
  }
  const red = materiaBuilder(109);
  const dat: number[] = [];
  const posiciones: [number, number, number][] = [];
  const BLANCO = new THREE.Color(1.0, 0.86, 0.76);
  for (const n of nodos) {
    for (let k = 0; k < 10; k++) {
      posiciones.push([n.x + gauss(r) * 0.008, n.y + gauss(r) * 0.008, n.z + gauss(r) * 0.008]);
      dat.push(0, 0, r(), 0);
    }
  }
  const hechos = new Set<string>();
  nodos.forEach((n, i) => {
    const cerca = nodos
      .map((m, j) => ({ j, d: m.distanceTo(n) }))
      .filter((x) => x.j !== i)
      .sort((a, z) => a.d - z.d)
      .slice(0, 3);
    for (const { j, d } of cerca) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (hechos.has(key)) continue;
      hechos.add(key);
      const m = nodos[j];
      const cuantos = Math.round(d * 160);
      const fase = r();
      for (let q = 0; q < cuantos; q++) {
        const t = r();
        posiciones.push([n.x + (m.x - n.x) * t, n.y + (m.y - n.y) * t, n.z + (m.z - n.z) * t]);
        dat.push(1, i < j ? t : 1 - t, fase, 0);
      }
    }
  });
  // Where each one goes: a light of the night Earth (the Earth turned as in scene 6).
  const l = luces(img, false);
  const n = posiciones.length;
  const q = caraHacia(CARA.lat, CARA.lon);
  const destino = V();
  const total = l.data.position.length / 3;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * total);
    destino.set(l.data.position[k * 3], l.data.position[k * 3 + 1], l.data.position[k * 3 + 2]).applyQuaternion(q);
    const [x, y, z] = posiciones[i];
    const nudo = dat[i * 4] < 0.5;
    const lc = new THREE.Color(l.data.color[k * 3], l.data.color[k * 3 + 1], l.data.color[k * 3 + 2]);
    red.push(destino.x, destino.y, destino.z, nudo ? BLANCO : CORAL, nudo ? 0.008 : 0.005, nudo ? 0.34 : 0.11, { from: [x, y, z], delay: r() });
    // The colour it ends with: the light's own (in `aDat.w`, its brightness).
    dat[i * 4 + 3] = (lc.r + lc.g + lc.b) / 3;
  }
  return { corteza: corteza0.data(), red: red.data(), dat: new Float32Array(dat) };
}

export const despierta: Escena = {
  id: 'despierta',
  nombre: 'I · Lo que piensa',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'La luz del Sol baja al mar; una célula, una red que se pasa chispas, un cerebro; sus neuronas se vuelven las luces de la Tierra.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.5;
    stage.renderer.toneMappingExposure = 1.1;

    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root) => {
      n.u.uSpread.value = 0;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };

    // The sea: light from above, deep blue below (a background that turns with the camera).
    const agua = pantalla(
      /* glsl */ `
      uniform float uAgua;
      void main() {
        vec3 d = normalize(vDir);
        float arriba = smoothstep(-0.6, 1.0, d.y);
        float rayos = pow(max(0.0, 0.5 + 0.5 * sin(atan(d.x, d.z) * 9.0 + d.y * 3.0)), 6.0) * smoothstep(0.0, 1.0, d.y);
        vec3 c = mix(vec3(0.0, 0.012, 0.03), vec3(0.05, 0.16, 0.24), arriba * arriba) + vec3(0.06, 0.14, 0.16) * rayos * 0.5;
        gl_FragColor = vec4(c * uAgua, 1.0);
      }`,
      { uAgua: { value: 1 } },
    );
    agua.mesh.renderOrder = -100;
    root.add(agua.mesh);
    FONDOS.push(agua);

    const celula = add(
      materia(celulaDatos(), {
        pre: /* glsl */ `uniform float uCel, uMar, uToque;`,
        move: /* glsl */ `
          if (aKind < 1.5) {
            // It shrinks when the light touches it, and breathes.
            float enc = 1.0 - 0.14 * uToque * (0.5 + 0.5 * sin(uTime * 3.0));
            p *= enc * (1.0 + 0.02 * sin(uTime * 1.3 + p.y * 9.0));
            em *= uCel;
          } else {
            p += vec3(sin(uTime * 0.11 + seed * 40.0), cos(uTime * 0.09 + seed * 30.0), sin(uTime * 0.07 + seed * 20.0)) * 0.06;
            em *= uMar;
          }
        `,
        uniforms: { uCel: { value: 1 }, uMar: { value: 1 }, uToque: { value: 0 } },
      }),
    );
    celula.u.uFuente.value = 0.4;

    const nervios = add(
      materia(redNerviosaDatos(), {
        pre: /* glsl */ `uniform float uNer, uCrece;`,
        move: /* glsl */ `
          p *= uCrece;
          p.y += 0.05 * sin(uTime * 0.8);
          float chispa = aKind < 0.5 ? smoothstep(0.88, 1.0, fract(aDelay * 2.0 - uTime * 0.7)) * 4.0 : 0.0;
          em *= uNer * (1.0 + chispa) * step(aDelay, uNer * 1.2 + 0.05);
        `,
        uniforms: { uNer: { value: 0 }, uCrece: { value: 0.3 } },
      }),
    );
    nervios.u.uFuente.value = 0.4;

    let corteza: Nube | null = null;
    let red: Nube | null = null;
    const tierraG = new THREE.Group();
    tierraG.quaternion.copy(caraHacia(CARA.lat, CARA.lon));
    root.add(tierraG);
    const base = `${import.meta.env.BASE_URL}texturas/`;
    const planeta = tierraHorizontes(base, { giro: 0 });
    tierraG.add(planeta.group);
    const listo = (async () => {
      const img = await mapaTierra();
      const d = cerebroDatos(img);
      corteza = add(materia(d.corteza, { pre: `uniform float uCor;`, move: `em *= uCor;`, uniforms: { uCor: { value: 0 } } }));
      corteza.u.uFuente.value = 0.3;
      red = add(
        materia(d.red, {
          pre: /* glsl */ `
            attribute vec4 aDat;
            uniform float uRed, uMaq;
            uniform vec3 uLuz, uFria, uCamW;
          `,
          move: /* glsl */ `
            float pulso = aDat.x > 0.5 ? smoothstep(0.86, 1.0, fract(aDat.y - uTime * 0.5 + aDat.z * 9.0)) * 3.5 * (1.0 - uK) : 0.0;
            // On the Earth: the colour of night lights; the biggest knots turn cold white (the machines).
            vec3 noche = uLuz * (0.25 + 0.7 * aDat.w);
            em = mix(em, noche, uK) * (1.0 + pulso);
            float maq = uMaq * step(0.5, 1.0 - aDat.x) * step(0.82, aDat.z);
            em = mix(em, uFria * 2.2, maq);
            em *= uRed;
            vec3 nn = normalize(position);
            em *= mix(1.0, smoothstep(-0.015, 0.03, dot(nn, normalize(uCamW - position))), uK);
          `,
          uniforms: { uCamW: { value: V() }, uRed: { value: 0 }, uMaq: { value: 0 }, uLuz: { value: new THREE.Color(1.0, 0.56, 0.22) }, uFria: { value: new THREE.Color(0.7, 0.86, 1.0) } },
          extra: { aDat: [d.dat, 4] },
        }),
      );
      red.u.uSpread.value = 1.2;
      red.u.uFuente.value = 0.45;
      await planeta.listo;
    })();

    // ---------------------------------------------------------------- the moments (GUION.md 10–14)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: -20, el: 14, ld: 0.18, yaw: 90, pitch: -90, roll: 0, fov: 40, blanco: 1, agua: 1, cel: 1, mar: 1, toque: 0, ner: 0, crece: 0.3, cor: 0, red: 0, forma: 0, tu: 0, tierra: 0, maq: 0, sc: 0, lw: 0, on: 0, vel: 0 });

    // The first spark: the light touches the cell, and something goes round inside it.
    tl.label('celula').caption(4.6, 'Una célula que reacciona', 'Antes de pensar, la materia aprendió a reaccionar. Empezó en el mar, con una célula.');
    tl.with(1.4, { blanco: 0 });
    luego(1.6, 1.4, { toque: 1 });
    luego(1.9, 0.6, { on: 1 });
    luego(1.9, 2.7, { sc: 1 });
    tl.to(4.6, { az: 10, el: 10, ld: 0.12 });

    // It jumps from cell to cell along a nerve of the bell, and the camera goes with it.
    tl.label('nervios').caption(5.0, 'Nervios', 'Después, unas células empezaron a pasarse chispas. Con ellas, un cuerpo entero reacciona a la vez.');
    tl.with(1.6, { cel: 0, toque: 0 });
    luego(0.3, 2.4, { ner: 1, crece: 1 });
    tl.to(1.6, { az: 40, el: 24, ld: 0.52 });
    luego(0.4, 1.0, { lw: 0.85 });
    tl.to(3.4, { sc: 2 });

    // The net folds into a brain; the spark goes in, among neurons, to the point.
    tl.label('cerebro').caption(5.8, 'Un cerebro', 'Lo más complejo que conocemos, y funciona con veinte vatios. Como el tuyo, ahora.');
    tl.with(2.0, { ner: 0, cor: 1, red: 1, mar: 0, agua: 0, lw: 0 });
    luego(1.4, 2.6, { sc: 3, lw: 0.8 });
    luego(3.8, 1.0, { tu: 1 });
    tl.to(2.4, { az: 96, el: 16, ld: 0.42 });
    // (in until «tú» is just ahead, then only drifting: never through it, where the spark rests)
    tl.to(2.2, { az: 102, el: 10.6, ld: -0.42, fov: 45 });
    // (the spark has arrived: the camera is the rig's alone again before the spark leaves)
    tl.with(1.2, { lw: 0 });
    tl.to(1.2, { az: 104, el: 10, fov: 46 });

    // Out of the brain: its network lays itself over the night Earth, and the spark runs on it, city to city.
    tl.label('ocho').caption(6.0, 'Ocho mil millones de cerebros', 'Están ahí, donde de noche hay luz. Todos juntos piensan con menos del uno por ciento de lo que gastamos.');
    tl.with(1.0, { tu: 0 });
    luego(0.4, 2.2, { cor: 0 });
    luego(0.4, 3.0, { forma: 1, tierra: 1 });
    // The spark leaves «tú» for London; the camera lets go and draws back to see the brain become
    // the night Earth, then dives onto the spark again as it reaches London.
    luego(0.2, 1.9, { ld: 0.32, el: 20, az: 118 });
    luego(1.6, 1.8, { lw: 1, fov: 40 });
    tl.to(1.8, { sc: 3.4, vel: 0.2 });
    tl.to(4.2, { sc: 4 + S_CAIRO / 4, vel: 0.2 });

    const tm = toma(tl, tl.at('cerebro') + 4.6);
    const tuPos = tm.pos.clone().addScaledVector(tm.dir, 0.12);
    const tu = add(puntoTu(tuPos, 0.006));
    const qT = caraHacia(CARA.lat, CARA.lon);
    const londres = rutaTierra(0).applyQuaternion(qT);
    // From «tú» out of the planet the brain becomes, over it and down onto London, arriving along the
    // route (never through the Earth, where the camera would see nothing).
    const rumbo = rutaTierra(0.04).applyQuaternion(qT).sub(londres).normalize();
    // (it sets off across the view, towards London but never at the camera that watches it leave)
    const haciaL = londres.clone().sub(tuPos);
    const sale = haciaL.clone().addScaledVector(tm.dir, -haciaL.dot(tm.dir)).normalize();
    const aLondres = new THREE.CubicBezierCurve3(tuPos.clone(), tuPos.clone().addScaledVector(sale, 0.5), londres.clone().multiplyScalar(1.22).addScaledVector(rumbo, -0.3), londres.clone());
    const enCerebro = new THREE.CatmullRomCurve3([campana(1, Math.PI / 2).multiplyScalar(1), V(0.35, 0.25, 0.3), V(-0.1, 0.1, 0.15), tuPos.clone()]);
    /**
     * The spark's way: a loop inside the cell (0..1), down a nerve of the bell and round its rim
     * (1..2), through the brain to «tú» (2..3), out to London (3..3.4), and over the Earth to Cairo
     * (3.4.., in the route's own s, scaled 1:4).
     */
    // (it arrives along the nerve: the tangent there is the nerve's own)
    const enNervio = campana(0.3, 0);
    const lungo = campana(0.32, 0).sub(enNervio).normalize();
    const salto = new THREE.CubicBezierCurve3(V(0.2, 0, 0), V(0.22, 0.22, 0.04), enNervio.clone().addScaledVector(lungo, -0.22), enNervio);
    const camino: Camino = (sv, out) => {
      if (sv <= 1) {
        const a = Math.max(sv, 0) * Math.PI * 4;
        return out.set(Math.cos(a) * 0.2, 0.05 * Math.sin(a * 1.5), Math.sin(a) * 0.2);
      }
      if (sv <= 2) {
        // Up and out of the cell onto a nerve in an arc (never back on itself), down the nerve,
        // round the rim.
        const t = sv - 1;
        if (t < 0.15) return out.copy(salto.getPoint(t / 0.15));
        const u = (t - 0.15) / 0.85;
        return u < 0.65 ? out.copy(campana(0.3 + (u / 0.65) * 0.7, 0)) : out.copy(campana(1, ((u - 0.65) / 0.35) * (Math.PI / 2)));
      }
      if (sv <= 3) return out.copy(enCerebro.getPoint(sv - 2));
      if (sv <= 3.4) return out.copy(aLondres.getPoint((sv - 3) / 0.4));
      return rutaTierra((sv - 3.4) * (S_CAIRO / (S_CAIRO / 4 + 0.6)), out).applyQuaternion(qT);
    };
    const chispa = crearChispa();
    root.add(chispa.nube.points);
    const solL = V();
    const camL = V();
    const inv = new THREE.Quaternion();
    return {
      tl,
      listo,
      salida: { pos: V(), escala: 1 },
      efectos(p) {
        return { vel: tl.get('vel', p) };
      },
      escalera: false,
      cuenta(p): Cuenta | null {
        if (p < tl.at('nervios')) return { pisos: ['10', '-12'], unidad: 'W', linea: 'una célula', h: 1 };
        if (p < tl.at('cerebro')) return { pisos: ['10', '-3'], unidad: 'W', linea: 'nervios', h: 1 };
        if (p < tl.at('ocho')) return { pisos: ['20'], unidad: 'W', linea: 'un cerebro, como el tuyo', h: 1 };
        if (p < tl.at('maquinas')) return { ...potencia(11.2, 'todos los cerebros · '), alcance: '1 mundo' };
        return { ...potencia(13.28), alcance: '1 mundo' };
      },
      // The years: from the first cell to today, the ages going by at an even pace.
      anio(p) {
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[a('celula'), -3.8e9], [a('nervios') - 1, -3.8e9], [a('nervios') + 0.6, -6e8], [a('cerebro') - 1, -6e8], [a('cerebro') + 0.6, -3e5], [a('ocho') - 0.8, -3e5], [a('ocho') + 1.4, 2026]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'I · La materia despierta', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-4;
        camera.far = 200;
        const sc = tl.get('sc', p);
        const lw = tl.get('lw', p);
        // Riding the spark; over the Earth, the same ride as scene 6 starts with (so they meet exactly).
        // (from one ride to the other over a stretch of the way, not at once where the Earth begins)
        // (while the spark rests at «tú», the gaze does not peek down the way out; it opens as the
        // spark takes it)
        const tope = sc <= 3 ? 3 : 3 + (sc - 3) * 3;
        const cam: Camino = (sv, out) => camino(Math.min(sv, tope), out);
        let m = montar(cam, sc, 0.05, 0.08, 0.04);
        const kT = THREE.MathUtils.smoothstep(sc, 3.4, 3.75);
        if (kT > 0) {
          const rs = (sc - 3.4) * (S_CAIRO / (S_CAIRO / 4 + 0.6));
          const mT = montarTierra(rs);
          mT.lugar.applyQuaternion(qT);
          mT.mira.applyQuaternion(qT);
          if (kT >= 1) m = { ...mT, arriba: mT.arriba.applyQuaternion(qT), delante: mT.delante.applyQuaternion(qT) };
          else {
            m.lugar.lerp(mT.lugar, kT);
            m.mira.lerp(mT.mira, kT);
            m.arriba.lerp(mT.arriba.applyQuaternion(qT), kT).normalize();
            m.delante.lerp(mT.delante.applyQuaternion(qT), kT).normalize();
          }
        }
        aplicarToma(camera, toma(tl, p, tm, { punto: m.mira, peso: lw, arriba: m.arriba, delante: m.delante }, { punto: m.lugar, peso: lw }));
        chispa.update(camino, sc, sc > 3.4 ? 0.0004 : 0.0025, tl.get('on', p), 0, camera.position, f.focal, f.dpr, f.time);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        agua.u.uAgua.value = tl.get('agua', p);
        celula.u.uCel.value = tl.get('cel', p);
        celula.u.uMar.value = tl.get('mar', p);
        celula.u.uToque.value = tl.get('toque', p);
        nervios.u.uNer.value = tl.get('ner', p);
        nervios.u.uCrece.value = tl.get('crece', p);
        if (corteza) corteza.u.uCor.value = tl.get('cor', p);
        if (red) {
          red.u.uRed.value = tl.get('red', p);
          red.u.uK.value = tl.get('forma', p);
          red.u.uMaq.value = tl.get('maq', p);
          red.u.uCamW.value.copy(camera.position);
        }
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.25 * Math.sin(t * 1.5));

        tierraG.updateMatrixWorld();
        inv.copy(tierraG.quaternion).invert();
        solL.copy(SOL).applyQuaternion(inv);
        camL.copy(camera.position).applyQuaternion(inv);
        const pres = tl.get('tierra', p);
        planeta.group.visible = pres > 0.002;
        planeta.update({ sol: solL, camara: camL, focal: f.focal, dpr: f.dpr, tiempo: t, presencia: pres });
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        // Flying low through the network as it becomes the Earth's lights: fine points, not big blobs.
        const bajo = THREE.MathUtils.smoothstep(p, tl.at('ocho'), tl.at('ocho') + 1.5);
        if (bajo > 0) for (const n of nubes) n.u.uMaxPx.value = THREE.MathUtils.lerp(24, 8, bajo) * f.dpr;
      },
      placa(g, f) {
        // The Sun's light, still filling the frame as the sea comes up.
        const b = tl.get('blanco', f.p);
        if (b > 0.002) {
          g.save();
          g.globalAlpha = ease(0, 1, b);
          g.fillStyle = '#fff6e6';
          g.fillRect(0, 0, f.W, f.H);
          g.restore();
        }
        void FONT;
        void ink;
      },
      dispose() {},
    };
  },
};
