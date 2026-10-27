import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { clamp, lerp, smoothstep } from '../engine/math';
import { TEAL, cifra, ink, nota, type Muro } from '../engine/placa';
import { flecha, linea, texto } from '../engine/lamina';
import { mezcla, type Vista } from '../engine/vista';
import { calentamiento, grados, industria, infrarrojo } from '../mundo/calor';
import { E, deriva, noche, type Mundo } from '../mundo/mundo';
import { GEO, R_E } from '../mundo/obras';
import type { Acto, Cuadro } from './tipos';

/**
 * Act II · Nosotros, hoy (10¹³ → 10¹⁶ W). The Earth's night lit by two hundred years of growth
 * (the real curve, OWID: 0.64 TW in 1800 → 19 TW today); today; more energy, more heat; the first
 * wall, «El calor nos echa», as Diego chose it (the Earth turns the colour of its heat behind a
 * curtain); the way up without rockets (riding the space elevator, the orbital ring beside it); and
 * the industry leaving for orbit, where its heat goes straight to the void: Type I, around 2370
 * (Jiang et al. 2022, range 2333–2404).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** Humanity's power by year (OWID: Smil 2017 + EI 2026), log10 W; today's figure is the EI's 19 TW. */
const CURVA: [number, number][] = [
  [1800, 0.64e12],
  [1850, 0.89e12],
  [1900, 1.38e12],
  [1950, 3.19e12],
  [1970, 7.3e12],
  [2000, 13.5e12],
  [2026, 19.0e12],
];
function potenciaEn(anio: number) {
  for (let i = 1; i < CURVA.length; i++) {
    const [a1, p1] = CURVA[i];
    const [a0, p0] = CURVA[i - 1];
    if (anio <= a1) return lerp(Math.log10(p0), Math.log10(p1), clamp((anio - a0) / (a1 - a0), 0, 1));
  }
  return Math.log10(19e12);
}

export function hoy(): Acto {
  let tl: Timeline;
  let P: (l: string, d?: number) => number;
  const ease = smoothstep;
  let m: Mundo;
  const ir = infrarrojo();
  const ind = industria();
  let giroAsc = 0;
  let giroDelta = 0;

  const anio = (p: number) => 1800 + 226 * tl.get('a2.t', p);
  const lpAt = (p: number) => (p < P('a2.hoy') ? potenciaEn(anio(p)) : tl.get('a2.lp', p));
  /** What stays on the surface: all of it until the industry leaves, then little. */
  const enSuperficie = (p: number) => Math.exp(lerp(Math.log(10 ** lpAt(p)), Math.log(1.2e14), tl.get('a2.sube', p)));
  const dT = (p: number) => calentamiento(enSuperficie(p));

  // ------------------------------------------------------------ cameras
  function vNoche(p: number): Vista {
    // Closer as the heat rises.
    const d = lerp(lerp(4.6, 4.1, ease(P('a2'), P('a2.hoy', 1), p)), 3.6, ease(P('a2.crece'), P('a2.muro', 1.5), p));
    return noche(d, deriva(p));
  }
  /** Riding the elevator (from the prototype): beside the ribbon, the offset growing with the height. */
  const rideR = (p: number) => Math.exp(lerp(Math.log(1.18), Math.log(9), ease(P('a2.asc', 0.6), P('a2.sale', 2.6), p)));
  function vAscensor(p: number): Vista {
    const up0 = m.ascensor;
    const sideL = up0.clone().cross(V(0, 1, 0)).normalize();
    const r = rideR(p);
    const k = ease(P('a2.asc', 0.6), P('a2.asc', 2.4), p);
    const posL = up0.clone().multiplyScalar(r).addScaledVector(sideL, 0.12 + 0.045 * r).add(V(0, 0.06 * r, 0));
    // Looking along the ribbon to the horizon first; then down at the Earth as we climb.
    const horizon = up0.clone().multiplyScalar(1.05).addScaledVector(sideL, -1.2).add(V(0, -0.15, 0));
    const tgtL = horizon.lerp(V(0, 0, 0), k);
    const q = m.giroQ(m.estado.giro);
    const upL = up0.clone().lerp(V(0, 1, 0), 0.4).normalize().applyQuaternion(q);
    return { pos: m.tierraAMundo(posL), target: m.tierraAMundo(tgtL), up: upL, fov: lerp(62, 48, k) };
  }

  return {
    id: 'a2',
    numero: 'II',
    nombre: 'Nosotros, hoy',
    coreografia(t) {
      tl = t;
      P = (l, d = 0) => tl.at(l) + d * tl.escala;
      tl.label('a2');
      tl.set({ 'a2.t': 0, 'a2.lp': 13.28, 'a2.ly': -1, 'a2.lr': 5.6, 'a2.luces': 0.36, 'a2.wipe': 1.25, 'a2.sube': 0, 'a2.giro': 0 });
      tl.caption(4.2, 'Doscientos años de luces', 'Desde 1800 fuimos encendiendo el planeta, primero de a poco y después de golpe. La energía que usamos pasó de 0,6 a 19 billones de vatios.');
      tl.to(4.2, { 'a2.t': 1 });
      tl.caption(2.6, 'Hoy', 'Hoy son 19 TW: en la escala de Kardashev, tipo 0,73. Parece mucho, pero la Tierra recibe del Sol 174 000 TW. Y toda la energía que usamos termina como calor.');
      tl.label('a2.hoy').with(1.6, { 'a2.wipe': 0.02 }).to(2.6, {});
      tl.caption(3.0, 'Más energía, más calor', 'Si seguimos creciendo, las luces llenan la Tierra y el calor de nuestras máquinas crece con ellas. A la derecha, el planeta como lo vería una cámara infrarroja.');
      tl.label('a2.crece').to(3.0, { 'a2.lp': 15.0, 'a2.ly': 2.35, 'a2.luces': 0.62 });
      tl.caption(2.8, 'El calor nos echa', 'Un planeta solo puede soltar calor irradiándolo al espacio. Con 10¹⁶ W usados en su superficie, la Tierra se calentaría al menos 6 grados: hay que salir.', { fuente: 'Balbi y Lingam, 2025' });
      tl.label('a2.muro').with(1.3, { 'a2.wipe': -1.25 }).to(2.8, { 'a2.lp': 16.0, 'a2.ly': 2.54 });
      tl.caption(3.6, 'Subir sin cohetes', 'Para salir sin quemar cohetes, un cable desde el ecuador hasta más allá de la órbita geoestacionaria, tenso por el giro de la Tierra. Falta un material el doble de fuerte que el mejor de hoy.');
      tl.label('a2.asc').with(1.0, { 'a2.wipe': 1.25 }).with(1.6, { 'a2.giro': 1 }).to(3.6, { 'a2.lr': 7.6 });
      tl.caption(3.8, 'La industria sale al espacio', 'En órbita, el calor se va directo al vacío sin calentar el planeta. Con la industria allá arriba se puede seguir creciendo: tipo I hacia el año 2370.');
      tl.label('a2.sale').to(3.8, { 'a2.sube': 1, 'a2.lp': 16.25, 'a2.ly': 2.54 });
      tl.label('a2.fin');
    },
    montar(mundo) {
      m = mundo;
      m.body.add(ir.mesh, ind.points);
      m.nubes.push(ind);
      giroAsc = m.giroAscensor;
      giroDelta = ((((giroAsc - m.giroNoche) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    },
    vista(p) {
      if (p < P('a2.asc')) return vNoche(p);
      return mezcla(vNoche(P('a2.asc')), vAscensor(p), ease(P('a2.asc'), P('a2.asc', 1.4), p));
    },
    lectura(p) {
      if (p < P('a2.hoy')) return { lp: lpAt(p), ly: -1, lr: 5.6, anio: anio(p) };
      return { lp: tl.get('a2.lp', p), ly: tl.get('a2.ly', p), lr: tl.get('a2.lr', p) };
    },
    muro(p): Muro {
      const k = tl.get('a2.sube', p);
      return { lp: 15, label: 'muro · el calor', a: ease(P('a2.crece', 1), P('a2.crece', 2), p), choque: ease(14.9, 15.6, lpAt(p)) * (1 - k), fuera: k };
    },
    estado(mundo, p) {
      const e = mundo.estado;
      // Two hundred years of lights: on with the power (today's cities by 2026), then the land filling.
      e.luces = p < P('a2.hoy') ? 0.36 * Math.min(1, Math.pow(10 ** (lpAt(p) - 13.28), 0.6)) : tl.get('a2.luces', p);
      e.nuevas = 0.8 * ease(P('a2.hoy'), P('a2.crece', 1), p);
      e.giro = mundo.giroNoche + giroDelta * ease(0, 1, tl.get('a2.giro', p));
      // The ring and the elevator: the way up.
      e.cercanias = ease(P('a2.asc', -0.2), P('a2.asc', 0.9), p);
    },
    update(f) {
      const { p, time, W } = f;
      // (the band in orbit stays while the next act leaves the Earth behind)
      const on = p > P('a2', -1) && p < P('a2.fin', 6);
      ind.points.visible = on;
      // The industry rising.
      ind.u.uK.value = clamp(tl.get('a2.sube', p), 0, 1);
      ind.u.uSpin.value = 0.6 * ease(P('a2.sale'), P('a2.sale', 4), p) + time * 0.01;
      m.body.worldToLocal(ind.u.uCamL.value.set(0, 0, 0));
      // Infrared, behind the curtain.
      const wipe = tl.get('a2.wipe', p);
      const wipePx = ((wipe + 1) / 2) * W;
      const irOn = on && wipe < 1.2 ? 1 : 0;
      ir.mesh.visible = irOn > 0;
      ir.uni.uWipePx.value = wipePx;
      m.sky.u.uIR.value = irOn;
      m.sky.u.uWipePx.value = wipePx;
      ind.u.uIR.value = irOn;
      ind.u.uWipe.value = wipe;
      const P0 = enSuperficie(p);
      // Our heat: where it is used first (the cities), then the whole planet warms.
      ir.uni.uLocal.value = 0.1 + 0.55 * smoothstep(13.2, 15.6, Math.log10(P0));
      ir.uni.uGlobal.value = 0.45 * Math.min(1.2, dT(p) / 6);
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u, lamina } = f;
      if (p < P('a2', -0.5) || p > P('a2.fin', 1)) return;
      const k = tl.get('a2.sube', p);
      const dt = dT(p);
      const Ep = f.proj(E);
      const limbW = E.clone().add(f.vista.pos.clone().sub(E).normalize().cross(V(0, 1, 0)).normalize().multiplyScalar(R_E));
      const Lp = f.proj(limbW);
      const rPx = Ep && Lp ? Math.hypot(Lp.x - Ep.x, Lp.y - Ep.y) : 0;
      // The years, as the show.
      const ya = ease(P('a2', 0.2), P('a2', 0.7), p) * (1 - ease(P('a2.hoy', -0.2), P('a2.hoy', 0.3), p));
      cifra(g, u, W * 0.76, H * 0.26, String(Math.round(anio(p))), '', 64, ya, ink(0.95), 'año');
      // The curtain.
      const wipe = tl.get('a2.wipe', p);
      const x = ((wipe + 1) / 2) * W;
      const inWall = p > P('a2.hoy') && p < P('a2.asc', 1.2);
      if (inWall && x > 10 && x < W - 10) {
        linea(g, u, [{ x, y: 96 * u }, { x, y: H - 280 * u }], ink(0.6), 1);
        texto(g, u, x - 12 * u, 112 * u, 'luz visible', ink(0.85), 1, 10, 'right');
        texto(g, u, x + 12 * u, 112 * u, 'infrarrojo · falso color', '#ff9a6a', 1, 10);
      } else if (inWall && wipe < 0) {
        texto(g, u, W / 2, 112 * u, 'infrarrojo · falso color · el calor de nuestras máquinas, realzado', '#ff9a6a', ease(P('a2.muro', 0.6), P('a2.muro', 1.1), p), 10, 'center');
      }
      // The planet's warming, as a big number by it (while we look at it from the night side).
      const showT = ease(P('a2.hoy', 0.3), P('a2.hoy', 0.9), p) * (1 - ease(P('a2.asc', 0.2), P('a2.asc', 0.8), p));
      if (Ep && showT > 0.01) cifra(g, u, Ep.x + rPx * 0.98 + 70 * u, Ep.y - rPx * 0.62, grados(dt), '', 58, showT, dt > 3 ? '#ff8a5a' : dt > 0.4 ? '#ffb08a' : ink(0.9), 'calor de nuestra energía');
      // Riding up: what we pass, and (plate) why the ribbon stays up.
      if (p > P('a2.asc')) {
        const up0 = m.ascensor;
        const at = (r: number) => f.proj(m.tierraAMundo(up0.clone().multiplyScalar(r)));
        const asc = ease(P('a2.asc', 0.8), P('a2.asc', 1.4), p);
        const ring = f.proj(m.tierraAMundo(up0.clone().applyAxisAngle(V(0, 1, 0), 0.5).setY(0).normalize().multiplyScalar(1.08)));
        if (ring && asc > 0.01) nota(g, u, ring.x, ring.y, 'anillo orbital · 500 km', -40, 30, asc * (1 - ease(P('a2.asc', 2.2), P('a2.asc', 2.8), p)));
        // Once the ribbon is seen from the side: its station, and (plate) why it stays up.
        const base = at(1);
        const top = at(12.5);
        const side = base && top ? Math.hypot(top.x - base.x, top.y - base.y) / H : 0;
        const lado = ease(0.25, 0.4, side) * ease(P('a2.sale'), P('a2.sale', 0.8), p);
        const geo = at(GEO);
        if (geo && lado > 0.01) nota(g, u, geo.x, geo.y, 'órbita geoestacionaria · 36 000 km', 34, -26, lado);
        if (lamina && lado > 0.01) {
          const asc = lado;
          // Along the ribbon: gravity pulls down, the turn pulls out; at GEO they balance. Below,
          // the net pull is down (red); above, out (teal): the ribbon hangs taut between them.
          for (const r of [1.6, 2.6, 4.2, GEO, 9, 12.5]) {
            const net = -1 / (r * r) + r / (GEO * GEO * GEO);
            const a = at(r);
            const b = at(r * (1 + 0.08 * Math.sign(net) * Math.min(1, Math.abs(net) * 2.2 + 0.25)));
            if (!a || !b) continue;
            if (Math.abs(net) < 0.01) {
              texto(g, u, a.x + 14 * u, a.y, 'equilibrio', TEAL, asc, 9, 'left');
              continue;
            }
            flecha(g, u, a, b, net < 0 ? '#ff6a4a' : TEAL, asc, 1.8);
          }
          const low = at(2.6);
          if (low) texto(g, u, low.x + 14 * u, low.y, 'la gravedad gana', '#ff8a6a', asc, 9, 'left');
          const high = at(12.5);
          if (high) texto(g, u, high.x + 14 * u, high.y, 'el giro gana', TEAL, asc, 9, 'left');
        }
      }
      // The band in orbit, once it fills.
      const band = ease(P('a2.sale', 1.2), P('a2.sale', 2.0), p);
      if (band > 0.01) {
        const q = f.proj(m.tierraAMundo(V(-1.3, 0.02, 0.3)));
        if (q) nota(g, u, q.x, q.y, 'fábricas y cómputo en órbita', -60, -36, band);
        if (Ep) cifra(g, u, Ep.x + Math.max(rPx, 40 * u) + 150 * u, Ep.y - Math.max(rPx, 40 * u) * 0.9, grados(dt), '', 44, band * 0.95, dt > 3 ? '#ff8a5a' : ink(0.9), 'calor que se queda en la Tierra');
      }
    },
  };
}
