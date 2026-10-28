import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { clamp, lerp, smoothstep } from '../engine/math';
import { TEAL, cifra, ink, nota } from '../engine/placa';
import { linea, panel, texto } from '../engine/lamina';
import { mirar, type Vista } from '../engine/vista';
import { CENTRO, esferaLamina } from '../mundo/galaxia';
import { E, LY_AU, NOCHE, deriva, type Mundo } from '../mundo/mundo';
import { R_E } from '../mundo/obras';
import type { Acto, Cuadro } from './tipos';

/**
 * Act 0 · ¿Hay alguien más? The style Diego chose in phase 0 is listening: from the Sun outwards,
 * our own voice (a bubble of radio about a century old, ~100 light years) against a galaxy of
 * 100 000; planets everywhere; how little we have listened; the bubble a single civilization would
 * have blown across the galaxy long ago, and that is not there. Then the fall to a yellow star and a
 * blue planet.
 *
 * The clock has no civilization to measure yet: it reads the power that is there and nobody uses
 * (the galaxy, ~10³⁷ W), and on the fall it drops with what is in view (a star, the light on a
 * planet). The next act counts up from there.
 *
 * Figures: 6 451 confirmed planets (NASA Exoplanet Archive, 15 Oct 2026); at least one planet per
 * star on average (Cassan et al. 2012); at 0.1 c a civilization crosses the galaxy in ~650 000 years
 * (Hart 1975); all of SETI so far ≈ a hot tub out of all the oceans (Wright, Kanodia & Lubar 2018).
 *
 * Internally in light years (the galaxy's units), handed to the world in AU.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const AU_LY = 1 / LY_AU;
const E_LY = E.clone().multiplyScalar(AU_LY);
const R_E_LY = R_E * AU_LY;
const UP = V(0, 1, 0);
const sph = (c: THREE.Vector3, d: number, elev: number, az: number) => c.clone().add(V(Math.cos(elev) * Math.sin(az) * d, Math.sin(elev) * d, Math.cos(elev) * Math.cos(az) * d));
/** The bubble that should exist: where a civilization might have started, and the years it takes. */
const SB = CENTRO.clone().add(V(-17000, 0, 11000));

export function apertura(): Acto {
  let tl: Timeline;
  let P: (l: string, d?: number) => number;
  const ease = smoothstep;
  let G: Mundo['G'];
  const bub = esferaLamina();

  /** Close to the Sun, then pulled back until the whole galaxy is in view; a slow drift after. */
  function cerca(p: number) {
    const az = 0.35 + 0.05 * (p - P('a0'));
    const d0 = lerp(420, 300, ease(P('a0.voz'), P('a0.lejos'), p));
    const k = ease(P('a0.lejos'), P('a0.planetas', -0.2), p);
    // With the whole galaxy in view, a slow turn round it and down towards its plane, so the
    // arms wheel past while the planets and the silence are told.
    const deriva = ease(P('a0.planetas', -0.2), P('a0.caida'), p);
    const d = Math.exp(lerp(Math.log(d0), Math.log(155000), k)) * (1 - 0.12 * deriva);
    // Pull straight back from the Sun first; only near the end turn to frame the whole galaxy.
    const target = V(0, 0, 0).lerp(CENTRO.clone().multiplyScalar(0.62), ease(0.55, 1, k));
    const pos = sph(target, d, lerp(0.18, 1.0, ease(0.0, 0.6, k)) - 0.28 * deriva, az + 0.75 * deriva);
    // At first we look away from the Sun, along the disc to the galaxy's core (all those stars, and
    // the glow of the bulge); then the gaze turns to the Sun, a point among them.
    const gira = ease(P('a0', 1.0), P('a0.voz', 0.5), p);
    if (gira >= 1) return { pos, target, up: UP.clone(), fov: 46 };
    const a = CENTRO.clone().sub(pos).normalize();
    const b = target.clone().sub(pos);
    const lb = b.length();
    const q = new THREE.Quaternion().setFromUnitVectors(a, b.divideScalar(lb));
    const dir = a.applyQuaternion(new THREE.Quaternion().slerp(q, gira));
    return { pos, target: pos.clone().addScaledVector(dir, lb), up: UP.clone(), fov: lerp(64, 46, gira) };
  }
  // The fall: wherever we are, to the Sun, then to the Earth, from the side where the next act
  // looks at it (its night side, the Sun just behind its limb: a lit crescent).
  function llegada(k: number, kp: number, from: { pos: THREE.Vector3; target: THREE.Vector3; fov: number }) {
    const d0 = from.pos.length();
    // Down to where the last leg starts, half an AU off the Earth on its night side: round the Sun by
    // angle and in powers of ten, never nearer it than that (falling to the Sun, then sliding over to
    // the Earth, the camera dipped inside its orbit and crossed to the night side: the Sun grew and
    // shrank, and the sky slid one way and back).
    const W = E_LY.clone().addScaledVector(llegaDir(), 0.5 * AU_LY);
    const a = from.pos.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(a, W.clone().normalize());
    const caida = a.applyQuaternion(new THREE.Quaternion().slerp(q, ease(0, 0.42, k))).multiplyScalar(Math.exp(lerp(Math.log(d0), Math.log(W.length()), ease(0, 0.78, k))));
    // The last leg, in beats (not in the eased fall, which crowds its end): from half an AU off the
    // Earth down to 4.2 of its radii, in powers of ten, the planet growing, never passing through it.
    const dE = Math.exp(lerp(Math.log(0.5 * AU_LY), Math.log(4.2 * R_E_LY), ease(0.7, 1, kp)));
    const pos = caida.lerp(E_LY.clone().addScaledVector(llegaDir(), dE), ease(0.68, 0.82, kp));
    // The gaze comes onto the Sun by angle, from the few degrees off it where the galaxy's view left
    // it (sliding the target across space, still thousands of light years off the Sun while we fell,
    // swung the Sun out of view and back in a fraction of a beat); its distance follows the fall.
    const s = ease(0, 0.3, k);
    const mira = from.target.clone().sub(from.pos);
    const sol = pos.clone().negate();
    const giro = new THREE.Quaternion().setFromUnitVectors(from.pos.clone().normalize().negate(), mira.clone().normalize());
    const alSol = pos.clone().addScaledVector(sol.clone().normalize().applyQuaternion(new THREE.Quaternion().slerp(giro, 1 - s)), sol.length() * Math.pow(mira.length() / d0, 1 - s));
    // The gaze stays on the Sun while the Earth grows beside it, and turns to the Earth (by angle) once it shows.
    const target = mirar(pos, alSol, E_LY, ease(0.68, 0.93, kp));
    return { pos, target, up: UP.clone(), fov: lerp(from.fov, 40, ease(0, 0.6, k)) };
  }
  /** Where the next act takes the Earth from (world direction, from the Earth). */
  const llegaDir = () => NOCHE.clone().applyAxisAngle(UP, deriva(P('a1'))).normalize();
  function camaraLy(p: number) {
    const k = tl.get('a0.caida', p);
    const kp = clamp((p - P('a0.caida')) / (P('a0.fin') - P('a0.caida')), 0, 1);
    return k > 0 ? llegada(k, kp, cerca(P('a0.caida'))) : cerca(p);
  }
  const bubble = (p: number) => {
    const k = tl.get('a0.bub', p);
    return { r: 20 + 120000 * ease(0, 0.82, k), on: ease(0.0, 0.06, k) * (1 - ease(0.84, 1.0, k)) };
  };
  const toAU = (v: THREE.Vector3) => v.clone().multiplyScalar(LY_AU);

  return {
    id: 'a0',
    numero: '0',
    nombre: 'Escuchar',
    // It draws its own scale (100 000 light years).
    regla: false,
    coreografia(t) {
      tl = t;
      P = (l, d = 0) => tl.at(l) + d * tl.escala;
      tl.label('a0');
      tl.caption(1.8, '¿Hay alguien más?', 'Nuestra galaxia tiene cientos de miles de millones de estrellas. Juntas brillan con unos 10³⁷ vatios y, hasta donde sabemos, nadie usa esa energía.');
      tl.to(1.8, {});
      tl.caption(2.6, 'Nuestra voz', 'Hace un siglo empezamos a transmitir por radio. Esas señales viajan a la velocidad de la luz y ya forman una burbuja de 100 años luz alrededor de la Tierra.');
      tl.label('a0.voz').to(2.6, { 'a0.voz': 1 });
      tl.caption(2.8, 'Cien mil años luz', 'Pero la galaxia mide 100 000 años luz. A esta escala, toda nuestra voz cabe en un punto.');
      tl.label('a0.lejos').to(2.8, {});
      tl.caption(3.0, 'Planetas por todas partes', 'Y planetas no faltan: ya confirmamos 6 451 y calculamos que hay al menos uno por estrella. Muchos están donde podría haber agua líquida.');
      tl.label('a0.planetas').to(3.0, { 'a0.plan': 1 });
      tl.caption(2.6, 'Lo que hemos escuchado', 'Llevamos décadas escuchando por si alguien transmite. Lo revisado hasta ahora es como sacar un vaso de agua del mar y decir que no hay peces.', { fuente: 'Tarter, 2010; Wright y otros, 2018' });
      tl.label('a0.escuchado').to(2.6, {});
      tl.caption(3.0, 'El silencio', 'Aun así, el silencio es raro: a una décima de la velocidad de la luz, una sola civilización llenaría la galaxia en 650 000 años, y ha habido 13 000 millones. ¿Dónde están todos?', { fuente: 'Fermi, 1950; Hart, 1975' });
      tl.label('a0.silencio').to(3.0, { 'a0.bub': 1 });
      tl.caption(3.4, 'Una estrella amarilla', 'No lo sabemos. Pero podemos imaginar cómo crecería una, empezando por la única que conocemos: la nuestra, junto a una estrella amarilla.', { desde: 1.9, viaje: 'Hacia el Sol' });
      tl.label('a0.caida').to(3.4, { 'a0.caida': 1, 'a0.plan': 0 });
      tl.label('a0.fin');
    },
    montar(m) {
      G = m.G;
      m.gal.add(bub.group);
      m.nubes.push(bub.nube);
    },
    vista(p) {
      const v = camaraLy(p);
      return { pos: toAU(v.pos), target: toAU(v.target), up: v.up, fov: v.fov } as Vista;
    },
    lectura: () => null,
    libre(p) {
      const k = tl.get('a0.caida', p);
      const lp = lerp(lerp(37.0, 26.58, ease(0.1, 0.35, k)), 17.24, ease(0.5, 0.78, k));
      const linea =
        k > 0.5 ? 'la luz del Sol que llega a un planeta azul'
        : k > 0.1 ? 'una estrella amarilla · el Sol'
        : `la Vía Láctea · 13 000 millones de años · ${tl.get('a0.plan', p) > 0.05 ? '6 451 planetas confirmados' : 'nuestra radio: 100 años luz'}`;
      return { lp, linea };
    },
    estado(m, p) {
      const k = tl.get('a0.caida', p);
      // The Earth's lights are not there yet: the next act turns them on.
      m.estado.luces = 0;
      m.estado.luna = ease(0.7, 0.95, k);
      // The first look, along the disc to the core: the Milky Way as from a dark site, brighter than
      // the galaxy is drawn elsewhere (from inside, its light is otherwise held back).
      const via = 1 - ease(P('a0', 1.4), P('a0.voz', 0.6), p);
      m.estado.galaxia = 1 + 1.3 * via;
      m.estado.cielo = 0.8 + 0.3 * via;
    },
    update(f) {
      const { p } = f;
      const on = p < P('a0.fin', 1);
      bub.group.visible = on;
      // Our radio bubble around the Sun, then (El silencio) the bubble that should exist, over the galaxy.
      const voz = tl.get('a0.voz', p);
      const sil = bubble(p);
      const silencio = tl.get('a0.bub', p) > 0.001;
      if (silencio) {
        bub.group.position.copy(SB);
        bub.group.scale.setScalar(sil.r);
        bub.nube.u.uGain.value = sil.on * 0.5;
      } else {
        bub.group.position.set(0, 0, 0);
        bub.group.scale.setScalar(Math.max(100 * ease(0, 1, voz), 1e-6));
        // Once it is a few pixels across, its points (each at least a pixel or two) pile into a lump:
        // it gives way to the plate's mark.
        const px = (100 / Math.max(camaraLy(p).pos.length(), 1)) * f.focal;
        bub.nube.u.uGain.value = (voz > 0.001 ? 1 : 0) * (1 - 0.6 * ease(P('a0.lejos'), P('a0.lejos', 1.4), p)) * smoothstep(4, 14, px);
      }
      G.nube.u.uBub.value.copy(SB);
      G.nube.u.uBubR.value = sil.r;
      G.nube.u.uBubOn.value = silencio ? sil.on : 0;
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u, time } = f;
      if (p > P('a0.fin', 0.5)) return;
      const proj = (ly: THREE.Vector3) => f.proj(toAU(ly));
      const dive = tl.get('a0.caida', p);
      // Our voice, and how far it is from everything.
      const vq = proj(V(0, 100, 0));
      const a = ease(P('a0.voz', 0.4), P('a0.voz', 1.0), p) * (1 - ease(P('a0.lejos', 0.4), P('a0.lejos', 1.0), p));
      if (vq && a > 0.01) nota(g, u, vq.x, vq.y, 'nuestra radio · 100 años luz', 34, -30, a);
      const sq = proj(V());
      const b2 = ease(P('a0.lejos', 1.0), P('a0.lejos', 1.6), p) * (1 - ease(P('a0.silencio'), P('a0.silencio', 0.6), p));
      if (sq && b2 > 0.01) {
        g.save();
        g.globalAlpha = b2;
        g.strokeStyle = TEAL;
        g.lineWidth = Math.max(1, 1.3 * u);
        g.beginPath();
        g.arc(sq.x, sq.y, 5 * u, 0, Math.PI * 2);
        g.stroke();
        g.restore();
        // (it gives way to «lo que hemos escuchado», on the same point)
        nota(g, u, sq.x, sq.y, 'nuestra voz · todo cabe en este punto', 40, 36, b2 * (1 - ease(P('a0.escuchado', -0.1), P('a0.escuchado', 0.3), p)));
        // The diameter across the line of sight, so it keeps its length while the camera turns.
        const ancho = camaraLy(p).pos.sub(CENTRO).cross(UP).normalize().multiplyScalar(50000);
        const e1 = proj(CENTRO.clone().sub(ancho));
        const e2 = proj(CENTRO.clone().add(ancho));
        if (e1 && e2 && e1.x > e2.x) [e1.x, e2.x] = [e2.x, e1.x];
        if (e1 && e2) {
          // Under the disc as it is seen (its rim's lowest point on screen).
          let y = Math.max(e1.y, e2.y);
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            const r = proj(CENTRO.clone().add(V(Math.cos(a) * 50000, 0, Math.sin(a) * 50000)));
            if (r) y = Math.max(y, r.y);
          }
          y = Math.min(y + 18 * u, H - 80 * u);
          linea(g, u, [{ x: e1.x, y }, { x: e2.x, y }], ink(0.5), b2, [], 1);
          linea(g, u, [{ x: e1.x, y: y - 5 * u }, { x: e1.x, y: y + 5 * u }], ink(0.5), b2, [], 1);
          linea(g, u, [{ x: e2.x, y: y - 5 * u }, { x: e2.x, y: y + 5 * u }], ink(0.5), b2, [], 1);
          texto(g, u, (e1.x + e2.x) / 2, y + 14 * u, '100 000 años luz', ink(0.7), b2, 10, 'center', false);
        }
      }
      // Planets everywhere: a dot on each star that has them (teal: one in its habitable zone).
      const plan = tl.get('a0.plan', p) * (1 - ease(0.05, 0.25, dive));
      if (plan > 0.01) {
        for (let i = 0; i < G.conPlanetas.length; i++) {
          // (not the neighbourhood's: crowded along the camera's route, from outside they made a cigar)
          if (i < G.locales) continue;
          const q = proj(G.conPlanetas[i]);
          if (!q || q.x < 0 || q.x > W || q.y < 0 || q.y > H) continue;
          g.save();
          g.globalAlpha = plan * 0.7;
          g.fillStyle = i % 4 === 1 ? TEAL : ink(0.8);
          g.beginPath();
          g.arc(q.x, q.y, 1.2 * u, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
        // The count, as the show.
        const c = ease(P('a0.planetas', 0.2), P('a0.planetas', 0.8), p) * (1 - ease(P('a0.escuchado', -0.3), P('a0.escuchado'), p));
        const half = ease(P('a0.planetas', 1.4), P('a0.planetas', 2.0), p);
        cifra(g, u, W * 0.72, H * 0.3, half > 0.5 ? '10' : '6 451', half > 0.5 ? '11' : '', 64, c, half > 0.5 ? TEAL : ink(0.95), half > 0.5 ? 'planetas en la galaxia, al menos' : 'planetas confirmados');
        // The key.
        const ka = plan * ease(P('a0.planetas', 0.6), P('a0.planetas', 1.2), p) * (1 - ease(P('a0.silencio'), P('a0.silencio', 0.5), p));
        if (ka > 0.01) {
          g.save();
          g.globalAlpha = ka;
          g.fillStyle = ink(0.8);
          g.beginPath();
          g.arc(W / 2 - 150 * u, H - 300 * u, 2.4 * u, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = TEAL;
          g.beginPath();
          g.arc(W / 2 + 6 * u, H - 300 * u, 2.4 * u, 0, Math.PI * 2);
          g.fill();
          g.restore();
          texto(g, u, W / 2 - 142 * u, H - 300 * u, 'una estrella con planetas', ink(0.7), ka, 9.5, 'left', false);
          texto(g, u, W / 2 + 14 * u, H - 300 * u, 'uno en la zona habitable', TEAL, ka, 9.5, 'left', false);
        }
      }
      // What we have listened to: a speck around our point.
      const esc = ease(P('a0.escuchado', 0.3), P('a0.escuchado', 0.9), p) * (1 - ease(P('a0.silencio', -0.3), P('a0.silencio', 0.2), p));
      if (sq && esc > 0.01) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 2);
        g.save();
        g.globalAlpha = esc * (0.5 + 0.5 * pulse);
        g.strokeStyle = TEAL;
        g.setLineDash([2 * u, 3 * u]);
        g.lineWidth = Math.max(1, u);
        g.beginPath();
        g.arc(sq.x, sq.y, (9 + 3 * pulse) * u, 0, Math.PI * 2);
        g.stroke();
        g.restore();
        nota(g, u, sq.x, sq.y, 'lo que hemos escuchado: casi nada', 40, 36, esc);
      }
      // How we look: the three ways (plate).
      if (f.lamina) panel(g, u, W, H, 0.72, 0.12, 'cómo buscamos', ['radio: señales angostas, desde 1960', 'láser: destellos de mil millonésimas de segundo', 'infrarrojo: el calor de obras enormes'], esc);
      // The silence: a timer, and then nothing.
      const bk = tl.get('a0.bub', p);
      if (bk > 0.01 && bk < 0.999) {
        const q = proj(SB);
        if (q) nota(g, u, q.x, q.y, 'una civilización · a 0,1 c', 30, -34, ease(0, 0.08, bk) * (1 - ease(0.3, 0.45, bk)));
        const years = Math.round((650000 * ease(0, 0.82, bk)) / 1000) * 1000;
        cifra(g, u, W * 0.74, H * 0.28, years.toLocaleString('es').replace(/\./g, ' '), '', 52, ease(0.02, 0.1, bk) * (1 - ease(0.86, 0.95, bk)), TEAL, 'años');
      }
      const none = ease(0.86, 0.95, bk) * (1 - ease(P('a0.caida'), P('a0.caida', 0.5), p));
      texto(g, u, W / 2, H * 0.3, 'bastaría una · no vemos ninguna', ink(0.9), none, 13, 'center');
      // The fall: a yellow star, a blue planet.
      const sun = proj(V());
      if (sun && dive > 0.05) nota(g, u, sun.x, sun.y, 'una estrella amarilla', 30, -34, ease(0.05, 0.2, dive) * (1 - ease(0.45, 0.58, dive)));
      const eq = f.proj(E);
      if (eq && dive > 0.4) nota(g, u, eq.x, eq.y, 'un planeta azul', 34, 34, ease(0.45, 0.6, dive) * (1 - ease(0.8, 0.9, dive)));
    },
  };
}
