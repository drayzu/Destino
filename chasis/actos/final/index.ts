import { tr } from '../../../estudios/idioma';
import * as THREE from 'three';
import { Timeline } from '../../../estudios/timeline';
import { enfocar, materia, type Nube } from '../../../estudios/motor/materia';
import { rng } from '../../../estudios/motor/math';
import { crearAgujero } from '../../../estudios/motor/agujero';
import { ease, redCosmica } from '../../../estudios/comun';
import { FONT, ink, type Cuenta, type Rotulo } from '../../../estudios/placa';
import { capaLuz, potencia, puntoTu, anioEn } from '../../../estudios/remake';
import { toma } from '../../../estudios/rig';
import { type Camino } from '../../../estudios/chispa';
import { escribir, toma as plano } from '../../toma';
import type { Acto, EscenaChasis, FrameActo } from '../../tipos';
import { V, N_DISCO, MENTE, NACE, R_UNI, anilloDatos, menteNodos, menteDatos, menteEnlaces, burbujaDatos, primeraLuz } from './mundo';
import { TOMA_FINAL } from './camara';

/**
 * Scenes 21–22 of ESCALETA.md, «El último agujero negro» and «Un universo nuevo» (GUION.md, moments
 * 52–57), and the hand-over to Infinito.
 *
 * The golden point is the last black hole: its disk white and gold, light bent round its shadow
 * (Infinito's ray-traced hole). A ring of ours round it takes energy from its spin. The last mind
 * flashes, each time further apart; the point breathes beside it; she goes out, the point does not.
 * In the black, a white point grows into a bubble and the camera goes in: the light spills, cools,
 * gathers into a web; the camera goes down to a corner of it, and there a teal point lights: twenty
 * watts, someone thinking for the first time. Everything goes out but the point. Infinito opens there.
 *
 * Units: the hole's horizon radius is 1.
 */

export const final: EscenaChasis = {
  id: 'final',
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
    const hoyo = crearAgujero();
    hoyo.u.uStars.value = 0.25;
    hoyo.u.uDiskOut.value = 16;
    root.add(hoyo.mesh);
    const anillo = add(materia(anilloDatos(), { pre: `uniform float uOn;`, move: `em *= uOn * (0.6 + 0.4 * sin(uTime * 0.7 + seed * 30.0));`, uniforms: { uOn: { value: 0 } } }), root, 2);
    anillo.u.uFuente.value = 0.5;
    const nodos = menteNodos();
    const mente = add(
      materia(menteDatos(nodos), {
        pre: /* glsl */ `uniform float uOn, uP;`,
        move: /* glsl */ `
          // Each node one thought left: an ember while it waits, a flash as it thinks it, then dark.
          float flash = exp(-pow((uP - aKind) / 0.012, 2.0)) * step(aKind, 1.5);
          em *= uOn * ((uP < aKind ? 0.22 : 0.0) + 3.0 * flash);
          sz *= 1.0 + 1.5 * flash;
        `,
        uniforms: { uOn: { value: 0 }, uP: { value: 0 } },
      }),
      root,
      3,
    );
    mente.u.uFuente.value = 0.6;
    const enlaces = menteEnlaces(nodos);
    root.add(enlaces.lineas);
    // (the one left, the last thought: yours)
    const ultimo = nodos.find((n) => n.t > 1.5)!.p;
    const tuMente = add(puntoTu(ultimo.clone(), 0.1), root, 4);

    const uniG = new THREE.Group();
    uniG.position.copy(NACE);
    root.add(uniG);
    const burbuja = add(materia(burbujaDatos(), { pre: `uniform float uOn;`, move: `em *= uOn;`, uniforms: { uOn: { value: 0 } } }), uniG, 5);
    burbuja.u.uFuente.value = 0.5;
    const capaUni = capaLuz(new THREE.Color(1.0, 0.96, 0.9), { cara: 0.025, grano: 0.35 });
    uniG.add(capaUni.mesh);
    // Inside: the light that spills and cools into a web (from a white fog to its knots).
    const rc = redCosmica(293, 110, (t, out) => out.setRGB(1.0, 0.86 - 0.1 * t, 0.7 - 0.15 * t), true);
    const luz = add(
      materia(rc.data, {
        pre: /* glsl */ `uniform float uLuz, uRed, uApaga; attribute vec3 aAzar;`,
        move: /* glsl */ `
          p = mix(aAzar, p, uRed);
          em = mix(vec3(1.0, 0.9, 0.78) * 0.15, em * 1.3, uRed) * uLuz * (1.0 - uApaga) * (0.25 + 0.75 * uRed);
        `,
        uniforms: { uLuz: { value: 0 }, uRed: { value: 0 }, uApaga: { value: 0 } },
        extra: { aAzar: [rc.azar, 3] },
      }),
      uniG,
      6,
    );
    luz.u.uFuente.value = 0.5;
    const primera = primeraLuz();
    uniG.add(primera.mesh);
    // The corner where someone thinks: a knot of the new web, near its edge.
    const rincon = rc.nodos.slice().sort((a, z) => z.length() - a.length())[8].clone();
    // Other universes, for the last moment («¿Y el nuestro?»): bubbles round the new one, rims of light
    // seen as the camera leaves it.
    const espuma: { c: ReturnType<typeof capaLuz>; base: number }[] = [];
    {
      const r = rng(301);
      for (let i = 0; i < 18; i++) {
        const c = capaLuz(new THREE.Color().setHSL(0.06 + r() * 0.55, 0.3, 0.72), { cara: 0.03, grano: 0.4 });
        const d = V(r() * 2 - 1, (r() * 2 - 1) * 0.6, r() * 2 - 1).normalize();
        const R = 4 + r() * 10;
        c.mesh.position.copy(NACE).addScaledVector(d, 18 + r() * 45 + R);
        c.mesh.scale.setScalar(R);
        root.add(c.mesh);
        espuma.push({ c, base: 0.16 + 0.2 * r() });
      }
    }
    const tu = add(puntoTu(rincon.clone(), 0.006), uniG, 7);

    // ---------------------------------------------------------------- the moments (GUION.md 52–57)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const Cn = (v: THREE.Vector3) => ({ cx: v.x, cy: v.y, cz: v.z });
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: 240, el: 16, ld: Math.log10(150), yaw: 90, pitch: -90, roll: 0, fov: 40, pl: 0, frio: 0, hoyo: 1, anillo: 0, mente: 0, periodo: 1, tuM: 0, apagaM: 0, cnt: 0, bur: 0, espuma: 0, rb: 0, luz: 0, red: 0, tu: 0, apaga: 0, tarjeta: 0, baja: 0, chs: 0, chOn: 0 });

    // The moment (Diego, 31 Oct: each idea its cinematic moment): down from afar onto the last hole,
    // to graze its disk, the light bent above and below its shadow filling the frame, the side coming
    // at us brighter; then up and out, to see our ring round it taking its spin. (Turning one way all
    // along, into the next moment's.)
    tl.label('centrales').caption(8.4, 'Las últimas centrales', 'Cuando las estrellas se apagan, quedan los agujeros negros. Todavía se puede sacar energía de su giro.');
    luego(0.6, 1.8, { anillo: 1 });
    // (just outside the disk's rim, low over its plane, the lens closing in: inside the rim the near
    // disk filled half the frame in streaks)
    tl.to(3.2, { ld: Math.log10(30), el: 9, az: 258, fov: 36 });
    tl.to(2.8, { ld: Math.log10(20), el: 5, az: 284, roll: 6, fov: 30 });
    tl.to(2.4, { ld: Math.log10(60), el: 10, az: 296, roll: 0, fov: 40 });

    tl.label('contados').caption(6.6, 'Pensamientos contados', 'Al universo le quedan pensamientos contados. Este que tienes ahora es uno de ellos.');
    tl.with(1.2, { mente: 1, chOn: 1 });
    tl.with(6.6, { chs: 1 });
    luego(0.6, 1.0, { tuM: 1 });
    luego(0.4, 5.0, { periodo: 6 });
    luego(0.3, 6.1, { cnt: 1 });
    luego(5.0, 1.2, { apagaM: 1 });
    // The moment: into the last mind, among its thoughts as they go out round the camera, the hole
    // right behind them (the camera on the far side of the mind from it: at az 41.6, el 28 it looks
    // straight back at the hole), and out again when one is left: yours.
    tl.with(1.6, { ...Cn(MENTE) });
    tl.to(2.4, { ld: Math.log10(1.3), el: 24, az: 366, fov: 58 });
    tl.to(2.4, { ld: Math.log10(1.6), el: 27, az: 392 });
    tl.to(1.8, { ld: Math.log10(6), el: 28, az: 401.6, fov: 44 });

    // In the black, a white point grows into a bubble, and the camera goes in.
    tl.label('crear').caption(5.4, 'Crear un universo', 'La última obra posible: una burbuja que crece hasta ser un universo propio. Hoy no sabemos hacerlo.');
    tl.with(2.0, { hoyo: 0, anillo: 0, mente: 0, tuM: 0 });
    luego(0.8, 1.0, { bur: 1 });
    luego(0.6, 3.0, { chs: 2 });
    luego(1.0, 4.2, { rb: 1 });
    luego(0.4, 1.6, { ...Cn(NACE) });
    // The moment: close by where it is born, the camera waits; the bubble swells towards it and its
    // front of light sweeps over the camera (radius R_UNI · rb passes 7 near rb 0.78), into the
    // first light inside.
    // (the first light lit as the front reaches the camera: the wave of light that takes it in)
    luego(3.9, 1.0, { pl: 1 });
    tl.to(2.0, { ld: Math.log10(10), el: 10, az: 406, fov: 46 });
    tl.to(3.4, { ld: Math.log10(7), el: 9, az: 420, fov: 52 });

    // Inside: the whole sky white with the first light; it cools to gold, red, black, and out of
    // its unevenness the web gathers, galaxies at its knots.
    tl.label('adentro').caption(4.6, 'Adentro', 'Adentro, un universo empieza.');
    tl.with(1.4, { pl: 1 });
    luego(0.6, 1.6, { luz: 1 });
    luego(1.0, 2.0, { bur: 0 });
    luego(0.4, 4.0, { frio: 1 });
    tl.to(4.6, { ld: Math.log10(R_UNI * 0.75), el: 10, az: 435 });

    const rinconW = rincon.clone().multiplyScalar(R_UNI).add(NACE);
    tl.label('alguien').caption(6.2, 'Alguien', 'En miles de millones de años, en algún rincón de ahí adentro, algo va a pensar por primera vez. Como tú, ahora.');
    // The moment: the web gathers, and the camera goes down through its threads as they form, past
    // its knots (young galaxies), to the corner where a point lights.
    tl.with(2.6, { red: 1 });
    luego(0.3, 1.8, { pl: 0 });
    luego(0.6, 3.2, { ...Cn(rinconW), baja: 1 });
    luego(0.6, 3.4, { chs: 3 });
    luego(3.6, 1.4, { tu: 1, chOn: 0 });
    tl.to(2.6, { ld: Math.log10(3.2), el: 9, az: 446 });
    tl.to(3.6, { ld: Math.log10(0.5), el: 6, az: 455 });

    // The moment: back out of the new universe until it is a bubble of light with its web inside, a
    // point of ours in it, and round it others, other universes; then all goes out but the point.
    tl.label('nuestro').caption(7.0, '¿Y el nuestro?', '¿Y si alguien hizo también el nuestro?');
    luego(0.2, 2.2, { bur: 1 });
    luego(2.2, 2.4, { espuma: 1 });
    luego(4.6, 1.6, { apaga: 1 });
    luego(5.2, 1.6, { tarjeta: 1 });
    tl.with(3.2, { ...Cn(NACE) });
    tl.to(4.6, { ld: Math.log10(75), el: 14, az: 470, fov: 40 });
    tl.to(2.4, { ld: Math.log10(85), az: 473 });

    const junto = MENTE.clone().add(V(1.6, 0.3, 0.6));
    const tm = toma(tl, 0);
    const sky = new THREE.Matrix3();
    const caminoCh: Camino = (sv, out) => {
      if (sv <= 1) return out.copy(junto).add(V(Math.sin(sv * 9) * 0.3, Math.cos(sv * 7) * 0.2, 0));
      if (sv <= 2) return out.copy(junto).lerp(NACE, THREE.MathUtils.smoothstep(sv - 1, 0, 1));
      return out.copy(NACE).lerp(rinconW, THREE.MathUtils.smoothstep(sv - 2, 0, 1));
    };
    // The shots (chasis/toma.ts): the act's camera written as keys (viaje.transcribir, then by hand).
    escribir(tl, TOMA_FINAL);
    return {
      id: 'final',
      tl,
      grupo: root as THREE.Group,
      costura: 'mundo',
      cerca: 1e-4,
      lejos: 5000,
      film: { strength: 0.75, radius: 0.6, threshold: 0.4, exposure: 1.1 },
      entrada: { pos: V(), escala: 20 },
      // The spark: beside the last mind (it waits there), into the bubble, down to its corner.
      camara(p, ch, out) {
        plano(tl, p, ch, out);
      },
      guia(p, out) {
        caminoCh(tl.get('chs', p), out);
        return true;
      },
      escalera: false,
      outro(p) {
        return tl.get('tarjeta', p);
      },
      cuenta(p): Cuenta | null {
        if (p < tl.at('crear')) {
          const per = tl.get('periodo', p);
          return potencia(29 - (per - 1) * 1.4);
        }
        if (p < tl.at('alguien')) return null;
        const b = tl.get('baja', p);
        if (b > 0.5) return { pisos: ['20'], unidad: 'W', linea: 'alguien, pensando', h: 1, a: ease(0.5, 1, b) };
        return null;
      },
      // The years: the last power plants, the last thoughts, the last black hole; inside, none.
      anio(p) {
        const a = (l: string) => tl.at(l);
        if (p >= a('adentro')) return null;
        return anioEn(p, [[0, 1e20], [a('contados'), 1e40], [a('crear'), 1e60], [a('crear') + 3, 1e100]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: p < tl.at('adentro') ? 'VIII · El final' : '', name: c.name, fact: c.fact } : null;
      },
      update(f: FrameActo) {
        const p = f.p;
        const t = f.time;
        const camera = f.camera;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        hoyo.update({ camera, center: V(), normal: N_DISCO, rs: 1, sky, time: t, alpha: tl.get('hoyo', p) });
        anillo.u.uOn.value = tl.get('anillo', p);
        mente.u.uOn.value = tl.get('mente', p) * (1 - tl.get('apagaM', p));
        mente.u.uP.value = tl.get('cnt', p);
        enlaces.u.uP.value = tl.get('cnt', p);
        enlaces.u.uOn.value = mente.u.uOn.value;
        tuMente.u.uGain.value = tl.get('tuM', p) * (1 + 0.25 * Math.sin(t * 1.5));
        const rb = tl.get('rb', p);
        uniG.scale.setScalar(Math.max(1e-3, R_UNI * rb));
        const vivo = 1 - tl.get('apaga', p);
        burbuja.u.uOn.value = 0.5 * tl.get('bur', p) * vivo;
        capaUni.u.uOn.value = 0.32 * tl.get('bur', p) * vivo;
        for (const e of espuma) {
          e.c.u.uOn.value = e.base * tl.get('espuma', p) * vivo;
          e.c.u.uTime.value = t;
        }
        capaUni.u.uTime.value = t;
        burbuja.u.uSizeUnit.value = uniG.scale.x * 0.25 + 0.2;
        luz.u.uLuz.value = tl.get('luz', p);
        luz.u.uRed.value = tl.get('red', p);
        luz.u.uApaga.value = tl.get('apaga', p);
        luz.u.uSizeUnit.value = uniG.scale.x;
        primera.u.uLuz.value = tl.get('pl', p);
        primera.u.uFrio.value = tl.get('frio', p);
        primera.u.uTime.value = t;
        // «Tú» keeps a few pixels, however close.
        tu.u.uSizeUnit.value = (8 * camera.position.distanceTo(rinconW)) / f.focal / 0.006;
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.25 * Math.sin(t * 1.5));
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        // A flood of light first (soft and wide), then a web of fine points.
        luz.u.uMaxPx.value = (3.2 + 6 * (1 - tl.get('red', p))) * f.dpr;
      },
      placa(g, f) {
        // The card: Infinito, where the point is.
        const a = f.chasis ? 0 : tl.get('tarjeta', f.p);
        if (a > 0.01) {
          const u = f.u;
          g.save();
          g.globalAlpha = a;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.font = FONT.mono(11 * u);
          g.letterSpacing = `${1.8 * u}px`;
          g.fillStyle = 'rgba(201,180,255,0.9)';
          g.fillText(tr('Continúa en').toUpperCase(), f.W / 2, f.H * 0.68);
          g.letterSpacing = '0px';
          g.font = FONT.serif(64 * u);
          g.fillStyle = ink(0.95);
          g.fillText('Infinito', f.W / 2, f.H * 0.68 + 52 * u);
          g.font = FONT.italic(24 * u);
          g.fillStyle = ink(0.7);
          g.fillText(tr('¿Qué hay más allá?'), f.W / 2, f.H * 0.68 + 100 * u);
          g.restore();
        }
      },
    };
  },
};
