import * as THREE from 'three';
import { EASE, Timeline } from './timeline';
import { enfocar, type Nube } from './materia';
import { clamp, lerp, smoothstep } from './math';
import { FONT, TEAL, ink, nota, proyectar, rotulo, type Lectura, type Rotulo } from './placa';
import { tierra } from './tierra';
import {
  GEO,
  MOON_D,
  R_E,
  R_MER,
  R_SUN,
  ASCENSOR,
  ascensorDir,
  cercanias,
  cinturon,
  enjambre,
  faros,
  haz,
  luna,
  mercurio,
  orbitas,
  placas,
  ringABasis,
  ringAPoint,
  ruta,
  sol,
} from './obras';

/**
 * Prototype · the Solar System at work, between Type I and Type II.
 *
 * One continuous journey, riding the civilization's own routes: up the space elevator, out of the
 * Earth's neighbourhood, across the inner system to Mercury, along the catapult, on a payload into
 * the swarm, beside the light beam that pushes a sail, and up until the whole system is in view.
 * Everything keeps working while the camera is elsewhere: that is the point.
 *
 * World units: AU, Sun at the origin, ecliptic in XZ.
 */

export interface Frame {
  time: number;
  dt: number;
  p: number;
  W: number;
  H: number;
  u: number;
  dpr: number;
  focal: number;
  camera: THREE.PerspectiveCamera;
}

export interface Vista {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  fov: number;
}

export interface Sitio {
  id: string;
  nombre: string;
  frase: string;
  /** O observed / T physics allows it / E speculation. */
  certeza: 'O' | 'T' | 'E';
  /** AstroIngeniería article id (#obra-<id>). */
  obra?: string;
  /** Where it is now (world). */
  pos(out: THREE.Vector3): THREE.Vector3;
  /** How far to look at it from (AU) when visited. */
  dist: number;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const RING_R = 0.3;

/**
 * The spectrum seen from afar (energy per log of wavelength, λFλ): the Sun's light at 5 800 K and
 * the collectors' heat at ~300 K have the same shape, shifted; the swarm moves energy from one bump
 * to the other (fraction f), so the visible bump shrinks as much as the infrared one grows.
 */
function espectro(g: CanvasRenderingContext2D, u: number, x: number, y: number, w: number, h: number, f: number, alpha: number) {
  const L0 = -1;
  const L1 = 2;
  const X = (l: number) => x + ((l - L0) / (L1 - L0)) * w;
  const shape = (lum: number, T: number) => {
    const xx = 14388 / (Math.pow(10, lum) * T);
    return xx > 60 ? 0 : Math.pow(xx, 4) / (Math.exp(xx) - 1) / 4.78;
  };
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = 'rgba(4,6,8,0.7)';
  g.strokeStyle = 'rgba(236,231,219,0.18)';
  g.lineWidth = Math.max(1, u);
  g.beginPath();
  g.roundRect(x - 18 * u, y - 40 * u, w + 36 * u, h + 76 * u, 8 * u);
  g.fill();
  g.stroke();
  g.font = FONT.mono(9.5 * u);
  g.letterSpacing = `${1.3 * u}px`;
  g.fillStyle = ink(0.7);
  g.fillText('ESPECTRO VISTO DESDE LEJOS', x, y - 20 * u);
  // the visible band
  const v0 = X(Math.log10(0.38));
  const v1 = X(Math.log10(0.75));
  const grd = g.createLinearGradient(v0, 0, v1, 0);
  ['#7a4cff', '#3f7bff', '#2fd0c0', '#9be04a', '#ffd23a', '#ff8a2a', '#ff3a2a'].forEach((c, i, a) => grd.addColorStop(i / (a.length - 1), c));
  g.fillStyle = grd;
  g.globalAlpha = alpha * 0.55;
  g.fillRect(v0, y + h + 2 * u, v1 - v0, 5 * u);
  g.globalAlpha = alpha;
  // axis
  g.strokeStyle = ink(0.4);
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x + w, y + h);
  g.stroke();
  g.fillStyle = ink(0.55);
  g.font = FONT.mono(9 * u);
  g.letterSpacing = '0px';
  g.textAlign = 'center';
  ['0,1', '1', '10', '100'].forEach((t, i) => g.fillText(`${t} µm`, X(L0 + i), y + h + 22 * u));
  g.textAlign = 'left';
  const curve = (T: number, k: number, color: string) => {
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, 1.8 * u);
    g.beginPath();
    for (let i = 0; i <= 160; i++) {
      const l = L0 + ((L1 - L0) * i) / 160;
      const yy = y + h - shape(l, T) * k * h;
      if (i) g.lineTo(X(l), yy);
      else g.moveTo(X(l), yy);
    }
    g.stroke();
  };
  curve(5772, 1 - f, '#ffe0a0');
  curve(300, f, '#ff6a3d');
  g.font = FONT.mono(9.5 * u);
  g.fillStyle = '#ffe0a0';
  g.fillText('luz del Sol · 5 800 K', X(Math.log10(0.65)) + 8 * u, y + h - (1 - f) * h - 6 * u);
  g.fillStyle = '#ff8a5a';
  g.textAlign = 'right';
  g.fillText('calor del enjambre · 300 K', X(Math.log10(12)) - 8 * u, y + h - f * h - 6 * u);
  g.restore();
}

// Where things are (AU).
const TH_E = 3.62;
const E = V(Math.cos(TH_E), 0, Math.sin(TH_E));
const TH_M = 3.28;
const M = V(0.387 * Math.cos(TH_M), 0, 0.387 * Math.sin(TH_M));
const VENUS = V(0.723 * Math.cos(2.7), 0, 0.723 * Math.sin(2.7));
const MARS = V(1.524 * Math.cos(4.3), 0, 1.524 * Math.sin(4.3));
const JUPITER = V(5.2 * Math.cos(5.1), 0.05, 5.2 * Math.sin(5.1));

function coreografia() {
  const tl = new Timeline({ lp: 16.1, ly: 2.57, lr: 8, luces: 0.62, built: 0.42, eat: 0.08, paso: 0 });
  const cap = (d: number, n: string, f: string) => tl.caption(d, n, f);
  tl.set({ lp: 16.1, ly: 2.57, lr: 8.2 });
  cap(3.2, 'La Tierra encendida', 'Año ~2400. Diez mil billones de vatios: el tipo I. Un anillo en órbita y un ascensor que sube sin cohetes.');
  tl.label('tierra').to(0.6, {});
  tl.label('ascensor').to(2.6, { lr: 8.2 });
  cap(1.8, 'El calor nos echa', 'Usar más energía aquí abajo calentaría el planeta. La industria tiene que salir al espacio.');
  tl.label('salida').to(0.8, { lp: 16.5, ly: 2.62, lr: 11.7 });
  cap(1.4, 'Hacia el Sol', 'Todo pasa a la vez: la Luna lanza materia, el cinturón se mina, alrededor del Sol crece un enjambre.');
  tl.label('viaje').to(1.4, { lp: 17.5, ly: 2.7 });
  cap(1.0, 'Desarmar Mercurio', 'Máquinas que se copian a sí mismas convierten un planeta entero en colectores. Con su masa alcanza para rodear el Sol.');
  tl.label('mercurio').to(1.0, { lp: 18.5, ly: 2.76, eat: 0.1 });
  cap(1.8, 'La catapulta', 'Un riel de cientos de kilómetros lanza la materia al espacio sin cohetes. Sin aire, nada la frena.');
  tl.label('riel').to(0.8, { lp: 19.2 }).label('carga').to(1.0, { lp: 20, ly: 2.82, eat: 0.12 });
  cap(2.4, 'Enjambre de Dyson', 'No es una esfera: es una nube de velas en órbita, cada una de cara al Sol. La estrella se va apagando para los demás.');
  tl.label('enjambre').to(2.4, { lp: 21.2, ly: 2.89, built: 0.58, eat: 0.15 });
  // Station: how a Dyson swarm works, one step per gesture. Time stops; the scene becomes the diagram.
  const PASOS: [string, string][] = [
    ['Una vela', 'Cada colector es una lámina delgada de cara al Sol: capta su luz y la vuelve electricidad. Lo que no usa, lo suelta como calor.'],
    ['¿Por qué no una esfera?', 'Una cáscara rígida no se sostiene: nada la mantiene centrada y terminaría chocando con el Sol. Dyson (1960) propuso otra cosa.'],
    ['Un enjambre', 'Millones de colectores, cada uno en su propia órbita, como planetas diminutos. Juntos rodean el Sol sin tocarse.'],
    ['La energía viaja', 'En haces de microondas o láser, invisibles, la energía va a donde se usa: fábricas, hábitats, velas.'],
    ['Visto desde lejos', 'Desde otra estrella, el Sol se apaga: el enjambre se come su luz. Pero brilla en infrarrojo, con el calor de los colectores. Así buscamos a otras civilizaciones.'],
  ];
  tl.label('taller');
  PASOS.forEach(([n, f], i) => {
    tl.caption(1.75, n, f);
    tl.to(0.4, { paso: i + 1 }, EASE.inOut).to(1.35, {});
  });
  tl.set({ built: 0.58 });
  cap(1.2, 'Velas de luz', 'La luz del Sol, juntada en un haz, empuja una vela hacia otra estrella. El primer paso fuera de casa.');
  tl.label('vela').to(1.2, { lp: 21.8, ly: 2.94, lr: 12.4, built: 0.64 });
  cap(2.0, 'Todo a la vez', 'El Sistema Solar trabaja como una sola máquina. Tipo 1,6: falta todavía para usar toda la luz del Sol.');
  tl.label('todo').to(2.0, { lp: 22.1, ly: 2.98, lr: 12.6, built: 0.7, eat: 0.2 });
  return tl;
}

let skyUni: { uIR: THREE.IUniform; uWipePx: THREE.IUniform } | null = null;
/** The sky's uniforms, so the station can show it in the infrared too. */
export function cieloUniforms(u: { uIR: THREE.IUniform; uWipePx: THREE.IUniform }) {
  skyUni = u;
}

export function sistema(scene: THREE.Object3D) {
  const tl = coreografia();
  const nubes: Nube[] = [];

  // ------------------------------------------------------------ the bodies and the works
  const sun = sol();
  scene.add(sun.group);

  const swarm = enjambre();
  scene.add(swarm.points);
  nubes.push(swarm);
  const plates = placas();
  scene.add(plates.mesh);

  const orbits = orbitas([0.387, 0.723, 1.0, 1.524, 5.2]);
  scene.add(orbits);

  const CAMP = V(Math.cos(TH_E + 0.4) * 2.6, 0, Math.sin(TH_E + 0.4) * 2.6);
  const belt = cinturon(CAMP);
  scene.add(belt.points);
  nubes.push(belt);

  // The Earth system: the planet (tilted, turned so the elevator stands near dawn), its works, the Moon.
  const earthSys = new THREE.Group();
  earthSys.position.copy(E);
  earthSys.scale.setScalar(R_E);
  scene.add(earthSys);
  const body = new THREE.Group();
  earthSys.add(body);
  const earth = tierra();
  body.add(earth.group);
  const near = cercanias();
  body.add(near.group);
  const sunW = E.clone().negate().normalize();
  const tilt = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 23.44 * D2R);
  const up0 = ascensorDir();
  let best = 0;
  let bestErr = 9;
  for (let k = 0; k < 720; k++) {
    const phi = (k / 720) * Math.PI * 2;
    const q = tilt.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), phi));
    const u = up0.clone().applyQuaternion(q);
    const side = u.clone().cross(sunW).y;
    const err = Math.abs(u.dot(sunW) + 0.18) + (side > 0 ? 0 : 1);
    if (err < bestErr) {
      bestErr = err;
      best = phi;
    }
  }
  body.quaternion.copy(tilt).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), best));
  const upW = up0.clone().applyQuaternion(body.quaternion);

  const moon = luna();
  const moonDir = sunW.clone().applyAxisAngle(V(0, 1, 0), 2.2).add(V(0, 0.08, 0)).normalize();
  moon.group.position.copy(moonDir).multiplyScalar(MOON_D);
  earthSys.add(moon.group);
  nubes.push(...moon.nubes, ...near.nubes);

  const merc = mercurio();
  merc.group.position.copy(M);
  scene.add(merc.group);
  nubes.push(...merc.nubes);
  const mercSun = M.clone().negate().normalize();

  // ------------------------------------------------------------ routes
  const teal = new THREE.Color(0.6, 1.0, 0.88);
  const warm = new THREE.Color(1.0, 0.85, 0.6);
  const { n: nA, e1, e2 } = ringABasis();
  const aM = Math.atan2(M.dot(e2), M.dot(e1));
  const aArr = aM + 0.22;
  const tanA = (a: number) => e1.clone().multiplyScalar(-Math.sin(a)).addScaledVector(e2, Math.cos(a));
  const radA = (a: number) => e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));

  const tmp = V();
  const railEnd = merc.group.localToWorld(merc.riel.at(1, V()).multiplyScalar(1.0));
  merc.group.updateMatrixWorld(true);
  const launchDir = merc.riel.dir(1, V());
  const arrive = ringAPoint(aArr, 0, 0);
  const mercRoute = ruta(900, 0.05, teal, 4e-6, 0.16);
  const setMercRoute = () => {
    merc.group.updateMatrixWorld(true);
    const p0 = merc.group.localToWorld(merc.riel.at(1, V()));
    const p1 = p0.clone().addScaledVector(launchDir, 0.03).addScaledVector(mercSun, 0.01);
    const p3 = arrive.clone();
    const p2 = p3.clone().addScaledVector(tanA(aArr), -0.06).addScaledVector(radA(aArr), 0.015);
    mercRoute.set(p0, p1, p2, p3);
  };
  setMercRoute();
  scene.add(mercRoute.group);
  nubes.push(mercRoute.nube);
  void railEnd;

  // The Moon's catapult throws ore to a depot beyond the Moon; the belt ships to Earth; the first
  // seed factories went from Earth to Mercury.
  earthSys.updateMatrixWorld(true);
  const moonW = moon.group.getWorldPosition(V());
  const depot = E.clone().addScaledVector(moonDir, (MOON_D + 9) * R_E).add(V(0, 4 * R_E, 0));
  const moonRoute = ruta(260, 0.08, teal, 1.2e-6, 0.25);
  moonRoute.set(moonW.clone().addScaledVector(moonDir.clone().negate(), 0.27 * R_E), moonW.clone().add(V(0, 3 * R_E, 0)), depot.clone().add(V(0, 6 * R_E, 0)), depot);
  scene.add(moonRoute.group);
  nubes.push(moonRoute.nube);
  const beltRoutes = [0.4, 1.3, 2.4].map((a, i) => {
    const r = ruta(500, 0.015 + i * 0.004, warm, 2.2e-5, 0.08);
    const p0 = V(Math.cos(TH_E + a) * 2.6, 0.05 * (i - 1), Math.sin(TH_E + a) * 2.6);
    const p3 = E.clone().add(V(0, 0, 0.002 * (i - 1)));
    r.set(p0, p0.clone().multiplyScalar(0.75).add(V(0, 0.3, 0)), p3.clone().multiplyScalar(1.3).add(V(0, 0.15, 0)), p3);
    scene.add(r.group);
    nubes.push(r.nube);
    return r;
  });
  void beltRoutes;
  const seedRoute = ruta(300, 0.02, teal, 1.4e-5, 0.1);
  seedRoute.set(E.clone().add(V(0, 0.0005, 0)), E.clone().multiplyScalar(0.8).add(V(0, 0.08, 0)), M.clone().multiplyScalar(1.4).add(V(0, 0.05, 0)), M.clone().add(V(0, 0.0002, 0)));
  scene.add(seedRoute.group);
  nubes.push(seedRoute.nube);

  // The beam and the sail.
  const beam = haz();
  scene.add(beam.group);
  const aEm = aArr + 0.62;
  const emitter = ringAPoint(aEm, 0, 0);
  const sailDir = radA(aEm).multiplyScalar(0.8).addScaledVector(nA, 0.6).addScaledVector(tanA(aEm), 0.15).normalize();
  const sailAt = (tau: number, out: THREE.Vector3) => out.copy(emitter).addScaledVector(sailDir, 0.0006 + 4.5 * tau * tau);

  // Beacons: what is too small to see still shows as a light.
  const B = faros([
    { color: new THREE.Color(0.55, 0.85, 1.0), px: 2.4 }, // 0 Earth
    { color: new THREE.Color(0.85, 0.85, 0.8), px: 1.3 }, // 1 Moon
    { color: new THREE.Color(0.6, 1.0, 0.85), px: 2.0 }, // 2 Mercury (busy)
    { color: new THREE.Color(1.0, 0.95, 0.8), px: 2.0 }, // 3 Venus
    { color: new THREE.Color(1.0, 0.6, 0.4), px: 1.8 }, // 4 Mars
    { color: new THREE.Color(1.0, 0.9, 0.75), px: 2.2 }, // 5 Jupiter
    { color: new THREE.Color(0.75, 1.0, 0.92), px: 2.4 }, // 6 the sail
    { color: new THREE.Color(1.0, 0.97, 0.9), px: 2.6 }, // 7 our payload
  ]);
  scene.add(B.points);

  // ------------------------------------------------------------ the camera's route
  const P = (label: string) => tl.at(label);
  const ease = (a: number, b: number, p: number) => smoothstep(a, b, p);
  const loc2w = (g: THREE.Object3D, v: THREE.Vector3) => g.localToWorld(v.clone());
  const shot = (pos: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3, fov: number): Vista => ({ pos, target, up, fov });

  const rideR = (p: number) => Math.exp(lerp(Math.log(1.18), Math.log(13), ease(P('ascensor'), P('salida'), p)));
  // Beside the ribbon: an offset that grows with the height, so the ribbon stays a thread in frame.
  const sideL = up0.clone().cross(V(0, 1, 0)).normalize();
  function camTierra(p: number): Vista {
    body.updateMatrixWorld(true);
    const r = rideR(p);
    const k = ease(P('tierra'), P('ascensor') + 0.8, p);
    const posL = up0.clone().multiplyScalar(r).addScaledVector(sideL, 0.12 + 0.18 * r * 0.25).add(V(0, 0.06 * r, 0));
    // Looking at first along the ribbon to the horizon; then down at the Earth as we climb.
    const horizon = up0.clone().multiplyScalar(1.05).addScaledVector(sideL, -1.2).add(V(0, -0.15, 0));
    const tgtL = horizon.lerp(V(0, 0, 0), k);
    const upL = up0.clone().lerp(V(0, 1, 0), 0.4).normalize();
    return shot(loc2w(body, posL), loc2w(body, tgtL), upL.applyQuaternion(body.quaternion), lerp(62, 48, k));
  }
  function camSalida(p: number): Vista {
    // Back out until the Earth, its ring and the Moon fit together.
    const k = ease(P('salida'), P('viaje'), p);
    const end = camTierra(P('salida'));
    const dir = end.pos.clone().sub(E).normalize();
    const d = Math.exp(lerp(Math.log(end.pos.distanceTo(E)), Math.log(150 * R_E), k));
    const sideW = dir.clone().cross(V(0, 1, 0)).normalize();
    const pos = E.clone().addScaledVector(dir.lerp(sideW.multiplyScalar(-1).add(V(0, 0.35, 0)).normalize(), k * 0.7).normalize(), d);
    const target = E.clone().lerp(moon.group.getWorldPosition(V()), 0.35 * k);
    return shot(pos, target, end.up.clone().lerp(V(0, 1, 0), k), lerp(48, 44, k));
  }
  function camViaje(p: number): Vista {
    const s = ease(P('viaje'), P('mercurio'), p);
    const start = camSalida(P('viaje'));
    const endPos = M.clone().add(V(0.0, 0.0006, 0.0012));
    const base = start.pos.clone().lerp(endPos, s);
    base.y += 0.09 * Math.sin(Math.PI * s);
    // Looking at the Earth, then at the Sun's swarm, then at Mercury.
    const t1 = start.target.clone().lerp(V(0, 0, 0), ease(0.0, 0.45, s));
    const target = t1.lerp(M, ease(0.55, 1.0, s));
    return shot(base, target, V(0, 1, 0), lerp(44, 50, ease(0, 0.5, s)) - 6 * ease(0.6, 1, s));
  }
  // Mercury: approach, then along the rail.
  function camMercurio(p: number): Vista {
    merc.group.updateMatrixWorld(true);
    const a = ease(P('mercurio'), P('riel'), p);
    const r = ease(P('riel'), P('carga'), p);
    const s = lerp(0.05, 0.9, r);
    const railP = merc.riel.at(s, V());
    const railD = merc.riel.dir(s, V());
    const nrm = railP.clone().normalize();
    // From afar (≈ 70 radii, the planet small with its scar) down to 0.07 radii over the rail.
    const alt = Math.exp(lerp(Math.log(30), Math.log(0.07), a));
    const start = merc.riel.at(0.05, V());
    const approach = start.clone().normalize().multiplyScalar(1 + alt).addScaledVector(merc.riel.dir(0.05, V()), -alt * 0.9).add(V(0, alt * 0.4, 0));
    const along = railP.clone().addScaledVector(nrm, 0.07).addScaledVector(railD, -0.08).addScaledVector(merc.riel.axis, 0.035);
    const posL = r > 0 ? approach.lerp(along, ease(0, 0.25, r)) : approach;
    const tgtL = V(0, 0, 0).lerp(railP.clone().addScaledVector(railD, 0.2), ease(0.6, 1, a));
    const upL = V(0, 1, 0).lerp(nrm, ease(0.7, 1, a)).normalize();
    return shot(loc2w(merc.group, posL), loc2w(merc.group, tgtL), upL, lerp(50, 58, a));
  }
  // On a payload, from the end of the rail to ring A.
  const rideT = (p: number) => {
    const k = clamp((p - P('carga')) / (P('enjambre') - P('carga')), 0, 1);
    return k * k * (3 - 2 * k);
  };
  function camCarga(p: number): Vista {
    const t = rideT(p);
    const here = mercRoute.at(t, V());
    const back = mercRoute.at(Math.max(0, t - 0.012), V());
    const ahead = mercRoute.at(Math.min(1, t + 0.05), V());
    const lag = here.clone().sub(back);
    const lift = V(0, 1, 0).multiplyScalar(lag.length() * 0.35 + 3 * R_MER);
    const pos = here.clone().sub(lag.multiplyScalar(0.6)).add(lift);
    return shot(pos, ahead, V(0, 1, 0), 58);
  }
  // Along ring A: outside first (silhouettes against the Sun), over the top, then inside along the lit faces.
  const A0 = aArr - 0.004;
  const ringK = (p: number) => clamp((p - P('enjambre')) / (P('taller') - P('enjambre')), 0, 1);
  const ringAng = (p: number) => A0 + 0.012 * ease(0.45, 1, ringK(p)) + 0.03 * ease(P('vela'), P('todo'), p);
  /** Where the wave that opens the plates is (ring angle): it reaches us a quarter of the way in. */
  const waveFront = (p: number) => A0 - 0.02 + 0.08 * ringK(p) + 0.05 * ease(P('vela'), P('todo'), p);
  const SLOT = 0.78e-4;
  function camAnillo(p: number): Vista {
    const k = ringK(p);
    const a = ringAng(p);
    // Outside, facing the Sun through the ring; in through the slot between two rows of plates.
    const dr = Math.exp(lerp(Math.log(0.004), Math.log(0.0003), ease(0, 0.4, k))) - 0.00065 * ease(0.38, 0.66, k);
    const h = SLOT + 0.5e-4 * ease(0.66, 1, k);
    const pos = ringAPoint(a, h, dr);
    const fwd = tanA(a);
    const inward = radA(a).negate();
    // Facing the Sun through the ring; once inside, turning back to the wall of mirrors and
    // looking along it diagonally: each glass holds the Sun for a moment as we pass.
    const t = ease(0.5, 0.82, k);
    const look = inward.clone().multiplyScalar(1 - t * 1.6).addScaledVector(fwd, t * 1.1).normalize();
    const target = pos.clone().addScaledVector(look, 0.003).addScaledVector(nA, -0.0001 * t);
    return shot(pos, target, nA.clone(), lerp(58, 66, ease(0.4, 0.8, k)));
  }
  // The station: one view per step, blended as the step track moves (direction, log distance, lens).
  const aH = A0 + 0.016;
  const heroPos = ringAPoint(aH, 0, 0);
  const pasoK = (p: number) => tl.get('paso', p);
  /** Linear progress through the station (1 at its start, n + 1 at the end of step n): what moves within a step. */
  const pasoT = (p: number) => 1 + (p - P('taller')) / 1.75;
  type Toma = { target: THREE.Vector3; dir: THREE.Vector3; d: number; fov: number };
  const TOMAS: Toma[] = [
    { target: heroPos, dir: radA(aH).multiplyScalar(-0.8).addScaledVector(tanA(aH), 0.45).addScaledVector(nA, 0.3).normalize(), d: 0.0009, fov: 50 },
    { target: V(0, 0, 0), dir: radA(aH).multiplyScalar(0.55).addScaledVector(tanA(aH), -0.25).addScaledVector(nA, 0.8).normalize(), d: 1.05, fov: 46 },
    { target: V(0, 0, 0), dir: radA(aH + 0.5).multiplyScalar(0.6).addScaledVector(tanA(aH + 0.5), -0.2).addScaledVector(nA, 0.75).normalize(), d: 0.95, fov: 46 },
    { target: E.clone().multiplyScalar(0.42), dir: V(0.15, 1, 0.45).normalize(), d: 2.6, fov: 50 },
    { target: V(0, 0, 0), dir: radA(aH).multiplyScalar(0.25).addScaledVector(tanA(aH), 0.95).addScaledVector(nA, 0.18).normalize(), d: 26, fov: 3.4 },
  ];
  function camTaller(p: number): Vista {
    const k = clamp(pasoK(p), 1, 5) - 1;
    const i = Math.min(3, Math.floor(k));
    const t = k - i;
    const a = TOMAS[i];
    const b = TOMAS[i + 1];
    const dir = a.dir.clone().lerp(b.dir, t).normalize();
    const d = Math.exp(lerp(Math.log(a.d), Math.log(b.d), t));
    const target = a.target.clone().lerp(b.target, t);
    // Within a step the view keeps drifting a little: the world is alive while you read.
    const hold = (p - P('taller')) * 0.05;
    dir.applyAxisAngle(nA, hold * (i === 0 ? 0.6 : 0.3));
    return shot(target.clone().addScaledVector(dir, d), target, nA.clone(), Math.exp(lerp(Math.log(a.fov), Math.log(b.fov), t)));
  }

  // The beam: turn to the emitter, then ride out beside the sail, looking back at the Sun.
  const tau = (p: number) => ease(P('vela'), P('todo') + 2.0, p) * 0.75 + 0.25 * ease(P('todo'), P('todo') + 2.0, p);
  function camVela(p: number): Vista {
    const k = ease(P('vela'), P('todo'), p);
    const s = sailAt(tau(p), V());
    // Ahead of the sail, looking back: the sail, the beam that pushes it, and home behind.
    const d = Math.exp(lerp(Math.log(0.004), Math.log(0.25), k));
    const pos = s.clone().addScaledVector(sailDir, d).addScaledVector(tanA(aEm), d * 0.35).addScaledVector(nA, d * 0.2);
    const target = s.clone().lerp(V(0, 0, 0), 0.25 + 0.5 * ease(0.2, 1, k));
    return shot(pos, target, nA.clone(), lerp(50, 46, k));
  }
  function camTodo(p: number): Vista {
    const k = ease(P('todo'), P('todo') + 2.0, p);
    const dir = V(Math.cos(TH_E - 0.6), 0.85, Math.sin(TH_E - 0.6)).normalize();
    const d = Math.exp(lerp(Math.log(0.6), Math.log(6.2), k));
    return shot(dir.multiplyScalar(d), V(0, 0, 0).lerp(E.clone().multiplyScalar(0.35), 1 - k), V(0, 1, 0), 50);
  }

  const SEGS: [string, number, (p: number) => Vista][] = [
    ['tierra', 0, camTierra],
    ['salida', 0.05, camSalida],
    ['viaje', 0.05, camViaje],
    ['mercurio', 0.15, camMercurio],
    ['carga', 0.12, camCarga],
    ['enjambre', 0.18, camAnillo],
    ['taller', 0.3, camTaller],
    ['vela', 0.45, camVela],
    ['todo', 0.5, camTodo],
  ];
  function ruta0(p: number): Vista {
    let v = SEGS[0][2](p);
    for (let i = 1; i < SEGS.length; i++) {
      const [label, w, fn] = SEGS[i];
      const b = P(label);
      if (p < b - w) break;
      const t = w > 0 ? smoothstep(b - w, b + w, p) : 1;
      const n = fn(p);
      v = {
        pos: v.pos.clone().lerp(n.pos, t),
        target: v.target.clone().lerp(n.target, t),
        up: v.up.clone().lerp(n.up, t).normalize(),
        fov: lerp(v.fov, n.fov, t),
      };
    }
    return v;
  }

  // ------------------------------------------------------------ places to visit (explore mode)
  const sitios: Sitio[] = [
    { id: 'tierra', nombre: 'Un planeta encendido', frase: 'Tipo I: 10¹⁶ W, del orden de la energía que un planeta tiene a mano. Hoy usamos unos 19 TW; la luz del Sol que llega a la Tierra son 174 000 TW.', certeza: 'T', obra: 'tipo-i', dist: 6 * R_E, pos: (o) => o.copy(E) },
    { id: 'ascensor', nombre: 'Ascensor espacial', frase: 'Un cable desde el ecuador hasta más allá de la órbita geoestacionaria: el giro de la Tierra lo mantiene tenso. Falta un material dos veces más fuerte que el mejor de hoy.', certeza: 'T', obra: 'space-elevator', dist: 4 * R_E, pos: (o) => o.copy(E).addScaledVector(upW, GEO * R_E) },
    { id: 'anillo', nombre: 'Anillo orbital', frase: 'Un anillo que gira más rápido que una órbita y sostiene estaciones fijas sobre el suelo, unidas por cables.', certeza: 'T', obra: 'orbital-ring', dist: 1.6 * R_E, pos: (o) => o.copy(E).addScaledVector(V(1, 0, 0).applyQuaternion(body.quaternion), 1.08 * R_E) },
    { id: 'luna', nombre: 'La catapulta de la Luna', frase: 'Sin aire y con poca gravedad, un riel electromagnético lanza la roca lunar al espacio. Es lo más barato para empezar a construir.', certeza: 'T', obra: 'mass-driver', dist: 3 * (R_E * 0.2727), pos: (o) => moon.group.getWorldPosition(o) },
    { id: 'cinturon', nombre: 'Minería de asteroides', frase: 'El cinturón tiene apenas el 3 % de la masa de la Luna, repartido en millones de rocas: metales sin tener que salir de un pozo de gravedad.', certeza: 'T', obra: 'asteroid-mining', dist: 0.12, pos: (o) => o.copy(CAMP) },
    { id: 'mercurio', nombre: 'Desarmar Mercurio', frase: 'Máquinas que se copian a sí mismas. Armstrong y Sandberg (2013) calculan unos 31 años para convertir Mercurio en colectores.', certeza: 'E', obra: 'von-neumann', dist: 4 * R_MER, pos: (o) => o.copy(M) },
    { id: 'enjambre', nombre: 'Enjambre de Dyson', frase: 'Lo que Dyson propuso en 1960 no era una cáscara rígida: era una nube de objetos en órbitas propias. Visto de lejos, la estrella se apaga y brilla en infrarrojo.', certeza: 'T', obra: 'dyson-swarm', dist: 0.02, pos: (o) => ringAPoint(ringAng(tl.length), 0, 0, o) },
    { id: 'vela', nombre: 'Vela de luz', frase: 'Una vela de pocos gramos empujada por un láser podría llegar a una fracción de la velocidad de la luz. El haz sale del propio enjambre.', certeza: 'T', obra: 'laser-sail', dist: 0.01, pos: (o) => sailAt(tau(curP), o) },
    { id: 'sol', nombre: 'El Sol', frase: '3,8 × 10²⁶ W. Usarla toda es el tipo II. En tipo 1,6 la civilización usa 10²² W: menos de una diezmilésima de la luz del Sol.', certeza: 'O', obra: 'tipo-ii', dist: 40 * R_SUN, pos: (o) => o.set(0, 0, 0) },
  ];
  let curP = 0;

  /** How much the station is on (0 outside it), and what each step does to the world. */
  const enTaller = (p: number) => ease(P('taller') - 0.3, P('taller'), p) * (1 - ease(P('vela') - 0.4, P('vela') + 0.1, p));
  const tallerBuilt = (t: number) =>
    t < 2 ? 0.58 : t < 3 ? lerp(0.58, 0.04, ease(2.0, 2.3, t)) : t < 4 ? lerp(0.04, 0.75, ease(3.05, 3.9, t)) : t < 5 ? 0.75 : lerp(0.75, 0.97, ease(5.15, 5.8, t));
  const tallerFocus = (t: number) => (t < 3 ? 1 : 1 - ease(3.0, 3.3, t));
  const wipeAt = (t: number) => lerp(1.25, 0.0, ease(5.2, 5.75, t));
  const sw = new THREE.Vector3();

  // ------------------------------------------------------------ per frame
  const camL = V();
  const sunL = V();
  const invQ = new THREE.Quaternion();
  const scr = V();
  function apparentPx(center: THREE.Vector3, radius: number, cam: THREE.PerspectiveCamera, focal: number) {
    return (radius / Math.max(center.distanceTo(cam.position), 1e-12)) * focal;
  }

  return {
    tl,
    sitios,
    ruta: ruta0,
    lectura(p: number): Lectura {
      return { lp: tl.get('lp', p), ly: tl.get('ly', p), lr: tl.get('lr', p) };
    },
    rotulo(p: number): Rotulo | null {
      return tl.captionAt(p);
    },
    /** The station's drawing: light, heat, the shell that fails, the beams, the spectrum. */
    taller(g: CanvasRenderingContext2D, f: Frame) {
      const { p, W, H, u, camera, time } = f;
      const st = enTaller(p);
      if (st < 0.01) return;
      const k = pasoK(p);
      const kt = pasoT(p);
      const win = (c: number) => st * ease(c + 0.1, c + 0.25, kt) * (1 - ease(c + 0.95, c + 1.05, kt));
      const pr = (v: THREE.Vector3) => proyectar(v, camera, W, H);
      const front = (v: THREE.Vector3) => pr(v).z < 1;
      g.save();
      // Which station, and which step.
      g.globalAlpha = st;
      g.textAlign = 'center';
      g.font = FONT.mono(10.5 * u);
      g.letterSpacing = `${1.6 * u}px`;
      g.fillStyle = TEAL;
      g.fillText('CÓMO FUNCIONA · ENJAMBRE DE DYSON', W / 2, 58 * u);
      for (let i = 0; i < 5; i++) {
        const x = W / 2 + (i - 2) * 18 * u;
        const on = Math.round(k) === i + 1;
        g.beginPath();
        g.arc(x, 76 * u, (on ? 4 : 3) * u, 0, Math.PI * 2);
        if (k >= i + 0.6) {
          g.fillStyle = on ? TEAL : 'rgba(111,227,193,0.45)';
          g.fill();
        } else {
          g.strokeStyle = ink(0.5);
          g.lineWidth = Math.max(1, u);
          g.stroke();
        }
      }
      g.textAlign = 'left';
      g.globalAlpha = 1;

      const dashed = (pts: { x: number; y: number }[], color: string, a: number, dash: number[], width = 1.4, offset = 0) => {
        if (a < 0.01) return;
        g.save();
        g.globalAlpha = a;
        g.strokeStyle = color;
        g.lineWidth = Math.max(1, width * u);
        g.setLineDash(dash.map((d) => d * u));
        g.lineDashOffset = -offset * u;
        g.beginPath();
        pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
        g.stroke();
        g.restore();
      };
      const arrow = (a: { x: number; y: number }, b: { x: number; y: number }, color: string, al: number) => {
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        g.save();
        g.globalAlpha = al;
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(b.x, b.y);
        g.lineTo(b.x - Math.cos(ang - 0.4) * 9 * u, b.y - Math.sin(ang - 0.4) * 9 * u);
        g.lineTo(b.x - Math.cos(ang + 0.4) * 9 * u, b.y - Math.sin(ang + 0.4) * 9 * u);
        g.closePath();
        g.fill();
        g.restore();
      };

      // 1 · One sail: sunlight in, electricity out, the rest leaves as heat from its back.
      const a1 = win(1);
      if (a1 > 0.01) {
        const L = radA(aH).negate();
        const T = tanA(aH);
        for (let i = 0; i < 7; i++) {
          const ox = (i / 6 - 0.5) * 1.4e-4;
          const oy = ((i * 37) % 7) / 7 - 0.5;
          const end = heroPos.clone().addScaledVector(T, ox).addScaledVector(nA, oy * 0.9e-4);
          const start = end.clone().addScaledVector(L, 0.00042).addScaledVector(T, -0.00012);
          const run = ((time * 0.6 + i * 0.13) % 1) * 30;
          const A = pr(start);
          const B = pr(end);
          dashed([A, B], '#ffe0a0', a1 * 0.9, [6, 6], 1.4, run);
          arrow(A, B, '#ffe0a0', a1);
        }
        for (let i = 0; i < 3; i++) {
          const pts = [];
          for (let s = 0; s <= 24; s++) {
            const t = s / 24;
            pts.push(pr(heroPos.clone().addScaledVector(T, (i - 1) * 5e-5 + Math.sin(t * 18 - time * 3) * 1.2e-5).addScaledVector(nA, 0.4e-4).addScaledVector(L, -t * 0.0005)));
          }
          dashed(pts, '#ff6a3d', a1 * 0.8, [], 1.5);
        }
        const elA = pr(heroPos.clone().addScaledVector(T, 0.8e-4).addScaledVector(nA, -0.6e-4));
        const elB = pr(heroPos.clone().addScaledVector(T, 0.0009).addScaledVector(nA, -0.0003));
        dashed([elA, elB], TEAL, a1, [3, 5], 1.6, time * 40);
        const sunP = pr(heroPos.clone().addScaledVector(L, 0.00042).addScaledVector(T, -0.00012));
        if (front(heroPos)) {
          nota(g, u, sunP.x, sunP.y, 'luz del Sol', -30, -26, a1, '#ffe0a0');
          nota(g, u, elB.x, elB.y, 'electricidad', 26, 20, a1);
          const heat = pr(heroPos.clone().addScaledVector(nA, 0.4e-4).addScaledVector(L, -0.00045));
          nota(g, u, heat.x, heat.y, 'calor (infrarrojo)', 26, -24, a1, '#ff6a3d');
          const hp = pr(heroPos);
          nota(g, u, hp.x, hp.y, 'colector · tamaño ilustrativo', -40, 40, a1 * ease(1.3, 1.5, kt));
        }
      }

      // 2 · The rigid shell: nothing holds it centred; it drifts until it hits the Sun.
      const a2 = win(2);
      if (a2 > 0.01) {
        const S = pr(V(0, 0, 0));
        const right = V(1, 0, 0).applyQuaternion(camera.quaternion);
        const edge = pr(sw.copy(right).multiplyScalar(RING_R));
        const r = Math.hypot(edge.x - S.x, edge.y - S.y);
        const drift = r * 0.97 * ease(2.35, 2.85, kt);
        const cx = S.x + drift;
        g.save();
        g.globalAlpha = a2;
        g.strokeStyle = ink(0.75);
        g.lineWidth = Math.max(1, 1.3 * u);
        g.setLineDash([4 * u, 4 * u]);
        g.beginPath();
        g.ellipse(cx, S.y, r, r, 0, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        for (let i = 0; i < 9; i++) {
          const y = S.y + (i / 8 - 0.5) * 1.6 * r;
          const half = Math.sqrt(Math.max(0, r * r - (y - S.y) ** 2));
          g.globalAlpha = a2 * 0.25;
          g.beginPath();
          g.ellipse(cx, y, half, half * 0.18, 0, 0, Math.PI * 2);
          g.stroke();
        }
        g.globalAlpha = a2;
        // the drift
        if (drift > 4 * u) {
          g.strokeStyle = ink(0.7);
          g.beginPath();
          g.moveTo(S.x, S.y + r + 18 * u);
          g.lineTo(cx, S.y + r + 18 * u);
          g.stroke();
          arrow({ x: S.x, y: S.y + r + 18 * u }, { x: cx, y: S.y + r + 18 * u }, ink(0.7), a2);
        }
        const hit = ease(2.8, 2.88, kt);
        if (hit > 0.01) {
          g.globalAlpha = a2 * hit;
          g.strokeStyle = '#ff5b4a';
          g.lineWidth = Math.max(1, 2 * u);
          const hx = cx - r;
          g.beginPath();
          g.arc(hx, S.y, 14 * u, 0, Math.PI * 2);
          g.stroke();
          rotulo(g, u, hx, S.y - 30 * u, '¡choca con el Sol!', 10.5, a2 * hit, '#ff8a7a');
        }
        g.restore();
        rotulo(g, u, cx, S.y - r - 22 * u, 'cáscara rígida: nada la mantiene centrada', 10.5, a2 * (1 - hit * 0.6));
      }

      // 3 · Each collector on its own orbit.
      const a3 = win(3);
      if (a3 > 0.01) {
        const q = ringAPoint(aH + 1.3, 0, 0);
        if (front(q)) {
          const Q = pr(q);
          nota(g, u, Q.x, Q.y, 'cada colector, en su propia órbita', 30, 30, a3);
        }
        const S = pr(V(0, 0, 0));
        rotulo(g, u, S.x, S.y + 26 * u, 'el Sol', 10, a3 * 0.8);
      }

      // 4 · The energy travels (the beams are invisible: drawn as the plate draws what cannot be seen).
      const a4 = win(4);
      if (a4 > 0.01) {
        const dests: [THREE.Vector3, number, string][] = [
          [E, 0.4, 'a la Tierra'],
          [M, 1.9, 'a las fábricas de Mercurio'],
          [MARS, -0.6, 'a Marte'],
          [sailAt(0.15, sw.clone()), 2.6, 'a una vela'],
        ];
        for (const [to, off, label] of dests) {
          const from = ringAPoint(Math.atan2(to.dot(e2), to.dot(e1)) + off * 0.05, 0, 0);
          if (!front(from) || !front(to)) continue;
          const A = pr(from);
          const B = pr(to);
          dashed([A, B], TEAL, a4 * 0.9, [2, 7], 1.6, time * 60);
          arrow(A, B, TEAL, a4);
          nota(g, u, B.x, B.y, label, 22, -22, a4);
        }
      }

      // 5 · Seen from afar: visible and infrared, and the spectrum that shows why.
      const a5 = win(5);
      if (a5 > 0.01) {
        const x = ((wipeAt(kt) + 1) / 2) * W;
        g.save();
        g.globalAlpha = a5;
        if (x < W - 10) {
          g.strokeStyle = ink(0.6);
          g.lineWidth = Math.max(1, u);
          g.beginPath();
          g.moveTo(x, 96 * u);
          g.lineTo(x, H - 280 * u);
          g.stroke();
          g.font = FONT.mono(10 * u);
          g.letterSpacing = `${1.4 * u}px`;
          g.fillStyle = ink(0.85);
          g.textAlign = 'right';
          g.fillText('LUZ VISIBLE', x - 12 * u, 112 * u);
          g.textAlign = 'left';
          g.fillStyle = '#ff9a6a';
          g.fillText('INFRARROJO · FALSO COLOR', x + 12 * u, 112 * u);
        }
        g.restore();
        espectro(g, u, W - 470 * u, H - 270 * u, 360 * u, 150 * u, 0.95 * tallerBuilt(kt), a5);
      }
      g.restore();
    },
    /** Plate notes for this moment: what is where (world point, label, leader offset, alpha). */
    notas(p: number) {
      const out: { pos: THREE.Vector3; text: string; dx: number; dy: number; a: number }[] = [];
      const win = (a: string, b: string, pad = 0.15) => ease(P(a) - pad, P(a) + pad, p) * (1 - ease(P(b) - pad, P(b) + pad, p));
      const add = (pos: THREE.Vector3, text: string, dx: number, dy: number, a: number) => a > 0.01 && out.push({ pos, text, dx, dy, a });
      body.updateMatrixWorld(true);
      const tierraA = win('tierra', 'salida') * ease(0.3, 1.0, p);
      add(E.clone().addScaledVector(upW, GEO * R_E), 'órbita geoestacionaria · 36 000 km', 30, -30, tierraA * ease(1.2, 1.8, p));
      add(loc2w(body, V(Math.cos(1.2) * 1.08, 0, -Math.sin(1.2) * 1.08)), 'anillo orbital · 500 km', -40, 30, tierraA * (1 - ease(1.6, 2.4, p)));
      add(E.clone().addScaledVector(upW, ASCENSOR.top * R_E), 'contrapeso · 100 000 km', 30, -26, tierraA * ease(2.2, 2.8, p));
      add(moon.group.getWorldPosition(V()), 'la Luna lanza roca al espacio', 30, -26, win('salida', 'viaje', 0.2));
      const viajeA = win('viaje', 'mercurio', 0.2);
      add(E.clone(), 'Tierra', 26, -24, viajeA);
      add(VENUS.clone(), 'Venus', 26, -20, viajeA);
      add(M.clone(), 'Mercurio · se desarma', 26, 24, viajeA);
      add(V(0, 0, 0), 'el Sol y su enjambre', -40, -40, viajeA);
      add(merc.group.localToWorld(merc.riel.at(0.7, V())), 'riel de 2 000 km', 34, -30, win('riel', 'carga', 0.1));
      add(mercRoute.at(rideT(p), V()), 'nuestra carga', 26, -26, win('carga', 'enjambre', 0.1));
      add(ringAPoint(ringAng(p) + 0.0012, SLOT + 1.56e-4, 0), 'colector (tamaño ilustrativo)', 30, -30, win('enjambre', 'taller', 0.15) * ease(P('enjambre') + 0.2, P('enjambre') + 0.5, p));
      add(sailAt(tau(p), V()), 'vela de 4 m empujada por un haz de luz', 26, -28, win('vela', 'todo', 0.2));
      const todoA = ease(P('todo') + 0.6, P('todo') + 1.2, p);
      add(E.clone(), 'Tierra', 22, -22, todoA);
      add(M.clone(), 'Mercurio', -30, 26, todoA);
      add(MARS.clone(), 'Marte', 22, -20, todoA);
      add(JUPITER.clone(), 'Júpiter', 22, -20, todoA);
      add(V(Math.cos(TH_E + 1.4) * 2.7, 0, Math.sin(TH_E + 1.4) * 2.7), 'cinturón · minas', 26, 22, todoA);
      add(sailAt(tau(p), V()), 'vela', 22, -20, todoA);
      return out;
    },
    /** Everything that depends on the camera, after it is placed. */
    update(f: Frame) {
      const { camera, p, time } = f;
      curP = p;
      const st = enTaller(p);
      const kt = pasoT(p);
      const built = lerp(tl.get('built', p), tallerBuilt(kt), st);
      sun.update(camera, time, built * 0.9);
      // Station: the hero plate, the rest dimmed; the infrared view behind a wipe.
      const ir = st > 0.5 && kt > 5.05 ? 1 : 0;
      const wipe = wipeAt(kt);
      const wipePx = ((wipe + 1) / 2) * f.W;
      for (const u of [sun.uni, skyUni]) {
        if (!u) continue;
        u.uIR.value = ir;
        u.uWipePx.value = wipePx;
      }
      swarm.u.uIR.value = ir;
      swarm.u.uWipe.value = wipe;
      swarm.u.uFocus.value = st * tallerFocus(kt);
      plates.u.uHero.value = aH;
      plates.u.uFocus.value = st * (1 - ease(1.85, 2.1, kt));
      // Earth.
      body.updateMatrixWorld(true);
      invQ.copy(body.quaternion).invert();
      sunL.copy(sunW).applyQuaternion(invQ);
      body.worldToLocal(camL.copy(camera.position));
      earth.update(sunL, camL, tl.get('luces', p));
      near.uni.uSun.value.copy(sunL);
      near.uni.uCamL.value.copy(camL);
      moon.uni.uSun.value.copy(sunW);
      moon.group.worldToLocal(moon.uni.uCamL.value.copy(camera.position));
      merc.uni.uSun.value.copy(mercSun);
      merc.group.worldToLocal(merc.uni.uCamL.value.copy(camera.position));
      merc.uni.uEat.value = tl.get('eat', p);
      // The swarm.
      const spin = time * 0.0006 + 2.2 * st * ease(3.0, 3.9, kt);
      swarm.u.uBuilt.value = built;
      swarm.u.uSpin.value = spin;
      swarm.u.uCamW.value.copy(camera.position);
      swarm.u.uFar.value = smoothstep(0.5, 0.95, camera.position.length()) * (1 - smoothstep(2, 4, camera.position.length()));
      const dA = Math.abs(camera.position.length() - 0.3) + Math.abs(camera.position.dot(nA));
      const closeA = 1 - smoothstep(0.004, 0.03, dA);
      swarm.u.uNearA.value = closeA;
      plates.mesh.visible = closeA > 0.001;
      plates.u.uSpin.value = spin;
      plates.u.uWave0.value = A0 - 0.6 - spin;
      plates.u.uWave.value = waveFront(p) - (A0 - 0.6);
      plates.u.uTime.value = time;
      // The beam and the sail.
      const vela = ease(P('vela') - 0.3, P('vela'), p);
      const sailP = sailAt(tau(p), V());
      beam.set(emitter, sailP, vela);
      beam.u.uTime.value = time;
      beam.u.uDpr.value = f.dpr;
      // Beacons fade once the thing itself is big enough to see.
      const fadeBy = (c: THREE.Vector3, r: number) => 1 - smoothstep(3, 10, apparentPx(c, r, camera, f.focal));
      B.set(0, E, fadeBy(E, R_E));
      const mw = moon.group.getWorldPosition(scr);
      B.set(1, mw, fadeBy(mw, R_E * 0.2727) * 0.8);
      B.set(2, M, fadeBy(M, R_MER));
      B.set(3, VENUS, 1);
      B.set(4, MARS, 1);
      B.set(5, JUPITER, 1);
      B.set(6, sailP, vela);
      const t = rideT(p);
      const ride = ease(P('carga') - 0.05, P('carga') + 0.05, p) * (1 - ease(P('enjambre') + 0.1, P('enjambre') + 0.3, p));
      B.set(7, mercRoute.at(t, scr), ride);
      B.commit();
      B.mat.uniforms.uDpr.value = f.dpr;
      // Point sizes are in each cloud's own units: scale them to the world.
      for (const n of [...nubes, ...earth.nubes]) {
        enfocar(n, f.focal, f.dpr, time);
        n.u.uSizeUnit.value = n.points.getWorldScale(tmp).x;
        n.u.uMinPx.value = 1.4 * f.dpr;
      }
    },
  };
}

export type Sistema = ReturnType<typeof sistema>;
