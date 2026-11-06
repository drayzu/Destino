import { tr } from '../../../estudios/idioma';
import * as THREE from 'three';
import { Timeline } from '../../../estudios/timeline';
import { enfocar, materia, materiaBuilder, type Nube } from '../../../estudios/motor/materia';
import { redCosmica } from '../../../estudios/comun';
import { brillosGalaxias, formaGalaxia, type FormaGalaxia } from '../../../estudios/galaxias';
import { FONT, ink, type Cuenta, type Rotulo } from '../../../estudios/placa';
import { cuantas, enfocarMarcas, marcas, nombres, type Nombre } from '../../../estudios/revelar';
import { TEAL, potencia, anioEn } from '../../../estudios/remake';
import { toma } from '../../../estudios/rig';
import { montar, type Camino } from '../../../estudios/chispa';
import { escribir, toma as plano } from '../../toma';
import type { Acto, EscenaChasis, FrameActo } from '../../tipos';
import { COSTURA_MOVE, capaLuzSegura, costuraDatos, espiralHuida } from '../../../estudios/momentos-cosmos';
import { V, HOR, AZ_LEJOS, OTRAS } from './mundo';
import { TOMA_COSMOS, TOMA_COSMOS_MIRA } from './camara';

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

export const cosmos: EscenaChasis = {
  id: 'cosmos',
  montar(stage): Acto {
    const root = stage.root;
    const { camera } = stage;

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
    const rc = redCosmica(241, 150, (t, out) => out.setRGB(0.82, 0.88, 1.0).multiplyScalar(1 - 0.3 * t), true);
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
          // Each galaxy belongs to the bubble that got there: the nearest, for its size (so where two
          // meet, each keeps its share of the sky); a glow along the line where they touch.
          float d0 = rr / max(uBur, 1e-4);
          float d1 = length(p * 1.6 - uO1 * 1.6) / max(uOtras, 1e-4);
          float d2 = length(p * 1.6 - uO2 * 1.6) / max(uOtras, 1e-4);
          float d3 = length(p * 1.6 - uO3 * 1.6) / max(uOtras, 1e-4);
          float m = min(min(d0, d1), min(d2, d3));
          float tomado = (1.0 - smoothstep(0.94, 1.0, m)) * step(0.25, fract(seed * 11.7));
          vec3 suyo = d0 <= m ? uTeal * (0.45 + 0.8 * length(em)) : d1 <= m ? uC1 * (0.35 + 0.7 * length(em)) : d2 <= m ? uC2 * (0.35 + 0.7 * length(em)) : uC3 * (0.35 + 0.7 * length(em));
          em = mix(em, suyo, tomado);
          // (the second nearest, almost as near: the border)
          float m2 = d0 <= m ? min(min(d1, d2), d3) : d1 <= m ? min(min(d0, d2), d3) : d2 <= m ? min(min(d0, d1), d3) : min(min(d0, d1), d2);
          em += vec3(1.0, 0.95, 0.85) * 0.9 * (1.0 - smoothstep(0.0, 0.06, m2 - m)) * step(m2, 1.0) * step(0.001, uOtras);
          float nuestro = d0 <= m ? tomado : 0.0;
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
        pre: /* glsl */ `uniform float uSondas, uExp, uVacia, uTenue;`,
        move: /* glsl */ `
          p *= 1.0 + uExp * 1.4;
          em *= step(aKind, uSondas) * (0.1 + 2.2 * smoothstep(uSondas - 0.05, uSondas, aKind)) * (1.0 - uVacia) * (1.0 - 0.92 * uTenue);
        `,
        uniforms: { uSondas: { value: 0 }, uExp: { value: 0 }, uVacia: { value: 0 }, uTenue: { value: 0 } },
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
    const capaHor = capaLuzSegura(new THREE.Color(0.55, 0.62, 0.8), { cara: 0.03, grano: 0.3 });
    capaHor.mesh.scale.setScalar(HOR);
    root.add(capaHor.mesh);

    // Type IV up close: our share of the web is galaxies, every one ours. Spirals along our
    // filaments (where the web is once the swell has done), and a way among them for the camera.
    const PASA = 1 + 1.4;
    const gb = materiaBuilder(271);
    const gr = gb.r;
    const candidatas: THREE.Vector3[] = [];
    for (let k = 0; k < n && candidatas.length < 220; k += 23) {
      const g = V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).multiplyScalar(1.6 * PASA);
      if (g.length() < HOR * 0.9 && g.length() > 0.06 && candidatas.every((c) => c.distanceTo(g) > 0.045)) candidatas.push(g);
    }
    const blanco = new THREE.Color(0.9, 1.0, 0.96);
    // (each its own kind of galaxy, all ours: teal, warmer at their hearts)
    const col = new THREE.Color();
    const formas: { c: THREE.Vector3; f: FormaGalaxia }[] = [];
    for (const c of candidatas) {
      const f = formaGalaxia(gr, 420, 0.012, (x, y, z, t, luz, tinte) => {
        col.copy(TEAL).lerp(blanco, 0.3 * gr()).lerp(tinte, t < 0.05 ? 0.55 : 0.25);
        gb.push(c.x + x, c.y + y, c.z + z, col, t < 0.05 ? 0.0007 : 0.0006, luz * (t < 0.05 ? 1.6 : 1.7));
      });
      formas.push({ c, f });
    }
    // (and under their points, each galaxy's soft light)
    const brillos = brillosGalaxias(formas, TEAL);
    root.add(brillos.mesh);
    const cercanas = add(materia(gb.data(), { pre: `uniform float uOn;`, move: `em *= uOn;`, uniforms: { uOn: { value: 0 } } }), root, 3);
    cercanas.u.uFuente.value = 0.6;

    // The bubble that touches ours (the amber one): its galaxies on its side of the seam, each lit as
    // its front gets there; and the seam itself, a wall of light where the two fronts meet.
    const EJE = OTRAS[0].c.clone().normalize();
    const SEAM = 0.56;
    /** A bubble's galaxies, seen from afar: `n` of them inside radius `R` round `o`, on its side of the
     * seam, each lit as its front gets there (`uFrente`), those along the seam flaring (`uCostura`). */
    const nubeBurbuja = (seed: number, o: THREE.Vector3, R: number, n: number, color: THREE.Color, nuestro: boolean) => {
      const bb = materiaBuilder(seed);
      const br = bb.r;
      const cs: number[] = [];
      for (let k = 0, hechas = 0; hechas < n && k < 20000; k++) {
        const [x, y, z] = bb.onSphere();
        const c = o.clone().add(V(x, y, z).multiplyScalar(R * Math.cbrt(br())));
        const lado = c.dot(EJE);
        if (nuestro ? lado > SEAM - 0.025 : lado < SEAM + 0.025 || c.length() < 0.4) continue;
        hechas++;
        formaGalaxia(br, 160, 0.011, (gx, gy, gz, t, luz, tinte) => {
          col.copy(color).lerp(blanco, 0.15 * br()).lerp(tinte, t < 0.05 ? 0.4 : 0.12);
          bb.push(c.x + gx, c.y + gy, c.z + gz, col, t < 0.05 ? 0.0008 : 0.0007, luz * 0.9);
          cs.push(c.x, c.y, c.z);
        });
      }
      const nb = add(
        materia(bb.data(), {
          pre: /* glsl */ `attribute vec3 aC; uniform float uOn, uFrente, uCostura, uHuye, uApaga; uniform vec3 uEje, uO;`,
          move: /* glsl */ `
            float dC = length(aC - uO);
            em *= uOn * smoothstep(dC - 0.03, dC, uFrente);
            // (what dark energy takes goes off, reddening; what we hold goes out, galaxy by galaxy)
            p *= 1.0 + 2.2 * uHuye * uHuye;
            em = mix(em, vec3(0.9, 0.22, 0.1) * max(max(em.r, em.g), em.b), smoothstep(0.0, 0.4, uHuye));
            em *= 1.0 - smoothstep(0.55, 1.0, uHuye);
            em *= step(uApaga, fract(sin(dot(aC, vec3(12.9898, 78.233, 37.719))) * 43758.5453));
            em *= 1.0 + 3.0 * uCostura * exp(-pow(abs(dot(aC, uEje) - ${SEAM.toFixed(2)}) / 0.05, 2.0));
          `,
          uniforms: { uOn: { value: 0 }, uFrente: { value: 0 }, uCostura: { value: 0 }, uHuye: { value: 0 }, uApaga: { value: 0 }, uEje: { value: EJE.clone() }, uO: { value: o.clone() } },
          extra: { aC: [new Float32Array(cs), 3] },
        }),
        root,
        3,
      );
      nb.u.uFuente.value = 0.6;
      return nb;
    };
    const nuestras = nubeBurbuja(281, V(), HOR * 0.85, 240, TEAL, true);
    const suyas = nubeBurbuja(283, OTRAS[0].c, 1.3, 260, OTRAS[0].col, false);
    const costura = add(
      materia(costuraDatos(9000, EJE), { pre: /* glsl */ `uniform float uOn, uRho; uniform vec3 uCentro;`, move: COSTURA_MOVE, uniforms: { uOn: { value: 0 }, uRho: { value: 0 }, uCentro: { value: EJE.clone().multiplyScalar(SEAM) } } }),
      root,
      5,
    );
    costura.u.uFuente.value = 1;
    // The way: through a ring of them round the middle, each passed close.
    const paso = candidatas
      .filter((c) => c.length() > 0.18 && c.length() < 0.62)
      .sort((a, b) => Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z));
    const elegidas = [0, 1, 2, 3, 4, 5].map((i) => paso[Math.floor((i / 6) * paso.length)] ?? V(0.3, 0, 0));
    const caminoRuta: Camino = (sv, out) => out.copy(ruta.getPoint(THREE.MathUtils.clamp(sv, 0, 1)));
    const ruta = new THREE.CatmullRomCurve3(elegidas.map((c, i) => c.clone().add(V(0.012, 0.018, 0.012).multiplyScalar(i % 2 ? 1 : -1))));
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
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: 80, el: 20, ld: Math.log10(3.7), yaw: 90, pitch: -90, roll: 0, fov: 40, sondas: 0, seis: 0, exp: 0, hor: 0, bur: 0, otras: 0, vacia: 0, oro: 0, prog: 0, tit: 0, mapa: 0, nombres: 0, vuela: 0, sv: 0, cerca: 0 });

    tl.label('seis').caption(5.8, 'La eternidad en seis horas', 'O hacia afuera: con la luz de una estrella, en seis horas salen sondas a todas las galaxias alcanzables.');
    luego(0.8, 4.0, { sondas: HOR, bur: HOR * 0.85 });
    // (the spark's way out as the relay left it: `prog`; from there on it flows without a stop through
    // the caption change, `prog2`, the two blended once the relay is done)
    luego(0.6, 5.0, { prog: 0.55 });
    tl.keyAt(0.6, { prog2: 0 });
    tl.keyAt(5.6, { prog2: 0.52 });
    tl.keyAt(10.4, { prog2: 0.72 });
    luego(1.2, 1.2, { seis: 1 });
    luego(4.4, 1.2, { seis: 0 });
    // (once the relay is done: down through home after the spark, the probes streaking out past the
    // camera on every side, and on behind it, galaxies rushing by; the web's own light lower, so the
    // probes are what shines; the dive as long as the relay was, never a lunge)
    luego(2.5, 3.0, { ride: 1 });
    luego(3.0, 1.4, { vel: 0.5 });
    luego(4.4, 1.8, { vel: 0 });
    luego(2.6, 1.8, { tenue: 1 });
    luego(2.8, 1.6, { huida: 1 });
    tl.to(5.8, { az: 110, el: 24, ld: Math.log10(2.4) });

    // Riding on behind the spark: the galaxy it chases is carried off faster than it goes, past the
    // horizon's faint wall, reddening, dimming, a red ember out there. Then the camera lets go and
    // falls back, slowly, the way it looks: home's galaxies slide past, our bubble opens round it in
    // its horizon, the lost one a dim red point beyond; it comes to rest out on the far side, where
    // the next bubble will come. (While it rides, its rig moves there unseen: the centre to where the
    // two will touch, the distance in.)
    const SEAM_C = OTRAS[0].c.clone().normalize().multiplyScalar(0.56);
    const D_ESPERA = Math.log10(1.3);
    tl.label('prisa').caption(5.8, 'La prisa', 'Hay que apurarse: las galaxias se alejan cada vez más rápido, y las que cruzan el horizonte ya no se alcanzan.');
    tl.with(1.4, { hor: 1 });
    luego(0.6, 5.0, { exp: 1, prog: 0.72 });
    luego(2.4, 2.4, { tit: 1 });
    luego(3.4, 4.0, { ride: 0 });
    luego(3.6, 2.8, { tenue: 0 });
    luego(7.2, 1.6, { huida: 0 });
    luego(0.6, 2.6, { cx: SEAM_C.x, cy: SEAM_C.y, cz: SEAM_C.z });
    tl.keyAt(tl.at('prisa') + 0.6, { ld: Math.log10(2.4) });
    tl.keyAt(tl.at('prisa') + 3.0, { ld: D_ESPERA });
    tl.to(5.8, { az: 140, el: 28, ld: D_ESPERA });

    // Ours, a cloud of teal galaxies, and the amber one growing towards it, each galaxy lit as its
    // front gets there; where they touch, a wall of light, and the galaxies along it flare. The
    // camera draws back to see both, the two colours either side of the wall, and goes in to it
    // (close in, the wall seen edge-on: a line between the two colours; from nearer, the two lost
    // their colours and the wall its line).
    tl.label('tocan').caption(6.8, 'Las expansivas se tocan', 'Si otras se expanden igual, las burbujas se tocan, y cada una se queda con su parte del cielo.');
    luego(0.0, 1.6, { toca: 1 });
    luego(0.4, 4.6, { otras: 1.3 });
    luego(2.4, 1.6, { costura: 1 });
    tl.to(2.4, { az: 186, el: -10, ld: Math.log10(2.3) });
    tl.to(2.2, { az: 199, el: -20, ld: Math.log10(1.4) });
    tl.to(2.2, { az: 203, el: -24, ld: Math.log10(0.85) });

    // The reveal: all we reach, ours in teal among the others; the names a moment; still.
    // Into our share of the web: every light a galaxy, every one ours, the camera gliding among
    // them; then out again, to the whole island among the others'.
    tl.label('tipo').caption(16.0, 'Tipo IV', 'Tipo IV: todo lo que se puede alcanzar. Más allá no hay adónde ir.');
    tl.with(2.0, { bur: HOR * 1.02 });
    luego(0.4, 2.0, { cerca: 1, toca: 0, costura: 0 });
    luego(1.0, 2.6, { cx: 0, cy: 0, cz: 0 });
    luego(0.6, 2.8, { vuela: 1 });
    luego(0.6, 10.0, { sv: 1 });
    luego(8.8, 3.0, { vuela: 0 });
    luego(10.0, 1.8, { cerca: 0 });
    luego(10.4, 1.6, { mapa: 1 });
    luego(11.4, 1.4, { nombres: 1 });
    // (then out again: our island of teal galaxies whole, the amber one against it at the seam)
    luego(9.6, 2.2, { isla: 1 });
    tl.to(11.6, { az: 205, el: 26, ld: Math.log10(4.6) });
    tl.to(4.0, { az: 208 });

    tl.label('horizonte').caption(6.0, 'El horizonte', 'Lo que se lleva la energía oscura no vuelve. Lo que podemos tocar ya no crece: se vacía.');
    luego(0.2, 1.0, { nombres: 0 });
    luego(0.4, 1.4, { mapa: 0 });
    luego(0.4, 3.6, { vacia: 1, hor: 0.4, tit: 0 });
    luego(0.9, 2.3, { vid: 1 });
    // (the others are carried off, reddening; ours goes out galaxy by galaxy; all of it before the
    // last stretch, which is as it was: the act after takes up from there)
    luego(0.1, 3.0, { huye: 1 });
    luego(0.4, 2.8, { apaga: 1 });
    luego(3.0, 0.4, { isla: 0 });
    luego(0.6, 3.6, { prog: 0 });
    luego(2.4, 2.0, { oro: 1 });
    tl.to(2.6, { az: 220, el: 20, ld: Math.log10(2.4) });
    tl.to(3.4, { az: 240, el: 16, ld: Math.log10(0.05) });

    // The spark: out on a probe towards one galaxy within reach, on the far side from where the camera
    // comes in (a little on, so the camera keeps turning the same way): the camera dives through home
    // after it and rides it.
    const lejos = V(Math.cos(THREE.MathUtils.degToRad(21)) * Math.sin(THREE.MathUtils.degToRad(AZ_LEJOS)), Math.sin(THREE.MathUtils.degToRad(21)), Math.cos(THREE.MathUtils.degToRad(21)) * Math.cos(THREE.MathUtils.degToRad(AZ_LEJOS))).negate();
    const meta = lejos.clone().multiplyScalar(HOR * 0.78);
    // (for its first beats, while the act before hands over, it heads where it always did, then bends
    // round to that galaxy)
    const metaAntes = (() => {
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
    const tmpM = V();
    // The galaxy it chases: a spiral that reads as one, out there; space swells and carries it off
    // faster than the probe goes, past the horizon, where it reddens and fades.
    const huida = add(
      materia(espiralHuida(3200, 0.05, meta.clone().negate()), {
        pre: /* glsl */ `uniform float uOn, uRojo;`,
        move: /* glsl */ `
          em = mix(em, vec3(1.0, 0.24, 0.1) * max(max(em.r, em.g), em.b) * 0.9, uRojo);
          em *= uOn;
        `,
        uniforms: { uOn: { value: 0 }, uRojo: { value: 0 } },
      }),
      root,
      4,
    );
    huida.u.uFuente.value = 0.6;
    const tm = toma(tl, 0);
    /** The spark's way at beat p (its galaxy carried off by the swell) and how far along it is. */
    const rutaEn = (p: number) => {
      const expC = tl.get('exp', p);
      const caminoCh: Camino = (sv, out) => out.copy(metaAntes).lerp(V().copy(meta), THREE.MathUtils.smoothstep(sv, 0.2, 0.34)).multiplyScalar((1 + expC * 1.4) * Math.max(0, sv));
      const wP = p < 20 ? THREE.MathUtils.smoothstep(p, 2.5, 3.6) : 0;
      const prog = THREE.MathUtils.lerp(tl.get('prog', p), tl.get('prog2', p), wP);
      return { caminoCh, prog };
    };
    // The shots (chasis/toma.ts): the act's camera written as keys (viaje.transcribir, then by hand).
    escribir(tl, TOMA_COSMOS);
    // (among the bubbles the old camera looked well away from the act's centre: there the shot says
    // what it looks at itself, so it never turns round a centre off the frame)
    escribir(tl, TOMA_COSMOS_MIRA);
    return {
      id: 'cosmos',
      tl,
      grupo: root as THREE.Group,
      costura: 'mundo',
      cerca: 1e-5,
      lejos: 100,
      film: { strength: 0.7, radius: 0.6, threshold: 0.4, exposure: 1.1 },
      entrada: { pos: V(), escala: 1.6 },
      salida: { pos: V(), escala: 0.0025 },
      camara(p, ch, out) {
        plano(tl, p, ch, out);
      },
      guia(p, out) {
        const r = rutaEn(p);
        r.caminoCh(r.prog, out);
        return true;
      },
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
      // The years: the probes leave in six hours; arriving takes thousands of millions of years; and
      // then the island empties, until the stars go out.
      anio(p) {
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[0, 5e6], [a('prisa'), 5e6], [a('tocan'), 2e9], [a('tipo') + 2, 2e10], [a('horizonte'), 2e10], [a('horizonte') + 3.6, 1e12], [tl.length, 1e14]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'VII · El cosmos', name: c.name, fact: c.fact } : null;
      },
      update(f: FrameActo) {
        const p = f.p;
        const t = f.time;
        const camera = f.camera;
        // Where it is: along the way to its galaxy (which the swell carries off), and home again at the end.
        const expC = tl.get('exp', p);
        const caminoCh: Camino = (sv, out) => out.copy(metaAntes).lerp(tmpM.copy(meta), THREE.MathUtils.smoothstep(sv, 0.2, 0.34)).multiplyScalar((1 + expC * 1.4) * Math.max(0, sv));
        // (as the relay left it, then flowing on: the two blended once the relay is done; equal again
        // long before the spark comes home)
        const wP = p < 20 ? THREE.MathUtils.smoothstep(p, 2.5, 3.6) : 0;
        const prog = THREE.MathUtils.lerp(tl.get('prog', p), tl.get('prog2', p), wP);
        // Gliding through our galaxies (Type IV): the camera on its way among them, looking ahead.
        const vuela = tl.get('vuela', p);
        const ride = tl.get('ride', p);
        const sv = THREE.MathUtils.clamp(tl.get('sv', p), 0, 1);
        // (the gaze always a little ahead of the place, even at the way's end; both smoothed, so the
        // camera rounds each galaxy it passes instead of turning at it)
        const cerca = tl.get('cerca', p);
        const toca = tl.get('toca', p);
        const otrasV = tl.get('otras', p);
        const contacto = THREE.MathUtils.smoothstep(otrasV, 0.62, 0.95);
        cercanas.u.uOn.value = cerca;
        brillos.u.uOn.value = 0.55 * cerca;
        const isla = Math.max(toca, tl.get('isla', p));
        nuestras.u.uApaga.value = tl.get('apaga', p);
        suyas.u.uHuye.value = tl.get('huye', p);
        for (const [nb, fr] of [[nuestras, tl.get('bur', p)], [suyas, otrasV]] as [Nube, number][]) {
          // (the neighbour seen whole, from afar, dimmer than ours: ours is the one we look at)
          nb.u.uOn.value = nb === suyas ? isla * (1 - 0.4 * tl.get('isla', p) * (1 - toca)) : isla;
          nb.u.uFrente.value = fr;
          nb.u.uCostura.value = contacto;
          nb.points.visible = isla > 0.002;
          nb.u.uMaxPx.value = 4 * f.dpr;
        }
        costura.u.uOn.value = Math.max(tl.get('costura', p), 0.5 * tl.get('isla', p)) * (1 - tl.get('huye', p));
        costura.u.uRho.value = 0.6 * THREE.MathUtils.smoothstep(otrasV, 0.6, 1.25);
        costura.points.visible = costura.u.uOn.value > 0.002;
        sondas.u.uTenue.value = Math.max(vuela, Math.min(1, tl.get('toca', p) + cerca + tl.get('isla', p)));
        // The galaxy it chases: carried off faster than the probe, reddening past the horizon.
        const huyeR = meta.length() * (1 + expC * 1.4 + expC * expC * 1.8);
        huida.points.position.copy(meta).setLength(huyeR);
        huida.u.uOn.value = tl.get('huida', p) * (1 - 0.72 * THREE.MathUtils.smoothstep(huyeR, HOR * 1.1, HOR * 2.6));
        huida.u.uRojo.value = THREE.MathUtils.smoothstep(huyeR, HOR * 0.85, HOR * 1.35);
        huida.points.visible = huida.u.uOn.value > 0.002;
        huida.u.uSizeUnit.value = 1;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        const exp = tl.get('exp', p);
        red.u.uExp.value = exp;
        red.u.uRed.value = 1 - 0.55 * tl.get('tenue', p);
        red.u.uBur.value = tl.get('bur', p);
        red.u.uOtras.value = tl.get('otras', p);
        red.u.uVacia.value = tl.get('vacia', p);
        sondas.u.uSondas.value = tl.get('sondas', p);
        sondas.u.uExp.value = 0;
        sondas.u.uVacia.value = tl.get('vacia', p);
        horizonte.u.uOn.value = 0.6 * tl.get('hor', p) * (1 - tl.get('toca', p));
        capaHor.u.uOn.value = 0.5 * tl.get('hor', p) * tl.get('vid', p);
        capaHor.u.uTime.value = t;
        oro.u.uGain.value = tl.get('oro', p);
        oro.u.uSizeUnit.value = (6 * camera.position.length()) / f.focal;
        for (const x of nubes) enfocar(x, f.focal, f.dpr, t);
        enfocarMarcas(aroNuestra, f.dpr, tl.get('mapa', p));
        OTRAS.forEach((o, i) => otrasAhora[i].copy(o.c).multiplyScalar(1 + exp * 1.4));
        red.u.uMaxPx.value = 3.2 * f.dpr;
        // Up close a galaxy is many fine points, never a few big blobs.
        cercanas.u.uMaxPx.value = 5 * f.dpr;
        red.u.uSizeUnit.value = 1.6;
      },
      efectos(p) {
        return { vel: tl.get('vel', p) };
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
          g.fillText(tr('horas'), f.W - 90 * u, f.H * 0.42 + 44 * u);
          g.restore();
        }
      },
    };
  },
};
