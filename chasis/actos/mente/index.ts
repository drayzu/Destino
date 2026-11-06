import * as THREE from 'three';
import { Timeline } from '../../../estudios/timeline';
import { enfocar, materia, type Nube } from '../../../estudios/motor/materia';
import type { Rotulo } from '../../../estudios/placa';
import { puntoTu } from '../../../estudios/remake';
import type { Camino } from '../../../estudios/chispa';
import type { Acto, EscenaChasis, FrameActo } from '../../tipos';
import { mezclar, toma, vuelo } from '../../toma';
import { V, CORAL, Neurona, bosque, axon } from './mundo';

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

export const mente: EscenaChasis = {
  id: 'mente',
  montar(stage): Acto {
    const root = stage.root;

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
    // (the way bends round as it goes, a wide arc through the network: by the last neuron you are
    // heading back across it, so leaving it you face it whole, with no turn of your own)
    while (cadena.length < 9) {
      dirGeneral.applyAxisAngle(V(0, 1, 0), THREE.MathUtils.degToRad(cadena.length > 1 ? 21 : 0));
      const ultima = cadena[cadena.length - 1];
      // (the nearest that lies ahead, more ahead than aside: flying it, a sharp turn at each neuron
      // swung the view; never none, or the way stopped short)
      const cand = neuronas
        .filter((n) => !usadas.has(n))
        .map((n) => ({ n, d: n.c.distanceTo(ultima.c), a: n.c.clone().sub(ultima.c).normalize().dot(dirGeneral) }))
        .filter((x) => x.d > 0.8 && x.d < 3.4 && x.a > 0.2)
        .sort((x, y) => x.d - 2.5 * x.a - (y.d - 2.5 * y.a))[0];
      if (!cand) break;
      cadena.push(cand.n);
      usadas.add(cand.n);
      dirGeneral = dirGeneral.lerp(cand.n.c.clone().sub(ultima.c).normalize(), 0.15).normalize();
    }
    const ultima = cadena[cadena.length - 1].c;
    // The way you fly (DIRECCION.md, 2): one smooth curve through every neuron of the chain, no corner
    // at any, then out of the last into the black, far, bending round to where our radio goes. The
    // axons you run along are drawn on it.
    // (and out of the last neuron on, climbing as a plane takes off, the network ahead and below)
    const sale = (ade: number, alto: number) => ultima.clone().addScaledVector(dirGeneral, ade).add(V(0, alto, 0));
    const nodos = [...cadena.map((n) => n.c.clone()), sale(1.8, 0.4), sale(3.8, 1.4), sale(5.6, 3.0)];
    const ruta = new THREE.CatmullRomCurve3(nodos, false, 'centripetal');
    const largos = ruta.getLengths(4000);
    /** How far along the way (its length, 0..1) the k-th node is. */
    const uNodo = (k: number) => largos[Math.round((k / (nodos.length - 1)) * 4000)] / largos[4000];
    class Tramo extends THREE.Curve<THREE.Vector3> {
      constructor(private a: number, private c: number) {
        super();
      }
      getPoint(t: number, out = V()) {
        return ruta.getPoint(this.a + (this.c - this.a) * t, out);
      }
    }
    // The axons drawn too (the ones you run along, on the way itself, and others between neighbours).
    const pintarAxon = (cv: THREE.Curve<THREE.Vector3>, luz: number) => {
      const L = cv.getLength();
      const n = Math.round(L * 260);
      for (let i = 0; i < n; i++) {
        const p = cv.getPoint(r());
        b.push(p.x, p.y, p.z, CORAL, 0.006, luz, { kind: 2 });
      }
    };
    for (let k = 0; k + 1 < cadena.length; k++) pintarAxon(new Tramo(k / (nodos.length - 1), (k + 1) / (nodos.length - 1)), 0.22);
    for (const ne of neuronas) {
      const vecina = neuronas.filter((m) => m !== ne).sort((x, y) => x.c.distanceTo(ne.c) - y.c.distanceTo(ne.c))[1 + Math.floor(r() * 2)];
      pintarAxon(axon(ne.c, vecina.c, r), 0.12);
    }
    const camino: Camino = (s, out) => ruta.getPointAt(THREE.MathUtils.clamp(s, 0, 1), out);
    /** s as you leave the last neuron. */
    const sSale = uNodo(cadena.length - 1);
    /** What you look at as you leave: «tú», where it began, in the middle of the network. */
    const medio = V();

    const red = add(
      materia(b.data(), {
        pre: /* glsl */ `uniform float uRed; uniform vec3 uChispa; uniform float uBrota;`,
        move: /* glsl */ `
          // The network comes on round «tú», from near to far.
          float dO = length(p);
          em *= uRed * (1.0 - smoothstep(uBrota - 1.2, uBrota, dO));
          // Each neuron warms as the spark passes (gently: a sharp flare round a spark the camera rides
          // just behind lit the whole frame at once).
          float dC = length(p - uChispa);
          em *= 1.0 + 1.4 * exp(-dC * dC / 0.12);
          // Its own small activity.
          if (aKind < 0.5) em *= 0.8 + 0.2 * sin(uTime * (1.0 + seed * 3.0) + seed * 50.0);
        `,
        // (what passes right by the camera fades instead of filling the frame: a dendrite brushing the
        // lens was a blink of light)
        post: /* glsl */ `
          // (in the network's own units: drawn in the next act's across the seam, it is far smaller)
          float dCam = length(mv.xyz) / max(uEscalaMundo, 1e-30);
          em *= smoothstep(0.012, 0.05, dCam);
          occ *= smoothstep(0.012, 0.05, dCam);
        `,
        uniforms: { uRed: { value: 0 }, uChispa: { value: V() }, uBrota: { value: 0 } },
      }),
    );
    red.u.uFuente.value = 0.35;
    const tu = add(puntoTu(V(), 0.02), 5);

    // ---------------------------------------------------------------- the moments (GUION.md v2, 1–2)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    // The shots: close in on «tú» (chasis/toma.ts); then you are the impulse (`vuelo`): into the
    // neuron and along the axons, faster and faster, each neuron warming as you reach it; out into the
    // black at full speed, and as you go you turn round to see the whole network lit behind you, going
    // away until it is a point.
    tl.set({ cx: 0, cy: 0, cz: 0, az: 20, el: 8, ld: 1.0, roll: 0, fov: 40, mx: 0, my: 0, red: 0, brota: 0, tu: 1, cue: 1, sc: 0, on: 0, lw: 0, vel: 0, fp: 0, vm: 0, vh: 0 });

    tl.label('pensamiento').caption(4.0, 'Un pensamiento', 'Estás pensando. Eso cuesta unos veinte vatios.');
    luego(0.5, 1.4, { cue: 0 });
    luego(1.0, 3.0, { red: 1, brota: 7 });
    tl.to(4.0, { ld: -0.4, az: 34, el: 12 });

    tl.label('apaga').caption(6.4, 'Se apaga contigo', 'Ese pensamiento vive en ti, y se apaga contigo. A menos que algo lo lleve más lejos.');
    luego(0.2, 1.4, { fp: 1, tu: 0 });
    luego(0.4, 1.0, { vh: 0.035 });
    // (the network lights further out as you go through it: lit only round «tú», the way out was dark)
    luego(1.6, 4.4, { brota: 16 });
    luego(1.2, 2.4, { vel: 0.15 });
    luego(3.6, 2.8, { vel: 0.45 });
    tl.wait(6.4);
    tl.label('fuera');
    tl.wait(1.6);
    // The pace, written as a curve with no step in it (keys every tenth of a beat): from rest at «tú»,
    // faster and faster through the network (as t^2.2), and on out of it at the pace it had, easing.
    const a = tl.at('apaga') + 0.2;
    const f = tl.at('fuera') - 0.6;
    const fin = f + 1.6;
    const v0 = (sSale * 1.5) / (f - a);
    const sc = (t: number) => {
      if (t <= f) return sSale * (Math.max(0, t - a) / (f - a)) ** 1.5;
      // (a cubic from the network's pace to rest at the way's end)
      const T = fin - f;
      const x = Math.min(1, (t - f) / T);
      const x2 = x * x;
      const x3 = x2 * x;
      return sSale * (2 * x3 - 3 * x2 + 1) + T * v0 * (x3 - 2 * x2 + x) + (-2 * x3 + 3 * x2);
    };
    for (let t = a; t <= fin + 1e-9; t += 0.1) tl.keyAt(+t.toFixed(3), { sc: sc(t) });
    // As you leave you turn round to the network (the gaze onto its middle), and the camera goes over
    // to drawing back from it, in powers of ten, until it is a point (the next act's Sun takes it there).
    const tVuelta = f + 1.3;
    const lugar = ruta.getPointAt(sc(tVuelta)).add(V(0, 0.035, 0)).sub(medio);
    const az0 = THREE.MathUtils.radToDeg(Math.atan2(lugar.x, lugar.z));
    const el0 = THREE.MathUtils.radToDeg(Math.asin(lugar.y / lugar.length()));
    // (the turn an even one, over two beats and more: written at an even pace, not eased at its ends)
    // (the gaze settles on the network's middle as it leaves)
    tl.keyAt(f - 0.8, { vm: 0, cx: medio.x, cy: medio.y, cz: medio.z }).keyAt(f + 0.8, { vm: 0.85 }).keyAt(tVuelta + 0.2, { vm: 1 });
    tl.keyAt(f + 0.7, { fp: 1 }).keyAt(tVuelta, { az: az0, el: el0, ld: Math.log10(lugar.length()) });
    tl.keyAt(tVuelta + 0.6, { fp: 0 });
    tl.keyAt(tl.length, { az: az0 + 8, el: el0 + 4, ld: Math.log10(90) });
    luego(-1.5, 1.4, { red: 0.9 });

    const enOrbita = { pos: V(), quat: new THREE.Quaternion(), fov: 40, dist: 1, lw: 0 };
    const grupo = root as THREE.Group;
    return {
      id: 'mente',
      tl,
      grupo,
      cerca: 1e-4,
      lejos: 400,
      // (it ends looking at «tú», the network's middle, from 90 away: a point; the next act's Sun)
      salida: { pos: V(), escala: 90 },
      film: { strength: 0.75, radius: 0.6, threshold: 0.45, exposure: 1.1 },
      presencias: ['red', 'tu', 'cue', 'on'],
      // (where you are: what warms the neurons as you pass)
      guia(p, out) {
        camino(tl.get('sc', p), out);
        return true;
      },
      camara(p, _ch, out) {
        const fp = tl.get('fp', p);
        if (fp <= 0) {
          toma(tl, p, null, out);
          return;
        }
        vuelo(tl, p, ruta, out, { pista: 'sc', adelante: 0.08, alabeo: 20 });
        if (fp < 1) mezclar(toma(tl, p, null, enOrbita), out, fp, out);
      },
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
      update(f: FrameActo) {
        const p = f.p;
        const t = f.time;
        red.u.uRed.value = tl.get('red', p);
        red.u.uBrota.value = tl.get('brota', p);
        if (f.guia) red.u.uChispa.value.copy(f.guia);
        // («tú» gives way as the camera goes through it after the spark: its dots, met at the lens, were
        // a burst of teal)
        const dTu = f.camera.position.length();
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.22 * Math.sin(t * 1.5)) * THREE.MathUtils.smoothstep(dTu, 0.16, 0.34);
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        red.u.uMaxPx.value = 5 * f.dpr;
      },
    };
  },
};
