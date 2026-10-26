import * as THREE from 'three';
import { Timeline } from '../timeline';
import { cielo } from '../cielo';
import { esfera, tierra } from '../tierra';
import { faros } from '../obras';
import { enfocar, materia, materiaBuilder } from '../materia';
import { clamp, lerp, smoothstep } from '../math';
import { TEAL, ink, nota } from '../placa';
import { estacion, flecha, indicador, linea, pr, texto, type P2 } from './lamina';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Study · a second station: «Cómo se sostiene un ascensor espacial». The grammar of the swarm
 * station (the journey stops, the scene becomes the diagram, one step per gesture) on a different
 * kind of mechanism: forces.
 *
 * The physics, per kilogram of cable at a distance r from the Earth's centre (drawn to scale):
 * gravity pulls in with GM/r², the turning (one turn a day, ω = 7.29e-5 /s) pulls out with ω²r. They
 * balance at the geostationary radius (42 164 km from the centre, 35 786 km up). Below, gravity
 * wins; above, the turn wins: the cable is pulled taut from both ends, its tension greatest where
 * they balance (a cable of even section and 1 300 kg/m³ carries ~63 GPa there, Pugno 2006; Edwards
 * asks ~100 GPa; the best nanotubes measured: ~52–63 GPa, and a long cable loses much of it). The
 * ribbon is ~100 000 km long with a counterweight at its end (Edwards, NIAC 2000); laser-powered
 * climbers at ~190 km/h reach the geostationary orbit in about eight days.
 *
 * World units: Earth radii, the Earth at the origin, north up (+Y).
 */

const GM = 3.986e14;
const RE = 6.378e6;
const W_ROT = 7.2921e-5;
const GEO = 42.164e6 / RE; // 6.611
const TOP = 1 + 1e8 / RE; // 100 000 km up: 16.68
/** Per kilogram (m/s²), at r Earth radii. */
const gravedad = (r: number) => GM / (r * RE) ** 2;
const giro = (r: number) => W_ROT * W_ROT * r * RE;
/** Tension of a cable of even section, anchored with no pull at the ground, relative to its value at GEO. */
const tension = (r: number) => {
  const t = (x: number) => GM * (1 / RE - 1 / (x * RE)) - (W_ROT * W_ROT * RE * RE * (x * x - 1)) / 2;
  return Math.max(0, t(r) / t(GEO));
};
const D2R = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const km = (r: number) => `${Math.round(((r - 1) * RE) / 1e6) * 1000}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** The ribbon, the station at GEO and the counterweight, as light (local units: Earth radii). */
function cinta(up: THREE.Vector3) {
  const b = materiaBuilder(211);
  const white = new THREE.Color(1, 0.95, 0.86);
  const teal = new THREE.Color(0.6, 1.0, 0.88);
  for (let k = 0; k < 9000; k++) {
    const r = Math.pow(TOP, k / 9000);
    b.push(up.x * r, up.y * r, up.z * r, white, 0.0012 * Math.sqrt(r), k % 300 === 0 ? 1.6 : 0.22);
  }
  for (const [rr, n, s] of [[GEO, 260, 0.05], [TOP, 420, 0.12]] as const) {
    for (let k = 0; k < n; k++) {
      const [dx, dy, dz] = b.onSphere();
      const rad = s * Math.pow(b.r(), 0.5);
      b.push(up.x * rr + dx * rad, up.y * rr + dy * rad, up.z * rr + dz * rad, teal, 0.006, 0.5);
    }
  }
  // The base: a platform on the equator.
  for (let k = 0; k < 500; k++) {
    const a = b.r() * Math.PI * 2;
    const rr = 0.012 * Math.sqrt(b.r());
    const t1 = up.clone().cross(V(0, 1, 0)).normalize();
    b.push(up.x * 1.002 + t1.x * Math.cos(a) * rr, Math.sin(a) * rr, up.z * 1.002 + t1.z * Math.cos(a) * rr, teal, 0.002, 1.5);
  }
  const n = materia(b.data(), { move: 'fuente = 0.5;' });
  n.u.uSpread.value = 0;
  return n;
}

export const ascensor: Escena = {
  id: 'ascensor',
  nombre: 'Cómo se sostiene un ascensor',
  estilos: [{ key: '1', nombre: 'estación', nota: 'La segunda estación: un mecanismo de fuerzas. El viaje se frena, el cable real se vuelve el diagrama, un paso por gesto.' }],
  montar(stage): Instancia {
    stage.bloom.strength = 0.6;
    stage.bloom.radius = 0.35;
    stage.bloom.threshold = 0.65;
    stage.renderer.toneMappingExposure = 1.0;
    const root = new THREE.Group();
    stage.root.add(root);
    const sky = cielo(0.9);
    root.add(sky.mesh);
    // The Earth and everything that turns with it.
    const body = new THREE.Group();
    root.add(body);
    const earth = tierra();
    body.add(earth.group);
    const UP0 = new THREE.Vector3(...esfera(0, -80)).normalize();
    const rib = cinta(UP0);
    body.add(rib.points);
    // Climbers: lights on the ribbon (positions set each frame).
    const NC = 7;
    const B = faros([
      ...Array.from({ length: NC }, () => ({ color: new THREE.Color(1, 0.97, 0.9), px: 1.1 })),
      { color: new THREE.Color(1, 0.97, 0.9), px: 1.8 }, // the one we ride
    ]);
    root.add(B.points);

    // ------------------------------------------------------------ the journey
    const tl = new Timeline({ lp: 14.6, ly: 2.24, lr: 8.0, paso: 0, sube: 0 });
    tl.set({ lp: 14.6, ly: 2.24, lr: 8.0 });
    tl.caption(2.6, 'Subir sin cohetes', 'Un cable desde el ecuador hasta más allá de la órbita: por él se sube al espacio como en un ascensor.');
    tl.label('obra').to(2.6, { sube: 0.12 });
    const st = estacion(tl, 'estacion', [
      ['El cable', 'Cien mil kilómetros desde el ecuador hasta un contrapeso. Gira con la Tierra: una vuelta por día.'],
      ['La gravedad tira hacia abajo', 'Cada tramo del cable pesa. Cerca del suelo, mucho; lejos, casi nada: la gravedad se debilita con la distancia.'],
      ['El giro tira hacia afuera', 'Como una honda: al girar, todo lo que va en el cable quiere salir despedido. Cuanto más lejos, más fuerte.'],
      ['Se equilibran a 36 000 km', 'Abajo gana la gravedad y arriba gana el giro: el cable queda tenso como una cuerda, y más que nunca en la órbita geoestacionaria.'],
      ['Los escaladores', 'Suben por el cable con la energía de un láser que les llega desde el suelo. A 190 km/h, en ocho días están en la órbita geoestacionaria.'],
    ]);
    tl.caption(2.6, 'Hacia arriba', 'La primera parada es la órbita geoestacionaria. Desde ahí, lo que se suelta más arriba sale lanzado hacia otros planetas.');
    tl.label('arriba').to(2.6, { sube: 1, lr: 8.0 });
    const P = (l: string) => tl.at(l);
    const ease = smoothstep;

    // The spin: the Earth turns once during step 3 (a time-lapse) and stands still otherwise, so the
    // views beside the cable keep it across the screen.
    const theta = (p: number) => Math.PI * 2 * ease(st.start + 2 * st.dur + 0.3, st.start + 3 * st.dur - 0.15, p);
    const R0 = UP0.clone();
    const S0 = R0.clone().cross(V(0, 1, 0)).normalize();
    const sunW = S0.clone().multiplyScalar(0.8).add(V(0, 0.3, 0)).addScaledVector(R0, 0.15).normalize();

    // ------------------------------------------------------------ cameras
    type Vista = { pos: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3; fov: number };
    const along = (r: number, th: number) => UP0.clone().applyAxisAngle(V(0, 1, 0), th).multiplyScalar(r);
    /** Beside the cable, the whole of it in view, tilted a little so it climbs across the screen. */
    function lado(th: number, mid: number, d: number, fov: number, tilt = 0.2, lift = 0): Vista {
      const R = UP0.clone().applyAxisAngle(V(0, 1, 0), th);
      const S = R.clone().cross(V(0, 1, 0)).normalize();
      const target = R.clone().multiplyScalar(mid).add(V(0, lift, 0));
      const pos = target.clone().addScaledVector(S, d).add(V(0, d * 0.1, 0));
      const up = V(0, 1, 0).multiplyScalar(Math.cos(tilt)).addScaledVector(R, -Math.sin(tilt)).normalize();
      return { pos, target, up, fov };
    }
    /** From above the North Pole, a little to one side: the Earth and its cable turning like a sling. */
    function arriba(): Vista {
      const th0 = 0;
      const R = UP0.clone().applyAxisAngle(V(0, 1, 0), th0);
      const S = R.clone().cross(V(0, 1, 0)).normalize();
      const target = V(0, 0, 0);
      const pos = V(0, 23, 0).addScaledVector(S, 6).addScaledVector(R, -2);
      return { pos, target, up: R.clone(), fov: 34 };
    }
    /** Riding up the ribbon, just off it, looking up along it. */
    /** Riding up beside the ribbon: it stands up the frame, the Earth curving away below; look −1 turns down to the Earth. */
    function montado(r: number, th: number, look: number): Vista {
      const R = UP0.clone().applyAxisAngle(V(0, 1, 0), th);
      const S = R.clone().cross(V(0, 1, 0)).normalize();
      const off = 0.16 + 0.12 * (r - 1);
      const pos = R.clone().multiplyScalar(r).addScaledVector(S, off).add(V(0, 0.04, 0));
      const level = R.clone().multiplyScalar(r + lerp(-0.45, 1.2, Math.max(0, look))).addScaledVector(S, off * 0.15);
      const down = Math.max(0, -look);
      const target = level.lerp(V(0, 0, 0), down);
      const up = R.clone().lerp(V(0, 1, 0), smoothstep(0.3, 0.9, down)).normalize();
      return { pos, target, up, fov: lerp(60, 50, down) };
    }
    const TOMAS: Vista[] = [
      lado(0, 8.0, 24, 30),
      lado(0, 8.0, 24, 30),
      arriba(),
      lado(0, 8.0, 24, 30),
      lado(0, 3.6, 9.5, 34, 0.16, 0.15),
    ];
    const blend = (a: Vista, b: Vista, t: number): Vista => {
      const da = a.pos.clone().sub(a.target);
      const db = b.pos.clone().sub(b.target);
      const dir = da.clone().normalize().lerp(db.clone().normalize(), t).normalize();
      const d = Math.exp(lerp(Math.log(da.length()), Math.log(db.length()), t));
      const target = a.target.clone().lerp(b.target, t);
      return { pos: target.clone().addScaledVector(dir, d), target, up: a.up.clone().lerp(b.up, t).normalize(), fov: lerp(a.fov, b.fov, t) };
    };
    const rideR = (p: number) => Math.exp(lerp(Math.log(1.05), Math.log(1.55), ease(P('obra'), st.start, p)));
    const climbR = (p: number) => Math.exp(lerp(Math.log(1.55), Math.log(GEO - 0.15), ease(P('arriba'), P('arriba') + 2.6, p)));
    function camara(p: number): Vista {
      if (p < st.start - 0.6) return montado(rideR(p), 0, 0.12 + 0.13 * ease(P('obra') + 0.6, P('obra') + 2.0, p));
      const k = clamp(st.k(p), 1, 5) - 1;
      const i = Math.min(3, Math.floor(k));
      const inside = blend(TOMAS[i], TOMAS[i + 1], k - i);
      // Drift while reading.
      inside.pos.applyAxisAngle(V(0, 1, 0), (p - st.start) * 0.004);
      if (p < st.start) return blend(montado(rideR(p), 0, 0.25), inside, ease(st.start - 0.6, st.start, p));
      if (p > st.end) return blend(inside, montado(climbR(p), 0, 0.15 - 1.15 * ease(st.end + 0.8, st.end + 2.6, p)), ease(st.end, st.end + 0.9, p));
      return inside;
    }

    const tmp = V();
    return {
      tl,
      listo: earth.listo,
      lectura: (p) => ({ lp: tl.get('lp', p), ly: tl.get('ly', p), lr: tl.get('lr', p) }),
      rotulo: (p) => tl.captionAt(p),
      update(f: Frame) {
        const { camera, p, time } = f;
        const th = theta(p);
        body.rotation.set(0, th, 0);
        body.updateMatrixWorld(true);
        const v = camara(p);
        // The rides and the side views turn with the Earth (only step 3 looks from outside).
        const rot = p < st.start + 2 * st.dur || p > st.start + 3 * st.dur ? th : 0;
        v.pos.applyAxisAngle(V(0, 1, 0), rot);
        v.target.applyAxisAngle(V(0, 1, 0), rot);
        v.up.applyAxisAngle(V(0, 1, 0), rot);
        camera.position.copy(v.pos);
        camera.up.copy(v.up);
        camera.lookAt(v.target);
        camera.fov = v.fov;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        const inv = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -th, 0));
        earth.update(sunW.clone().applyQuaternion(inv), camera.position.clone().applyQuaternion(inv), 0.42);
        // Climbers: they run up (and a few down) the ribbon; the ride follows the last one.
        const R = UP0.clone().applyAxisAngle(V(0, 1, 0), th);
        for (let i = 0; i < NC; i++) {
          const s = (i / NC + time * 0.01) % 1;
          const r = Math.pow(TOP, i % 3 === 2 ? 1 - s : s);
          B.set(i, tmp.copy(R).multiplyScalar(r), 0.9);
        }
        const ride = p < st.start ? rideR(p) + 0.05 : p > st.end ? climbR(p) + 0.08 : 1 + 2.4 * ease(st.start + 4 * st.dur, st.end, p) + 0.6;
        B.set(NC, tmp.copy(R).multiplyScalar(ride), 1);
        B.commit();
        B.mat.uniforms.uDpr.value = f.dpr;
        const focal = f.H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        for (const n of [rib, ...earth.nubes]) {
          enfocar(n, focal, f.dpr, time);
          n.u.uSizeUnit.value = 1;
          n.u.uMinPx.value = 1.4 * f.dpr;
        }
      },
      placa(g: CanvasRenderingContext2D, f: Frame) {
        const { p, W, H, u, camera, time } = f;
        const on = st.on(p);
        // Notes during the ride.
        const th = theta(p);
        const at = (r: number) => along(r, th);
        const proj = (r: number) => pr(at(r), camera, W, H);
        if (on < 0.99) {
          const a = (1 - on) * ease(P('obra') + 0.4, P('obra') + 1.0, p) * (p < st.start ? 1 : 0);
          const q = proj(1.3);
          if (q) nota(g, u, q.x, q.y, 'cinta de nanotubos · 1 m de ancho', 34, -30, a);
          const b2 = (1 - on) * (p > st.end ? ease(st.end + 0.6, st.end + 1.2, p) : 0);
          const g2 = proj(GEO);
          if (g2) nota(g, u, g2.x, g2.y, 'órbita geoestacionaria · 35 786 km', 30, -30, b2);
        }
        if (on < 0.01) return;
        indicador(g, u, W, 'ascensor espacial', st.n, st.k(p), on);
        const kt = st.t(p);
        // Screen geometry of the cable: its direction and the side the arrows sit on.
        const A = proj(1);
        const Bq = proj(TOP);
        if (!A || !Bq) return;
        const len = Math.hypot(Bq.x - A.x, Bq.y - A.y);
        const dx = (Bq.x - A.x) / len;
        const dy = (Bq.y - A.y) / len;
        const nx = -dy;
        const ny = dx;
        const scale = 30 * u / giro(GEO); // px per m/s²: an arrow of 30 at GEO
        const STATIONS = [1.6, 2.2, 3, 4, 5, GEO, 8.3, 10.5, 13, 16];
        const off = (q: P2, d: number) => ({ x: q.x + nx * d * u, y: q.y + ny * d * u });

        // 1 · The cable, measured.
        const w1 = st.win(1, p) + st.win(5, p) * 0.6;
        if (w1 > 0.01) {
          for (let k = 0; k <= 10; k++) {
            const r = 1 + (k * 1e7) / RE;
            const q = proj(r);
            if (!q) continue;
            linea(g, u, [off(q, -5), off(q, 5)], ink(0.5), w1, [], 1);
            if (k % 2 === 0 && k > 0) texto(g, u, off(q, 18).x, off(q, 18).y, `${k * 10} 000 km`, ink(0.6), w1, 9, 'center', false);
          }
          const qg = proj(GEO)!;
          nota(g, u, qg.x, qg.y, 'órbita geoestacionaria · 35 786 km · una vuelta por día', -10, -64, st.win(1, p));
          const qt = proj(TOP)!;
          nota(g, u, qt.x, qt.y, 'contrapeso · 100 000 km', -40, -44, st.win(1, p));
          nota(g, u, A.x, A.y, 'base en el ecuador', 10, 52, st.win(1, p));
          texto(g, u, W / 2, H - 300 * u, 'cable dibujado más grueso de lo que es · la cinta es más delgada que un papel', ink(0.45), st.win(1, p), 9, 'center', false);
        }

        // 2 · Gravity: arrows towards the Earth, long near the ground, almost nothing far away.
        const w2 = st.win(2, p);
        if (w2 > 0.01) {
          for (const r of STATIONS) {
            const q = proj(r);
            if (!q) continue;
            const L = gravedad(r) * scale;
            const cl = Math.min(L, 150 * u);
            const o = off(q, -26);
            flecha(g, u, o, { x: o.x - dx * cl, y: o.y - dy * cl }, '#ff8a6a', w2, 1.6);
            if (L > cl) texto(g, u, o.x - dx * (cl + 30 * u), o.y - dy * (cl + 30 * u) - 2 * u, '≈', '#ff8a6a', w2, 12, 'center', false);
          }
          const q0 = off(proj(1.6)!, -46);
          texto(g, u, q0.x + 6 * u, q0.y - 12 * u, 'gravedad · 6,2 m/s² a 2 000 km', '#ff8a6a', w2 * (st.win(2, p) > 0.2 ? 1 : 0), 9.5, 'left', false);
          const qt = off(proj(13)!, -46);
          texto(g, u, qt.x, qt.y, `${(gravedad(13)).toFixed(2).replace('.', ',')} m/s² a ${km(13)} km`, '#ff8a6a', w2 * (st.win(2, p) > 0.2 ? 1 : 0), 9.5, 'center', false);
        }

        // 3 · The turn: from above, arrows outwards along the spoke, turning with it.
        const w3 = st.win(3, p);
        if (w3 > 0.01) {
          for (const r of STATIONS) {
            const q = proj(r);
            if (!q) continue;
            const L = giro(r) * scale;
            const o = st.win(3, p) > 0.01 ? q : off(q, 26);
            flecha(g, u, o, { x: o.x + dx * L, y: o.y + dy * L }, TEAL, w3, 1.6);
          }
          if (st.win(3, p) > 0.01) {
            const E = pr(V(), camera, W, H)!;
            // The turn itself: an arc around the pole.
            const pts: P2[] = [];
            for (let i = 0; i <= 40; i++) {
              const a = (i / 40) * Math.PI * 1.6 + th;
              const q = pr(UP0.clone().applyAxisAngle(V(0, 1, 0), a).multiplyScalar(2.2), camera, W, H);
              if (q) pts.push(q);
            }
            linea(g, u, pts, ink(0.55), st.win(3, p), [3, 4], 1.2);
            if (pts.length > 2) flecha(g, u, pts[pts.length - 3], pts[pts.length - 1], ink(0.7), st.win(3, p), 1.2);
            texto(g, u, E.x, E.y + 34 * u, 'polo norte', ink(0.6), st.win(3, p), 9, 'center');
            const qf = proj(5.5)!;
            nota(g, u, qf.x, qf.y, 'el giro tira hacia afuera · más fuerte cuanto más lejos', 30, 40, st.win(3, p));
          }
        }

        // 4 · Where they balance; the net pull; the tension, greatest at GEO.
        const w4 = st.win(4, p);
        if (w4 > 0.01) {
          // The tension band around the cable (its half-width follows the tension).
          const band: P2[] = [];
          const back: P2[] = [];
          for (let i = 0; i <= 80; i++) {
            const r = 1 + ((TOP - 1) * i) / 80;
            const q = proj(r);
            if (!q) continue;
            const w = 16 * u * tension(r);
            band.push({ x: q.x + nx * w, y: q.y + ny * w });
            back.unshift({ x: q.x - nx * w, y: q.y - ny * w });
          }
          g.save();
          g.globalAlpha = w4 * ease(4.35, 4.6, kt);
          g.fillStyle = 'rgba(111,227,193,0.16)';
          g.strokeStyle = 'rgba(111,227,193,0.7)';
          g.lineWidth = Math.max(1, u);
          g.beginPath();
          [...band, ...back].forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
          g.closePath();
          g.fill();
          g.stroke();
          g.restore();
          // Net pull per kilogram: down below GEO, out above it.
          for (const r of [1.6, 2.2, 3, 4, 5, 8.3, 10.5, 13, 16]) {
            const q = proj(r);
            if (!q) continue;
            const net = giro(r) - gravedad(r);
            const L = Math.min(Math.abs(net) * scale, 110 * u);
            const col = net > 0 ? TEAL : '#ff8a6a';
            const o = off(q, -62);
            flecha(g, u, o, { x: o.x + dx * L * Math.sign(net), y: o.y + dy * L * Math.sign(net) }, col, w4, 2.6);
          }
          const qg = proj(GEO)!;
          const og = off(qg, -62);
          g.save();
          g.globalAlpha = w4;
          g.strokeStyle = ink(0.9);
          g.lineWidth = Math.max(1, 1.4 * u);
          g.beginPath();
          g.arc(og.x, og.y, 6 * u, 0, Math.PI * 2);
          g.stroke();
          g.restore();
          texto(g, u, og.x, og.y - 24 * u, 'aquí se equilibran', ink(0.95), w4, 10, 'center');
          const ql = off(proj(3.2)!, -92);
          texto(g, u, ql.x, ql.y, 'gana la gravedad', '#ff8a6a', w4, 9.5, 'center');
          const qr = off(proj(12)!, -92);
          texto(g, u, qr.x, qr.y, 'gana el giro', TEAL, w4, 9.5, 'center');
          const qm = off(qg, 44);
          const a2 = w4 * ease(4.5, 4.75, kt);
          texto(g, u, qm.x, qm.y, 'tensión del cable · máxima aquí', TEAL, a2, 10, 'center');
          texto(g, u, qm.x, qm.y + 18 * u, 'pide ~100 GPa · el mejor nanotubo medido: ~50', ink(0.65), a2, 9.5, 'center', false);
        }

        // 5 · Climbers, and the light that powers them (a laser: invisible, drawn).
        const w5 = st.win(5, p);
        if (w5 > 0.01) {
          const rc = 1 + 2.4 * ease(st.start + 4 * st.dur, st.end, p) + 0.6;
          const q = proj(rc);
          const qa = proj(1.0);
          if (q && qa) {
            linea(g, u, [off(qa, 4), off(q, 4)], TEAL, w5 * 0.9, [2, 6], 1.6, time * 50);
            nota(g, u, q.x, q.y, 'escalador · 190 km/h', 24, -34, w5);
            const mid = proj((1 + rc) / 2)!;
            nota(g, u, off(mid, 4).x, off(mid, 4).y, 'láser desde el suelo (invisible)', 24, 40, w5);
          }
          const qg = proj(GEO);
          if (qg) nota(g, u, qg.x, qg.y, 'órbita geoestacionaria · 8 días', -20, -50, w5);
        }
        void D2R;
      },
      dispose() {},
    };
  },
};
