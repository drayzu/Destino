import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { clamp, lerp, smoothstep } from '../engine/math';
import { TEAL, cifra, ink, nota, sup, type Muro } from '../engine/placa';
import { linea, texto } from '../engine/lamina';
import { espectro } from '../engine/espectro';
import { mezcla, type Vista } from '../engine/vista';
import { E, LUNA, type Mundo } from '../mundo/mundo';
import { R_E, R_MER, RING_A, cinturon, enjambre, faros, mercurio, orbitas, placas, ringABasis, ringAPoint, ruta } from '../mundo/obras';
import type { Acto, Cuadro } from './tipos';

/**
 * Act III · El sistema solar trabaja (10¹⁶ → 10²⁶ W), from the phase-0 prototype, without its
 * station: the journey leaves the Earth and crosses the inner system, which already works as one
 * machine; machines that copy themselves take Mercury apart (Armstrong & Sandberg 2013: ~31 years,
 * most of it in the last 4); the catapult throws its matter with no rocket; the camera rides a
 * payload into the swarm, through the slot between two rows of collectors and along the wall of
 * mirrors a wave unfolds (Dyson 1960 proposed a swarm, not a shell); seen from afar the Sun goes
 * dark in visible light and glows in the infrared (how we search for others: Ĝ with WISE;
 * Hephaistos 2024, seven candidates, several of them background galaxies); and Type II, all the
 * Sun's light, 3.8 × 10²⁶ W, where the light of one star runs out.
 *
 * Still to come in this act (phase 2): an O'Neill cylinder from the inside, star lifting, the
 * stellar engines (Shkadov, Caplan), and the habitats, Mars and Venus working at the same time.
 *
 * World units: AU. The prototype's layout is turned with the Earth's place in its orbit.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const TH_E = Math.atan2(E.z, E.x);
/** How much the prototype's layout is turned (it had the Earth at 3.62 rad). */
const DELTA = TH_E - 3.62;
const polar = (r: number, th: number, y = 0) => V(r * Math.cos(th), y, r * Math.sin(th));
const M = polar(0.387, TH_E - 0.34);
const VENUS = polar(0.723, TH_E - 0.92);
const MARS = polar(1.524, TH_E + 0.68);
const JUPITER = polar(5.2, TH_E + 1.48, 0.05);
const CAMP = polar(2.6, TH_E + 0.4);
/** Turns a vector from the prototype's frame into this one. */
const qL = new THREE.Quaternion().setFromAxisAngle(UP, -DELTA);
const SLOT = 0.78e-4;

export function sistema(): Acto {
  let tl: Timeline;
  let P: (l: string) => number;
  const ease = smoothstep;
  let m: Mundo;

  // Ring A turns with the layout (before the swarm and its plates are built).
  RING_A.node = 0.6 + DELTA;
  const { n: nA, e1, e2 } = ringABasis();
  const tanA = (a: number) => e1.clone().multiplyScalar(-Math.sin(a)).addScaledVector(e2, Math.cos(a));
  const radA = (a: number) => e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));

  const swarm = enjambre();
  const plates = placas();
  const merc = mercurio();
  merc.group.position.copy(M);
  merc.group.quaternion.copy(qL);
  const merc2w = (v: THREE.Vector3) => v.clone().applyQuaternion(qL).multiplyScalar(R_MER).add(M);
  const mercSunL = M.clone().negate().normalize().applyQuaternion(qL.clone().invert());
  const belt = cinturon(CAMP);
  const orbits = orbitas([0.387, 0.723, 1.0, 1.524, 5.2]);
  const teal = new THREE.Color(0.6, 1.0, 0.88);
  const warm = new THREE.Color(1.0, 0.85, 0.6);

  // Routes: Mercury's catapult to ring A; the Moon's to a depot; the belt to the Earth; the first seeds to Mercury.
  const aM = Math.atan2(M.dot(e2), M.dot(e1));
  const aArr = aM + 0.22;
  const launchDir = merc.riel.dir(1, V()).applyQuaternion(qL);
  const mercSun = M.clone().negate().normalize();
  const mercRoute = ruta(900, 0.05, teal, 4e-6, 0.16);
  {
    const p0 = merc2w(merc.riel.at(1, V()));
    const p1 = p0.clone().addScaledVector(launchDir, 0.03).addScaledVector(mercSun, 0.01);
    const p3 = ringAPoint(aArr, 0, 0);
    const p2 = p3.clone().addScaledVector(tanA(aArr), -0.06).addScaledVector(radA(aArr), 0.015);
    mercRoute.set(p0, p1, p2, p3);
  }
  const moonDir = LUNA.clone().sub(E).normalize();
  const depot = E.clone().addScaledVector(moonDir, LUNA.distanceTo(E) + 9 * R_E).add(V(0, 4 * R_E, 0));
  const moonRoute = ruta(260, 0.08, teal, 1.2e-6, 0.25);
  moonRoute.set(LUNA.clone().addScaledVector(moonDir, -0.27 * R_E), LUNA.clone().add(V(0, 3 * R_E, 0)), depot.clone().add(V(0, 6 * R_E, 0)), depot);
  const beltRoutes = [0.4, 1.3, 2.4].map((a, i) => {
    const r = ruta(500, 0.015 + i * 0.004, warm, 2.2e-5, 0.08);
    const p0 = polar(2.6, TH_E + a, 0.05 * (i - 1));
    const p3 = E.clone().add(V(0, 0, 0.002 * (i - 1)));
    r.set(p0, p0.clone().multiplyScalar(0.75).add(V(0, 0.3, 0)), p3.clone().multiplyScalar(1.3).add(V(0, 0.15, 0)), p3);
    return r;
  });
  const seedRoute = ruta(300, 0.02, teal, 1.4e-5, 0.1);
  seedRoute.set(E.clone().add(V(0, 0.0005, 0)), E.clone().multiplyScalar(0.8).add(V(0, 0.08, 0)), M.clone().multiplyScalar(1.4).add(V(0, 0.05, 0)), M.clone().add(V(0, 0.0002, 0)));
  const rutas = [mercRoute, moonRoute, ...beltRoutes, seedRoute];

  // Beacons for what is too small to see.
  const B = faros([
    { color: new THREE.Color(0.6, 1.0, 0.85), px: 2.0 }, // 0 Mercury (busy)
    { color: new THREE.Color(1.0, 0.95, 0.8), px: 2.0 }, // 1 Venus
    { color: new THREE.Color(1.0, 0.6, 0.4), px: 1.8 }, // 2 Mars
    { color: new THREE.Color(1.0, 0.9, 0.75), px: 2.2 }, // 3 Jupiter
    { color: new THREE.Color(1.0, 0.97, 0.9), px: 2.6 }, // 4 our payload
    { color: new THREE.Color(0.85, 0.85, 0.8), px: 1.3 }, // 5 the Moon
  ]);

  // ------------------------------------------------------------ the camera's route
  const rideR = 9;
  /** Where act II leaves the camera: on the elevator, high up, looking down at the Earth. */
  function finAscensor(): Vista {
    const up0 = m.ascensor;
    const sideL = up0.clone().cross(UP).normalize();
    const posL = up0.clone().multiplyScalar(rideR).addScaledVector(sideL, 0.12 + 0.045 * rideR).add(V(0, 0.06 * rideR, 0));
    const q = m.giroQ(m.giroAscensor);
    return { pos: m.tierraAMundo(posL), target: E.clone(), up: up0.clone().lerp(UP, 0.4).normalize().applyQuaternion(q), fov: 48 };
  }
  function camSalida(p: number): Vista {
    // Back out until the Earth, its ring and the Moon fit together.
    const k = ease(P('a3'), P('a3.viaje'), p);
    const end = finAscensor();
    const dir = end.pos.clone().sub(E).normalize();
    const d = Math.exp(lerp(Math.log(end.pos.distanceTo(E)), Math.log(150 * R_E), k));
    const sideW = dir.clone().cross(UP).normalize();
    const pos = E.clone().addScaledVector(dir.lerp(sideW.multiplyScalar(-1).add(V(0, 0.35, 0)).normalize(), k * 0.7).normalize(), d);
    const target = E.clone().lerp(LUNA, 0.35 * k);
    return { pos, target, up: end.up.clone().lerp(UP, k).normalize(), fov: lerp(48, 44, k) };
  }
  function camViaje(p: number): Vista {
    const s = ease(P('a3.viaje'), P('a3.mercurio'), p);
    const start = camSalida(P('a3.viaje'));
    const endPos = M.clone().add(V(0.0, 0.0006, 0.0012).applyQuaternion(qL));
    const base = start.pos.clone().lerp(endPos, s);
    base.y += 0.09 * Math.sin(Math.PI * s);
    // Looking at the Earth, then at the Sun's swarm, then at Mercury.
    const t1 = start.target.clone().lerp(V(0, 0, 0), ease(0.0, 0.45, s));
    const target = t1.lerp(M, ease(0.55, 1.0, s));
    return { pos: base, target, up: UP.clone(), fov: lerp(44, 50, ease(0, 0.5, s)) - 6 * ease(0.6, 1, s) };
  }
  function camMercurio(p: number): Vista {
    const a = ease(P('a3.mercurio'), P('a3.riel'), p);
    const r = ease(P('a3.riel'), P('a3.carga'), p);
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
    const upL = UP.clone().lerp(nrm, ease(0.7, 1, a)).normalize().applyQuaternion(qL);
    return { pos: merc2w(posL), target: merc2w(tgtL), up: upL, fov: lerp(50, 58, a) };
  }
  // On a payload, from the end of the rail to ring A.
  const rideT = (p: number) => {
    const k = clamp((p - P('a3.carga')) / (P('a3.enjambre') - P('a3.carga')), 0, 1);
    return k * k * (3 - 2 * k);
  };
  function camCarga(p: number): Vista {
    const t = rideT(p);
    const here = mercRoute.at(t, V());
    const back = mercRoute.at(Math.max(0, t - 0.012), V());
    const ahead = mercRoute.at(Math.min(1, t + 0.05), V());
    const lag = here.clone().sub(back);
    const lift = UP.clone().multiplyScalar(lag.length() * 0.35 + 3 * R_MER);
    return { pos: here.clone().sub(lag.multiplyScalar(0.6)).add(lift), target: ahead, up: UP.clone(), fov: 58 };
  }
  // Along ring A: outside first (silhouettes against the Sun), in through the slot, then along the lit faces.
  const A0 = aArr - 0.004;
  const ringK = (p: number) => clamp((p - P('a3.enjambre')) / (P('a3.lejos') - P('a3.enjambre')), 0, 1);
  const ringAng = (p: number) => A0 + 0.012 * ease(0.45, 1, ringK(p));
  /** Where the wave that opens the plates is (ring angle): it reaches us a quarter of the way in. */
  const waveFront = (p: number) => A0 - 0.02 + 0.08 * ringK(p) + 0.05 * ease(P('a3.lejos'), P('a3.todo'), p);
  function camAnillo(p: number): Vista {
    const k = ringK(p);
    const a = ringAng(p);
    const dr = Math.exp(lerp(Math.log(0.004), Math.log(0.0003), ease(0, 0.4, k))) - 0.00065 * ease(0.38, 0.66, k);
    const h = SLOT + 0.5e-4 * ease(0.66, 1, k);
    const pos = ringAPoint(a, h, dr);
    const fwd = tanA(a);
    const inward = radA(a).negate();
    // Facing the Sun through the ring; once inside, turning to the wall of mirrors and looking
    // along it diagonally: each glass holds the Sun for a moment as we pass.
    const t = ease(0.5, 0.82, k);
    const look = inward.clone().multiplyScalar(1 - t * 1.6).addScaledVector(fwd, t * 1.1).normalize();
    const target = pos.clone().addScaledVector(look, 0.003).addScaledVector(nA, -0.0001 * t);
    return { pos, target, up: nA.clone(), fov: lerp(58, 66, ease(0.4, 0.8, k)) };
  }
  // Seen from afar: as another star would see us, through a long lens.
  const aH = A0 + 0.016;
  const lejosDir = radA(aH).multiplyScalar(0.25).addScaledVector(tanA(aH), 0.95).addScaledVector(nA, 0.18).normalize();
  function camLejos(p: number): Vista {
    const k = ease(P('a3.lejos'), P('a3.lejos') + 1.6, p);
    const from = camAnillo(P('a3.lejos'));
    const far: Vista = { pos: lejosDir.clone().multiplyScalar(26), target: V(), up: nA.clone(), fov: 3.4 };
    return mezcla(from, far, k);
  }
  function camTodo(p: number): Vista {
    const k = ease(P('a3.todo'), P('a3.todo') + 2.4, p);
    const dir = V(Math.cos(TH_E - 0.6), 0.85, Math.sin(TH_E - 0.6)).normalize();
    const d = Math.exp(lerp(Math.log(0.6), Math.log(6.2), k));
    return { pos: dir.multiplyScalar(d), target: V(0, 0, 0).lerp(E.clone().multiplyScalar(0.35), 1 - k), up: UP.clone(), fov: 50 };
  }
  const SEGS: [string, number, (p: number) => Vista][] = [
    ['a3', 0, camSalida],
    ['a3.viaje', 0.05, camViaje],
    ['a3.mercurio', 0.2, camMercurio],
    ['a3.carga', 0.12, camCarga],
    ['a3.enjambre', 0.18, camAnillo],
    ['a3.lejos', 0, camLejos],
    ['a3.todo', 0.6, camTodo],
  ];
  function ruta0(p: number): Vista {
    let v = SEGS[0][2](p);
    for (let i = 1; i < SEGS.length; i++) {
      const [label, w, fn] = SEGS[i];
      const b = P(label);
      if (p < b - w) break;
      const t = w > 0 ? smoothstep(b - w, b + w, p) : 1;
      v = mezcla(v, fn(p), t);
    }
    return v;
  }

  // Seen from afar: the curtain between visible light and the infrared.
  const wipeAt = (p: number) => lerp(1.25, 0.0, ease(P('a3.lejos') + 1.7, P('a3.lejos') + 2.6, p)) + 1.3 * ease(P('a3.todo'), P('a3.todo') + 0.6, p);

  return {
    id: 'a3',
    numero: 'III',
    nombre: 'El sistema solar trabaja',
    coreografia(t) {
      tl = t;
      P = (l) => tl.at(l);
      tl.label('a3');
      tl.set({ 'a3.lp': 16.25, 'a3.ly': 2.54, 'a3.lr': 7.6, 'a3.built': 0, 'a3.eat': 0 });
      tl.caption(3.0, 'Hacia el Sol', 'Todo pasa a la vez: la Luna lanza roca, el cinturón se mina y alrededor del Sol empieza a crecer un enjambre.');
      tl.to(1.4, { 'a3.lp': 16.5, 'a3.ly': 2.6, 'a3.lr': 9.0, 'a3.built': 0.15, 'a3.eat': 0.04 });
      tl.label('a3.viaje').to(1.6, { 'a3.lp': 17.5, 'a3.ly': 2.7, 'a3.lr': 11.2, 'a3.built': 0.3, 'a3.eat': 0.07 });
      tl.caption(3.0, 'Desarmar Mercurio', 'Máquinas que se copian a sí mismas convierten un planeta entero en colectores: unos 31 años, casi todo en los últimos cuatro.');
      tl.label('a3.mercurio').to(3.0, { 'a3.lp': 18.5, 'a3.ly': 2.76, 'a3.eat': 0.12, 'a3.built': 0.38 });
      tl.caption(4.2, 'La catapulta', 'Un riel de 2 000 km lanza la materia al espacio sin cohetes: Mercurio no tiene aire que la frene. Viajamos en una carga.');
      tl.label('a3.riel').to(1.8, { 'a3.lp': 19.2 });
      tl.label('a3.carga').to(2.4, { 'a3.lp': 20, 'a3.ly': 2.82, 'a3.eat': 0.15, 'a3.built': 0.45 });
      tl.caption(4.0, 'La pared que tapa el Sol', 'No es una esfera: es un enjambre de velas en órbita, cada una de cara al Sol (Dyson, 1960). La estrella se va apagando para los demás.');
      tl.label('a3.enjambre').to(4.0, { 'a3.lp': 21.2, 'a3.ly': 2.89, 'a3.built': 0.58, 'a3.lr': 11.7 });
      tl.caption(4.4, 'Visto desde lejos', 'Desde otra estrella, el Sol se apaga en luz visible y brilla en infrarrojo con el calor de los colectores. Así buscamos a otros: entre millones de estrellas, siete candidatas, y varias resultaron galaxias lejanas.');
      tl.label('a3.lejos').to(4.4, { 'a3.lp': 24.0, 'a3.ly': 3.0, 'a3.built': 0.9 });
      tl.caption(3.8, 'Tipo II', 'Toda la luz del Sol: 3,8 × 10²⁶ W. Creciendo un 2,3 % al año, se llegaría en unos 1 350 años. Y la luz de una estrella se acaba.');
      tl.label('a3.todo').to(3.8, { 'a3.lp': 26.58, 'a3.ly': 3.13, 'a3.lr': 12.6, 'a3.built': 1.0, 'a3.eat': 0.2 });
      tl.label('a3.fin');
    },
    montar(mundo) {
      m = mundo;
      m.root.add(swarm.points, plates.mesh, merc.group, belt.points, orbits, B.points);
      for (const r of rutas) m.root.add(r.group);
      m.nubes.push(swarm, ...merc.nubes, belt, ...rutas.map((r) => r.nube));
    },
    vista: (p) => ruta0(p),
    lectura: (p) => ({ lp: tl.get('a3.lp', p), ly: tl.get('a3.ly', p), lr: tl.get('a3.lr', p) }),
    muro(p): Muro | null {
      const a = ease(P('a3.todo') + 0.6, P('a3.todo') + 1.6, p);
      return a > 0.01 ? { lp: 26.58, label: 'muro · la luz de una estrella', a, choque: ease(26.0, 26.55, tl.get('a3.lp', p)) } : null;
    },
    estado(mundo, p) {
      const e = mundo.estado;
      // The Earth as the last act left it: turned to the elevator, filling with lights, its works up.
      e.giro = mundo.giroAscensor;
      e.luces = 0.62;
      e.nuevas = 0.8;
      e.cercanias = 1;
      e.solDim = tl.get('a3.built', p) * 0.9;
    },
    update(f: Cuadro) {
      const { p, time, W, vista } = f;
      const built = tl.get('a3.built', p);
      const on = built > 0.001;
      const cam = vista.pos;
      // The swarm.
      const spin = time * 0.0006;
      swarm.points.visible = on;
      swarm.u.uBuilt.value = built;
      swarm.u.uSpin.value = spin;
      swarm.u.uCamW.value.copy(cam);
      swarm.u.uFar.value = smoothstep(0.5, 0.95, cam.length()) * (1 - smoothstep(2, 4, cam.length()));
      swarm.u.uFocus.value = 0;
      const dA = Math.abs(cam.length() - 0.3) + Math.abs(cam.dot(nA));
      const closeA = 1 - smoothstep(0.004, 0.03, dA);
      swarm.u.uNearA.value = closeA;
      plates.mesh.visible = on && closeA > 0.001;
      plates.u.uSpin.value = spin;
      plates.u.uWave0.value = A0 - 0.6 - spin;
      plates.u.uWave.value = waveFront(p) - (A0 - 0.6);
      plates.u.uTime.value = time;
      plates.u.uFocus.value = 0;
      plates.u.uCam.value.copy(cam);
      // Mercury: its pit grows.
      merc.uni.uSun.value.copy(mercSunL);
      merc.group.worldToLocal(merc.uni.uCamL.value.set(0, 0, 0));
      merc.uni.uEat.value = tl.get('a3.eat', p);
      // Routes and the belt, once the work has begun.
      for (const r of rutas) r.group.visible = on;
      belt.points.visible = on;
      orbits.visible = p > P('a3.todo') - 0.2 && p < P('a3.fin') + 3;
      for (const l of orbits.children) ((l as THREE.Line).material as THREE.LineBasicMaterial).opacity = 0.1 * ease(P('a3.todo'), P('a3.todo') + 1, p);
      // Seen from afar: visible light and the infrared, behind the curtain.
      const wipe = wipeAt(p);
      const wipePx = ((wipe + 1) / 2) * W;
      const ir = p > P('a3.lejos') && p < P('a3.fin') + 1 && wipe < 1.2 ? 1 : 0;
      for (const u of [m.sun.uni, m.sky.u]) {
        u.uIR.value = ir;
        u.uWipePx.value = wipePx;
      }
      swarm.u.uIR.value = ir;
      swarm.u.uWipe.value = wipe;
      // Beacons: fade once the thing itself is big enough to see.
      const fadeBy = (c: THREE.Vector3, r: number) => 1 - smoothstep(3, 10, (r / Math.max(c.distanceTo(cam), 1e-300)) * f.focal);
      B.set(0, M, fadeBy(M, R_MER) * (on ? 1 : 0.6));
      B.set(1, VENUS, 1);
      B.set(2, MARS, 1);
      B.set(3, JUPITER, 1);
      const ride = ease(P('a3.carga') - 0.05, P('a3.carga') + 0.05, p) * (1 - ease(P('a3.enjambre') + 0.1, P('a3.enjambre') + 0.3, p));
      B.set(4, mercRoute.at(rideT(p), V()), ride);
      B.set(5, LUNA, fadeBy(LUNA, R_E * 0.2727) * 0.8);
      B.commit();
      B.mat.uniforms.uDpr.value = f.dpr;
      B.points.visible = p > P('a3') - 1;
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u } = f;
      if (p < P('a3') - 0.5 || p > P('a3.fin') + 1.5) return;
      const win = (a: string, b: string, pad = 0.15) => ease(P(a) - pad, P(a) + pad, p) * (1 - ease(P(b) - pad, P(b) + pad, p));
      const add = (w: THREE.Vector3, text: string, dx: number, dy: number, a: number) => {
        if (a < 0.01) return;
        const q = f.proj(w);
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) nota(g, u, q.x, q.y, text, dx, dy, a);
      };
      add(LUNA, 'la Luna lanza roca al espacio', 30, -26, win('a3', 'a3.viaje', 0.2) * ease(P('a3') + 0.6, P('a3') + 1.0, p));
      const viajeA = win('a3.viaje', 'a3.mercurio', 0.2);
      add(E, 'Tierra', 26, -24, viajeA);
      add(VENUS, 'Venus', 26, -20, viajeA);
      add(M, 'Mercurio · se desarma', 26, 24, viajeA);
      add(V(), 'el Sol y su enjambre', -40, -40, viajeA);
      add(merc2w(merc.riel.at(0.7, V())), 'riel de 2 000 km', 34, -30, win('a3.riel', 'a3.carga', 0.1));
      add(mercRoute.at(rideT(p), V()), 'nuestra carga', 26, -26, win('a3.carga', 'a3.enjambre', 0.1));
      add(ringAPoint(ringAng(p) + 0.0012, SLOT + 1.56e-4, 0), 'colector · tamaño ilustrativo', 30, -30, win('a3.enjambre', 'a3.lejos', 0.15) * ease(P('a3.enjambre') + 0.2, P('a3.enjambre') + 0.5, p));
      // The machines that copy themselves: 2, 4, 8… 2⁴⁰.
      const ma = win('a3.mercurio', 'a3.riel', 0.2);
      if (ma > 0.01) {
        const n = Math.round(40 * ease(P('a3.mercurio') + 0.3, P('a3.riel') - 0.2, p));
        cifra(g, u, W * 0.74, H * 0.26, '2', sup(Math.max(1, n)), 64, ma, TEAL, 'máquinas que se copian a sí mismas');
      }
      // Seen from afar: the curtain and the spectrum that shows why.
      const la = ease(P('a3.lejos') + 1.4, P('a3.lejos') + 2.0, p) * (1 - ease(P('a3.todo') + 0.2, P('a3.todo') + 0.8, p));
      if (la > 0.01) {
        const x = ((wipeAt(p) + 1) / 2) * W;
        if (x < W - 10 && x > 10) {
          linea(g, u, [{ x, y: 96 * u }, { x, y: H - 280 * u }], ink(0.6), la);
          texto(g, u, x - 12 * u, 112 * u, 'luz visible', ink(0.85), la, 10, 'right');
          texto(g, u, x + 12 * u, 112 * u, 'infrarrojo · falso color', '#ff9a6a', la, 10);
        }
        espectro(g, u, W - 470 * u, H - 270 * u, 360 * u, 150 * u, 0.95 * tl.get('a3.built', p), la);
      }
      // Everything at once.
      const todoA = ease(P('a3.todo') + 1.2, P('a3.todo') + 1.8, p);
      add(E, 'Tierra', 22, -22, todoA);
      add(M, 'Mercurio', -30, 26, todoA);
      add(MARS, 'Marte', 22, -20, todoA);
      add(JUPITER, 'Júpiter', 22, -20, todoA);
      add(polar(2.7, TH_E + 1.4), 'cinturón · minas', 26, 22, todoA);
      add(V(), 'el Sol, casi cubierto', -40, -40, todoA);
    },
  };
}
