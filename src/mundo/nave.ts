import * as THREE from 'three';
import { enfocar, geometria, puntos, type Puntos } from '../horizontes';
import { LIVIANO } from '../engine/post';

/**
 * A generation ship (act IV), in points, unlike the habitats: a long truss spine; at its fore end
 * (+Y, where it is going) the fusion engine's magnetic nozzle, turned forward to brake, with the
 * propellant tanks (gold foil) behind it; radiators glowing dull red with the waste heat; two
 * habitat wheels that turn for gravity (their windows lit warm); at the aft end a dish that points
 * home. After the studies of the 1970s–2010s (Enzmann; Daedalus; Project Hyperion).
 *
 * Kilometres, axis along local Y. `fijo` holds what does not turn; `giro` the wheels (the act turns
 * it). Lit by a fixed key light, baked into the colours.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const LUZ = V(0.55, 0.35, 0.75).normalize();
/** How dense the hull is (all but the radiators, which read as panels already): sparse, it looked like a sketch. */
const D = LIVIANO ? 1.5 : 3;

class Nube {
  pos: number[] = [];
  col: number[] = [];
  size: number[] = [];
  push(p: THREE.Vector3, c: [number, number, number], s = 0.03) {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(...c);
    this.size.push(s);
  }
  /** A lit surface point: albedo times the key light on its normal, plus some fill. */
  lit(p: THREE.Vector3, n: THREE.Vector3, alb: [number, number, number], s = 0.03, fill = 0.16) {
    const k = fill + (1 - fill) * Math.max(0, n.dot(LUZ));
    this.push(p, [alb[0] * k, alb[1] * k, alb[2] * k], s);
  }
  build() {
    const n = this.size.length;
    return puntos(
      geometria({ position: new Float32Array(this.pos), color: new Float32Array(this.col), size: new Float32Array(this.size), seed: new Float32Array(n), aKind: new Float32Array(n) }),
      { pre: '', cuerpo: '', uniforms: {} },
    );
  }
}

export function naveGeneracional() {
  const fijo = new THREE.Group();
  const giro = new THREE.Group();
  const a = new Nube();
  const b = new Nube();
  const r = Math.random;
  const ACERO: [number, number, number] = [0.42, 0.44, 0.47];

  // The spine: a square truss, its four longerons and their zigzag braces, from the dish to the engine.
  const Y0 = -24;
  const Y1 = 13;
  const w = 0.28;
  const esquinas = [V(w, 0, w), V(-w, 0, w), V(-w, 0, -w), V(w, 0, -w)];
  for (const c of esquinas)
    for (let y = Y0; y < Y1; y += 0.012 / D) a.lit(V(c.x, y, c.z), c.clone().normalize(), ACERO, 0.025);
  for (let k = 0; k < 4; k++) {
    const c0 = esquinas[k];
    const c1 = esquinas[(k + 1) % 4];
    for (let y = Y0; y < Y1; y += 0.8)
      for (let t = 0; t < 1; t += 0.015 / D) {
        const p = c0.clone().lerp(c1, t).setY(y + t * 0.8);
        a.lit(p, c0.clone().add(c1).normalize(), ACERO, 0.025);
      }
  }

  // Inside the truss, a closed box (cables, pipes, the corridor between the wheels): with only the
  // truss, the spine read as see-through.
  for (let i = 0; i < 20000 * D; i++) {
    const k = Math.floor(r() * 4);
    const t = r() * 2 - 1;
    const n = [V(1, 0, 0), V(0, 0, 1), V(-1, 0, 0), V(0, 0, -1)][k];
    const lado = V(-n.z, 0, n.x);
    a.lit(n.clone().multiplyScalar(0.2).addScaledVector(lado, 0.2 * t).setY(Y0 + r() * (Y1 - Y0)), n, [0.12, 0.125, 0.135], 0.025, 0.25);
  }

  // The engine at the fore end: the magnetic nozzle (a bell of coil rings and ribs, open forward),
  // its throat glowing.
  for (let i = 0; i < 30000 * D; i++) {
    const t = r();
    const y = 13 + t * 3.5;
    const rad = 0.5 + 1.8 * t * t;
    const ph = r() * Math.PI * 2;
    const anillo = Math.abs(((t * 7) % 1) - 0.5) > 0.42;
    const costilla = Math.abs(((ph / (Math.PI * 2)) * 16) % 1 - 0.5) > 0.44;
    if (!anillo && !costilla && r() > 0.25) continue;
    const n = V(Math.cos(ph), -0.5 * t, Math.sin(ph)).normalize();
    a.lit(V(Math.cos(ph) * rad, y, Math.sin(ph) * rad), n, anillo || costilla ? [0.22, 0.23, 0.25] : [0.12, 0.125, 0.135], 0.03, 0.22);
  }
  for (let i = 0; i < 1500 * D; i++) {
    const [x, y, z] = [r() - 0.5, r() - 0.5, r() - 0.5].map((v) => v * 0.6);
    a.push(V(x, 13.4 + y, z), [1.4, 1.7, 2.0], 0.04);
  }

  // The propellant (deuterium and helium-3): six long capsule tanks round the spine behind the
  // engine, in white insulation with darker bands, each held to the spine by struts.
  // (points add up: as dense as they are, a dim white reads as the insulation; brighter, they glared)
  const TANQUE: [number, number, number] = [0.3, 0.29, 0.27];
  const RT = 0.62;
  const TY0 = 6.2;
  const TY1 = 11.6;
  for (let k = 0; k < 6; k++) {
    const ang = (k * Math.PI) / 3 + Math.PI / 6;
    const cx = Math.cos(ang) * 1.3;
    const cz = Math.sin(ang) * 1.3;
    for (let i = 0; i < 16000 * D; i++) {
      // body or a domed end, by area
      const w = r();
      let p: THREE.Vector3;
      let n: THREE.Vector3;
      if (w < 0.82) {
        const ph = r() * Math.PI * 2;
        const y = TY0 + r() * (TY1 - TY0);
        n = V(Math.cos(ph), 0, Math.sin(ph));
        p = V(cx + n.x * RT, y, cz + n.z * RT);
      } else {
        n = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
        if (n.lengthSq() > 1 || n.lengthSq() < 1e-4) {
          i--;
          continue;
        }
        n.normalize();
        if (w < 0.91) n.y = Math.abs(n.y);
        else n.y = -Math.abs(n.y);
        p = V(cx + n.x * RT, (n.y > 0 ? TY1 : TY0) + n.y * RT, cz + n.z * RT);
      }
      const banda = Math.abs((((p.y - TY0) / (TY1 - TY0)) * 6) % 1 - 0.5) > 0.44;
      const f = banda ? 0.55 : 0.92 + 0.12 * r();
      a.lit(p, n, [TANQUE[0] * f, TANQUE[1] * f, TANQUE[2] * f], 0.025, 0.2);
    }
    for (const y of [TY0 + 0.6, (TY0 + TY1) / 2, TY1 - 0.6])
      for (let s = 0.3; s < 1.3 - RT; s += 0.012 / D) a.lit(V(Math.cos(ang) * s, y, Math.sin(ang) * s), V(0, 1, 0), ACERO, 0.02, 0.4);
  }

  // Radiators: four long fins from the spine, glowing dull red with the heat they shed.
  for (let k = 0; k < 4; k++) {
    const ang = (k * Math.PI) / 2 + Math.PI / 4;
    const d = V(Math.cos(ang), 0, Math.sin(ang));
    // On a regular grid (scattered at random they read as a haze, not as panels): 0.8 × 1.2 km
    // panels, each its own glow, darker seams between them.
    for (let out = 0.4; out < 7; out += 0.045)
      for (let yy = 0; yy < 9.5; yy += 0.045) {
        const y = -4 + yy - out * 0.25;
        const panel = Math.floor(out / 0.8) * 13 + Math.floor(yy / 1.2);
        const seam = Math.abs(((out / 0.8) % 1) - 0.5) > 0.44 || Math.abs(((yy / 1.2) % 1) - 0.5) > 0.44;
        const calor = (0.75 + 0.5 * Math.abs(Math.sin(panel * 12.9898) % 1)) * (1 - 0.35 * (out / 7)) * (seam ? 0.3 : 1);
        a.push(d.clone().multiplyScalar(out).setY(y), [0.78 * calor, 0.26 * calor, 0.11 * calor], 0.028);
      }
  }

  // The dish at the aft end, pointing home.
  for (let i = 0; i < 22000 * D; i++) {
    const t = Math.sqrt(r());
    const ph = r() * Math.PI * 2;
    const rad = 2.6 * t;
    const y = Y0 - 0.6 * t * t;
    const n = V(-Math.cos(ph) * t * 0.45, -1, -Math.sin(ph) * t * 0.45).normalize();
    const red = Math.abs(((ph / (Math.PI * 2)) * 24) % 1 - 0.5) > 0.44 || Math.abs((t * 5) % 1 - 0.5) > 0.44;
    a.lit(V(Math.cos(ph) * rad, y, Math.sin(ph) * rad), n.negate(), red ? [0.6, 0.62, 0.66] : [0.38, 0.4, 0.43], 0.03, 0.25);
  }
  for (let y = Y0; y > Y0 - 2.4; y -= 0.012 / D) a.push(V(0, y, 0), [0.5, 0.52, 0.55], 0.025);

  // The two habitat wheels (they turn): tubes 600 m thick, 6 km out, on six spokes from a hub; their
  // inner windows lit warm, where people live.
  for (const yc of [-9, -15.5]) {
    for (let i = 0; i < 90000 * D; i++) {
      const u = r() * Math.PI * 2;
      const v = r() * Math.PI * 2;
      const rin = 6 + 0.6 * Math.cos(v);
      const p = V(Math.cos(u) * rin, yc + 0.6 * Math.sin(v), Math.sin(u) * rin);
      const n = V(Math.cos(u) * Math.cos(v), Math.sin(v), Math.sin(u) * Math.cos(v));
      const ventana = Math.abs(Math.cos(v) + 1) < 0.25 && Math.abs((u * 60) % 1 - 0.5) < 0.3;
      if (ventana) b.push(p, [0.6, 0.43, 0.25], 0.028);
      else {
        const seg = Math.abs(((u / (Math.PI * 2)) * 48) % 1 - 0.5) > 0.46;
        b.lit(p, n, seg ? [0.26, 0.27, 0.29] : [0.19, 0.2, 0.22], 0.028, 0.22);
      }
    }
    for (let k = 0; k < 6; k++) {
      const u = (k * Math.PI) / 3;
      for (let s = 0.6; s < 5.4; s += 0.01 / D) b.lit(V(Math.cos(u) * s, yc, Math.sin(u) * s), V(0, 1, 0), ACERO, 0.025, 0.4);
    }
    for (let i = 0; i < 8000 * D; i++) {
      const u = r() * Math.PI * 2;
      const y = yc + (r() - 0.5) * 1.6;
      const n = V(Math.cos(u), 0, Math.sin(u));
      b.lit(V(Math.cos(u) * 0.6, y, Math.sin(u) * 0.6), n, [0.2, 0.21, 0.22], 0.03);
    }
  }

  const fijas = a.build();
  const giran = b.build();
  fijo.add(fijas.points);
  giro.add(giran.points);
  const capas: Puntos[] = [fijas, giran];
  return {
    fijo,
    giro,
    capas,
    /** Its parts, for the labels (km, the ship's frame; the wheels' at their hub, which does not turn). */
    partes: [
      { en: V(0, 16.3, 1.9), texto: 'motor de fusión: apunta adelante para frenar', dx: 30, dy: -56 },
      { en: V(Math.cos(Math.PI / 6) * 1.9, 7.2, Math.sin(Math.PI / 6) * 1.9), texto: 'combustible: deuterio y helio-3', dx: 30, dy: 50 },
      { en: V(Math.cos(Math.PI / 4) * 5, -2, Math.sin(Math.PI / 4) * 5), texto: 'radiadores: botan el calor sobrante', dx: -30, dy: -40 },
      { en: V(0, -12.2, 6.3), texto: 'ruedas: su giro hace de gravedad', dx: -40, dy: 40 },
      { en: V(0, -24.5, 0), texto: 'antena hacia casa', dx: 30, dy: -46 },
    ],
    update(vista: { focal: number; dpr: number }) {
      for (const c of capas) enfocar(c, vista);
    },
  };
}
