import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { sol as solH } from '../src/horizontes';
import { TEAL, potencia, puntoTu } from './remake';
import { aplicarToma, toma } from './rig';
import { crearChispa, type Camino } from './chispa';
import { LEJOS, enjambreNube } from './mercurio';
import { angulos } from './rig';
import type { Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scenes 14–15 of ESCALETA.md, «La vela» and «La nave-mundo» (GUION.md, moments 32–35).
 *
 * From the Sun in its swarm, a beam of teal light pushes a sail of a few grams; the camera rides
 * behind it. The Sun falls away; at a fifth of the speed of light the sky bends: the stars crowd
 * ahead, bluer, and redden behind (aberration and Doppler, computed), while dust streaks past.
 * Alpha Centauri A and B come up ahead, two suns; the sail opens wide and brakes on their light.
 * Then something enormous passes, slowly: a ship that is a world, its wheels turning, and among its
 * lights, the point.
 *
 * Units: solar radii at the start (the Sun's scene hands over in them); the sail at the origin,
 * flying towards +Z. Distances to the stars are drawn short and move in logarithm.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const S0 = V(0, -1.2, -14);

/** The sky: stars at «infinity» (a sphere far away), coloured by their temperature. */
function cieloDatos(): MateriaData {
  const b = materiaBuilder(181);
  const c = new THREE.Color();
  for (let i = 0; i < 60000; i++) {
    const [x, y, z] = b.onSphere();
    const t = b.r();
    c.setRGB(1, 0.84, 0.66).lerp(new THREE.Color(0.72, 0.82, 1), t);
    b.push(x * 9000, y * 9000, z * 9000, c, 1, 0.25 + 0.75 * b.r() * b.r());
  }
  return b.data();
}

/** The sail: a thin square of teal light with a chip at its middle (its own units: the sail is 1 across). */
function velaDatos(): MateriaData {
  const b = materiaBuilder(191);
  for (let i = 0; i < 14000; i++) {
    const x = b.r() - 0.5;
    const y = b.r() - 0.5;
    const borde = Math.max(Math.abs(x), Math.abs(y)) > 0.48;
    b.push(x, y, 0, borde ? TEAL : new THREE.Color(0.7, 0.92, 0.88), 0.006, borde ? 0.9 : 0.16);
  }
  for (let i = 0; i < 300; i++) b.push(gauss(b.r) * 0.02, gauss(b.r) * 0.02, 0.01, 0xffffff, 0.006, 1.2);
  return b.data();
}

/** Interstellar dust that streams past (`aKind` phase; `aOff` place round the path). */
function polvoDatos() {
  const b = materiaBuilder(193);
  const off: number[] = [];
  for (let i = 0; i < 9000; i++) {
    b.push(0, 0, 0, new THREE.Color(0.75, 0.82, 0.9), 0.0015, 0.5, { kind: b.r() });
    const a = b.r() * Math.PI * 2;
    const q = 0.02 + Math.sqrt(b.r()) * 0.5;
    off.push(Math.cos(a) * q, Math.sin(a) * q);
  }
  return { data: b.data(), off: new Float32Array(off) };
}

/**
 * The ship that is a world (its own units: 1 long, along +Z): a spine, four wheels that turn, a
 * radiator fin and a shield at its bow. `aKind`: 0 spine, 1 wheel (turns), 2 light, 3 radiator.
 */
function naveDatos(): MateriaData {
  const b = materiaBuilder(197);
  const r = b.r;
  for (let i = 0; i < 9000; i++) {
    const z = r() - 0.5;
    const a = r() * Math.PI * 2;
    b.push(Math.cos(a) * 0.012, Math.sin(a) * 0.012, z, new THREE.Color(0.6, 0.66, 0.75), 0.002, 0.14, { kind: 0 });
  }
  for (const zc of [-0.3, -0.1, 0.1, 0.3]) {
    for (let i = 0; i < 9000; i++) {
      const a = r() * Math.PI * 2;
      const rr = 0.13 + gauss(r) * 0.004;
      const ancho = (r() - 0.5) * 0.03;
      const luz = r() < 0.08;
      b.push(Math.cos(a) * rr, Math.sin(a) * rr, zc + ancho, luz ? new THREE.Color(1.0, 0.82, 0.55) : new THREE.Color(0.55, 0.62, 0.72), 0.002, luz ? 0.9 : 0.1, { kind: luz ? 2 : 1, delay: zc });
    }
    // Spokes.
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      for (let i = 0; i < 300; i++) {
        const q = 0.012 + r() * 0.118;
        b.push(Math.cos(a) * q, Math.sin(a) * q, zc, new THREE.Color(0.5, 0.56, 0.65), 0.002, 0.1, { kind: 1, delay: zc });
      }
    }
  }
  for (let i = 0; i < 6000; i++) {
    const z = -0.5 + r() * 0.35;
    const x = (r() - 0.5) * 0.5;
    b.push(x, 0, z, new THREE.Color(1.0, 0.4, 0.2), 0.002, 0.06, { kind: 3 });
  }
  for (let i = 0; i < 7000; i++) {
    const a = r() * Math.PI * 2;
    const q = Math.sqrt(r()) * 0.16;
    b.push(Math.cos(a) * q, Math.sin(a) * q, 0.55 - q * q * 1.5, new THREE.Color(0.65, 0.7, 0.78), 0.002, 0.12, { kind: 0 });
  }
  // Its teal lights along the spine.
  for (let i = 0; i < 400; i++) b.push(gauss(r) * 0.005, gauss(r) * 0.005, r() - 0.5, TEAL, 0.004, 1.0, { kind: 2 });
  return b.data();
}

export const vela: Escena = {
  id: 'vela',
  nombre: 'IV · La vela y la nave',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'El láser empuja la vela; a un quinto de la luz el cielo se deforma; frena con la luz de Alfa Centauri; pasa una nave que es un mundo.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.55;
    stage.renderer.toneMappingExposure = 1.05;

    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root, orden = 5) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };
    // The Sun and its swarm, falling behind.
    const casa = new THREE.Group();
    root.add(casa);
    const sol = solH({ puntos: 200000, corona: 90000 });
    casa.add(sol.group);
    const enjambre = add(enjambreNube(false), casa, 10);
    enjambre.u.uCubre.value = 1;
    // Alpha Centauri A and B, ahead.
    const alfa = new THREE.Group();
    root.add(alfa);
    const A = solH({ puntos: 220000, corona: 90000, semilla: 7 });
    const B = solH({ puntos: 160000, corona: 60000, semilla: 11, estilo: 'viva' });
    A.group.scale.setScalar(1.22);
    B.group.scale.setScalar(0.86);
    B.group.position.set(6.5, 1.2, 4);
    alfa.add(A.group, B.group);

    const cielo = add(materia(cieloDatos()), root, 1);
    cielo.u.uFuente.value = 1;
    const velaG = new THREE.Group();
    root.add(velaG);
    const velaN = add(materia(velaDatos(), { pre: `uniform float uLuzA;`, move: `em *= 1.0 + uLuzA * 2.5 * step(0.5, length(em));`, uniforms: { uLuzA: { value: 0 } } }), velaG, 6);
    velaN.u.uFuente.value = 0.4;
    // The beam that pushes it, from the swarm.
    const hazB = materiaBuilder(199);
    for (let i = 0; i < 12000; i++) hazB.push(gauss(hazB.r) * 0.004, gauss(hazB.r) * 0.004, hazB.r(), TEAL, 0.004, 0.5, { kind: hazB.r() });
    const haz = add(
      materia(hazB.data(), {
        pre: /* glsl */ `uniform vec3 uDesde; uniform float uHaz;`,
        move: /* glsl */ `
          p = mix(uDesde, vec3(0.0, 0.0, -0.002), position.z) + vec3(position.xy * (1.0 + 30.0 * (1.0 - position.z)), 0.0);
          em *= uHaz * (0.4 + 0.6 * smoothstep(0.86, 1.0, fract(position.z * 6.0 - uTime * 2.0)));
        `,
        uniforms: { uDesde: { value: S0.clone() }, uHaz: { value: 0 } },
      }),
      root,
      4,
    );
    haz.u.uFuente.value = 0.5;
    const pd = polvoDatos();
    const polvo = add(
      materia(pd.data, {
        pre: /* glsl */ `attribute vec2 aOff; uniform float uPolvo, uVel;`,
        move: /* glsl */ `
          float zz = fract(aKind - uTime * uVel) * 4.0 - 2.0;
          p = vec3(aOff.x, aOff.y, zz);
          em *= uPolvo * (1.0 - smoothstep(1.2, 2.0, abs(zz)));
        `,
        uniforms: { uPolvo: { value: 0 }, uVel: { value: 0.4 } },
        extra: { aOff: [pd.off, 2] },
      }),
      root,
      3,
    );
    polvo.u.uFuente.value = 0.6;
    const naveG = new THREE.Group();
    root.add(naveG);
    const nave = add(
      materia(naveDatos(), {
        pre: /* glsl */ `uniform float uNave;`,
        move: /* glsl */ `
          if (aKind > 0.5 && aKind < 2.5 && abs(p.z - aDelay) < 0.03) {
            float ag = uTime * 0.3;
            p.xy = vec2(cos(ag) * p.x - sin(ag) * p.y, sin(ag) * p.x + cos(ag) * p.y);
          }
          em *= uNave;
        `,
        uniforms: { uNave: { value: 0 } },
      }),
      naveG,
      6,
    );
    nave.u.uFuente.value = 0.4;
    const tu = add(puntoTu(V(0.02, 0.135, 0.1), 0.006), naveG, 7);
    const chispa = crearChispa();
    root.add(chispa.nube.points);
    const eco = crearChispa();
    root.add(eco.nube.points);

    const listo = Promise.all([sol.listo, A.listo, B.listo]);

    // ---------------------------------------------------------------- the moments (GUION.md 32–35)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    // Where the Sun's scene leaves the camera (sol.ts, «tipo»): relative to the Sun, here S0.
    tl.set({ cx: S0.x, cy: S0.y, cz: S0.z, ox: 0, oy: 0, oz: 0, az: angulos(LEJOS).az + 150, el: 30, ld: 2.2, yaw: 90, pitch: -90, roll: 0, fov: 34, haz: 0, lsol: Math.log10(14), lcen: 4.5, beta: 0, polvo: 0, abre: 1, luzA: 0, nave: 0, tu: 0, nz: -3, eco: 0, ecoS: 0, chH: 0, salta: 0 });

    tl.label('velas').caption(5.6, 'Velas de luz', 'Para ir a otra estrella, un láser empuja una vela de pocos gramos. En minutos va a un quinto de la luz.');
    tl.with(1.2, { cx: 0, cy: 0, cz: 0 });
    luego(1.4, 1.2, { haz: 1 });
    luego(1.6, 1.6, { chH: 1 });
    tl.to(3.0, { az: 28, el: 12, ld: -1.1, fov: 46 });
    luego(0.2, 2.6, { lsol: 2.6, polvo: 1 });
    tl.to(2.6, { az: 40, el: 10, ld: -1.2 });

    tl.label('quinto').caption(5.8, 'A un quinto de la luz', 'Veinte años hasta Alfa Centauri. A esta velocidad el cielo se deforma: adelante, azul; atrás, rojo.');
    tl.with(1.0, { haz: 0 });
    tl.with(3.0, { beta: 0.2, lsol: 4.2 });
    tl.to(2.6, { az: 120, el: 8, ld: -1.15, fov: 60 });
    tl.to(3.2, { az: 178, el: 6, ld: -1.25, fov: 66 });

    // The wall: light is slow. An echo goes home, so slowly the camera slows with it.
    tl.label('lenta').caption(6.0, 'La luz es lenta', 'Cada mensaje a casa tarda más de cuatro años. Allá solo saben de nosotros lo que fuimos.');
    tl.with(0.8, { eco: 1 });
    tl.with(6.0, { ecoS: 1 });
    tl.to(6.0, { az: 200, el: 12, ld: -1.0, fov: 54 });

    tl.label('freno').caption(6.0, 'Frenar con su luz', 'Al llegar no hay con qué frenar. Una vela más grande usa la luz de la estrella como freno.');
    tl.with(3.6, { lcen: 1.35, beta: 0.03 });
    luego(1.4, 2.4, { abre: 5, luzA: 1 });
    luego(3.0, 2.0, { polvo: 0 });
    tl.to(6.0, { az: 160, el: 16, ld: -0.6, fov: 50 });

    // Something enormous passes, slowly.
    tl.label('nave').caption(6.2, 'Naves que son mundos', 'El viaje dura siglos. Quien llega es nieto de los nietos de quien salió: alguien como tú, que nunca vio la Tierra.');
    tl.with(1.6, { nave: 1 });
    luego(2.0, 1.4, { salta: 1 });
    luego(3.2, 1.0, { tu: 1 });
    tl.to(6.2, { nz: 0.6, cx: 0.9, cy: 0.1, cz: 0.2, az: 120, el: 10, ld: -0.35, fov: 40 });

    const tm = toma(tl, 0);
    const velV = V();
    const fwd = V(0, 0, 1);
    return {
      tl,
      listo,
      entrada: { pos: S0.clone(), escala: 1 },
      salida: { pos: V(0.9, 0.1, 0.2), escala: 0.05 },
      escalera: false,
      cuenta(p) {
        if (p < tl.at('nave')) return potencia(26.7, 'vela · ');
        return potencia(27.4);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'IV · Estrellas vecinas', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-5;
        camera.far = 30000;
        aplicarToma(camera, toma(tl, p, tm));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        // The Sun falls behind and Alpha Centauri comes up ahead, both in logarithm.
        const dSol = Math.pow(10, tl.get('lsol', p));
        casa.position.set(S0.x * (dSol / 14), S0.y * (dSol / 14), -dSol);
        const dCen = Math.pow(10, tl.get('lcen', p));
        alfa.position.set(-3, 1.5, dCen);
        haz.u.uDesde.value.copy(casa.position).add(V(0, 0, 3.2));
        const camC = camera.position.clone().sub(casa.position);
        sol.u.uBrillo.value = 2.2 * (1 - 0.86 * THREE.MathUtils.smoothstep(camC.length(), 2.6, 3.9));
        sol.update({ sol: V(1, 0, 0), camara: camC, focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        enjambre.u.uCam.value.copy(camC);
        const camA = camera.position.clone().sub(alfa.position);
        A.u.uBrillo.value = 2.6;
        B.u.uBrillo.value = 1.4;
        A.update({ sol: V(1, 0, 0), camara: camA.clone().divideScalar(1.22), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        B.update({ sol: V(1, 0, 0), camara: camA.clone().sub(B.group.position).divideScalar(0.86), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        alfa.visible = dCen < 20000;

        // Aberration and Doppler for the sky: our speed along +Z, in view space.
        const beta = tl.get('beta', p);
        velV.copy(fwd).transformDirection(camera.matrixWorldInverse);
        cielo.u.uBeta.value = beta;
        cielo.u.uVelV.value.copy(velV);
        polvo.u.uPolvo.value = tl.get('polvo', p);
        polvo.u.uVel.value = 0.15 + beta * 4;
        velaG.scale.setScalar(0.02 * tl.get('abre', p));
        velaN.u.uSizeUnit.value = velaG.scale.x;
        velaN.u.uLuzA.value = tl.get('luzA', p);
        haz.u.uHaz.value = tl.get('haz', p);
        naveG.position.set(0.9, 0.1, 0.2 + tl.get('nz', p));
        // The spark: along the beam from the swarm into the sail, then on the sail, then a jump to the ship.
        const desde = casa.position.clone().add(V(0, 0, 3.2));
        const enVela = V(0, 0, 0.004);
        const enNave = naveG.position.clone().add(V(0.02, 0.135, 0.1));
        const caminoCh: Camino = (sv, out) => (sv <= 1 ? out.copy(desde).lerp(enVela, Math.max(0, sv) ** 0.5) : out.copy(enVela).lerp(enNave, Math.min(1, sv - 1)));
        const chS = Math.min(1, tl.get('chH', p)) + tl.get('salta', p);
        chispa.update(caminoCh, chS, 0.004, 1, 0, camera.position, f.focal, f.dpr, f.time);
        // The echo home: from the sail back towards the Sun, slow.
        const caminoEco: Camino = (sv, out) => out.copy(enVela).lerp(casa.position, Math.max(0, sv) * 0.25);
        eco.update(caminoEco, tl.get('ecoS', p), 0.002, tl.get('eco', p) * (1 - tl.get('salta', p)), 0, camera.position, f.focal, f.dpr, f.time);
        naveG.scale.setScalar(1);
        naveG.rotation.y = 0.15;
        nave.u.uNave.value = tl.get('nave', p);
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.25 * Math.sin(t * 1.5)) * tl.get('nave', p);
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        cielo.u.uMaxPx.value = 2.6 * f.dpr;
        polvo.u.uMaxPx.value = 3 * f.dpr;
      },
      dispose() {},
    };
  },
};
