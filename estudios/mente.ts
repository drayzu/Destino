import { DIR_VOZ } from './apertura';
import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import type { Rotulo } from './placa';
import { TEAL, puntoTu } from './remake';
import { aplicarToma, toma } from './rig';
import { crearChispa, montar, type Camino } from './chispa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * The opening of GUION.md v2, moments 1–2: «Un pensamiento» and «Se apaga contigo».
 *
 * Black, and the point that breathes. The camera comes close and the point is a neuron: its
 * dendrites branch out round it, and other neurons light up in the dark. Out of the point comes the
 * spark, your thought, and the camera gets on it: from neuron to neuron along their axons, each one
 * flaring as it passes, faster and faster, until it leaves the network into the black.
 *
 * Units: about a neuron's reach.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CORAL = new THREE.Color(1.0, 0.56, 0.45);
const BLANCA = new THREE.Color(1.0, 0.86, 0.76);

interface Neurona {
  c: THREE.Vector3;
}

/** Neurons in a volume, each with its dendrites (branching), and an axon to a neighbour. */
function bosque() {
  const b = materiaBuilder(301);
  const r = b.r;
  const neuronas: Neurona[] = [];
  // The first one, «tú», at the origin; the rest round it.
  neuronas.push({ c: V() });
  while (neuronas.length < 110) {
    const p = V((r() - 0.5) * 9, (r() - 0.5) * 5, (r() - 0.5) * 9);
    if (neuronas.every((n) => n.c.distanceTo(p) > 0.9)) neuronas.push({ c: p });
  }
  const rama = (desde: THREE.Vector3, dir: THREE.Vector3, largo: number, nivel: number) => {
    const fin = desde.clone().addScaledVector(dir, largo);
    const n = Math.max(4, Math.round(largo * 180));
    for (let i = 0; i < n; i++) {
      const t = r();
      const p = desde.clone().lerp(fin, t);
      b.push(p.x + gauss(r) * 0.004, p.y + gauss(r) * 0.004, p.z + gauss(r) * 0.004, CORAL, 0.006, 0.16 + 0.1 * (4 - nivel), { kind: 1 });
    }
    if (nivel < 4) {
      const hijas = 2;
      for (let k = 0; k < hijas; k++) {
        const d2 = dir.clone().add(V(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.55)).normalize();
        rama(fin, d2, largo * (0.55 + r() * 0.2), nivel + 1);
      }
    }
  };
  for (const ne of neuronas) {
    // The body: a bright knot.
    for (let i = 0; i < 70; i++) {
      const [x, y, z] = b.onSphere();
      const q = Math.cbrt(r()) * 0.05;
      b.push(ne.c.x + x * q, ne.c.y + y * q, ne.c.z + z * q, BLANCA, 0.012, 0.9, { kind: 0 });
    }
    for (let k = 0; k < 6; k++) {
      const [x, y, z] = b.onSphere();
      rama(ne.c, V(x, y, z), 0.32 + r() * 0.2, 1);
    }
  }
  return { b, neuronas };
}

/** An axon between two neurons: a soft curve. */
function axon(a: THREE.Vector3, c: THREE.Vector3, r: () => number) {
  const mid = a.clone().add(c).multiplyScalar(0.5).add(V(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.35));
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, c.clone());
}

export const mente: Escena = {
  id: 'mente',
  nombre: 'Apertura · Un pensamiento',
  estilos: [{ key: '1', nombre: 'Guion v2', nota: 'El punto es una neurona; de él sale la chispa, tu pensamiento, y la cámara la sigue de neurona en neurona hasta salir.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.75;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.45;
    stage.renderer.toneMappingExposure = 1.1;

    const nubes: Nube[] = [];
    const add = (n: Nube, orden = 0) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      root.add(n.points);
      nubes.push(n);
      return n;
    };
    const { b, neuronas } = bosque();
    const r = b.r;
    // The way the spark takes: from «tú» along axons, eight neurons, then out into the black.
    const cadena: Neurona[] = [neuronas[0]];
    const usadas = new Set<Neurona>([neuronas[0]]);
    let dirGeneral = V(0.3, 0.15, -1).normalize();
    while (cadena.length < 9) {
      const ultima = cadena[cadena.length - 1];
      const cand = neuronas
        .filter((n) => !usadas.has(n))
        .map((n) => ({ n, d: n.c.distanceTo(ultima.c), a: n.c.clone().sub(ultima.c).normalize().dot(dirGeneral) }))
        .filter((x) => x.d < 2.6 && x.a > 0.2)
        .sort((x, y) => x.d - x.a - (y.d - y.a))[0];
      if (!cand) break;
      cadena.push(cand.n);
      usadas.add(cand.n);
      dirGeneral = dirGeneral.lerp(cand.n.c.clone().sub(ultima.c).normalize(), 0.3).normalize();
    }
    const curvas: THREE.Curve<THREE.Vector3>[] = [];
    for (let i = 0; i + 1 < cadena.length; i++) curvas.push(axon(cadena[i].c, cadena[i + 1].c, r));
    const ultima = cadena[cadena.length - 1].c;
    // (out of the last neuron, bending round to the way the next act's spark sets off: no turn at
    // the change of act)
    const finVoz = ultima.clone().addScaledVector(dirGeneral, 3.5).addScaledVector(DIR_VOZ, 5.5);
    curvas.push(new THREE.CubicBezierCurve3(ultima.clone(), ultima.clone().addScaledVector(dirGeneral, 3.0), finVoz.clone().addScaledVector(DIR_VOZ, -3.2), finVoz));
    // The axons drawn too (the ones the spark takes, and others between neighbours).
    const pintarAxon = (cv: THREE.Curve<THREE.Vector3>, luz: number) => {
      const L = cv.getLength();
      const n = Math.round(L * 260);
      for (let i = 0; i < n; i++) {
        const p = cv.getPoint(r());
        b.push(p.x, p.y, p.z, CORAL, 0.006, luz, { kind: 2 });
      }
    };
    for (let i = 0; i + 1 < curvas.length; i++) pintarAxon(curvas[i], 0.22);
    for (const ne of neuronas) {
      const vecina = neuronas.filter((m) => m !== ne).sort((x, y) => x.c.distanceTo(ne.c) - y.c.distanceTo(ne.c))[1 + Math.floor(r() * 2)];
      pintarAxon(axon(ne.c, vecina.c, r), 0.12);
    }
    const ruta = new THREE.CurvePath<THREE.Vector3>();
    for (const c of curvas) ruta.add(c);
    const largoRed = curvas.slice(0, -1).reduce((x, c) => x + c.getLength(), 0);
    const largoTotal = largoRed + curvas[curvas.length - 1].getLength();
    const camino: Camino = (s, out) => out.copy(ruta.getPointAt(THREE.MathUtils.clamp(s, 0, 1)));
    /** s at the moment the spark leaves the last neuron. */
    const sSale = largoRed / largoTotal;

    const red = add(
      materia(b.data(), {
        pre: /* glsl */ `uniform float uRed; uniform vec3 uChispa; uniform float uBrota;`,
        move: /* glsl */ `
          // The network comes on round «tú», from near to far.
          float dO = length(p);
          em *= uRed * (1.0 - smoothstep(uBrota - 1.2, uBrota, dO));
          // Each neuron flares as the spark passes.
          float dC = length(p - uChispa);
          em *= 1.0 + 3.0 * exp(-dC * dC / 0.08);
          // Its own small activity.
          if (aKind < 0.5) em *= 0.7 + 0.3 * sin(uTime * (1.0 + seed * 3.0) + seed * 50.0);
        `,
        uniforms: { uRed: { value: 0 }, uChispa: { value: V() }, uBrota: { value: 0 } },
      }),
    );
    red.u.uFuente.value = 0.35;
    const tu = add(puntoTu(V(), 0.02), 5);
    const chispa = crearChispa();
    root.add(chispa.nube.points);

    // ---------------------------------------------------------------- the moments (GUION.md v2, 1–2)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: 20, el: 8, ld: 1.0, yaw: 90, pitch: -90, roll: 0, fov: 40, red: 0, brota: 0, tu: 1, cue: 1, sc: 0, on: 0, lw: 0, vel: 0 });

    tl.label('pensamiento').caption(4.0, 'Un pensamiento', 'Estás pensando. Eso cuesta unos veinte vatios.');
    luego(0.5, 1.4, { cue: 0 });
    luego(1.0, 3.0, { red: 1, brota: 7 });
    tl.to(4.0, { ld: -0.4, az: 34, el: 12 });

    tl.label('apaga').caption(6.4, 'Se apaga contigo', 'Ese pensamiento vive en ti, y se apaga contigo. A menos que algo lo lleve más lejos.');
    tl.with(0.6, { on: 1 });
    tl.with(1.2, { lw: 1 });
    // Faster and faster: slow at the first neuron, quick at the last.
    tl.to(1.6, { sc: 0.04 });
    tl.to(2.4, { sc: 0.3, vel: 0.15 });
    tl.to(2.4, { sc: sSale, vel: 0.45 });
    tl.label('fuera');
    tl.to(1.6, { sc: 1, vel: 0.2, red: 0.15 });

    const tm = toma(tl, 0);
    const fin = montar(camino, 1, 0.009, 0.02, 0.085, V(0, 1, 0), 0.03);
    return {
      tl,
      salida: { pos: camino(1, V()), escala: fin.lugar.distanceTo(camino(1, V())) },
      escalera: false,
      cuenta() {
        return { pisos: ['20'], unidad: 'W', linea: 'tú, pensando', h: 1 };
      },
      anio() {
        return 2026;
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: '', name: c.name, fact: c.fact } : null;
      },
      efectos(p) {
        return { vel: tl.get('vel', p) };
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-4;
        camera.far = 100;
        const sc = tl.get('sc', p);
        // Riding the spark: just behind it, a little above, looking ahead.
        // (round each neuron in a wide curve: the spark turns sharply there, the camera need not;
        // and high enough to pass over each body, not through it)
        const m = montar(camino, sc, 0.009, 0.02, 0.085, V(0, 1, 0), 0.03);
        aplicarToma(camera, toma(tl, p, tm, { punto: m.mira, peso: tl.get('lw', p), arriba: m.arriba, delante: m.delante }, { punto: m.lugar, peso: tl.get('lw', p) }));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        red.u.uRed.value = tl.get('red', p);
        red.u.uBrota.value = tl.get('brota', p);
        chispa.update(camino, sc, 0.0006, tl.get('on', p), 0, camera.position, f.focal, f.dpr, t);
        red.u.uChispa.value.copy(chispa.pos);
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.22 * Math.sin(t * 1.5));
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        red.u.uMaxPx.value = 5 * f.dpr;
        void TEAL;
      },
      dispose() {},
    };
  },
};
