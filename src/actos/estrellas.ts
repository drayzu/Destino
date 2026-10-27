import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { clamp, lerp, smoothstep } from '../engine/math';
import { TEAL, cifra, ink, nota, type Muro } from '../engine/placa';
import { flecha, texto } from '../engine/lamina';
import { mezcla, mirar, type Vista } from '../engine/vista';
import { LY_AU, type Mundo } from '../mundo/mundo';
import { R_SUN, faros } from '../mundo/obras';
import { VECINAS, dondeVecina, estrella, rutasVecinas, vecinas, vela } from '../mundo/vecinas';
import type { Acto, Cuadro } from './tipos';

/**
 * Act IV · Estrellas vecinas (10²⁶ → ~10²⁹ W). Four moments, each with one subject and its own
 * colour:
 *
 * - Velas de luz: a beam of tens of gigawatts pushes a sail of a few grams and a few metres to a
 *   fifth of the speed of light in minutes (Breakthrough Starshot, 2016). The beam is infrared,
 *   invisible: the sail glows dull red with its heat.
 * - A un quinto de la luz: riding it, twenty years to α Centauri. Real aberration and Doppler: the
 *   stars bunch ahead and turn bluer, those behind redder and dimmer. At the end it flies between
 *   α Centauri A and B, golden and orange (0.06 AU from A).
 * - Frenar con su luz: nothing slows it, so it passes. A slower, larger sail (4.6 % of c at most)
 *   can brake with the light and gravity of A and B and stay at Proxima (Heller & Hippke 2017).
 * - Muro · la luz pone el freno: growing 2.3 % a year we would want the whole galaxy in ~2 500
 *   years, but light takes 100 000 to cross it (Murphy 2011). From here time runs in millions.
 *
 * The sails are drawn in the camera's own space (`cabina`): light years from the Sun the world's
 * coordinates no longer tell metres apart, so the world places only what is far.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
/** A metre in AU. */
const M = 1 / 1.495978707e11;
/** Scene units per metre for what rides with the camera (in front of everything in the world). */
const SIGMA = 1e-4;

const VA = VECINAS[0];
const VB = VECINAS[1];
const VP = VECINAS[2];
/** α Centauri: the pair's middle, the line between them, A and B (AU, world). */
const AC = dondeVecina(VA).multiplyScalar(LY_AU);
const DIR = AC.clone().normalize();
const SEP = DIR.clone().cross(UP).normalize().applyAxisAngle(DIR, 0.5);
const A = AC.clone().addScaledVector(SEP, -7.6);
const B = AC.clone().addScaledVector(SEP, 9.4);
const PROX = dondeVecina(VP).multiplyScalar(LY_AU);
const R_A = 1.22 * R_SUN;
const R_B = 0.86 * R_SUN;
/** Where the sail is launched: on the way out, past the swarm. */
const L0 = DIR.clone().multiplyScalar(0.42);
/** Its flight: to pass A 1.5 AU off, on the side away from B. */
const FB = A.clone().addScaledVector(SEP, -0.06);
const RUMBO = FB.clone().sub(L0).normalize();
const TRAMO = FB.distanceTo(L0);
const LADO = RUMBO.clone().cross(UP).normalize();
const ARRIBA = LADO.clone().cross(RUMBO).normalize();

export function estrellas(): Acto {
  let tl: Timeline;
  let P: (l: string, d?: number) => number;
  const ease = smoothstep;
  let m: Mundo;

  const vec = vecinas();
  const rutas = rutasVecinas();
  const starA = estrella(new THREE.Color(1.0, 0.86, 0.62), 20);
  const starB = estrella(new THREE.Color(1.0, 0.6, 0.32), 16);
  const starP = estrella(new THREE.Color(1.0, 0.36, 0.2), 8);
  starA.group.position.copy(A);
  starA.group.scale.setScalar(R_A);
  starB.group.position.copy(B);
  starB.group.scale.setScalar(R_B);
  starP.group.position.copy(PROX);
  starP.group.scale.setScalar(0.154 * R_SUN);

  // What rides with the camera: Starshot's sail (2 m) and the braking sail (160 m).
  const cabina = new THREE.Group();
  const velaS = vela(12);
  const velaG = vela(24);
  cabina.add(velaS.group, velaG.group);
  // While the sail is too small to see (metres across, kilometres away), a light marks it.
  const faro = faros([{ color: new THREE.Color(1.4, 2.6, 2.2), px: 4.5 }]);
  cabina.add(faro.points);

  // ------------------------------------------------------------ the sail's flight
  /** How far the sail is from its launch (AU) and its speed (c), by beat. */
  function vuelo(p: number) {
    const a = P('a4');
    const kL = (p - a) / (P('a4.viaje') - a);
    const kV = (p - P('a4.viaje')) / (P('a4.frenar') - P('a4.viaje'));
    if (p < P('a4.viaje')) {
      // Constant push for ~10 minutes: s = ½ a t², v = a t (0.12 AU, 0.2 c).
      const u = clamp((kL - 0.5) / 0.5, 0, 1);
      return { s: 0.12 * u * u, beta: 0.2 * u };
    }
    // The cruise, at its real constant speed (the years tick evenly); the last 3 000 AU shrink in
    // logarithm, so A and B grow; the last 30 AU, past A, again at the real speed.
    if (kV < 0.76) return { s: lerp(0.12, TRAMO - 3000, kV / 0.76), beta: 0.2 };
    if (kV < 0.88) return { s: TRAMO - Math.exp(lerp(Math.log(3000), Math.log(30), ease(0.76, 0.88, kV))), beta: 0.2 };
    // Past A: in slow motion close to it (the passing itself lasts minutes).
    const h = 0.04;
    const x = Math.sinh(lerp(Math.asinh(-30 / h), Math.asinh(40 / h), (kV - 0.88) / 0.12)) * h;
    return { s: TRAMO + x, beta: 0.2 };
  }
  const velaW = (s: number) => L0.clone().addScaledVector(RUMBO, s);
  /** Behind the sail and a little above, looking ahead. Metres, in the sail's frame. */
  const DETRAS = V(0, 3.4, -15);
  const LADO_ANTES = V(5.5, 1.2, 3.5);
  const offW = (o: THREE.Vector3) => LADO.clone().multiplyScalar(o.x).addScaledVector(ARRIBA, o.y).addScaledVector(RUMBO, o.z);

  /** The camera's offset from the sail (metres, world axes) and where it looks. */
  function montura(p: number): { off: THREE.Vector3; mira: THREE.Vector3; fov: number } {
    const kL = (p - P('a4')) / (P('a4.viaje') - P('a4'));
    const sw = ease(0.5, 0.85, kL);
    const off = offW(LADO_ANTES.clone().lerp(DETRAS, sw));
    const { s } = vuelo(p);
    const sail = velaW(s);
    // Before it leaves: looking at the sail (the Sun and its swarm behind it). Then further and
    // further ahead of it, so the sail stays in view while the camera swings behind.
    const ahead = sail.clone().addScaledVector(RUMBO, 1).addScaledVector(ARRIBA, 0.03);
    let mira = ahead.clone();
    if (p < P('a4.viaje')) {
      const t = ease(0.5, 0.9, kL);
      const d = Math.exp(lerp(Math.log(0.3 * M), Math.log(1), t));
      mira = sail.clone().addScaledVector(RUMBO, d).addScaledVector(ARRIBA, lerp(-0.06, 0.03, t) * d);
    }
    // Passing α Centauri: the head turns to A as it rushes by.
    const kV = (p - P('a4.viaje')) / (P('a4.frenar') - P('a4.viaje'));
    if (p >= P('a4.viaje')) {
      const look = ease(0.89, 0.93, kV) * (1 - ease(0.965, 0.995, kV));
      if (look > 0) mira = ahead.lerp(A, look);
    }
    return { off, mira, fov: p < P('a4.viaje') ? lerp(52, 60, sw) : 60 };
  }

  // ------------------------------------------------------------ braking at α Centauri A
  /** The braking sail's path around A (AU from A): in from the Sun's side, round A at ~5 radii, out towards B. */
  const U1 = DIR.clone().negate();
  const U2 = SEP.clone();
  const rp = 5 * R_A;
  const ecc = 1.6;
  const fMax = Math.acos(-1 / ecc) * 0.93;
  function frenoRel(k: number) {
    const f = lerp(-fMax, fMax * 0.55, k);
    const r = (rp * (1 + ecc)) / (1 + ecc * Math.cos(f));
    // Its periapsis on the side facing the Sun; rotated so it arrives from where it came.
    const per = U1.clone().applyAxisAngle(U1.clone().cross(U2).normalize(), -0.9);
    const w = U1.clone().cross(U2).normalize().cross(per).normalize();
    return per.multiplyScalar(r * Math.cos(f)).addScaledVector(w, r * Math.sin(f));
  }
  const kFreno = (p: number) => (p - P('a4.frenar')) / (P('a4.muro') - P('a4.frenar'));
  /** Behind the braking sail (metres): its face towards A, we see it against the star. */
  function camFreno(p: number): Vista {
    const k = kFreno(p);
    const t = ease(0, 1, k);
    const rel = frenoRel(t);
    const relN = frenoRel(Math.min(1, t + 0.01));
    const fwd = relN.clone().sub(rel).normalize();
    const toA = rel.clone().negate().normalize();
    const side = fwd.clone().cross(toA).normalize();
    // Metres behind it on the line to A, a little to one side: the sail cut out against A's disc.
    const offM = toA.clone().multiplyScalar(-760).addScaledVector(side, 230).addScaledVector(fwd, -120);
    const pos = A.clone().add(rel).addScaledVector(offM, M);
    return { pos, target: A.clone(), up: UP.clone(), fov: 58 };
  }

  // ------------------------------------------------------------ the camera
  function camVelas(p: number): Vista {
    const kL = (p - P('a4')) / (P('a4.viaje') - P('a4'));
    const mt = montura(p);
    const sail = velaW(vuelo(p).s);
    const near: Vista = { pos: sail.clone().addScaledVector(mt.off, M), target: mt.mira, up: UP.clone(), fov: mt.fov };
    // From the Solar System seen whole (where act III leaves us), a dive to the sail by the Sun.
    const top = V(Math.cos(1.25 - 0.6), 0.85, Math.sin(1.25 - 0.6)).normalize().multiplyScalar(6.2);
    const far: Vista = { pos: top, target: L0.clone().multiplyScalar(0.5), up: UP.clone(), fov: 50 };
    // Falling towards the sail with the Sun (where it is) ahead, then turning to the sail itself.
    const v = mezcla(far, near, ease(0.04, 0.28, kL));
    const haciaSol = mirar(v.pos, far.target, sail, ease(0.02, 0.12, kL));
    return { ...v, target: mirar(v.pos, haciaSol, near.target, ease(0.2, 0.3, kL)) };
  }
  function camViaje(p: number): Vista {
    const mt = montura(p);
    const sail = velaW(vuelo(p).s);
    return { pos: sail.clone().addScaledVector(mt.off, M), target: mt.mira, up: UP.clone(), fov: mt.fov };
  }
  /** Pulling back: the neighbourhood, then the whole galaxy, where our bubble is a point. */
  const GAL = V(0, 0, -26000).multiplyScalar(LY_AU);
  function camMuro(p: number): Vista {
    const k = (p - P('a4.muro')) / (P('a4.fin') - P('a4.muro'));
    const from = camFreno(P('a4.muro'));
    const barrio: Vista = { pos: DIR.clone().multiplyScalar(-30 * LY_AU).addScaledVector(UP, 26 * LY_AU), target: DIR.clone().multiplyScalar(4 * LY_AU), up: UP.clone(), fov: 50 };
    const galaxia: Vista = { pos: GAL.clone().add(V(30000, 62000, 60000).multiplyScalar(LY_AU)), target: GAL.clone().multiplyScalar(0.55), up: UP.clone(), fov: 46 };
    if (k < 0.45) return mezcla(from, barrio, ease(0.0, 0.4, k));
    return mezcla(barrio, galaxia, ease(0.5, 0.95, k));
  }
  function vista(p: number): Vista {
    if (p < P('a4.viaje')) return camVelas(p);
    if (p < P('a4.frenar', -0.6)) return camViaje(p);
    if (p < P('a4.frenar', 0.6)) return mezcla(camViaje(p), camFreno(p), ease(P('a4.frenar', -0.6), P('a4.frenar', 0.6), p));
    if (p < P('a4.muro')) return camFreno(p);
    return camMuro(p);
  }

  return {
    id: 'a4',
    numero: 'IV',
    nombre: 'Estrellas vecinas',
    // The sails are drawn with the camera, in metres: only the neighbourhood is to scale.
    regla: (p) => p > P('a4.muro', 0.5),
    coreografia(t) {
      tl = t;
      P = (l, d = 0) => tl.at(l) + d * tl.escala;
      tl.label('a4');
      tl.set({ 'a4.lp': 26.58, 'a4.ly': 3.13, 'a4.lr': 12.6, 'a4.bub': 0 });
      tl.caption(5.4, 'Velas de luz', 'Para ir a otra estrella, un láser enorme empuja una vela de pocos gramos: en minutos va a un quinto de la velocidad de la luz.', { fuente: 'Breakthrough Starshot, 2016', desde: 1.2, viaje: 'Hacia la vela' });
      tl.to(5.4, { 'a4.lp': 26.62, 'a4.ly': 3.132 });
      tl.label('a4.viaje');
      tl.caption(8.0, 'A un quinto de la luz', 'Son veinte años hasta Alfa Centauri. A esta velocidad el cielo se deforma: las estrellas se juntan hacia adelante y se ven más azules; las de atrás, más rojas.');
      tl.to(8.0, { 'a4.lp': 26.8, 'a4.ly': 3.138, 'a4.lr': 16.62 });
      tl.label('a4.frenar');
      tl.caption(6.4, 'Frenar con su luz', 'Al llegar no hay con qué frenar. Una vela más grande y más lenta sí puede usar la luz de Alfa Centauri A y B como freno, y quedarse en Próxima.', { fuente: 'Heller y Hippke, 2017' });
      tl.to(6.4, { 'a4.lp': 27.4, 'a4.ly': 3.163 });
      tl.label('a4.muro');
      tl.caption(7.0, 'La luz pone el freno', 'Al ritmo de hoy querríamos toda la galaxia en unos 2 500 años, pero la luz tarda 100 000 en cruzarla. Desde aquí, el tiempo se mide en millones de años.', { fuente: 'Murphy, 2011', desde: 1.05, viaje: 'Alejándonos' });
      tl.to(7.0, { 'a4.lp': 29.0, 'a4.ly': 3.4, 'a4.lr': 17.7, 'a4.bub': 1 });
      tl.label('a4.fin');
    },
    montar(mundo) {
      m = mundo;
      m.gal.add(vec.points, rutas.lines);
      m.nubes.push(vec);
      m.root.add(starA.group, starB.group, starP.group);
      m.root.parent!.add(cabina);
    },
    vista: (p) => vista(p),
    lectura: (p) => ({ lp: tl.get('a4.lp', p), ly: tl.get('a4.ly', p), lr: tl.get('a4.lr', p) }),
    muro(p): Muro | null {
      const a = ease(P('a4.muro', 1.0), P('a4.muro', 2.0), p);
      return a > 0.01 ? { lp: 29.0, label: 'muro · la velocidad de la luz', a, choque: ease(28.3, 28.95, tl.get('a4.lp', p)) } : null;
    },
    estado(mundo, p) {
      const e = mundo.estado;
      // Light years away the Sun is one star among many: its beacon fades.
      const lejos = vista(p).pos.length() / LY_AU;
      e.faros = 1 - smoothstep(0.5, 6, lejos);
      e.solDim = 0.9;
      e.cercanias = 0;
      e.luna = 0;
      // Riding the sail: the sky as it looks at that speed.
      const { beta } = vuelo(Math.min(p, P('a4.frenar')));
      e.beta = p < P('a4.frenar') ? beta : beta * (1 - ease(P('a4.frenar', -0.4), P('a4.frenar', 0.4), p));
      e.vel = RUMBO.clone();
    },
    update(f: Cuadro) {
      const { p, time, camera, vista: v } = f;
      const here = p > P('a4', -1) && p < P('a4.fin', 2);
      vec.u.uScale.value = f.k * LY_AU;
      vec.u.uOn.value = here ? 1 : 0.6;
      vec.points.visible = p > P('a4', -1);
      vec.u.uBubR.value = 50 * tl.get('a4.bub', p) * ease(P('a4.muro', 0.5), P('a4.muro', 2.5), p);
      // At the wall the neighbours are the subject: brighter, joined to the Sun by routes.
      // They stay until the galaxy takes over the frame, so the pull back never passes through black.
      const barrio = ease(P('a4.muro', 0.3), P('a4.muro', 1.4), p) * (1 - ease(P('a4.muro', 5.2), P('a4.muro', 6.4), p));
      vec.u.uPiso.value = lerp(0.006, 0.5, barrio);
      rutas.mat.opacity = 0.55 * barrio * ease(P('a4.muro', 1.0), P('a4.muro', 2.2), p);
      rutas.lines.visible = rutas.mat.opacity > 0.001;
      // The galaxy's own stars in our bubble too.
      const bub = ease(P('a4.muro', 0.5), P('a4.muro', 2.5), p);
      if (here) {
        m.G.nube.u.uBub.value.set(0, 0, 0);
        m.G.nube.u.uBubR.value = 50 * bub;
        m.G.nube.u.uBubOn.value = bub;
      }
      // α Centauri up close.
      const nearAC = v.pos.distanceTo(AC) < 0.05 * LY_AU && here;
      starA.update(camera, time, nearAC ? 1 : 0, v.pos.distanceTo(A) / R_A);
      starB.update(camera, time, nearAC ? 1 : 0, v.pos.distanceTo(B) / R_B);
      starP.update(camera, time, v.pos.distanceTo(PROX) < 0.02 * LY_AU && here ? 1 : 0);
      vec.u.uCerca.value = nearAC ? 0.002 : 1e-9;

      // ---- the cabin: what rides with the camera, placed from the camera in metres.
      cabina.visible = false;
      velaS.group.visible = false;
      velaG.group.visible = false;
      faro.points.visible = false;
      if (!here) return;
      const toView = (w: THREE.Vector3) => w.clone().transformDirection(camera.matrixWorldInverse);
      if (p < P('a4.frenar', 0.3)) {
        // Starshot's sail: where it is from the camera (metres), facing ahead.
        const mt = montura(p);
        const near = p >= P('a4') + (P('a4.viaje') - P('a4')) * 0.3;
        let rel: THREE.Vector3;
        if (near) rel = mt.off.clone().negate();
        else rel = velaW(vuelo(p).s).sub(v.pos).divideScalar(M);
        const lejos = rel.length();
        if (lejos > 1500 && p < P('a4.viaje')) {
          // Its light, in its direction (the cabin keeps it near; only the direction matters).
          cabina.visible = true;
          faro.points.visible = true;
          faro.set(0, rel.clone().normalize().multiplyScalar(1000 * SIGMA), smoothstep(1500, 4000, lejos) * smoothstep(3e12, 3e11, lejos));
          faro.commit();
          faro.mat.uniforms.uDpr.value = f.dpr;
        }
        if (lejos < 3000) {
          cabina.visible = true;
          velaS.group.visible = true;
          velaS.group.position.copy(rel).multiplyScalar(SIGMA);
          velaS.group.scale.setScalar(2 * SIGMA);
          velaS.group.quaternion.setFromUnitVectors(V(0, 0, 1), RUMBO);
          const kL = (p - P('a4')) / (P('a4.viaje') - P('a4'));
          velaS.uni.uCalor.value = p < P('a4.viaje') ? ease(0.42, 0.55, kL) * (1 - ease(0.9, 1.0, kL) * 0.7) : 0.3 * (1 - ease(P('a4.viaje'), P('a4.viaje', 1), p));
          // The Sun's light on it before it leaves; A's as it passes.
          const sail = velaW(vuelo(p).s);
          const sunDir = sail.clone().negate().normalize();
          const aDir = A.clone().sub(sail);
          const aD = aDir.length();
          const useA = aD < 200;
          velaS.uni.uLuzDir.value.copy(toView(useA ? aDir.normalize() : sunDir));
          velaS.uni.uLuz.value = useA ? Math.min(3, 4 / (aD * aD)) : Math.min(2, 0.3 / sail.lengthSq());
          velaS.uni.uLuzCol.value.set(useA ? 0xffd9a0 : 0xffe8c8);
        }
      } else if (p < P('a4.muro', 1.5)) {
        // The braking sail: its face to A, metres from the camera.
        const k = kFreno(Math.min(p, P('a4.muro')));
        const rel = frenoRel(ease(0, 1, k));
        const cv = camFreno(Math.min(p, P('a4.muro')));
        const offM = cv.pos.clone().sub(A.clone().add(rel)).divideScalar(M);
        const relCam = p < P('a4.muro') ? offM.negate() : A.clone().add(rel).sub(v.pos).divideScalar(M);
        if (relCam.length() < 2e5) {
          cabina.visible = true;
          velaG.group.visible = true;
          velaG.group.position.copy(relCam).multiplyScalar(SIGMA);
          velaG.group.scale.setScalar(160 * SIGMA);
          const toA = rel.clone().negate().normalize();
          velaG.group.quaternion.setFromUnitVectors(V(0, 0, 1), toA);
          const dA = rel.length();
          velaG.uni.uLuzDir.value.copy(toView(toA));
          velaG.uni.uLuz.value = Math.min(4, (0.04 / dA) ** 2);
          velaG.uni.uLuzCol.value.set(0xffd08a);
          velaG.uni.uCalor.value = 0;
        }
      }
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u } = f;
      if (p < P('a4', -0.5) || p > P('a4.fin', 1.5)) return;
      const add = (w: THREE.Vector3, text: string, dx: number, dy: number, a: number) => {
        if (a < 0.01 || !f.lamina) return;
        const q = f.proj(w);
        if (q && q.x > 0 && q.x < W && q.y > 0 && q.y < H) nota(g, u, q.x, q.y, text, dx, dy, a);
      };
      const kL = (p - P('a4')) / (P('a4.viaje') - P('a4'));
      const kV = (p - P('a4.viaje')) / (P('a4.frenar') - P('a4.viaje'));
      const kF = kFreno(p);
      const kM = (p - P('a4.muro')) / (P('a4.fin') - P('a4.muro'));
      // The sail: its speed, counted up while the beam pushes.
      const ve = ease(0.5, 0.58, kL) * (1 - ease(0.06, 0.12, kV));
      if (ve > 0.01) {
        const b = vuelo(p).beta;
        cifra(g, u, W * 0.76, H * 0.24, b.toFixed(2).replace('.', ','), '', 58, ve, TEAL, 'de la velocidad de la luz');
        if (f.lamina) {
          // The beam: infrared, invisible; it comes from the swarm, behind.
          const q = f.proj(velaW(vuelo(p).s));
          if (q) {
            for (let k = -2; k <= 2; k++) flecha(g, u, { x: q.x + k * 26 * u - 160 * u, y: q.y + 150 * u }, { x: q.x + k * 6 * u, y: q.y + 14 * u }, '#ff7a5a', ve * 0.7, 1.2, [4, 4], f.time * 40);
            texto(g, u, q.x - 170 * u, q.y + 172 * u, 'haz de láser · infrarrojo, invisible', '#ff9a7a', ve, 10);
          }
        }
      }
      // The trip: the years.
      const vy = ease(0.12, 0.2, kV) * (1 - ease(0.9, 0.98, kV));
      if (vy > 0.01) {
        const s = vuelo(p).s;
        const anos = Math.max(0, Math.min(21.8, (s / TRAMO) * 21.8));
        cifra(g, u, W * 0.76, H * 0.24, String(Math.round(anos)), '', 58, vy, TEAL, 'años de viaje');
        if (f.lamina) {
          texto(g, u, W / 2, H * 0.12, 'adelante: las estrellas se juntan y se ven más azules', '#9fc4ff', vy, 10.5, 'center');
          texto(g, u, W / 2, H * 0.12 + 18 * u, 'atrás: más rojas y débiles', '#ffab8a', vy, 10.5, 'center');
        }
      }
      add(A, 'Alfa Centauri A', 34, -30, ease(0.8, 0.84, kV) * (1 - ease(0.97, 1.0, kV)));
      add(B, 'Alfa Centauri B', 34, -30, ease(0.8, 0.84, kV) * (1 - ease(0.97, 1.0, kV)));
      // Braking.
      const fr = ease(0.12, 0.2, kF) * (1 - ease(0.9, 0.98, kF));
      if (fr > 0.01) {
        cifra(g, u, W * 0.76, H * 0.24, '4,6 %', '', 58, fr, TEAL, 'de la luz: la más rápida que así puede frenar');
        add(A, 'Alfa Centauri A', -40, -34, fr);
        add(B, 'Alfa Centauri B', 30, -26, fr);
        if (f.lamina) {
          const rel = frenoRel(ease(0, 1, kF));
          const sail = A.clone().add(rel);
          const q0 = f.proj(sail);
          const q1 = f.proj(sail.clone().addScaledVector(rel.clone().normalize(), rel.length() * 0.6));
          if (q0 && q1) {
            flecha(g, u, q0, q1, '#ffd08a', fr, 1.8);
            texto(g, u, q1.x + 10 * u, q1.y, 'la luz de A la empuja hacia atrás', '#ffd08a', fr, 10);
          }
        }
      }
      // The wall.
      const mu = ease(0.1, 0.18, kM) * (1 - ease(0.9, 1.0, kM));
      if (mu > 0.01) {
        const late = ease(0.55, 0.62, kM);
        cifra(g, u, W * 0.76, H * 0.24, late > 0.5 ? '100 000' : '2 500', '', 58, mu, late > 0.5 ? '#ff9a6a' : TEAL, late > 0.5 ? 'años tarda la luz en cruzar la galaxia' : 'años: toda la galaxia, creciendo un 2,3 % al año');
        add(V(), 'nuestra burbuja', 30, -30, ease(0.2, 0.3, kM) * (1 - ease(0.5, 0.56, kM)));
        add(V(), 'aquí: nuestra burbuja, un punto', 30, -30, ease(0.8, 0.88, kM));
      }
      void ink;
    },
  };
}
