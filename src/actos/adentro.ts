import * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import { lerp, smoothstep } from '../engine/math';
import { TEAL, cifra, ink, nota, type Muro } from '../engine/placa';
import { linea, texto } from '../engine/lamina';
import { mezcla, mirar, vuelo, type Vista } from '../engine/vista';
import { CENTRO } from '../mundo/galaxia';
import { LY_AU, type Mundo } from '../mundo/mundo';
import { AZ, CAL, RADIOS, TEMPS, calor, capaBits, capaMateria, red } from '../mundo/matrioshka';
import type { Acto, Cuadro } from './tipos';

/**
 * Act VI · Hacia adentro. Perhaps mature civilizations stop growing outwards and think inwards: the
 * camera dives from the galaxy's edge back to the Sun, now wrapped in a Matrioshka brain (Bradbury):
 * nested shells of computers, each running on the waste heat of the one inside. The cold thinks
 * more: erasing a bit costs at least kT ln 2 (Landauer 1961), 110 times less at 2.7 K than at 300 K;
 * with one sun's light, from ~10⁴⁷ to ~10⁴⁹ operations a second (Wright 2020, § 4.5). Then, as Diego
 * chose it, the shells' matter turns into bits, the camera dives among them, they order themselves,
 * and the network that thinks grows out of them. No simulation: it is the civilization that turns
 * into computing. The wall: the cold (nothing is colder than the background; no thought is free).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
/** AU per unit of the study (the shells from ~0.3 to ~5 AU, compressed). */
const S = 0.6;
const orbita = (d: number, az: number, el: number, target = V(), fov = 42): Vista => ({
  pos: target.clone().add(V(Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d)).multiplyScalar(S),
  target: target.clone().multiplyScalar(S),
  up: UP.clone(),
  fov,
});
const coma = (v: number, d: number) => v.toFixed(d).replace('.', ',');

export function adentro(): Acto {
  let tl: Timeline;
  let P: (l: string, d?: number) => number;
  const ease = smoothstep;
  let m: Mundo;

  const group = new THREE.Group();
  group.scale.setScalar(S);
  const mat = RADIOS.map((_, n) => capaMateria(n));
  for (const c of mat) group.add(c.points);
  const bits = RADIOS.map((_, n) => capaBits(n));
  for (const c of bits) group.add(c.mesh);
  const net = red();
  group.add(net.lines, net.puntos.points);
  const heat = calor();
  group.add(heat.points);

  // ------------------------------------------------------------ the camera (the study's way 4)
  function camEstudio(c: number, time: number): Vista {
    const drift = 0.02 * Math.sin(time * 0.1);
    const a = orbita(lerp(34, 26, ease(0, 1, c)), AZ + 0.75 - 0.1 * c + drift, lerp(0.55, 0.36, ease(0, 1, c)), V(), 40);
    const b = orbita(16, AZ + 0.3 + drift, 0.24, V(), 44);
    const kF = ease(2, 3, c);
    const R = Math.exp(lerp(Math.log(16), Math.log(RADIOS[3] * 0.86), ease(0, 0.4, kF)));
    const az = AZ + 0.3 + lerp(0, 1.0, ease(0, 0.25, kF)) + 1.3 * ease(0.35, 1, kF);
    const pos = orbita(R, az, lerp(0.24, 0.1, ease(0, 0.4, kF))).pos;
    const ahead = orbita(RADIOS[3] * 0.97, az + 0.5, 0.15).pos;
    const fl: Vista = { pos, target: V().lerp(ahead, ease(0.18, 0.45, kF)), up: UP.clone(), fov: lerp(44, 68, ease(0, 0.5, kF)) };
    const e = orbita(70, AZ + 0.9 + drift, 0.4, V(), 36);
    if (c < 1) return a;
    if (c < 2) return mezcla(a, b, ease(1, 2, c));
    if (c < 3) return fl;
    return mezcla(fl, e, ease(3, 4, c));
  }
  /** From the galaxy's edge (where act V leaves us) back to the Sun. */
  const BORDE: Vista = { pos: CENTRO.clone().add(V(-150000, 42000, 70000)).multiplyScalar(LY_AU), target: CENTRO.clone().multiplyScalar(LY_AU), up: UP.clone(), fov: 44 };
  function vista(p: number, time: number): Vista {
    const llega = camEstudio(0, time);
    const k = (p - P('a6')) / (P('a6.frio') - P('a6'));
    if (k < 0.5) {
      const s = ease(0.05, 0.5, k);
      const pos = vuelo(BORDE.pos, llega.pos, s, 20000 * LY_AU, 6);
      return { pos, target: mirar(pos, BORDE.target, llega.target, ease(0, 0.2, k)), up: UP.clone(), fov: lerp(44, 40, s) };
    }
    return camEstudio(tl.get('a6.cam', p), time);
  }

  return {
    id: 'a6',
    numero: 'VI',
    nombre: 'Hacia adentro',
    regla: false,
    coreografia(t) {
      tl = t;
      P = (l, d = 0) => tl.at(l) + d * tl.escala;
      tl.label('a6');
      tl.set({ 'a6.cam': 0, 'a6.frio': 0, 'a6.lam': 0, 'a6.flow': 0, 'a6.muro': 0, 'a6.ly': 8.6 });
      tl.caption(5.6, 'Pensar con una estrella', 'Hacia adentro: en vez de seguir expandiéndose, una civilización madura podría envolver su estrella en capas de computadoras, cada una alimentada con el calor de la anterior.', { fuente: 'Bradbury, 1999 (cerebro Matrioshka)', desde: 2.5, viaje: 'Hacia una sola estrella' });
      tl.to(3.0, {}).to(2.6, { 'a6.cam': 1, 'a6.ly': 8.62 });
      tl.label('a6.frio');
      tl.caption(3.8, 'El frío piensa más', 'Cuanto más frío, más barato es pensar: borrar un bit a 3 K cuesta 110 veces menos que a 300 K. Con la luz de un sol, de 10⁴⁷ a 10⁴⁹ operaciones por segundo.', { fuente: 'Landauer, 1961' });
      tl.to(3.8, { 'a6.cam': 2, 'a6.frio': 1, 'a6.flow': 1, 'a6.ly': 8.64 });
      tl.label('a6.mente');
      tl.caption(5.6, 'Dejar de ser materia', 'Una civilización así ya no necesita cuerpos: sus mentes son cálculo. De nosotros queda la forma en que corre la información.');
      tl.to(0.5, { 'a6.frio': 0 }).to(5.1, { 'a6.cam': 3, 'a6.lam': 1, 'a6.ly': 8.68 });
      tl.label('a6.muro');
      tl.caption(4.0, 'El frío', 'Pero pensar cuesta energía, y toda energía termina como calor. Nada se enfría por debajo del fondo del universo: cada pensamiento tiene su precio.');
      tl.to(4.0, { 'a6.cam': 4, 'a6.muro': 1, 'a6.ly': 8.7 });
      tl.label('a6.fin');
    },
    montar(mundo) {
      m = mundo;
      m.root.add(group);
      m.nubes.push(...mat, heat, net.puntos);
    },
    vista: (p, time) => vista(p, time),
    lectura: (p) => ({ lp: 37.0, ly: tl.get('a6.ly', p), lr: 20.98 }),
    muro(p): Muro | null {
      const k = tl.get('a6.muro', p);
      return k > 0.01 ? { lp: 37.25, label: 'muro · el frío', a: ease(0, 0.3, k), choque: ease(0.4, 0.9, k) } : null;
    },
    estado(mundo, p) {
      const e = mundo.estado;
      const lamK = tl.get('a6.lam', p);
      // The Earth and the planets became the shells; at the Sun's scale, no beacons.
      e.tierra = 0;
      e.faros = 0;
      e.cercanias = 0;
      e.luna = 0;
      // The sky dims as the image stops being matter; the Sun, wrapped, seen through the cut.
      e.cielo = 0.8 * (1 - 0.75 * lamK);
      e.galaxia = 1 - 0.7 * lamK;
      e.solDim = lerp(0.35, 0.96, lamK);
    },
    update(f: Cuadro) {
      const { p, time, vista: v } = f;
      const here = p > P('a6', -0.5) && p < P('a6.fin', 2);
      group.visible = here;
      if (!here) return;
      const dist = v.pos.length() / S;
      const lamK = tl.get('a6.lam', p);
      const muroK = tl.get('a6.muro', p);
      const flow = tl.get('a6.flow', p);
      // Matter → bits (late in «El frío piensa más»); inside, the bits flicker at random for a while,
      // then order themselves; then the network.
      const bitsK = ease(P('a6.frio', 1.4), P('a6.frio', 3.2), p);
      const ordenK = ease(P('a6.mente', 3.2), P('a6.mente', 4.2), p);
      const redK = ease(P('a6.mente', 3.7), P('a6.mente', 5.2), p);
      // Its glow hidden inside the shells (they wrap it).
      m.sun.group.children[1].visible = lamK < 0.35 && dist > 5;
      mat.forEach((c) => {
        c.u.uGain.value = 1 - 0.88 * bitsK;
      });
      net.u.uTime.value = time;
      net.u.uA.value = 0.8 * redK * (1 - 0.35 * muroK);
      net.puntos.u.uGain.value = redK;
      bits.forEach((c, n) => {
        c.u.uTime.value = time;
        c.u.uOrden.value = ordenK;
        const near = 1 - ease(0.0, 0.6, Math.abs(Math.log(dist / RADIOS[n])));
        const flash = 0.9 - 0.5 * ordenK;
        c.u.uA.value = (0.55 + flash * near) * (n === 4 ? 0.85 : 1) * bitsK * (1 - 0.45 * redK) * (1 - 0.7 * ease(0, 0.3, muroK));
        c.mesh.visible = bitsK > 0.003;
      });
      heat.u.uFlow.value = 0.9 * flow * (1 - lamK * 0.6);
      // Points small enough to read as matter (the study's sizes).
      for (const n of [...mat, heat]) n.u.uMinPx.value = 1.2 * f.dpr;
      net.puntos.u.uMinPx.value = 1.6 * f.dpr;
      heat.u.uMaxPx.value = 5 * f.dpr;
    },
    placa(g, f: Cuadro) {
      const { p, W, H, u, time } = f;
      if (p < P('a6', -0.5) || p > P('a6.fin', 0.3)) return;
      const at = (d: number, az: number, el: number) => orbita(d, az, el).pos;
      // The temperature of each shell, on the cut's edge (plate); the scale's honesty, always.
      const ta = ease(P('a6', 4.0), P('a6', 4.6), p) * (1 - ease(P('a6.mente', 0.4), P('a6.mente', 1.0), p));
      if (ta > 0.01) {
        if (f.lamina) {
          RADIOS.forEach((R, n) => {
            const q = f.proj(at(R, AZ - 0.02, 0.16 + 0.04 * n));
            if (!q) return;
            const per = coma(TEMPS[0] / TEMPS[n], 0);
            const label = tl.get('a6.frio', p) > 0.3 ? `${TEMPS[n]} K · bits por julio ×${per}` : `${TEMPS[n]} K`;
            nota(g, u, q.x, q.y, label, 30 + 6 * n, -22 - 8 * n, ta, `#${CAL[n].getHexString()}`);
          });
        }
        texto(g, u, W / 2, H - 300 * u, 'radios comprimidos · tamaño ilustrativo · colores: temperatura (falso color)', ink(0.5), ta, 9, 'center', false);
      }
      // The numbers are the show: from 10⁴⁷ to 10⁴⁹ operations per second with the light of one sun.
      const fr = tl.get('a6.frio', p);
      if (fr > 0.01) {
        const late = ease(P('a6.frio', 1.8), P('a6.frio', 2.7), p);
        cifra(g, u, W * 0.74, H * 0.24, '10', late > 0.5 ? '49' : '47', 64, fr * (late > 0.5 ? 1 : 1 - 0.6 * ease(0.3, 0.5, late)), late > 0.5 ? TEAL : ink(0.95), late > 0.5 ? 'operaciones/s · cerca del frío del fondo' : 'operaciones/s · una esfera a 1 UA');
      }
      // The star, drawn, once everything is lámina.
      if (lamK(p) > 0.3) {
        const c = f.proj(V());
        const e = f.proj(f.vista.pos.clone().normalize().cross(UP).normalize().multiplyScalar(0.07 * 1.6 * S));
        const rr = c && e ? Math.max(6 * u, Math.hypot(e.x - c.x, e.y - c.y)) : 0;
        if (c && e && rr < 0.2 * H) {
          const a = ease(0.3, 0.8, lamK(p)) * (1 - ease(P('a6.muro'), P('a6.muro', 1.2), p));
          g.save();
          g.globalAlpha = a;
          g.strokeStyle = '#ffe0a0';
          g.lineWidth = Math.max(1, 1.2 * u);
          g.beginPath();
          g.arc(c.x, c.y, rr, 0, Math.PI * 2);
          g.stroke();
          g.restore();
          for (let k = 0; k < 12; k++) {
            const ang = (k / 12) * Math.PI * 2 + time * 0.05;
            linea(g, u, [{ x: c.x + Math.cos(ang) * rr * 1.25, y: c.y + Math.sin(ang) * rr * 1.25 }, { x: c.x + Math.cos(ang) * rr * 1.7, y: c.y + Math.sin(ang) * rr * 1.7 }], '#ffe0a0', a * 0.7, [], 1);
          }
        }
      }
      // Thought, named.
      const fin = 1 - ease(P('a6.muro', 0.2), P('a6.muro', 0.8), p);
      texto(g, u, W / 2, H * 0.2, 'cada cuadro, un bit que se borra y se reescribe', ink(0.85), ease(P('a6.mente', 1.8), P('a6.mente', 2.2), p) * (1 - ease(P('a6.mente', 2.9), P('a6.mente', 3.2), p)), 12, 'center');
      texto(g, u, W / 2, H * 0.2, 'los bits se ordenan: un pensamiento', TEAL, ease(P('a6.mente', 3.3), P('a6.mente', 3.6), p) * (1 - ease(P('a6.mente', 4.1), P('a6.mente', 4.4), p)), 12, 'center');
      texto(g, u, W / 2, H * 0.2, 'cada pulso, un mensaje entre mentes', TEAL, ease(P('a6.mente', 4.5), P('a6.mente', 4.9), p) * fin, 12, 'center');
      // The wall: the cold. A thermometer down to the floor of the universe.
      const mk = tl.get('a6.muro', p);
      if (mk > 0.01) termometro(g, f, ease(0.15, 0.5, mk), ease(0.45, 0.9, mk));

      function lamK(q: number) {
        return tl.get('a6.lam', q);
      }
    },
  };

  /** The wall drawn: temperatures on a log bar, from the star to the cosmic background; below, nothing. */
  function termometro(g: CanvasRenderingContext2D, f: Cuadro, a: number, hit: number) {
    const { W, H, u } = f;
    const x0 = W * 0.24;
    const x1 = W * 0.76;
    const y = H * 0.22;
    const X = (T: number) => x0 + ((Math.log10(5800) - Math.log10(T)) / (Math.log10(5800) - Math.log10(1))) * (x1 - x0);
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(4,6,8,0.6)';
    g.beginPath();
    g.roundRect(x0 - 24 * u, y - 46 * u, x1 - x0 + 48 * u, 96 * u, 8 * u);
    g.fill();
    g.restore();
    linea(g, u, [{ x: x0, y }, { x: X(2.725), y }], ink(0.7), a, [], 2);
    linea(g, u, [{ x: X(2.725), y }, { x: x1, y }], 'rgba(255,106,74,0.9)', a, [3, 3], 2);
    const tick = (T: number, label: string, col: string, up: boolean) => {
      const x = X(T);
      linea(g, u, [{ x, y: y - 6 * u }, { x, y: y + 6 * u }], col, a, [], 1.4);
      texto(g, u, x, y + (up ? -18 : 20) * u, label, col, a, 9.5, 'center', false);
    };
    tick(5800, 'la estrella · 5 800 K', '#ffe0a0', true);
    tick(1000, '1 000 K', `#${CAL[0].getHexString()}`, false);
    tick(300, '300 K · nosotros', ink(0.8), true);
    tick(30, '30 K', `#${CAL[3].getHexString()}`, false);
    tick(10, '10 K', `#${CAL[4].getHexString()}`, false);
    tick(2.725, '2,7 K · el fondo del universo', TEAL, true);
    const xw = X(2.725);
    g.save();
    g.globalAlpha = a;
    g.strokeStyle = `rgba(255,106,74,${0.6 + 0.4 * hit})`;
    g.lineWidth = Math.max(1, (1.4 + 1.6 * hit) * u);
    g.shadowColor = '#ff5b4a';
    g.shadowBlur = 12 * hit * u;
    g.beginPath();
    g.moveTo(xw, y - 30 * u);
    g.lineTo(xw, y + 30 * u);
    g.stroke();
    g.restore();
    texto(g, u, (xw + x1) / 2, y + 22 * u, 'más frío no hay', 'rgba(255,140,110,0.95)', a * hit, 9.5, 'center', false);
    texto(g, u, W / 2, y + 62 * u, 'kT ln 2 > 0: ningún pensamiento es gratis', ink(0.85), a * hit, 11, 'center');
  }
}

