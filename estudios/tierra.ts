import * as THREE from 'three';
import { EASE, Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { clamp, gauss, lerp } from './motor/math';
import { ease, mapaTierra } from './comun';
import { tierra as tierraHorizontes } from '../src/horizontes';
import { CIUDADES } from './ciudades';
import { HORIZONTE, INFERNO, TEAL, caraHacia, dirLatLon, potencia, puntoTu } from './remake';
import { angulos, aplicarToma, toma } from './rig';
import type { Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Study A of the remake: scenes 6 and 7 of ESCALETA.md, «La Tierra de noche» and «El cable»
 * (GUION.md, moments 15–19).
 *
 * The Earth fills half the frame with its night towards us (Europe, Africa, the Middle East, India).
 * Two hundred years of lights spread over it like a slow fire, first in Europe and North America,
 * then everywhere at once. «Hoy»: the point among the lights. The camera turns towards the day side,
 * enormous next to our lights. A curtain sweeps the frame and the Earth is seen by its heat. From the
 * equator a teal thread rises: the elevator. The camera rides up beside it while factories and data
 * centres climb past, and the Earth cools as its industry leaves. At the top, a ring of industry
 * round the planet: type I.
 *
 * Ways: 1 «Luces», the night as it is photographed (fine, warm, a dust of small towns); 2 «Red», the
 * same cities as knots joined by threads of light, with pulses running along them (the network that
 * the brain becomes in scene 5).
 *
 * Units: Earth radii, the Earth at the origin.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** The face turned to the camera at first, and where the elevator stands (on the equator, East Africa). */
const CARA = { lat: 24, lon: 36 };
const CABLE = { lat: 0, lon: 37 };
/** Where «tú» is: in the middle of the face, on the dark of the Red Sea between the lights (a city's core would drown it). */
const TU_EN = { lat: 22.5, lon: 37.5 };
/** The Sun, behind the Earth and to the left: a thin day crescent on the left limb. */
const SOL = V(-0.62, 0.22, -0.75).normalize();
const ALTO = 11;
const HALO = new THREE.Color(0.35, 0.58, 1.0);
const HALO_IR = new THREE.Color(1.0, 0.36, 0.12);
const GEO = 6.6;

// ---------------------------------------------------------------- the lights

/** When a region's cities got their lights: [first, span] in years. */
function inicio(lat: number, lon: number): [number, number] {
  if (lat > 35 && lon > -12 && lon < 45) return [1880, 55];
  if (lat > 44 && lon >= 45) return [1925, 50];
  if (lon < -50 && lat > 15) return [1885, 55];
  if (lon < -30) return [1920, 60];
  if (lat < -10 && lon > 110) return [1895, 50];
  if (lon > 125 && lat > 25) return [1900, 55];
  if (lon > 95 && lat > 18) return [1955, 50];
  if (lon > 60) return [1950, 62];
  if (lat > 12 && lon > 25) return [1940, 55];
  return [1960, 62];
}

/** World power (log10 W) by year: Smil and the Energy Institute, as the plate says. */
function lpDe(anio: number) {
  const K: [number, number][] = [[1800, 11.81], [1900, 12.15], [1950, 12.54], [1975, 12.9], [2000, 13.11], [2026, 13.28]];
  if (anio <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (anio <= K[i][0]) return lerp(K[i - 1][1], K[i][1], (anio - K[i - 1][0]) / (K[i][0] - K[i - 1][0]));
  return K[K.length - 1][1];
}

function base(c: THREE.Vector3) {
  const t1 = V(0, 1, 0).cross(c);
  if (t1.lengthSq() < 1e-8) t1.set(1, 0, 0);
  t1.normalize();
  return [t1, c.clone().cross(t1).normalize()];
}

function slerp(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const w = a.angleTo(b);
  const s = Math.sin(w) || 1;
  return a.clone().multiplyScalar(Math.sin((1 - t) * w) / s).addScaledVector(b, Math.sin(t * w) / s);
}

function esMar(img: ImageData, d: THREE.Vector3) {
  const lat = Math.asin(clamp(d.y, -1, 1));
  const lon = Math.atan2(-d.z, d.x);
  const px = Math.min(img.width - 1, Math.floor((lon / (2 * Math.PI) + 0.5) * img.width));
  const py = Math.floor((0.5 - lat / Math.PI) * (img.height - 1));
  const k = (py * img.width + px) * 4;
  const R = img.data[k];
  const G = img.data[k + 1];
  const B = img.data[k + 2];
  return B > R * 1.15 && B > G * 0.95;
}

const centros = CIUDADES.map(([la, lo, pop]) => {
  const [a0, span] = inicio(la, lo);
  return { c: dirLatLon(la, lo), pop, anio: a0 + span * clamp(0.04 + 0.6 * (1 - Math.sqrt(pop / 37)), 0, 1) };
});

/**
 * The night lights: each city a cloud of points by its size (a whiter core, sodium round it), the
 * roads between neighbours, and (way 1) the dust of small towns over the land near them. `aDat`:
 * the year it lights, the kind (0 city, 1 town, 2 road), how far along its road, a phase.
 */
function luces(img: ImageData, red: boolean): { data: MateriaData; dat: Float32Array } {
  const b = materiaBuilder(red ? 21 : 11);
  const r = b.r;
  const dat: number[] = [];
  const SODIO = new THREE.Color(1.0, 0.56, 0.22);
  const BLANCA = new THREE.Color(1.0, 0.84, 0.62);
  const R = 1.0015;
  for (const k of centros) {
    const [t1, t2] = base(k.c);
    const sig = (red ? 0.0014 : 0.0034) * Math.pow(k.pop, 0.42);
    const n = Math.round((red ? 40 : 90) * Math.sqrt(k.pop));
    for (let i = 0; i < n; i++) {
      const nucleo = i < n * 0.2;
      const s = nucleo ? sig * 0.35 : sig;
      const dx = gauss(r) * s;
      const dy = gauss(r) * s;
      const p = k.c.clone().addScaledVector(t1, dx).addScaledVector(t2, dy).normalize().multiplyScalar(R);
      b.push(p.x, p.y, p.z, nucleo ? BLANCA : SODIO, 0.0011, red ? (nucleo ? 0.7 : 0.3) : nucleo ? 0.38 : 0.16);
      dat.push(k.anio + (Math.hypot(dx, dy) / sig) * 9 + r() * 6, 0, 0, r());
    }
  }
  // Way 2: the roads, each city to its nearest neighbours (threads with pulses).
  const hechos = new Set<string>();
  if (red) centros.forEach((k, i) => {
    const cerca = centros
      .map((m, j) => ({ m, j, d: k.c.angleTo(m.c) }))
      .filter((x) => x.j !== i && x.d < (red ? 0.26 : 0.2))
      .sort((a, z) => a.d - z.d)
      .slice(0, red ? 3 : 2);
    for (const { m, j, d } of cerca) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (hechos.has(key)) continue;
      hechos.add(key);
      const n = Math.round(d * (red ? 3200 : 1400));
      const fase = r();
      const desde = Math.max(k.anio, m.anio) + 6;
      for (let q = 0; q < n; q++) {
        const t = r();
        const j2 = red ? 0.0005 : 0.0018;
        const p = slerp(k.c, m.c, t).add(V(gauss(r) * j2, gauss(r) * j2, gauss(r) * j2)).normalize().multiplyScalar(R);
        b.push(p.x, p.y, p.z, SODIO, 0.0009, red ? 0.32 : 0.07);
        dat.push(desde + r() * 12, 2, i < j ? t : 1 - t, fase);
      }
    }
  });
  // Way 1: the carpet of towns over the land round the cities, from a coarse density grid.
  if (!red) {
    const GW = 360;
    const GH = 180;
    const dens = new Float32Array(GW * GH);
    const anios = new Float32Array(GW * GH).fill(2030);
    const d = V();
    for (let y = 0; y < GH; y++) {
      const lat = (0.5 - (y + 0.5) / GH) * Math.PI;
      for (let x = 0; x < GW; x++) {
        const lon = ((x + 0.5) / GW - 0.5) * 2 * Math.PI;
        d.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
        let w = 0;
        for (const k of centros) {
          const c = d.dot(k.c);
          if (c < 0.95) continue;
          const a2 = Math.acos(Math.min(1, c)) ** 2;
          const e = Math.pow(k.pop, 0.75) * (Math.exp(-a2 / (2 * 0.035 * 0.035)) + 0.35 * Math.exp(-a2 / (2 * 0.1 * 0.1)));
          if (e > 0.05) anios[y * GW + x] = Math.min(anios[y * GW + x], k.anio + 12);
          w += e;
        }
        dens[y * GW + x] = w;
      }
    }
    for (let i = 0; i < 900000; i++) {
      const [x, y, z] = b.onSphere();
      d.set(x, y, z);
      const lat = Math.asin(y);
      const lon = Math.atan2(-z, x);
      const gx = Math.min(GW - 1, Math.floor((lon / (2 * Math.PI) + 0.5) * GW));
      const gy = Math.min(GH - 1, Math.floor((0.5 - lat / Math.PI) * GH));
      const w = dens[gy * GW + gx];
      if (w < 0.02 || r() > w / (w + 2.2)) continue;
      if (esMar(img, d)) continue;
      d.multiplyScalar(R);
      const brillo = r();
      b.push(d.x, d.y, d.z, brillo > 0.93 ? BLANCA : SODIO, 0.0009, 0.1 + 0.32 * brillo * brillo);
      dat.push(anios[gy * GW + gx] + r() * 40, 1, 0, r());
    }
  }
  return { data: b.data(), dat: new Float32Array(dat) };
}

const GLSL_LUCES = {
  pre: /* glsl */ `
    attribute vec4 aDat;
    uniform vec3 uCamL, uSunL;
    uniform float uAnio, uWipe, uIR, uRed, uLuz;
    uniform vec3 uWipeAx;
    ${HORIZONTE}
  `,
  move: /* glsl */ `
    float on = smoothstep(aDat.x, aDat.x + 16.0, uAnio);
    float crece = mix(0.4, 1.0, smoothstep(aDat.x, aDat.x + 80.0, uAnio));
    float noche = 1.0 - smoothstep(-0.2, 0.08, dot(normalize(p), uSunL));
    float pulso = 0.0;
    if (aDat.y > 1.5) {
      float x = fract(aDat.z * 2.0 - uTime * 0.22 + aDat.w * 7.0);
      pulso = uRed * smoothstep(0.86, 1.0, x) * 5.0;
    }
    em *= on * crece * delante(p, uCamL) * mix(0.04, 1.0, noche) * uLuz * (1.0 + pulso);
  `,
  post: /* glsl */ `
    em *= mix(1.0, smoothstep(uWipe - 0.012, uWipe + 0.012, dot(normalize(p), uWipeAx)), uIR);
  `,
};

// ---------------------------------------------------------------- the heat

/**
 * The Earth seen by its heat, as a map (equirectangular, the library's frame): warmer towards the
 * equator, a little over land, and much over the cities. The planet's own surface hook reads it.
 */
function mapaCalor(img: ImageData): THREE.DataTexture {
  const W = 512;
  const H = 256;
  const px = new Uint8Array(W * H * 4);
  const d = V();
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
      d.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
      let h = 0.12 + 0.3 * Math.pow(Math.cos(lat), 1.6) + (esMar(img, d) ? 0 : 0.04);
      for (const k of centros) {
        const c = d.dot(k.c);
        if (c < 0.99) continue;
        const a = Math.acos(Math.min(1, c));
        h += 0.05 * Math.sqrt(k.pop) * Math.exp(-(a * a) / (2 * 0.02 * 0.02));
      }
      const i = ((H - 1 - y) * W + x) * 4;
      px[i] = Math.round(Math.min(h, 0.8) * 255);
      px[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(px, W, H, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * The curtain: past a plane that sweeps across the planet (`uWipeAx`, the camera's right in the
 * planet's frame; `uWipe`, how far it has gone), the ground is seen by its heat.
 */
const CALOR = {
  pre: /* glsl */ `
    uniform sampler2D uCalor;
    uniform float uIR, uWarm, uWipe;
    uniform vec3 uWipeAx;
  `,
  glsl: /* glsl */ `
    float mIR = uIR * (1.0 - smoothstep(uWipe - 0.012, uWipe + 0.012, dot(n, uWipeAx)));
    if (mIR > 0.0) {
      float h = texture2D(uCalor, uvDe(n)).r + uWarm * 0.2;
      alb = mix(alb, vec3(0.0), mIR);
      vec3 cal = vec3(smoothstep(0.04, 0.5, h), smoothstep(0.36, 0.86, h) * 0.72, smoothstep(0.72, 1.0, h) * 0.45);
      extra = mix(extra, cal * 0.5, mIR);
    }
  `,
};

// ---------------------------------------------------------------- the elevator

/** The cable: points from the ground to ALTO radii, denser low; it grows to `uAlto`. */
function cableDatos(c: THREE.Vector3): MateriaData {
  const b = materiaBuilder(9);
  const [t1, t2] = base(c);
  for (let i = 0; i < 14000; i++) {
    const u = b.r();
    const h = 1 + (ALTO - 1) * Math.pow(u, 1.7);
    const j = 0.0008 * h;
    const p = c.clone().multiplyScalar(h).addScaledVector(t1, gauss(b.r) * j).addScaledVector(t2, gauss(b.r) * j);
    b.push(p.x, p.y, p.z, TEAL, 0.00016, 0.6, { kind: h });
  }
  return b.data();
}

/**
 * What climbs it: factories (teal blocks of points) and data centres (white-blue slabs), packets
 * that ride the cable up for ever. `position` holds each point's place in its packet; `aKind` the
 * packet's phase; `aDelay` when it appears (0..1, with the industry).
 */
function cargaDatos(c: THREE.Vector3): MateriaData {
  const b = materiaBuilder(13);
  const [t1, t2] = base(c);
  const FRIA = new THREE.Color(0.78, 0.88, 1.0);
  const N = 170;
  for (let k = 0; k < N; k++) {
    const fase = k / N + b.r() * 0.004;
    const datos = k % 4 === 3;
    const s = 0.0032 + b.r() * 0.0022;
    const lado = (b.r() - 0.5) * 0.0016;
    const nx = datos ? 7 : 4;
    const ny = datos ? 7 : 4;
    const nz = datos ? 2 : 5;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++)
        for (let q = 0; q < nz; q++) {
          const o = t1
            .clone()
            .multiplyScalar(((i / (nx - 1 || 1)) - 0.5) * s + lado)
            .addScaledVector(t2, ((j / (ny - 1 || 1)) - 0.5) * s)
            .addScaledVector(c, ((q / (nz - 1 || 1)) - 0.5) * s * (datos ? 0.15 : 1));
          b.push(o.x, o.y, o.z, datos ? FRIA : TEAL, s * 0.2, datos ? 0.32 : 0.36, { kind: fase, delay: b.r() });
        }
  }
  return b.data();
}

/** The industry in orbit: a ring at geostationary height, that spreads round from the cable. */
function anilloDatos(lonCable: number): MateriaData {
  const b = materiaBuilder(17);
  const lo0 = THREE.MathUtils.degToRad(lonCable);
  for (let i = 0; i < 42000; i++) {
    const a = b.r() * Math.PI * 2;
    const R = GEO + gauss(b.r) * 0.05;
    const y = gauss(b.r) * 0.012;
    const lo = lo0 + a;
    let dif = a > Math.PI ? Math.PI * 2 - a : a;
    dif /= Math.PI;
    b.push(Math.cos(lo) * R, y, -Math.sin(lo) * R, b.r() < 0.12 ? 0xffffff : TEAL, 0.004, 0.25 + b.r() * 0.25, { kind: dif });
  }
  return b.data();
}

// ---------------------------------------------------------------- the scene

export const tierraNoche: Escena = {
  id: 'tierra',
  nombre: 'A · La Tierra de noche y el cable',
  estilos: [
    { key: '1', nombre: 'Luces', nota: 'La noche como se fotografía: luces finas y cálidas, polvo de pueblos sobre la tierra, caminos tenues.' },
    { key: '2', nombre: 'Red', nota: 'Las mismas ciudades como nudos unidos por hilos de luz, con pulsos que los recorren: la red en que se convierte el cerebro.' },
  ],
  montar(stage, estilo): Instancia {
    const red = estilo === 1;
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.5;
    stage.bloom.threshold = 0.42;
    stage.renderer.toneMappingExposure = 1.15;

    const earth = new THREE.Group();
    earth.quaternion.copy(caraHacia(CARA.lat, CARA.lon));
    root.add(earth);
    const base = `${import.meta.env.BASE_URL}texturas/`;
    const calorU = { uCalor: { value: null as THREE.Texture | null }, uIR: { value: 0 }, uWarm: { value: 0 }, uWipe: { value: -2 }, uWipeAx: { value: V(1, 0, 0) } };
    const planeta = tierraHorizontes(base, { giro: 0, superficie: { ...CALOR, uniforms: calorU } });
    earth.add(planeta.group);

    const cDir = dirLatLon(CABLE.lat, CABLE.lon);
    const cW = cDir.clone().applyQuaternion(earth.quaternion);
    const cAng = angulos(cW);
    /** Riding beside the cable, not on it: a fixed step east of it. */
    const lado = V(0, 1, 0).cross(cW).normalize().multiplyScalar(0.03);
    /** The last view: 48° above the equator and turned from the cable, so the ring opens and the cable shows in profile. */
    const norte = V(0, 1, 0).applyQuaternion(earth.quaternion);
    const fin = angulos(cW.clone().applyAxisAngle(norte, THREE.MathUtils.degToRad(-75)).multiplyScalar(Math.cos(0.84)).addScaledVector(norte, Math.sin(0.84)));
    const tuPos = dirLatLon(TU_EN.lat, TU_EN.lon).multiplyScalar(1.004);

    const nubes: Nube[] = [];
    const add = (n: Nube) => {
      n.u.uSpread.value = 0;
      earth.add(n.points);
      nubes.push(n);
      return n;
    };
    const comunes = () => ({ uCamL: { value: V() }, uSunL: { value: V() }, uWipe: { value: -2 }, uWipeAx: { value: V(1, 0, 0) } });

    const cable = add(
      materia(cableDatos(cDir), {
        pre: /* glsl */ `uniform float uAlto;`,
        move: /* glsl */ `
          em *= 1.0 - smoothstep(uAlto - 0.25, uAlto, aKind);
          em *= 1.0 - 0.9 * smoothstep(${GEO.toFixed(1)}, ${ALTO.toFixed(1)}, aKind);
          float dz = (aKind - uAlto) / 0.12;
          em *= 1.0 + 3.0 * exp(-dz * dz);
        `,
        uniforms: { uAlto: { value: 1 } },
      }),
    );
    cable.u.uFuente.value = 0.3;
    const carga = add(
      materia(cargaDatos(cDir), {
        pre: /* glsl */ `uniform vec3 uC; uniform float uInd, uAlto;`,
        move: /* glsl */ `
          float h = 1.03 * pow(${ALTO.toFixed(1)} / 1.03, fract(aKind + uTime * 0.0045));
          p = position + uC * h;
          em *= step(aDelay, uInd) * smoothstep(1.03, 1.08, h) * (1.0 - smoothstep(uAlto - 0.3, uAlto, h));
          em *= 1.0 - 0.8 * smoothstep(${GEO.toFixed(1)}, ${ALTO.toFixed(1)}, h);
        `,
        uniforms: { uC: { value: cDir.clone() }, uInd: { value: 0 }, uAlto: { value: 1 } },
      }),
    );
    carga.u.uFuente.value = 0.15;
    const anillo = add(
      materia(anilloDatos(CABLE.lon), {
        pre: /* glsl */ `uniform float uAni;`,
        move: /* glsl */ `em *= smoothstep(aKind - 0.08, aKind, uAni * 1.08);`,
        uniforms: { uAni: { value: 0 } },
      }),
    );
    anillo.u.uFuente.value = 0.35;
    const tu = add(puntoTu(tuPos, 0.008));

    let lucesN: Nube | null = null;
    const listo = (async () => {
      const img = await mapaTierra();
      const l = luces(img, red);
      lucesN = materia(l.data, { ...GLSL_LUCES, uniforms: { ...comunes(), uAnio: { value: 1800 }, uIR: { value: 0 }, uRed: { value: red ? 1 : 0 }, uLuz: { value: 1 } }, extra: { aDat: [l.dat, 4] } });
      lucesN.u.uFuente.value = 0.5;
      add(lucesN);
      calorU.uCalor.value = mapaCalor(img);
      await planeta.listo;
    })();

    // ---------------------------------------------------------------- the moments (GUION.md 15–19)
    const tl = new Timeline();
    /** A tween that starts `off` beats after the cursor (the cursor stays). */
    const luego = (off: number, dur: number, v: Record<string, number>, e: ((t: number) => number) | null = null) => {
      tl.wait(off);
      tl.with(dur, v, e);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: 12, el: 9, ld: 0.74, yaw: 90, pitch: -90, roll: 0, fov: 34, anio: 1800, tu: 0, wipe: -1.4, warm: 0, ir: 0, presencia: 1, alto: 1, ind: 0, ani: 0, lw: 0, lh: 1, lp2: 13.28 });

    tl.label('luces').caption(3.8, 'Doscientos años de luces', 'En doscientos años encendimos el planeta: primero de a poco, después de golpe.');
    luego(0.3, 3.3, { anio: 2026 });
    tl.to(3.8, { az: 3, el: 5, ld: 0.64 });

    tl.label('hoy').caption(3.6, 'Hoy', 'Hoy usamos diecinueve billones de vatios. Unos pocos encienden la pantalla en que miras esto.');
    luego(0.4, 0.9, { tu: 1 });
    tl.to(3.6, { az: 0, el: 4, ld: 0.58 });

    tl.label('energia').caption(3.6, 'Más energía, más calor', 'Hay espacio para crecer: el Sol le da a la Tierra casi diez mil veces más. Pero lo que usamos termina como calor.');
    tl.with(1.0, { tu: 0 });
    tl.to(3.6, { az: -52, el: 12, ld: 0.66 });

    tl.label('calor').caption(3.9, 'El calor nos echa', 'Un planeta solo se enfría brillando hacia el espacio. Si seguimos creciendo aquí, se recalienta: hay que salir.');
    tl.with(0.01, { ir: 1 });
    luego(0.3, 1.8, { wipe: 1.4 }, EASE.sine);
    luego(1.4, 2.4, { warm: 1, lp2: 16 });
    luego(1.6, 1.6, { presencia: 0.45 });
    tl.to(3.9, { az: -24, el: 8, ld: 0.68 });

    // The thread rises from the equator, seen from the side, and the Earth cools as the industry
    // climbs it. Then the camera goes beside the cable, looking out at the horizon with the factories
    // rising through the frame, and looks down more and more as it climbs.
    tl.label('cable').caption(10.4, 'La industria sale al espacio', 'Las fábricas suben por el cable. Allá arriba su calor se va al vacío, y podemos seguir creciendo hasta el tipo I.');
    tl.with(1.8, { alto: ALTO });
    luego(0.6, 2.4, { ind: 1 });
    luego(0.5, 2.4, { warm: 0 });
    luego(1.3, 1.9, { ir: 0, presencia: 1 });
    tl.to(2.6, { az: cAng.az + 30, el: cAng.el + 12, ld: 0.5 });
    tl.to(2.4, { az: cAng.az, el: cAng.el, ld: 0.075, ox: lado.x, oy: lado.y, oz: lado.z, pitch: -9, yaw: 180, roll: 7, fov: 54 });
    tl.to(5.4, { ld: 0.74, pitch: -74, roll: 0, fov: 48 });
    luego(-2.2, 3.0, { ani: 1 });
    // At the top, away from the cable to see the whole Earth with its ring.
    tl.to(3.0, { az: fin.az, el: fin.el, ld: 1.36, ox: 0, oy: 0, oz: 0, pitch: -90, yaw: 90, fov: 34 });
    tl.label('fin').wait(0.6);

    const tm = toma(tl, 0);
    const solL = V();
    const camL = V();
    const inv = new THREE.Quaternion();
    const centroV = V();

    return {
      tl,
      listo,
      escalera: false,
      cuenta(p) {
        const anio = tl.get('anio', p);
        if (p < tl.at('hoy')) return potencia(lpDe(anio), `${Math.round(anio)} · `);
        if (p < tl.at('calor')) return potencia(13.28, '2026 · hoy · ');
        return potencia(tl.get('lp2', p));
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'II · Nosotros, hoy', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-4;
        camera.far = 400;
        const mira = { punto: cW.clone().multiplyScalar(tl.get('lh', p)), peso: tl.get('lw', p) };
        aplicarToma(camera, toma(tl, p, tm, mira));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        earth.updateMatrixWorld();

        inv.copy(earth.quaternion).invert();
        solL.copy(SOL).applyQuaternion(inv);
        camL.copy(camera.position).applyQuaternion(inv);
        planeta.update({ sol: solL, camara: camL, focal: f.focal, dpr: f.dpr, tiempo: t, presencia: tl.get('presencia', p) });

        const ir = tl.get('ir', p);
        const wipe = ir > 0 ? tl.get('wipe', p) : -2;
        // The curtain sweeps from the left of the frame to its right: the camera's right, planet frame.
        const eje = V(1, 0, 0).applyQuaternion(camera.quaternion).applyQuaternion(inv);
        calorU.uIR.value = ir;
        calorU.uWipe.value = wipe;
        calorU.uWipeAx.value.copy(eje);
        calorU.uWarm.value = tl.get('warm', p);
        if (planeta.halo) planeta.halo.uColor.value.copy(HALO).lerp(HALO_IR, ir * ease(-1, 1, wipe));
        if (lucesN) {
          lucesN.u.uCamL.value.copy(camL);
          lucesN.u.uSunL.value.copy(solL);
          lucesN.u.uAnio.value = tl.get('anio', p);
          lucesN.u.uWipe.value = wipe;
          lucesN.u.uWipeAx.value.copy(eje);
          lucesN.u.uIR.value = ir;
        }
        const alto = tl.get('alto', p);
        cable.u.uAlto.value = alto;
        carga.u.uAlto.value = alto;
        carga.u.uInd.value = tl.get('ind', p);
        anillo.u.uAni.value = tl.get('ani', p);
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.25 * Math.sin(t * 1.5));

        // The planet hides what is behind it (the cable's far side, the ring behind the Earth).
        centroV.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
        for (const n of [cable, carga, anillo]) n.u.uOcc.value.set(centroV.x, centroV.y, centroV.z, 1.0);
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
      },
      placa(g, f) {
        // The curtain's edge while it sweeps.
        const ir = tl.get('ir', f.p);
        const w = tl.get('wipe', f.p);
        if (ir > 0.5 && w > -1 && w < 1) {
          const q = V(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(w).project(camera);
          const x = ((q.x + 1) / 2) * f.W;
          const grad = g.createLinearGradient(0, 0, 0, f.H);
          grad.addColorStop(0, 'rgba(255,140,80,0)');
          grad.addColorStop(0.5, 'rgba(255,140,80,0.55)');
          grad.addColorStop(1, 'rgba(255,140,80,0)');
          g.fillStyle = grad;
          g.fillRect(x - 0.75 * f.dpr, 0, 1.5 * f.dpr, f.H);
        }
      },
      dispose() {
        void lerp;
      },
    };
  },
};
