import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type Nube } from './motor/materia';
import { redCosmica } from './comun';
import { FONT, ink, type Cuenta, type Rotulo } from './placa';
import { cuantas, enfocarMarcas, marcas, nombres, type Nombre } from './revelar';
import { TEAL, potencia } from './remake';
import { aplicarToma, toma } from './rig';
import { crearChispa, type Camino } from './chispa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scene 20 of ESCALETA.md, «Seis horas» (GUION.md, moments 47–51).
 *
 * The thinking network of scene 19 moves off and its knots become galaxies: the cosmic web. From
 * ours, thousands of threads of teal go out to every galaxy we can reach, in six hours. The web
 * swells (dark energy): the galaxies past the horizon redden and go. Other bubbles, other colours,
 * grow and touch ours; each keeps its share of the sky. All we can reach, type IV; and then what we
 * reach stops growing and empties, until a golden point is left: the last black hole.
 *
 * Units: the web is drawn in a ball of radius 1.6; our horizon (what we can reach) is HOR.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const HOR = 0.8;
const OTRAS = [
  { c: V(1.15, 0.25, -0.5), col: new THREE.Color(1.0, 0.7, 0.32) },
  { c: V(-0.85, -0.4, 0.95), col: new THREE.Color(1.0, 0.45, 0.68) },
  { c: V(-0.4, 0.9, -1.0), col: new THREE.Color(0.78, 0.62, 1.0) },
];

export const cosmos: Escena = {
  id: 'cosmos',
  nombre: 'VII · El cosmos',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'Seis horas: sondas a todas las galaxias alcanzables; la prisa; las otras burbujas; tipo IV; el horizonte que vacía lo nuestro.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.4;
    stage.renderer.toneMappingExposure = 1.1;

    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root, orden = 0) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };
    const web = new THREE.Group();
    web.scale.setScalar(1.6);
    root.add(web);
    const rc = redCosmica(241, 150, (t, out) => out.setRGB(0.82, 0.88, 1.0).multiplyScalar(1 - 0.3 * t));
    const otrasU = OTRAS.map((o) => o.c.clone().divideScalar(1.6));
    const red = add(
      materia(rc.data, {
        pre: /* glsl */ `
          uniform float uRed, uExp, uBur, uOtras, uVacia, uHor;
          uniform vec3 uTeal, uO1, uO2, uO3, uC1, uC2, uC3;
        `,
        move: /* glsl */ `
          // The swell: everything moves out; what crosses our horizon reddens and goes.
          p *= 1.0 + uExp * 1.4;
          float rr = length(p) * 1.6;
          float fuera = smoothstep(uHor * 0.9, uHor * 1.15, rr) * step(0.001, uExp);
          em = mix(em, vec3(0.9, 0.25, 0.12) * length(em), fuera * 0.8);
          em *= 1.0 - 0.85 * fuera * uExp;
          // Ours, teal; the others, theirs.
          float nuestro = (1.0 - smoothstep(uBur - 0.04, uBur, rr)) * step(0.3, fract(seed * 11.7));
          em = mix(em, uTeal * (0.4 + 0.7 * length(em)), nuestro);
          float o1 = (1.0 - smoothstep(uOtras - 0.04, uOtras, length(p * 1.6 - uO1 * 1.6))) * step(0.3, fract(seed * 5.3));
          float o2 = (1.0 - smoothstep(uOtras - 0.04, uOtras, length(p * 1.6 - uO2 * 1.6))) * step(0.3, fract(seed * 5.3));
          float o3 = (1.0 - smoothstep(uOtras - 0.04, uOtras, length(p * 1.6 - uO3 * 1.6))) * step(0.3, fract(seed * 5.3));
          em = mix(em, uC1 * 0.8, o1 * (1.0 - nuestro));
          em = mix(em, uC2 * 0.8, o2 * (1.0 - nuestro));
          em = mix(em, uC3 * 0.8, o3 * (1.0 - nuestro));
          // What we can touch stops growing and empties.
          em *= 1.0 - uVacia * (1.0 - smoothstep(0.0, uHor, rr)) * smoothstep(0.03, 0.12, rr);
          em *= uRed;
        `,
        uniforms: {
          uRed: { value: 1 },
          uExp: { value: 0 },
          uBur: { value: 0 },
          uOtras: { value: 0 },
          uVacia: { value: 0 },
          uHor: { value: HOR },
          uTeal: { value: TEAL.clone() },
          uO1: { value: otrasU[0] },
          uO2: { value: otrasU[1] },
          uO3: { value: otrasU[2] },
          uC1: { value: OTRAS[0].col },
          uC2: { value: OTRAS[1].col },
          uC3: { value: OTRAS[2].col },
        },
      }),
      web,
    );
    red.u.uFuente.value = 0.5;

    // The probes: threads from ours to galaxies within reach (`aKind`: how far along).
    const sb = materiaBuilder(251);
    const pos = rc.data.position;
    const n = pos.length / 3;
    let hechos = 0;
    for (let guard = 0; hechos < 1400 && guard < 20000; guard++) {
      const k = Math.floor(sb.r() * n);
      const g = V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).multiplyScalar(1.6);
      const L = g.length();
      if (L > HOR || L < 0.05) continue;
      hechos++;
      const cuantos = Math.round(L * 90);
      for (let i = 0; i < cuantos; i++) {
        const t = sb.r();
        sb.push(g.x * t, g.y * t, g.z * t, TEAL, 0.0035, 0.35, { kind: t * L });
      }
    }
    const sondas = add(
      materia(sb.data(), {
        pre: /* glsl */ `uniform float uSondas, uExp, uVacia;`,
        move: /* glsl */ `
          p *= 1.0 + uExp * 1.4;
          em *= step(aKind, uSondas) * (0.5 + 1.5 * smoothstep(uSondas - 0.06, uSondas, aKind)) * (1.0 - uVacia);
        `,
        uniforms: { uSondas: { value: 0 }, uExp: { value: 0 }, uVacia: { value: 0 } },
      }),
      root,
      2,
    );
    sondas.u.uFuente.value = 0.5;

    // Our horizon: a sphere of faint points.
    const hb = materiaBuilder(257);
    for (let i = 0; i < 16000; i++) {
      const [x, y, z] = hb.onSphere();
      hb.push(x * HOR, y * HOR, z * HOR, new THREE.Color(0.55, 0.62, 0.8), 0.004, 0.12);
    }
    const horizonte = add(materia(hb.data(), { pre: `uniform float uOn;`, move: `em *= uOn;`, uniforms: { uOn: { value: 0 } } }), root, 1);
    // The last black hole, a golden point in the empty island.
    const ob = materiaBuilder(263);
    ob.push(0, 0, 0, new THREE.Color(1.0, 0.75, 0.4), 1, 2.4);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      ob.push(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4, new THREE.Color(1.0, 0.7, 0.35), 0.4, 0.6);
    }
    const oro = add(materia(ob.data()), root, 3);
    oro.u.uFuente.value = 1;
    oro.points.rotation.x = 0.35;

    // Revealing: our galaxy ringed in the middle of its share; the others and the horizon named a moment.
    const aroNuestra = add(marcas([{ pos: V(), R: 0, color: TEAL, nuestro: true, aro: 30, sinPunto: true }]), root, 40);
    const otrasAhora = OTRAS.map((o) => o.c.clone());
    const NOMBRES: Nombre[] = [
      { pos: V(), texto: 'Vía Láctea', nuestro: true, lado: 'o', aire: 100 },
      ...otrasAhora.map((pos): Nombre => ({ pos, texto: 'Otros', lado: 'n', aire: 6 })),
      { pos: V(0, -HOR, 0), texto: 'Horizonte', lado: 's' },
    ];
    /** Galaxies we reach (Armstrong & Sandberg, «Eternity in six hours»: some four thousand million). */
    const ALCANZABLES = 4e9;

    // ---------------------------------------------------------------- the moments (GUION.md 47–51)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: 80, el: 20, ld: Math.log10(3.7), yaw: 90, pitch: -90, roll: 0, fov: 40, sondas: 0, seis: 0, exp: 0, hor: 0, bur: 0, otras: 0, vacia: 0, oro: 0, prog: 0, tit: 0, mapa: 0, nombres: 0 });

    tl.label('seis').caption(5.8, 'La eternidad en seis horas', 'O hacia afuera: con la luz de una estrella, en seis horas salen sondas a todas las galaxias alcanzables.');
    luego(0.8, 4.0, { sondas: HOR, bur: HOR * 0.85 });
    luego(0.6, 5.0, { prog: 0.55 });
    luego(1.2, 1.2, { seis: 1 });
    luego(4.4, 1.2, { seis: 0 });
    tl.to(5.8, { az: 110, el: 24, ld: Math.log10(2.4) });

    tl.label('prisa').caption(5.8, 'La prisa', 'Hay que apurarse: las galaxias se alejan cada vez más rápido, y las que cruzan el horizonte ya no se alcanzan.');
    tl.with(1.4, { hor: 1 });
    luego(0.6, 5.0, { exp: 1, prog: 0.72 });
    luego(2.4, 2.4, { tit: 1 });
    tl.to(5.8, { az: 140, el: 28, ld: Math.log10(3.3) });

    tl.label('tocan').caption(5.6, 'Las expansivas se tocan', 'Si otras se expanden igual, las burbujas se tocan, y cada una se queda con su parte del cielo.');
    luego(0.4, 4.6, { otras: 1.3 });
    tl.to(5.6, { az: 175, el: 32, ld: Math.log10(5.2) });

    // The reveal: all we reach, ours in teal among the others; the names a moment; still.
    tl.label('tipo').caption(7.4, 'Tipo IV', 'Tipo IV: todo lo que se puede alcanzar. Más allá no hay adónde ir.');
    tl.with(2.0, { bur: HOR * 1.02 });
    luego(1.4, 1.6, { mapa: 1 });
    luego(2.4, 1.4, { nombres: 1 });
    tl.to(4.8, { az: 200, el: 26, ld: Math.log10(4.6) });
    tl.to(2.6, { az: 206 });

    tl.label('horizonte').caption(6.0, 'El horizonte', 'Lo que se lleva la energía oscura no vuelve. Lo que podemos tocar ya no crece: se vacía.');
    luego(0.2, 1.0, { nombres: 0 });
    luego(0.4, 1.4, { mapa: 0 });
    luego(0.4, 3.6, { vacia: 1, hor: 0.4, tit: 0 });
    luego(0.6, 3.6, { prog: 0 });
    luego(2.4, 2.0, { oro: 1 });
    tl.to(2.6, { az: 220, el: 20, ld: Math.log10(2.4) });
    tl.to(3.4, { az: 240, el: 16, ld: Math.log10(0.05) });

    // The spark: out on a probe towards one galaxy within reach (its knot, in the web's frame).
    const meta = (() => {
      let mejor = V(0.5, 0.1, 0.3);
      for (let k = 0; k < n; k += 97) {
        const g = V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).multiplyScalar(1.6);
        if (g.length() > HOR * 0.7 && g.length() < HOR * 0.95 && g.y > 0) {
          mejor = g;
          break;
        }
      }
      return mejor;
    })();
    const chispa = crearChispa();
    root.add(chispa.nube.points);
    const tm = toma(tl, 0);
    return {
      tl,
      entrada: { pos: V(), escala: 1.6 },
      salida: { pos: V(), escala: 0.0025 },
      escalera: false,
      cuenta(p) {
        const c: Cuenta = p < tl.at('tipo') ? potencia(37 + 8 * Math.min(1, tl.get('bur', p) / (HOR * 0.85)), '') : p < tl.at('horizonte') ? potencia(46) : potencia(46 - 6 * tl.get('vacia', p));
        // How far we reach: the galaxies the probes get to, then all there is to reach.
        const k = Math.min(1, tl.get('sondas', p) / HOR);
        const todo = tl.at('tipo') + 1.0;
        c.alcance = p >= todo ? 'todo lo alcanzable' : k < 0.02 ? 'la galaxia' : cuantas(Math.max(2, ALCANZABLES * k * k * k), 'galaxia', 'galaxias');
        c.nuevo = p >= todo ? 1 - THREE.MathUtils.smoothstep(p, todo, todo + 1.8) : 0;
        return c;
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'VII · El cosmos', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-5;
        camera.far = 100;
        aplicarToma(camera, toma(tl, p, tm));
        // Where it is: along the way to its galaxy (which the swell carries off), and home again at the end.
        const expC = tl.get('exp', p);
        const caminoCh: Camino = (sv, out) => out.copy(meta).multiplyScalar((1 + expC * 1.4) * Math.max(0, sv));
        const prog = tl.get('prog', p);
        chispa.update(caminoCh, prog, 0.01, 1 - tl.get('oro', p), tl.get('tit', p), camera.position, f.focal, f.dpr, f.time);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        const exp = tl.get('exp', p);
        red.u.uExp.value = exp;
        red.u.uBur.value = tl.get('bur', p);
        red.u.uOtras.value = tl.get('otras', p);
        red.u.uVacia.value = tl.get('vacia', p);
        sondas.u.uSondas.value = tl.get('sondas', p);
        sondas.u.uExp.value = 0;
        sondas.u.uVacia.value = tl.get('vacia', p);
        horizonte.u.uOn.value = tl.get('hor', p);
        oro.u.uGain.value = tl.get('oro', p);
        oro.u.uSizeUnit.value = (6 * camera.position.length()) / f.focal;
        for (const x of nubes) enfocar(x, f.focal, f.dpr, t);
        enfocarMarcas(aroNuestra, f.dpr, tl.get('mapa', p));
        OTRAS.forEach((o, i) => otrasAhora[i].copy(o.c).multiplyScalar(1 + exp * 1.4));
        red.u.uMaxPx.value = 3.2 * f.dpr;
        red.u.uSizeUnit.value = 1.6;
      },
      placa(g, f) {
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
        // Six hours: the number that is the spectacle, large and alone.
        const a = tl.get('seis', f.p);
        if (a > 0.01) {
          const u = f.u;
          g.save();
          g.globalAlpha = a;
          g.textAlign = 'right';
          g.textBaseline = 'alphabetic';
          g.shadowColor = 'rgba(0,0,0,0.9)';
          g.shadowBlur = 20 * u;
          g.font = FONT.serif(150 * u);
          g.fillStyle = ink(0.92);
          g.fillText('6', f.W - 90 * u, f.H * 0.42);
          g.font = FONT.italic(30 * u);
          g.fillStyle = ink(0.7);
          g.fillText('horas', f.W - 90 * u, f.H * 0.42 + 44 * u);
          g.restore();
        }
      },
      dispose() {},
    };
  },
};
