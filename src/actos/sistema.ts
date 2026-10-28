import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { clamp, lerp, smoothstep } from '../engine/math';
import { cifra, ink, nota, rumbo, sup, TEAL, type Muro } from '../engine/placa';
import { flecha, linea, texto } from '../engine/lamina';
import { espectro } from '../engine/espectro';
import { mezcla, type Vista } from '../engine/vista';
import { E, LUNA, LUNA_DIR, type Mundo } from '../mundo/mundo';
import { cilindro, OMEGA } from '../mundo/habitat';
import { espejoShkadov, levante, motorCaplan } from '../mundo/estrella';
import { anilloBishop, esferaBernal, toroStanford } from '../mundo/habitats';
import { L1_VEN, R_MARS, R_PARASOL, R_VEN, marte, venus } from '../mundo/planetas';
import { MOON_D, R_E, R_MER, R_SUN, RING_A, bezier, camino, cinturon, enjambre, faros, mercurio, orbitas, placas, ringABasis, ringAPoint, transferencia } from '../mundo/obras';
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
 * Before the Sun, a world from the inside: an O'Neill cylinder at the Earth–Moon L5 point (Island
 * Three, 8 km × 32 km; its turn, once every ~2 minutes, is its gravity).
 *
 * After the swarm, the star itself: matter lifted out through its poles lengthens its life (up to
 * ~3 billion years, Scoggins & Kipping 2023), and stellar engines move it (Shkadov 1987: a mirror,
 * ~34 000 light years in a billion years; Caplan 2019: jets of its own matter, ~1 000 times faster).
 *
 * On the way to the Sun, the other planets at work: Mars warmed by mirrors over its south pole
 * (Zubrin & McKay 1993), though its own CO₂ gives at most ~20 mbar (Jakosky & Edwards 2018), so
 * people live under domes; Venus with cities floating ~50 km up, at ~1 bar and 0–50 °C (Landis
 * 2003), and a parasol at L1 that shades it to cool it (Birch 1991).
 *
 * On the way to it, the other habitats that turn for their gravity: a Bishop ring 2 000 km across
 * and a McKendree cylinder 4 600 km long (both need carbon nanotubes), a Stanford torus (1.8 km)
 * and a Bernal sphere (~0.5 km) beside the O'Neill cylinder.
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
/** A kilometre in AU. */
const KM = 1 / 1.495978707e8;
/** The O'Neill cylinder: at the Earth–Moon L5 point, its axis towards the Sun. */
const CIL = E.clone().addScaledVector(LUNA_DIR.clone().applyAxisAngle(UP, -Math.PI / 3), MOON_D * R_E);
const R_CIL = 4;
/** Where the stellar engines push the Sun (in the ecliptic). */
const MOTOR = polar(1, TH_E + 2.2);
/** Two directions in the plane of a view: the Sun's side seen from each planet. */
const SUN_MARS = MARS.clone().negate().normalize();
const SUN_VEN = VENUS.clone().negate().normalize();
/**
 * How Mars is turned: with Hellas (the deepest basin, where water and green come first; 42° S, 70° E)
 * on the lit face we look at, between the Sun and the camera.
 */
const GIRO_MARTE = -TH_E - 1.16 - Math.PI;
const qC = new THREE.Quaternion().setFromUnitVectors(UP, CIL.clone().negate().normalize());

export function sistema(): Acto {
  let tl: Timeline;
  let P: (l: string, d?: number) => number;
  const ease = smoothstep;
  let m: Mundo;

  // Ring A turns with the layout (before the swarm and its plates are built).
  RING_A.node = 0.6 + DELTA;
  const { n: nA, e1, e2 } = ringABasis();
  const tanA = (a: number) => e1.clone().multiplyScalar(-Math.sin(a)).addScaledVector(e2, Math.cos(a));
  const radA = (a: number) => e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));

  const cil = cilindro();
  cil.group.position.copy(CIL);
  cil.group.quaternion.copy(qC);
  cil.group.scale.setScalar(KM);
  /** A point in the cylinder's frame (km, not turning) to the world (AU). */
  const cil2w = (v: THREE.Vector3) => v.clone().applyQuaternion(qC).multiplyScalar(KM).add(CIL);
  // Engineering the star.
  const lift = levante();
  lift.group.scale.setScalar(R_SUN);
  const espejo = espejoShkadov();
  espejo.mesh.scale.setScalar(0.55);
  espejo.mesh.quaternion.setFromUnitVectors(UP, MOTOR);
  const caplan = motorCaplan(2.5, 0.055);
  caplan.group.position.copy(MOTOR).multiplyScalar(-0.06);
  caplan.group.quaternion.setFromUnitVectors(UP, MOTOR.clone().negate());
  // The other habitats at L5.
  const ring = anilloBishop();
  const torus = toroStanford();
  const bernal = esferaBernal();
  for (const h of [ring, torus, bernal]) h.group.scale.setScalar(KM);
  const habSun = CIL.clone().negate().normalize();
  // The small ones float beside the cylinder (cylinder frame, km), turned like it, towards the Sun.
  torus.group.quaternion.copy(qC);
  bernal.group.quaternion.copy(qC);
  // The other planets at work.
  const mars = marte();
  mars.group.position.copy(MARS);
  const ven = venus();
  ven.group.position.copy(VENUS);
  /** A point on Mars (local, turning with it) to the world. */
  const mars2w = (v: THREE.Vector3) => v.clone().applyQuaternion(mars.giro.quaternion).multiplyScalar(R_MARS).add(MARS);
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
  const mercRoute = camino(1800, 0.05, teal, 4e-6, 14);
  {
    const p0 = merc2w(merc.riel.at(1, V()));
    const p1 = p0.clone().addScaledVector(launchDir, 0.03).addScaledVector(mercSun, 0.01);
    const p3 = ringAPoint(aArr, 0, 0);
    const p2 = p3.clone().addScaledVector(tanA(aArr), -0.06).addScaledVector(radA(aArr), 0.015);
    mercRoute.trazar(bezier(p0, p1, p2, p3));
  }
  const moonDir = LUNA.clone().sub(E).normalize();
  const depot = E.clone().addScaledVector(moonDir, LUNA.distanceTo(E) + 9 * R_E).add(V(0, 4 * R_E, 0));
  const moonRoute = camino(700, 0.08, teal, 1.2e-6, 7);
  moonRoute.trazar(bezier(LUNA.clone().addScaledVector(moonDir, -0.27 * R_E), LUNA.clone().add(V(0, 3 * R_E, 0)), depot.clone().add(V(0, 6 * R_E, 0)), depot));
  // From the belt to the Earth, and the first seeds from the Earth to Mercury: spirals between orbits,
  // prograde, as ships would fly them (not straight lines across the system).
  const beltRoutes = [0, 1, 2].map((i) => {
    const r = camino(2400, 0.012 + i * 0.003, warm, 2.2e-5, 10);
    r.trazar(transferencia(2.6, TH_E - 2.2 - 0.6 * i, 1, TH_E, 0.04 * (i - 1), 0));
    return r;
  });
  const seedRoute = camino(2600, 0.015, teal, 1.4e-5, 10);
  seedRoute.trazar(transferencia(1, TH_E, 0.387, TH_E - 0.34 + Math.PI * 2, 0.0005, 0.0002));
  // The cylinder's ships to Mars, with the mirrors that will warm it: the line we fly along to get there.
  // It swings out beside the camera's path and back in, so it sweeps across the view to Mars.
  const marsRoute = camino(3200, 0.016, teal, 4e-5, 16);
  {
    const d = MARS.clone().sub(CIL);
    const lado = d.clone().cross(UP).normalize();
    marsRoute.trazar(bezier(CIL.clone(), CIL.clone().addScaledVector(d, 0.2).addScaledVector(lado, 0.09).add(V(0, -0.05, 0)), CIL.clone().addScaledVector(d, 0.7).addScaledVector(lado, 0.05).add(V(0, -0.01, 0)), MARS.clone().add(V(0, -2 * R_MARS, 0))));
  }
  const rutas = [mercRoute, moonRoute, ...beltRoutes, seedRoute, marsRoute];

  // Beacons for what is too small to see.
  const B = faros([
    { color: new THREE.Color(0.6, 1.0, 0.85), px: 2.0 }, // 0 Mercury (busy)
    { color: new THREE.Color(1.0, 0.95, 0.8), px: 2.0 }, // 1 Venus
    { color: new THREE.Color(1.0, 0.6, 0.4), px: 1.8 }, // 2 Mars
    { color: new THREE.Color(1.0, 0.9, 0.75), px: 2.2 }, // 3 Jupiter
    { color: new THREE.Color(1.0, 0.97, 0.9), px: 2.6 }, // 4 our payload
    { color: new THREE.Color(0.85, 0.85, 0.8), px: 1.3 }, // 5 the Moon
    { color: new THREE.Color(0.6, 1.0, 0.88), px: 2.0 }, // 6 the cylinder
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
    const k = ease(P('a3'), P('a3.habitats'), p);
    const end = finAscensor();
    const dir = end.pos.clone().sub(E).normalize();
    const d = Math.exp(lerp(Math.log(end.pos.distanceTo(E)), Math.log(150 * R_E), k));
    const sideW = dir.clone().cross(UP).normalize();
    const pos = E.clone().addScaledVector(dir.lerp(sideW.multiplyScalar(-1).add(V(0, 0.35, 0)).normalize(), k * 0.7).normalize(), d);
    const target = E.clone().lerp(LUNA, 0.35 * k);
    return { pos, target, up: end.up.clone().lerp(UP, k).normalize(), fov: lerp(48, 44, k) };
  }
  /**
   * Worlds that turn: from the Earth towards L5, where the big habitats float. Laid out (once the
   * world is there) from the side we come from: the ring ahead and to one side, the McKendree
   * cylinder beyond it on the other, the O'Neill cylinder a point far behind them.
   */
  let HAB: { ring: THREE.Vector3; ringAxis: THREE.Vector3; cam: THREE.Vector3; tgt: THREE.Vector3; toro: THREE.Vector3; toroEje: THREE.Vector3; bernal: THREE.Vector3 } | null = null;
  /** How far above the way in the habitats are (degrees from where we look as we fly). */
  const LEVANTA = 60;
  function hab() {
    if (HAB) return HAB;
    const dirIn = camSalida(P('a3.habitats')).pos.sub(CIL).normalize();
    const side = dirIn.clone().cross(UP).normalize();
    const up = side.clone().cross(dirIn).normalize();
    const at = (f: number, sd: number, u: number) => CIL.clone().addScaledVector(dirIn, f * KM).addScaledVector(side, sd * KM).addScaledVector(up, u * KM);
    const cam0 = at(42000, 500, 900);
    const tgt = at(22000, -500, -150);
    // The small ones close to the camera, in front of the ring (perspective lines them up: the
    // sphere near, the torus beyond, the 2 000 km ring far behind), their lower edges level.
    const fwd = tgt.clone().sub(cam0).normalize();
    const der = fwd.clone().cross(UP).normalize();
    const arr = der.clone().cross(fwd).normalize();
    const delante = (f: number, x: number, y: number) => cam0.clone().addScaledVector(fwd, f * KM).addScaledVector(der, x * KM).addScaledVector(arr, y * KM);
    // Where the camera stops; and all of it turned up about there, above the way in, so that flying in
    // (looking ahead) they are out of the frame and only come into it when the gaze lifts.
    const cam = delante(2.2, 0, 0);
    const q = new THREE.Quaternion().setFromAxisAngle(der, THREE.MathUtils.degToRad(LEVANTA));
    const giro = (w: THREE.Vector3) => w.clone().sub(cam).applyQuaternion(q).add(cam);
    HAB = {
      ring: giro(at(34000, 3200, 1400)),
      ringAxis: dirIn.clone().multiplyScalar(0.75).addScaledVector(side, 0.45).addScaledVector(up, 0.5).normalize().applyQuaternion(q),
      cam,
      tgt: giro(tgt),
      bernal: giro(delante(10, -0.49, 0.29)),
      toro: giro(delante(14, 3.6, 0.5)),
      toroEje: arr.clone().multiplyScalar(0.6).addScaledVector(fwd, -0.55).addScaledVector(der, -0.35).normalize().applyQuaternion(q),
    };
    return HAB;
  }
  /**
   * Worlds that turn. Out of the Earth's view, the gaze turns calmly ahead, to where the cylinder is (a
   * point, the Sun above it), and the camera flies there straight, in powers of ten at a steady pace,
   * and stops. Only then, still, it lifts its gaze: the three habitats come down into the frame
   * together, and stay, turning. (Rebuilt: the gaze dipped, then turned right round while flying, and
   * the habitats came in, and went, at different speeds while the camera was still moving.)
   */
  function camHabitats(p: number): Vista {
    const k = (p - P('a3.habitats')) / (P('a3.oneill') - P('a3.habitats'));
    const h = hab();
    const desde = camSalida(P('a3.habitats'));
    const u = ease(0.04, 0.5, k);
    let pos = h.cam.clone();
    if (u < 1) {
      const D = desde.pos.distanceTo(h.cam);
      const e1 = Math.log(D / 2 / (3 * R_E));
      const e2 = Math.log(D / 2 / (1000 * KM));
      const e = u * (e1 + e2);
      pos = vuelo(desde.pos, h.cam, e < e1 ? (0.5 * e) / e1 : 0.5 + (0.5 * (e - e1)) / e2, 3 * R_E, 1000 * KM);
    }
    const g = ease(0, 0.34, k);
    const adelante = mirar(pos, desde.target, CIL, g);
    return { pos, target: mirar(pos, adelante, h.tgt, ease(0.52, 0.8, k)), up: desde.up.clone().lerp(UP, g).normalize(), fov: lerp(desde.fov, 50, ease(0.1, 0.5, k)) };
  }
  /** A world from the inside: outside the cylinder, in through the port at its axis, along it. */
  // Inside, 1 km over one valley (at +z), «up» towards the axis: the other two valleys climb overhead.
  const CIL_TOMAS: Vista[] = [
    { pos: V(14, -36, 10), target: V(0, -6, 0), up: V(1, 0, 0), fov: 46 },
    // (off the hub at the end of the shade dome: the docking collar, the shaft of light rings)
    { pos: V(0.25, -18.9, 0.35), target: V(0, -6, 1.2), up: V(1, 0, 0), fov: 58 },
    { pos: V(0, -9, 2.9), target: V(0, 4, 2.3), up: V(0, 0, -1), fov: 70 },
    { pos: V(0.2, 3, 2.7), target: V(0.6, 15, 1.7), up: V(0, 0, -1), fov: 72 },
  ];
  /** Just through the port, on the axis. */
  const CIL_PUERTO: Vista = { pos: V(0.04, -15.3, 0.12), target: V(0, -6, 1.3), up: V(1, 0, 0), fov: 62 };
  const cilW = (v: Vista): Vista => ({ pos: cil2w(v.pos), target: cil2w(v.target), up: v.up.clone().applyQuaternion(qC), fov: v.fov });
  function camCilindro(p: number): Vista {
    const t0 = P('a3.oneill');
    const k = (p - t0) / (P('a3.marte') - t0);
    const [a, b, c, d] = CIL_TOMAS.map(cilW);
    // From where the habitats leave us to the cylinder.
    const desde = camHabitats(P('a3.oneill'));
    // First turn to it (a point of light far away), then close in.
    const a0: Vista = { pos: desde.pos.clone(), target: CIL.clone(), up: desde.up.clone(), fov: 40 };
    // (the gaze comes down to it, still: the habitats rise out of the frame together; only then we fly)
    if (k < 0.18) return { pos: desde.pos, target: mirar(desde.pos, desde.target, CIL, ease(0, 0.18, k)), up: desde.up, fov: lerp(desde.fov, 40, ease(0, 0.18, k)) };
    if (k < 0.34) return mezcla(a0, a, ease(0.18, 0.34, k));
    if (k < 0.5) return mezcla(a, b, ease(0.34, 0.5, k));
    // (through the port on its axis, then out to the valley: straight from the hub to the valley the
    // camera crossed the end wall beside the port)
    const b2 = cilW(CIL_PUERTO);
    // Inside, «up» turns from along the end wall to towards the axis: one long, gentle roll from the
    // port to the valley (with the move to the valley it was a quarter turn in under a beat).
    const rodar = (v: Vista) => ({ ...v, up: b.up.clone().lerp(c.up, ease(0.46, 0.86, k)).normalize() });
    if (k < 0.6) return rodar(mezcla(b, b2, ease(0.5, 0.6, k)));
    if (k < 0.8) return rodar(mezcla(b2, c, ease(0.6, 0.8, k)));
    return rodar(mezcla(c, d, ease(0.8, 1, k)));
  }
  /**
   * From one place to another far away, across scales: the distance from the start grows in
   * logarithm, then the distance to the end shrinks in logarithm (a powers-of-ten flight).
   */
  function vuelo(a: THREE.Vector3, b: THREE.Vector3, s: number, d0: number, d1: number) {
    const u = b.clone().sub(a);
    const D = u.length();
    u.divideScalar(D);
    if (s < 0.5) return a.clone().addScaledVector(u, Math.exp(lerp(Math.log(d0), Math.log(D / 2), s * 2)) - d0 * (1 - s * 2));
    return b.clone().addScaledVector(u, -(Math.exp(lerp(Math.log(D / 2), Math.log(d1), s * 2 - 1)) - d1 * (s * 2 - 1)));
  }
  /** Turning the gaze from one point to another by angle (sliding the target across space would swing it away at once). */
  function mirar(pos: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, t: number) {
    const da = a.clone().sub(pos);
    const db = b.clone().sub(pos);
    const la = da.length();
    const lb = db.length();
    const q = new THREE.Quaternion().setFromUnitVectors(da.divideScalar(la), db.divideScalar(lb));
    const d = da.applyQuaternion(new THREE.Quaternion().slerp(q, t));
    return pos.clone().addScaledVector(d, Math.exp(lerp(Math.log(la), Math.log(lb), t)));
  }
  /** Leaving the cylinder: back along its axis to the end, out through the port, and away. */
  const CIL_FUERA: Vista[] = [
    { pos: V(0, -15.0, 0), target: V(0, 6, 0), up: V(0, 0, -1), fov: 70 },
    { pos: V(0, -90, 0), target: V(0, 0, 0), up: V(0, 0, -1), fov: 46 },
  ];
  /** Mars: seen from the south and the side, the terminator across it (km of world → its radii). */
  const dirMars = SUN_MARS.clone().applyAxisAngle(UP, 1.2).multiplyScalar(Math.cos(0.24)).add(V(0, -Math.sin(0.24), 0));
  const vMarte = (p: number): Vista => ({
    pos: MARS.clone().addScaledVector(dirMars.clone().applyAxisAngle(UP, 0.035 * (p - P('a3.marte'))), 4.4 * R_MARS),
    target: MARS.clone().add(V(0, -0.25 * R_MARS, 0)),
    up: UP.clone(),
    fov: 44,
  });
  /** A camera's turn (where it looks and its up) as a rotation, to turn from one to another in one go. */
  const giroDe = (pos: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, target, up));
  /**
   * From the cylinder to Mars, one thing at a time: out of the valley to the end and through the port,
   * back along the axis; then, still, one smooth turn from the cylinder to Mars (a point of light),
   * upright; then the flight, looking at Mars all the way, so it stays in the middle and grows, the
   * sky turning slowly round it as we come round to the side we see it from. (Rebuilt: the roll, the
   * turn to Mars and the flight overlapped, and quick: the view jumped, rocked, and Mars crossed the
   * frame.)
   */
  function camMarte(p: number): Vista {
    const k = (p - P('a3.marte')) / (P('a3.viaje') - P('a3.marte'));
    const d = cilW(CIL_TOMAS[3]);
    const [e, f] = CIL_FUERA.map(cilW);
    if (k < 0.12) return mezcla(d, e, ease(0, 0.12, k));
    if (k < 0.24) return mezcla(e, f, ease(0.12, 0.24, k));
    const llegada = vMarte(p);
    if (k < 0.4) {
      const q0 = giroDe(f.pos, f.target, f.up);
      const q1 = giroDe(f.pos, llegada.target, UP);
      const q = q0.clone().slerp(q1, ease(0.24, 0.4, k));
      const dist = Math.exp(lerp(Math.log(f.pos.distanceTo(f.target)), Math.log(f.pos.distanceTo(llegada.target)), ease(0.24, 0.4, k)));
      return { pos: f.pos.clone(), target: f.pos.clone().addScaledVector(V(0, 0, -1).applyQuaternion(q), dist), up: V(0, 1, 0).applyQuaternion(q), fov: lerp(f.fov, 44, ease(0.24, 0.4, k)) };
    }
    if (k >= 0.64) return llegada;
    // Leaving takes less of the way than coming in (out there only the stars are to be seen).
    const u = ease(0.4, 0.64, k);
    const s = u < 0.25 ? (0.5 * u) / 0.25 : 0.5 + (0.5 * (u - 0.25)) / 0.75;
    const recta = vuelo(f.pos, llegada.pos, s, 60 * KM, 0.5 * R_MARS);
    // Coming round to the side we see Mars from, slowly, over the whole way in (by angle round Mars).
    const r = recta.distanceTo(llegada.pos);
    const desde = recta.clone().sub(llegada.pos).divideScalar(r || 1);
    const q = new THREE.Quaternion().setFromUnitVectors(desde, llegada.pos.clone().sub(MARS).normalize());
    const pos = llegada.pos.clone().addScaledVector(desde.applyQuaternion(new THREE.Quaternion().slerp(q, ease(Math.log(2e4 * R_MARS), Math.log(3 * R_MARS), Math.log(r || 1e-30)))), r);
    return { pos, target: llegada.target.clone(), up: UP.clone(), fov: 44 };
  }
  /** Up over the inner system (everything at once), then down to Venus. */
  const VISTA_TODO: Vista = { pos: polar(0.5, TH_E - 0.3, 2.1), target: polar(0.25, TH_E - 0.2), up: UP.clone(), fov: 52 };
  const dirVen = SUN_VEN.clone().applyAxisAngle(UP, -0.95).multiplyScalar(Math.cos(0.22)).add(V(0, Math.sin(0.22), 0));
  const vVenus = (p: number): Vista => ({
    pos: VENUS.clone().addScaledVector(dirVen.clone().applyAxisAngle(UP, 0.09 * (p - P('a3.venus'))), lerp(4.2, 3.4, ease(P('a3.venus'), P('a3.venus', 2.6), p)) * R_VEN),
    target: VENUS.clone(),
    up: UP.clone(),
    fov: 44,
  });
  function camViaje(p: number): Vista {
    const s = (p - P('a3.viaje')) / (P('a3.venus') - P('a3.viaje'));
    // Out from Mars (still looking at it), across the whole system, round to Venus, and in.
    const o1: Vista = { ...VISTA_TODO, target: MARS.clone() };
    const o3: Vista = { ...VISTA_TODO, target: VENUS.clone() };
    // The legs between scales are quick (in between there is only black); the overview is the stay.
    if (s < 0.22) return mezcla(vMarte(P('a3.viaje')), o1, ease(0, 0.22, s));
    if (s < 0.5) return mezcla(o1, VISTA_TODO, ease(0.22, 0.5, s));
    if (s < 0.76) return mezcla(VISTA_TODO, o3, ease(0.5, 0.76, s));
    return mezcla(o3, vVenus(p), ease(0.76, 1, s));
  }
  /**
   * Venus: its cities first; then the shade comes; then, from behind it, the parasol in front of
   * the Sun just over its dark limb (from ~30 radii, through a long lens).
   */
  const ECL_D = 30;
  const ECL_H = 1.88;
  const vEclipse = (p: number): Vista => {
    const side = SUN_VEN.clone().cross(UP).normalize();
    const drift = 0.02 * (p - P('a3.venus'));
    return {
      pos: VENUS.clone().addScaledVector(SUN_VEN, -ECL_D * R_VEN).addScaledVector(UP, ECL_H * R_VEN).addScaledVector(side, drift * R_VEN),
      target: VENUS.clone().addScaledVector(SUN_VEN, ECL_D * R_VEN).addScaledVector(UP, -0.6 * R_VEN),
      up: UP.clone(),
      fov: 9.5,
    };
  };
  function camVenus(p: number): Vista {
    const k = (p - P('a3.venus')) / (P('a3.mercurio') - P('a3.venus'));
    if (k < 0.36) return vVenus(p);
    const ecl = vEclipse(p);
    if (k < 0.84) {
      // Round to its night side, pulling back, Venus always in view; then the long lens.
      const v0 = vVenus(p);
      const s = ease(0.36, 0.6, k);
      const d0 = v0.pos.clone().sub(VENUS);
      const d1 = ecl.pos.clone().sub(VENUS);
      const l0 = d0.length();
      const l1 = d1.length();
      const q = new THREE.Quaternion().setFromUnitVectors(d0.divideScalar(l0), d1.clone().divideScalar(l1));
      const dir = d0.applyQuaternion(new THREE.Quaternion().slerp(q, s));
      const orb: Vista = { pos: VENUS.clone().addScaledVector(dir, Math.exp(lerp(Math.log(l0), Math.log(l1), s))), target: VENUS.clone(), up: UP.clone(), fov: 44 };
      return mezcla(orb, ecl, ease(0.56, 0.66, k));
    }
    // On to Mercury, which grows from a point of light.
    const llegada = camMercurio(P('a3.mercurio'));
    const s = ease(0.85, 1.0, k);
    const pos = vuelo(ecl.pos, llegada.pos, s, 10 * R_VEN, 0.6 * llegada.pos.distanceTo(llegada.target));
    const target = mirar(pos, ecl.target, llegada.target, ease(0.84, 0.9, k));
    // (the roll to Mercury's ground happens here, with only stars in view)
    const up = UP.clone().lerp(llegada.up, ease(0.86, 0.95, k)).normalize();
    return { pos, target, up, fov: lerp(9.5, llegada.fov, ease(0.84, 0.93, k)) };
  }
  function camMercurio(p: number): Vista {
    const a = ease(P('a3.mercurio'), P('a3.riel'), p);
    const r = ease(P('a3.riel'), P('a3.carga'), p);
    const s = lerp(0.05, 0.9, r);
    const railP = merc.riel.at(s, V());
    const railD = merc.riel.dir(s, V());
    const nrm = railP.clone().normalize();
    // From afar (≈ 70 radii, the planet small with its scar) down to 0.07 radii over the rail.
    const alt = Math.exp(lerp(Math.log(8), Math.log(0.07), a));
    const start = merc.riel.at(0.05, V());
    const approach = start.clone().normalize().multiplyScalar(1 + alt).addScaledVector(merc.riel.dir(0.05, V()), -alt * 0.9).add(V(0, alt * 0.4, 0));
    // (nearly in the rail's own plane: from beside it, its arc over the curved ground read as a bend at the far end)
    const along = railP.clone().addScaledVector(nrm, 0.07).addScaledVector(railD, -0.08).addScaledVector(merc.riel.axis, 0.01);
    const posL = r > 0 ? approach.lerp(along, ease(0, 0.25, r)) : approach;
    // Already rolled to the ground's own up (done in the flight from Venus, among the stars); the
    // pitch from looking down to the horizon is slow (with the roll, close to the ground, it read
    // as the camera flipping over).
    const tgtL = V(0, 0, 0).lerp(railP.clone().addScaledVector(railD, 0.2), ease(0.4, 1, a));
    const upL = nrm.clone().applyQuaternion(qL);
    return { pos: merc2w(posL), target: merc2w(tgtL), up: upL, fov: lerp(50, 58, a) };
  }
  // On a payload, from the end of the rail to ring A.
  // It leaves in powers of ten, from a couple of Mercury's radii to the whole way (along the route
  // evenly, Mercury went from filling the view to a dot in a twentieth of a beat).
  let t0: number | null = null;
  const rideT = (p: number) => {
    const k = clamp((p - P('a3.carga')) / (P('a3.enjambre') - P('a3.carga')), 0, 1);
    const u = k * k * (3 - 2 * k);
    t0 ??= (2 * R_MER) / mercRoute.at(0, V()).distanceTo(mercRoute.at(1, V()));
    return Math.exp(lerp(Math.log(t0), 0, u)) - t0 * (1 - u);
  };
  function camCarga(p: number): Vista {
    const t = rideT(p);
    const here = mercRoute.at(t, V());
    const back = mercRoute.at(Math.max(0, t - 0.012), V());
    const ahead = mercRoute.at(Math.min(1, t + 0.05), V());
    const lag = here.clone().sub(back);
    const lift = UP.clone().multiplyScalar(lag.length() * 0.35 + 3 * R_MER);
    const tras = here.clone().addScaledVector(lag, -0.6).add(lift);
    // Just launched: first a look back over the payload at Mercury falling away, then a sweep past
    // the Sun to ring A ahead (turning through the Sun, not across the whole sky at once).
    const k = clamp((p - P('a3.carga')) / (P('a3.enjambre') - P('a3.carga')), 0, 1);
    if (k >= 0.5) return { pos: tras, target: ahead, up: UP.clone(), fov: 58 };
    // A few radii ahead of it, so Mercury starts big behind it and falls away as it speeds up.
    const delante = here.clone().addScaledVector(lag.clone().normalize(), 6 * R_MER).add(V(0, 2.5 * R_MER, 0));
    const vp = delante.lerp(tras, ease(0.2, 0.42, k));
    const v: Vista = { pos: vp, target: k < 0.28 ? mirar(vp, M, V(), ease(0.17, 0.27, k)) : mirar(vp, V(), ahead, ease(0.3, 0.5, k)), up: UP.clone(), fov: lerp(50, 58, ease(0.2, 0.5, k)) };
    // Off the rail: from where the ride along it leaves us, round the payload to its front (by angle,
    // the distance in logarithm), turning to look back at Mercury (a quick mix of the two flipped the
    // view and jumped six radii in a fraction of a beat).
    const g = ease(0, 0.16, k);
    if (g >= 1) return v;
    const s0 = camMercurio(P('a3.carga'));
    const oa = s0.pos.clone().sub(here);
    const ob = v.pos.clone().sub(here);
    const la = oa.length();
    const lb = ob.length();
    const q = new THREE.Quaternion().setFromUnitVectors(oa.divideScalar(la), ob.divideScalar(lb));
    const pos = here.clone().addScaledVector(oa.applyQuaternion(new THREE.Quaternion().slerp(q, g)), Math.exp(lerp(Math.log(la), Math.log(lb), g)));
    return { pos, target: mirar(pos, s0.target, v.target, g), up: s0.up.clone().lerp(UP, g).normalize(), fov: lerp(s0.fov, v.fov, g) };
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
    const k = ease(P('a3.lejos'), P('a3.lejos', 1.6), p);
    const from = camAnillo(P('a3.lejos'));
    const far: Vista = { pos: lejosDir.clone().multiplyScalar(26), target: V(), up: nA.clone(), fov: 3.4 };
    return mezcla(from, far, k);
  }
  /** Close to the Sun, from the side: the jets out of its poles. */
  const liftDir = polar(1, TH_E + 0.9).add(V(0, 0.22, 0)).normalize();
  // (rising a little above the equator and closing in, so the jets from the poles turn in depth)
  const vLift = (p: number): Vista => {
    const k = ease(P('a3.lift'), P('a3.motor'), p);
    const eje = liftDir.clone().cross(UP).normalize();
    return { pos: liftDir.clone().applyAxisAngle(eje, -0.3 * k).applyAxisAngle(UP, 0.03 * (p - P('a3.lift'))).multiplyScalar(lerp(24, 19, k) * R_SUN), target: V(0, 0, 0), up: UP.clone(), fov: 58 };
  };
  function camLift(p: number): Vista {
    return mezcla(camLejos(P('a3.lift')), vLift(p), ease(P('a3.lift'), P('a3.lift', 1.6), p));
  }
  /** Side-on to the engines: the mirror on one side, the jet on the other. */
  const motorDir = MOTOR.clone().cross(UP).normalize().add(V(0, 0.42, 0)).normalize();
  const vMotor = (p: number): Vista => ({ pos: MOTOR.clone().multiplyScalar(-0.55).addScaledVector(motorDir.clone().applyAxisAngle(UP, 0.06 * (p - P('a3.motor'))), 3.4), target: MOTOR.clone().multiplyScalar(-0.55), up: UP.clone(), fov: 46 });
  function camMotor(p: number): Vista {
    return mezcla(vLift(P('a3.motor')), vMotor(p), ease(P('a3.motor'), P('a3.motor', 1.8), p));
  }
  function camTodo(p: number): Vista {
    const k = ease(P('a3.todo'), P('a3.todo', 2.4), p);
    const dir = V(Math.cos(TH_E - 0.6), 0.85, Math.sin(TH_E - 0.6)).normalize();
    const d = Math.exp(lerp(Math.log(0.6), Math.log(6.2), k));
    return { pos: dir.multiplyScalar(d), target: V(0, 0, 0).lerp(E.clone().multiplyScalar(0.35), 1 - k), up: UP.clone(), fov: 50 };
  }
  const SEGS: [string, number, (p: number) => Vista][] = [
    ['a3', 0, camSalida],
    ['a3.habitats', 0, camHabitats],
    ['a3.oneill', 0, camCilindro],
    ['a3.marte', 0, camMarte],
    ['a3.viaje', 0, camViaje],
    ['a3.venus', 0, camVenus],
    ['a3.mercurio', 0.2, camMercurio],
    ['a3.carga', 0, camCarga],
    ['a3.enjambre', 0.4, camAnillo],
    ['a3.lejos', 0, camLejos],
    ['a3.lift', 0, camLift],
    ['a3.motor', 0, camMotor],
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
  const wipeAt = (p: number) => lerp(1.25, 0.0, ease(P('a3.lejos', 1.7), P('a3.lejos', 2.6), p)) + 1.3 * ease(P('a3.lift'), P('a3.lift', 0.6), p);

  return {
    id: 'a3',
    numero: 'III',
    nombre: 'El sistema solar trabaja',
    coreografia(t) {
      tl = t;
      P = (l, d = 0) => tl.at(l) + d * tl.escala;
      tl.label('a3');
      tl.set({ 'a3.lp': 16.25, 'a3.ly': 2.54, 'a3.lr': 7.6, 'a3.built': 0, 'a3.eat': 0 });
      tl.caption(5.2, 'Mundos que giran', 'Para vivir fuera de la Tierra hacen falta mundos que giren: su giro hace de gravedad. Hay esferas, ruedas, cilindros y anillos; los más grandes piden materiales que aún no sabemos fabricar.', { fuente: 'Bishop, 1997; O’Neill, 1976', desde: 3.1, viaje: 'Más allá de la Luna' });
      tl.to(1.4, { 'a3.lp': 16.4, 'a3.ly': 2.6, 'a3.lr': 8.6, 'a3.built': 0.1, 'a3.eat': 0.02 });
      tl.label('a3.habitats').to(3.8, { 'a3.lp': 16.5, 'a3.built': 0.12, 'a3.eat': 0.03 });
      tl.caption(5.0, 'Un mundo por dentro', 'Un cilindro de 8 km de ancho y 32 de largo que gira una vez cada dos minutos. Adentro, el paisaje sube por los lados y pasa por encima; por sus tres ventanas entra el sol que reflejan sus espejos.', { fuente: 'O’Neill, 1976', desde: 1.5, viaje: 'Hacia el cilindro' });
      tl.label('a3.oneill').to(5.0, { 'a3.lp': 16.6, 'a3.built': 0.15, 'a3.eat': 0.04 });
      tl.caption(5.4, 'Calentar Marte', 'Marte es frío y casi no tiene aire. Espejos en órbita pueden calentar su polo sur y liberar su hielo, pero su CO₂ no alcanza para un aire como el nuestro: se viviría bajo cúpulas.', { fuente: 'Zubrin y McKay, 1993; Jakosky y Edwards, 2018', desde: 2.4, viaje: 'Hacia Marte' });
      tl.label('a3.marte').to(5.4, { 'a3.lp': 16.95, 'a3.ly': 2.64, 'a3.lr': 11.36, 'a3.built': 0.2, 'a3.eat': 0.05 });
      tl.caption(3.8, 'Hacia el Sol', 'Todo ocurre a la vez: la Luna lanza roca, el cinturón de asteroides se mina y, cerca del Sol, empieza a crecer un enjambre.');
      tl.label('a3.viaje').to(3.8, { 'a3.lp': 17.2, 'a3.ly': 2.68, 'a3.lr': 11.5, 'a3.built': 0.27, 'a3.eat': 0.06 });
      tl.caption(6.4, 'Venus, a la sombra', 'Venus es un horno, pero a 50 km sobre el suelo el aire es templado: ahí pueden flotar ciudades. Un parasol entre Venus y el Sol la iría enfriando.', { fuente: 'Landis, 2003; Birch, 1991' });
      tl.label('a3.venus').to(6.4, { 'a3.lp': 17.5, 'a3.ly': 2.72, 'a3.built': 0.32, 'a3.eat': 0.08 });
      tl.caption(3.0, 'Desarmar Mercurio', 'Para el enjambre hace falta materia. Máquinas que se copian a sí mismas convierten Mercurio en colectores en unos 31 años, casi todo en los últimos cuatro.', { desde: 1.05, viaje: 'Hacia Mercurio' });
      tl.label('a3.mercurio').to(3.0, { 'a3.lp': 18.5, 'a3.ly': 2.76, 'a3.eat': 0.12, 'a3.built': 0.38 });
      tl.caption(4.2, 'La catapulta', 'Sin aire que la frene, un riel de 2 000 km lanza la materia al espacio. Viajamos en una de esas cargas.');
      tl.label('a3.riel').to(1.8, { 'a3.lp': 19.2 });
      tl.label('a3.carga').to(2.4, { 'a3.lp': 20, 'a3.ly': 2.82, 'a3.eat': 0.15, 'a3.built': 0.45 });
      tl.caption(4.0, 'La pared que tapa el Sol', 'No es una esfera sólida: es un enjambre de colectores, cada uno en su propia órbita y de cara al Sol. Para el resto de la galaxia, la estrella se va apagando.', { fuente: 'Dyson, 1960' });
      tl.label('a3.enjambre').to(4.0, { 'a3.lp': 21.2, 'a3.ly': 2.89, 'a3.built': 0.58, 'a3.lr': 11.7 });
      tl.caption(4.4, 'Visto desde lejos', 'Desde otra estrella, un Sol así se ve más débil en luz visible y brilla en infrarrojo con el calor de los colectores. Así buscamos a otros: entre millones de estrellas hay siete candidatas, y varias resultaron ser galaxias lejanas.', { fuente: 'Suazo y otros, 2024', desde: 1.3, viaje: 'Lejos del Sol' });
      tl.label('a3.lejos').to(4.4, { 'a3.lp': 24.0, 'a3.ly': 3.0, 'a3.built': 0.9 });
      tl.caption(3.8, 'Alargar la vida del Sol', 'Una estrella también se puede cuidar: campos magnéticos le sacan materia por los polos y, con menos masa, arde más despacio. Hasta 3 000 millones de años más de vida.', { fuente: 'Scoggins y Kipping, 2023' });
      tl.label('a3.lift').to(3.8, { 'a3.lp': 24.6, 'a3.ly': 3.04 });
      tl.caption(4.4, 'Mover el Sol', 'Y también se puede mover: un espejo gigante le devuelve parte de su luz y lo empuja 34 000 años luz en mil millones de años. Con chorros de su propia materia, mil veces más rápido.', { fuente: 'Shkadov, 1987; Caplan, 2019', desde: 1.3, viaje: 'Alrededor del Sol' });
      tl.label('a3.motor').to(4.4, { 'a3.lp': 25.3, 'a3.ly': 3.08 });
      tl.caption(3.8, 'Tipo II', 'Usar toda la luz del Sol, 3,8 × 10²⁶ W, es ser tipo II. Creciendo un 2,3 % al año se llegaría en unos 1 350 años. Y entonces la estrella ya no alcanza.');
      tl.label('a3.todo').to(3.8, { 'a3.lp': 26.58, 'a3.ly': 3.13, 'a3.lr': 12.6, 'a3.built': 1.0, 'a3.eat': 0.2 });
      tl.label('a3.fin');
    },
    montar(mundo) {
      m = mundo;
      const h = hab();
      ring.group.position.copy(h.ring);
      ring.group.quaternion.setFromUnitVectors(UP, h.ringAxis);
      torus.group.position.copy(h.toro);
      torus.group.quaternion.setFromUnitVectors(UP, h.toroEje);
      bernal.group.position.copy(h.bernal);
      // (no McKendree cylinder: with O'Neill's and the ship of act IV, it made three cylinders; the
      // Bishop ring stands for the giants that need materials we cannot make yet)
      m.root.add(ring.group, torus.group, bernal.group);
      m.root.add(mars.group, ven.group, lift.group, espejo.mesh, caplan.group, cil.group, swarm.points, plates.mesh, merc.group, belt.points, orbits, B.points);
      m.nubes.push(cil.casas, lift.nube, caplan.nube);
      for (const r of rutas) m.root.add(r.group);
      m.nubes.push(swarm, belt, orbits.nube, espejo.nube, ...rutas.map((r) => r.nube));
      // The planets join once their maps are loaded and their points built.
      return Promise.all([mars.listo, ven.listo, merc.listo]).then(() => void m.nubes.push(...mars.nubes, ...ven.nubes, ...merc.nubes));
    },
    vista: (p) => ruta0(p),
    lectura: (p) => ({ lp: tl.get('a3.lp', p), ly: tl.get('a3.ly', p), lr: tl.get('a3.lr', p) }),
    muro(p): Muro | null {
      const a = ease(P('a3.todo', 0.6), P('a3.todo', 1.6), p);
      return a > 0.01 ? { lp: 26.58, label: 'muro · la luz de una estrella', a, choque: ease(26.0, 26.55, tl.get('a3.lp', p)) } : null;
    },
    estado(mundo, p) {
      const e = mundo.estado;
      // The Earth as the last act left it: turned to the elevator, filling with lights, its works up.
      e.giro = mundo.giroAscensor;
      e.luces = 0.62;
      e.nuevas = 0.8;
      e.cercanias = 1;
      // Close to the Sun (lifting its matter) its glare would hide everything: it is dimmed.
      const cerca = ease(P('a3.lift', -0.4), P('a3.lift', 0.8), p) * (1 - ease(P('a3.motor', 0.4), P('a3.motor', 1.4), p));
      e.solDim = Math.max(tl.get('a3.built', p) * 0.9, 0.975 * cerca);
      const cam = ruta0(p).pos;
      // Close to the cylinder it fills the view and hides the sky (its points cannot occlude the galaxy
      // drawn over them); inside, the daylight would hide the stars anyway.
      const cilCerca = 1 - smoothstep(19 * KM, 34 * KM, cam.distanceTo(CIL));
      e.galaxia *= 1 - 0.92 * cilCerca;
      e.cielo *= 1 - 0.85 * cilCerca;
      // Mars and Venus hide the stars behind them.
      if (cam.distanceTo(MARS) < 400 * R_MARS) e.oclusor = { c: MARS, r: R_MARS, propias: mars.nubes };
      else if (cam.distanceTo(VENUS) < 400 * R_VEN) e.oclusor = { c: VENUS, r: R_VEN, propias: ven.nubes };
    },
    update(f: Cuadro) {
      const { p, time, W, vista } = f;
      const built = tl.get('a3.built', p);
      const on = built > 0.001;
      const cam = vista.pos;
      // The cylinder turns (its gravity); inside, the camera's place in its turning frame for the haze.
      const near = cam.distanceTo(CIL) < 2000 * KM;
      cil.group.visible = p > P('a3', -1) && near;
      if (cil.group.visible) cil.update(cil.giro.worldToLocal(V(0, 0, 0)), time, 0.15, f);
      // The swarm.
      const spin = time * 0.0006;
      swarm.points.visible = on;
      swarm.u.uBuilt.value = built;
      swarm.u.uGain.value = (1 - 0.85 * ease(P('a3.lift', -0.2), P('a3.lift', 0.8), p) * (1 - ease(P('a3.todo', -0.4), P('a3.todo', 0.6), p)));
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
      // The habitats at L5: only drawn while we are around.
      const atL5 = cam.distanceTo(CIL) < 3e6 * KM && p < P('a3.marte', 2);
      for (const hb of [ring, torus, bernal]) {
        hb.group.visible = atL5;
        if (atL5) {
          hb.uni.uSun.value.copy(habSun);
          hb.update(time, f);
        }
      }
      // Mars, warmed; Venus, shaded. Only drawn near them (beacons stand in from afar).
      const km = (p - P('a3.marte')) / (P('a3.viaje') - P('a3.marte'));
      mars.group.visible = cam.distanceTo(MARS) < 400 * R_MARS;
      if (mars.group.visible) {
        const camL = cam.clone().sub(MARS).divideScalar(R_MARS);
        mars.update(SUN_MARS, camL, time, GIRO_MARTE + 0.03 * (p - P('a3.marte')), ease(0.6, 0.95, km), ease(0.66, 1.0, km), ease(0.56, 0.84, km), ease(0.58, 0.68, km), f);
      }
      const kv = (p - P('a3.venus')) / (P('a3.mercurio') - P('a3.venus'));
      ven.group.visible = cam.distanceTo(VENUS) < 400 * R_VEN;
      if (ven.group.visible) {
        const camL = cam.clone().sub(VENUS).divideScalar(R_VEN);
        ven.update(SUN_VEN, camL, time, ease(0.24, 0.42, kv), ease(0.3, 0.56, kv), ease(-0.1, 0.12, kv), f);
      }
      // Mercury: its pit grows. Only drawn near it (a beacon stands in from afar).
      merc.group.visible = cam.distanceTo(M) < 400 * R_MER;
      if (merc.group.visible) merc.update(mercSunL, tl.get('a3.eat', p), f);
      // The star, engineered: lifting from the poles; the mirror and the engine's jets.
      lift.set(ease(P('a3.lift'), P('a3.lift', 0.8), p), f.lamina ? 1 : 0);
      const mot = ease(P('a3.motor', 0.3), P('a3.motor', 1.2), p);
      // Seen from far away, at Type II, only its rim: the full cap would hide the whole system.
      espejo.u.uOn.value = mot * (1 - 0.8 * ease(P('a3.todo', -0.4), P('a3.todo', 0.4), p));
      espejo.mesh.visible = mot > 0.001;
      caplan.nube.u.uOn.value = mot;
      caplan.group.visible = mot > 0.001;
      // Routes and the belt, once the work has begun.
      // Each route only while it is what the moment is about (one subject per frame).
      const todoW = ease(P('a3.todo', -0.4), P('a3.todo', 0.6), p);
      const kMarte = (p - P('a3.marte')) / (P('a3.viaje') - P('a3.marte'));
      const overW = ease(P('a3.viaje', 0.4), P('a3.viaje', 1.0), p) * (1 - ease(P('a3.venus', -1.0), P('a3.venus', -0.3), p));
      const rutaW = [
        Math.max(ease(P('a3.mercurio', 1.6), P('a3.riel'), p) * (1 - ease(P('a3.enjambre', 0.4), P('a3.enjambre', 1.0), p)), overW, todoW),
        1 - ease(P('a3.habitats'), P('a3.habitats', 0.6), p),
        Math.max(overW, todoW),
        Math.max(overW, todoW),
        Math.max(overW, todoW),
        Math.max(overW, todoW),
        ease(0.12, 0.24, kMarte) * (1 - ease(0.5, 0.62, kMarte)),
      ];
      rutas.forEach((r, i) => {
        const w = on ? rutaW[i] : 0;
        r.group.visible = w > 0.001;
        r.nube.u.uGain.value = w;
      });
      // Seen from inside its plane the belt is a band across the sky; by the cylinder it would cross
      // the cap (points cannot be hidden behind it), so it fades there.
      const cilCercaU = 1 - smoothstep(19 * KM, 34 * KM, cam.distanceTo(CIL));
      belt.u.uGain.value = 1 - cilCercaU;
      belt.points.visible = on && cilCercaU < 0.999;
      orbits.visible = p > P('a3.todo', -0.2) && p < P('a3.fin', 3);
      // (gone before the dive to the sail, launched beside Mercury's orbit: up close its dots were a row of blots)
      orbits.opacidad = 0.5 * ease(P('a3.todo'), P('a3.todo', 1), p) * (1 - ease(P('a4', 0.3), P('a4', 0.9), p));
      // Seen from afar: visible light and the infrared, behind the curtain.
      const wipe = wipeAt(p);
      const wipePx = ((wipe + 1) / 2) * W;
      const ir = p > P('a3.lejos') && p < P('a3.fin', 1) && wipe < 1.2 ? 1 : 0;
      for (const u of [m.sun.uni, m.sky.u]) {
        u.uIR.value = ir;
        u.uWipePx.value = wipePx;
      }
      swarm.u.uIR.value = ir;
      swarm.u.uWipe.value = wipe;
      // Beacons: fade once the thing itself is big enough to see.
      const fadeBy = (c: THREE.Vector3, r: number) => 1 - smoothstep(3, 10, (r / Math.max(c.distanceTo(cam), 1e-300)) * f.focal);
      B.set(0, M, fadeBy(M, R_MER) * (on ? 1 : 0.6));
      B.set(1, VENUS, fadeBy(VENUS, R_VEN));
      B.set(2, MARS, fadeBy(MARS, R_MARS));
      B.set(3, JUPITER, 1);
      const ride = ease(P('a3.carga', -0.05), P('a3.carga', 0.05), p) * (1 - ease(P('a3.enjambre', 0.1), P('a3.enjambre', 0.3), p));
      B.set(4, mercRoute.at(rideT(p), V()), ride);
      B.set(5, LUNA, fadeBy(LUNA, R_E * 0.2727) * 0.8);
      B.set(6, CIL, fadeBy(CIL, 16 * KM) * ease(P('a3', -0.5), P('a3'), p) * (1 - ease(P('a3.marte', 2), P('a3.marte', 3), p)));
      B.commit();
      B.mat.uniforms.uDpr.value = f.dpr;
      B.points.visible = p > P('a3', -1);
      // Light years away the whole system is one star: its works (whose lights keep their brightness
      // below a pixel) would make a blur where the Sun is.
      if (cam.length() > 3000 || p > P('a3.fin', 8)) {
        for (const o of [lift.group, espejo.mesh, caplan.group, swarm.points, plates.mesh, merc.group, belt.points, orbits, B.points]) o.visible = false;
        for (const r of rutas) r.group.visible = false;
      }
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u } = f;
      if (p < P('a3', -0.5) || p > P('a3.fin', 1.5)) return;
      const win = (a: string, b: string, pad = 0.15) => ease(P(a) - pad, P(a) + pad, p) * (1 - ease(P(b) - pad, P(b) + pad, p));
      // Labels on things belong to the plate (key I); without it, only what cannot be left out.
      const add = (w: THREE.Vector3, text: string, dx: number, dy: number, a: number, siempre = false) => {
        if (a < 0.01 || (!f.lamina && !siempre)) return;
        const q = f.proj(w);
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) nota(g, u, q.x, q.y, text, dx, dy, a);
      };
      add(LUNA, 'la Luna lanza roca al espacio', 30, -26, win('a3', 'a3.habitats', 0.2) * ease(P('a3', 0.6), P('a3', 1.0), p));
      // The habitats, and how big each one is.
      const kh = (p - P('a3.habitats')) / (P('a3.oneill') - P('a3.habitats'));
      const ha = ease(0.6, 0.7, kh) * (1 - ease(0.96, 1.04, kh));
      if (ha > 0.01) {
        const h = hab();
        add(h.ring.clone().addScaledVector(UP, 1000 * KM), 'anillo de Bishop · 2 000 km, aún en obra', 34, -30, ha);
        add(CIL, 'el de O’Neill: 32 km, aquí un punto', -40, 34, ha);
        add(h.toro, 'toro de Stanford · 1,8 km', 34, -34, ha);
        add(h.bernal, 'esfera de Bernal · 0,5 km', 40, 30, ha);
      }
      // The cylinder: what it is, from outside; inside (plate), why the ground holds.
      const ko = (p - P('a3.oneill')) / (P('a3.marte') - P('a3.oneill'));
      const fuera = ease(0.18, 0.28, ko) * (1 - ease(0.42, 0.5, ko));
      add(cil2w(V(R_CIL, 0, 0)), '8 km de ancho · 32 km de largo', 30, -30, fuera);
      add(cil2w(V(-R_CIL * 1.6, -4, R_CIL * 0.9)), 'espejo: mete la luz del Sol', -40, 30, fuera);
      const dentro = ease(0.58, 0.68, ko) * (1 - ease(0.94, 1.0, ko));
      if (dentro > 0.01 && f.lamina) {
        texto(g, u, W / 2, H * 0.17, 'una vuelta cada 2 minutos: el giro es la gravedad', TEAL, dentro, 12, 'center');
        {
          // On the land, the pull of the turn: outwards, away from the axis.
          const spin = f.time * OMEGA;
          for (let k = 0; k < 6; k++) {
            const th = spin + (k * Math.PI) / 3 + 0.5;
            const y = 2 + k * 1.6;
            const a0 = f.proj(cil2w(V(Math.cos(th) * R_CIL * 0.75, y, Math.sin(th) * R_CIL * 0.75)));
            const a1 = f.proj(cil2w(V(Math.cos(th) * R_CIL * 0.97, y, Math.sin(th) * R_CIL * 0.97)));
            if (a0 && a1) flecha(g, u, a0, a1, TEAL, dentro, 1.6);
          }
        }
      }
      // Mars, warmed.
      const km = (p - P('a3.marte')) / (P('a3.viaje') - P('a3.marte'));
      const ma1 = ease(0.62, 0.7, km) * (1 - ease(0.95, 1.02, km));
      if (ma1 > 0.01) {
        const esp = mars.espejos.map((e) => e.clone().multiplyScalar(R_MARS).add(MARS));
        add(esp[1], 'espejos: más luz sobre el polo sur', -36, -28, ma1);
        add(MARS.clone().add(V(0, -1.0 * R_MARS, 0)), 'el hielo del polo se libera', 34, 26, ma1);
        add(mars2w(V(Math.cos(-0.75) * Math.cos(1.2), Math.sin(-0.75), Math.cos(-0.75) * Math.sin(1.2))), 'ciudades bajo cúpulas', 34, -30, ma1 * ease(0.7, 0.76, km));
        cifra(g, u, W * 0.76, H * 0.24, '20', '', 58, ma1, TEAL, 'milibares de aire, como mucho, con su CO₂ (en la Tierra: 1 013)');
        if (f.lamina) {
          // The light the mirrors throw onto the cap.
          const pole = f.proj(MARS.clone().add(V(0, -0.92 * R_MARS, 0)));
          for (const e of esp) {
            const a0 = f.proj(e);
            if (a0 && pole) flecha(g, u, a0, pole, '#ffe0a0', ma1 * 0.8, 1.2, [4, 4], f.time * 30);
          }
        }
      }
      // Towards the cylinder: a point of light until we are close.
      const kO = (p - P('a3.oneill')) / (P('a3.marte') - P('a3.oneill'));
      const rumboO = ease(0.05, 0.09, kO) * (1 - ease(0.2, 0.24, kO));
      if (rumboO > 0.01) {
        const q = f.proj(CIL);
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) rumbo(g, u, q.x, q.y, "el cilindro de O'Neill", rumboO);
      }
      // Far from the Sun: what we are looking back at.
      const rumboL = ease(P('a3.lejos', 0.25), P('a3.lejos', 0.45), p) * (1 - ease(P('a3.lejos', 1.2), P('a3.lejos', 1.5), p));
      if (rumboL > 0.01) {
        const q = f.proj(V());
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) rumbo(g, u, q.x, q.y, 'el Sol y su enjambre', rumboL);
      }
      // On the way: where we are going, and what the ships carry.
      const rumboM = ease(0.2, 0.26, km) * (1 - ease(0.5, 0.56, km));
      if (rumboM > 0.01) {
        const q = f.proj(MARS);
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) rumbo(g, u, q.x, q.y, 'Marte', rumboM);
        add(marsRoute.at(0.3, V()), 'naves con los espejos', -30, 26, rumboM);
      }
      const viajeA = ease(P('a3.viaje', 1.0), P('a3.viaje', 1.3), p) * (1 - ease(P('a3.viaje', 2.5), P('a3.viaje', 2.8), p));
      add(E, 'Tierra', 26, -24, viajeA);
      add(MARS, 'Marte · se calienta', 26, -20, viajeA);
      add(VENUS, 'Venus · a la sombra', 26, -20, viajeA);
      add(M, 'Mercurio · se desarma', 26, 24, viajeA);
      add(polar(2.7, TH_E + 0.2), 'cinturón · minas', 26, 22, viajeA);
      add(V(), 'el Sol y su enjambre', -40, -40, viajeA);
      // Venus: the cities, then the shade.
      const kv = (p - P('a3.venus')) / (P('a3.mercurio') - P('a3.venus'));
      const ve1 = ease(0.06, 0.12, kv) * (1 - ease(0.3, 0.36, kv));
      if (ve1 > 0.01) {
        add(VENUS.clone().addScaledVector(dirVen.clone().add(V(0, 0.5, 0)).normalize(), 1.01 * R_VEN), 'ciudades que flotan a 50 km', 34, -30, ve1);
        cifra(g, u, W * 0.76, H * 0.24, '1 bar', '', 58, ve1, TEAL, 'y entre 0 y 50 °C, sobre las nubes');
      }
      const vs = ease(0.36, 0.4, kv) * (1 - ease(0.54, 0.58, kv));
      add(VENUS.clone().addScaledVector(SUN_VEN, 0.7 * R_VEN).add(V(0, 0.5 * R_VEN, 0)), 'llega la sombra del parasol', 34, -30, vs);
      const ve2 = ease(0.64, 0.68, kv) * (1 - ease(0.82, 0.85, kv));
      if (ve2 > 0.01) {
        const par = VENUS.clone().addScaledVector(SUN_VEN, L1_VEN * R_VEN);
        add(par.clone().add(V(0, R_PARASOL * R_VEN, 0)), 'parasol en L1 · a un millón de km', 30, -28, ve2);
        add(VENUS.clone().add(V(0, 0.6 * R_VEN, 0)), 'Venus, en su sombra: luces de las ciudades', 34, 30, ve2);
        if (f.lamina) {
          // The shadow: from the parasol's rim to the planet's.
          for (const sg of [-1, 1]) {
            const a0 = f.proj(par.clone().add(V(0, sg * R_PARASOL * R_VEN, 0)));
            const a1 = f.proj(VENUS.clone().add(V(0, sg * R_VEN, 0)));
            if (a0 && a1) linea(g, u, [a0, a1], ink(0.6), ve2, [3, 4]);
          }
        }
      }
      add(merc2w(merc.riel.at(0.5, V())), 'riel de 2 000 km', -40, -30, win('a3.riel', 'a3.carga', 0.1));
      add(merc2w(merc.riel.at(1, V())), 'sale a más de 4 km/s: escapa de Mercurio', 34, -30, win('a3.riel', 'a3.carga', 0.1));
      add(mercRoute.at(rideT(p), V()), 'nuestra carga', 26, -26, win('a3.carga', 'a3.enjambre', 0.1));
      add(ringAPoint(ringAng(p) + 0.0012, SLOT + 1.56e-4, 0), 'colector · tamaño ilustrativo', 30, -30, win('a3.enjambre', 'a3.lejos', 0.15) * ease(P('a3.enjambre', 0.2), P('a3.enjambre', 0.5), p), true);
      // The machines that copy themselves: 2, 4, 8… 2⁴⁰.
      const ma = win('a3.mercurio', 'a3.riel', 0.2);
      if (ma > 0.01) {
        const n = Math.round(40 * ease(P('a3.mercurio', 0.3), P('a3.riel', -0.2), p));
        cifra(g, u, W * 0.74, H * 0.26, '2', sup(Math.max(1, n)), 64, ma, TEAL, 'máquinas que se copian a sí mismas');
      }
      // Lifting the star.
      const li = ease(P('a3.lift', 1.4), P('a3.lift', 2.0), p) * (1 - ease(P('a3.motor', 0.2), P('a3.motor', 0.8), p));
      add(V(0, 9 * R_SUN, 0), 'materia que sale por los polos', 34, -26, li);
      add(polar(1.7 * R_SUN, TH_E + 0.4), 'corriente en anillo: canaliza el plasma', 34, 30, li);
      cifra(g, u, W * 0.76, H * 0.24, '+3 000', '', 58, li, TEAL, 'millones de años de vida, como mucho');
      // Moving the star.
      const mo = ease(P('a3.motor', 1.4), P('a3.motor', 2.0), p) * (1 - ease(P('a3.todo', 0.2), P('a3.todo', 0.8), p));
      if (mo > 0.01) {
        add(MOTOR.clone().multiplyScalar(0.55).add(V(0, 0.18, 0)), 'espejo de Shkadov', 30, -28, mo);
        add(MOTOR.clone().multiplyScalar(-1.4), 'motor de Caplan: su chorro', 30, 28, mo);
        const a0 = f.proj(V());
        const a1 = f.proj(MOTOR.clone().multiplyScalar(0.32));
        if (a0 && a1 && f.lamina) {
          flecha(g, u, a0, a1, TEAL, mo, 2.2);
          texto(g, u, a1.x + 10 * u, a1.y - 14 * u, 'el Sol se mueve', TEAL, mo, 10);
        }
        const late = ease(P('a3.motor', 2.6), P('a3.motor', 3.0), p);
        cifra(g, u, W * 0.76, H * 0.24, late > 0.5 ? '50' : '34 000', '', 58, mo, TEAL, late > 0.5 ? 'años luz en un millón de años, con chorros' : 'años luz en mil millones de años, con el espejo');
        if (f.lamina) {
          // The light the mirror sends back, past the star: more light leaves the other way.
          for (let k = -2; k <= 2; k++) {
            const side = MOTOR.clone().cross(UP).normalize();
            const m0 = f.proj(MOTOR.clone().applyAxisAngle(UP, k * 0.25).multiplyScalar(0.55));
            const m1 = f.proj(side.clone().multiplyScalar(k * 0.04).addScaledVector(MOTOR, -0.5));
            if (m0 && m1) flecha(g, u, m0, m1, '#ffe0a0', mo * 0.7, 1.2, [4, 4], f.time * 30);
          }
        }
      }
      // Seen from afar: the curtain and the spectrum that shows why.
      const la = ease(P('a3.lejos', 1.4), P('a3.lejos', 2.0), p) * (1 - ease(P('a3.lift', 0.2), P('a3.lift', 0.8), p));
      if (la > 0.01) {
        const x = ((wipeAt(p) + 1) / 2) * W;
        if (x < W - 10 && x > 10) {
          linea(g, u, [{ x, y: 96 * u }, { x, y: H - 280 * u }], ink(0.6), la);
          texto(g, u, x - 12 * u, 112 * u, 'luz visible', ink(0.85), la, 10, 'right');
          texto(g, u, x + 12 * u, 112 * u, 'infrarrojo · falso color', '#ff9a6a', la, 10);
        }
        if (f.lamina) espectro(g, u, W - 470 * u, H - 270 * u, 360 * u, 150 * u, 0.95 * tl.get('a3.built', p), la);
      }
      // Everything at once.
      const todoA = ease(P('a3.todo', 1.2), P('a3.todo', 1.8), p);
      add(E, 'Tierra', -26, 26, todoA);
      add(M, 'Mercurio', -30, 26, todoA);
      add(MARS, 'Marte', 22, -20, todoA);
      add(VENUS, 'Venus', 22, -20, todoA);
      add(JUPITER, 'Júpiter', 22, -20, todoA);
      add(polar(2.7, TH_E + 1.4), 'cinturón · minas', 26, 22, todoA);
      add(V(), 'el Sol, casi cubierto', -40, -40, todoA);
    },
  };
}
