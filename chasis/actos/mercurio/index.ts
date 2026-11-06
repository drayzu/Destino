import * as THREE from 'three';
import { Timeline } from '../../../estudios/timeline';
import { enfocar, materia, type Nube } from '../../../estudios/motor/materia';
import { mercurio as mercurioHorizontes, sol as solHorizontes } from '../../../src/horizontes';
import { TEAL, potencia, anioEn } from '../../../estudios/remake';
import { toma } from '../../../estudios/rig';
import type { Camino } from '../../../estudios/chispa';
import { COLOR, E, MA, RE, RMA, RV, VE, M, RM, RA, RB, PHI0, PHI, RIEL_A, caminoRio as camino, D_RIO as D, N_RIO as N_T } from '../../../estudios/interior';
import { enfocarMarcas, marcas, nombres, orbitas, type Nombre } from '../../../estudios/revelar';
import type { Cuenta, Rotulo } from '../../../estudios/placa';
import { CONTRATO, mezclar, toma as plano } from '../../toma';
import { primeraPersona } from '../../primera';
import type { Acto, EscenaChasis, FrameActo } from '../../tipos';
import { vueloInterior } from '../../../estudios/vuelo';
import { V, Y, LENTE, LEJOS, rigDe, rielDatos, CADENCIA, rielMalla, cargasDatos, rioDatos, enjambreNube, MINA } from './mundo';
import { VUELO_MERCURIO } from './camara';

/**
 * Study B of the remake: scenes 11 and 12 of ESCALETA.md, «Mercurio se deshace» and «El enjambre»
 * (GUION.md, moments 25–28).
 *
 * Mercury against the Sun, its night side towards us: teal machines that copy themselves spread over
 * it, veins of light behind a bright front, and the crust they take grows dark. A rail of light along
 * its equator throws the rock off with no rocket; the camera rides a load down the river of rock that
 * falls towards the Sun, the stream all round it. The river opens into the swarm: millions of
 * collectors, each in its own orbit, that glint when they turn to the Sun. They close round the star,
 * and from outside the Sun goes out behind them: from far away, a warm ember.
 *
 * Ways: 1 «Vidrio», the collectors as they would be, dark glass that glints; 2 «Verde agua», the
 * collectors in the work's light (ours is teal).
 *
 * Units: solar radii, the Sun at the origin. Distances are drawn short (Mercury at 18, the swarm at 3);
 * the plate keeps the true ones.
 */

export { LEJOS, enjambreNube } from './mundo';

export const mercurio: EscenaChasis = {
  id: 'mercurio',
  montar(stage): Acto {
    // (the way Diego chose: «Vidrio»)
    const teal = false;
    const root = stage.root;
    const base = `${import.meta.env.BASE_URL}texturas/`;

    const sol = solHorizontes({ puntos: 320000, corona: 160000 });
    root.add(sol.group);
    sol.u.uBrillo.value = 2.2;

    const minaU = { uSem: { value: M.clone().normalize().addScaledVector(Y, 0.15).normalize() }, uTeal: { value: TEAL.clone() }, uMina: { value: 0 }, uLejos: { value: 1 } };
    const merc = mercurioHorizontes(base, { giro: 0, superficie: { ...MINA, uniforms: minaU } });
    merc.group.position.copy(M);
    merc.group.scale.setScalar(RM);
    root.add(merc.group);

    const nubes: Nube[] = [];
    const add = (n: Nube, orden = 5) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      root.add(n.points);
      nubes.push(n);
      return n;
    };

    const riel = add(
      materia(rielDatos(), {
        pre: /* glsl */ `uniform float uRiel;`,
        move: /* glsl */ `
          float pulso = (smoothstep(0.86, 0.944, fract(aKind * 6.0 + uTime * 1.1)) * (1.0 - smoothstep(0.944, 1.0, fract(aKind * 6.0 + uTime * 1.1))));
          em *= uRiel * (0.35 + 4.0 * pulso) * step(aKind, uRiel * 1.05);
        `,
        post: LENTE,
        uniforms: { uRiel: { value: 0 } },
      }),
    );
    riel.u.uFuente.value = 0.25;
    riel.points.visible = false;
    const rielM = rielMalla();
    root.add(rielM.mesh);
    // (the loads ride the rail in the rail's own frame: along the arc, each by its phase)
    const cargas = add(
      materia(cargasDatos(), {
        pre: /* glsl */ `uniform float uRiel; uniform vec3 uM, uN, uD; uniform float uR;`,
        move: /* glsl */ `
          float fase = fract(uTime * ${CADENCIA.toFixed(3)} + aKind);
          float vv = fase * fase;
          float a = (1.0 - vv) * ${RIEL_A.toFixed(3)};
          vec3 rad = uN * cos(a) - uD * sin(a);
          vec3 tg = normalize(uN * sin(a) + uD * cos(a));
          vec3 lado = normalize(cross(rad, tg));
          p = uM + rad * (uR + 0.0016) + tg * position.z + lado * position.x + rad * position.y;
          em *= uRiel * smoothstep(0.0, 0.05, fase) * step(vv, uRiel);
        `,
        post: LENTE,
        uniforms: { uRiel: { value: 0 }, uM: { value: M.clone() }, uN: { value: N_T.clone() }, uD: { value: D.clone() }, uR: { value: RM * 1.004 } },
      }),
    );
    cargas.u.uFuente.value = 0.6;

    const rd = rioDatos(90000);
    const rio = add(
      materia(rd.data, {
        pre: /* glsl */ `
          attribute vec2 aOff;
          uniform float uRio, uRioOn;
          uniform vec3 uTeal;
        `,
        move: /* glsl */ `
          float sv = fract(aKind + uTime * 0.016);
          float rv = ${RA.toFixed(2)} * pow(${(RB / RA).toFixed(5)}, sv);
          float ph = ${PHI0.toFixed(5)} + ${PHI.toFixed(5)} * sv;
          vec3 rh = vec3(sin(ph), 0.0, cos(ph));
          vec3 ee = vec3(cos(ph), 0.0, -sin(ph));
          float abre = 0.014 + 0.12 * sv + 0.9 * sv * sv * sv * sv;
          p = rh * rv + (ee * aOff.x + vec3(0.0, 1.0, 0.0) * aOff.y) * abre;
          em = mix(vec3(0.42, 0.4, 0.37), uTeal, smoothstep(0.0, 0.04, sv)) * (0.12 + 0.3 * fract(seed * 7.3));
          em *= step(sv, uRio) * (1.0 - smoothstep(0.8, 1.0, sv)) * uRioOn;
        `,
        post: LENTE,
        uniforms: { uRio: { value: 0 }, uRioOn: { value: 1 }, uTeal: { value: TEAL.clone() } },
        extra: { aOff: [rd.off, 2] },
      }),
    );
    rio.u.uFuente.value = 0.15;

    const enjambre = add(enjambreNube(teal), 10);

    // Revealing: the orbits, the worlds as marks (all ours), and the Sun itself ours now, ringed.
    const orbs = add(orbitas([{ r: M.length() }, { r: VE.length() }, { r: E.length() }, { r: Math.hypot(MA.x, MA.z), y: MA.y }]));
    const lasMarcas = add(
      marcas([
        { pos: E, R: RE, color: COLOR.tierra, nuestro: true },
        { pos: MA, R: RMA, color: COLOR.marte, nuestro: true },
        { pos: VE, R: RV, color: COLOR.venus, nuestro: true },
        { pos: M, R: RM, color: COLOR.mercurio, nuestro: true },
        { pos: V(), R: 0, color: TEAL, nuestro: true, aro: 96, sinPunto: true },
      ]),
    );
    const NOMBRES: Nombre[] = [
      { pos: V(), texto: 'Sol · el enjambre', nuestro: true, aire: 40 },
      { pos: E, texto: 'Tierra', nuestro: true },
      { pos: MA, texto: 'Marte', nuestro: true },
      { pos: VE, texto: 'Venus', nuestro: true, lado: 'o' },
      { pos: M, texto: 'Mercurio', nuestro: true, lado: 'o' },
    ];

    const listo = Promise.all([sol.listo, merc.listo]);

    // ---------------------------------------------------------------- the moments (GUION.md 25–28)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const rM = M.clone().normalize();
    const eM = Y.clone().cross(rM).normalize();
    // Mercury half lit: the Sun off to the side, the terminator down the middle of the disc.
    const lado = eM.clone().multiplyScalar(eM.dot(D) > 0 ? -1 : 1);
    const c0 = rigDe(M.clone().addScaledVector(lado.clone().addScaledVector(Y, 0.3).addScaledVector(rM, 0.25).normalize(), 1.75));
    const c1 = rigDe(M.clone().addScaledVector(lado.clone().addScaledVector(Y, 0.42).addScaledVector(rM, 0.05).normalize(), 1.45));
    // The rail and the river leaving it: from above and to the side, Mercury on one side of the frame.
    const c2 = rigDe(M.clone().addScaledVector(Y, 1.7).addScaledVector(lado, 1.6).addScaledVector(D, -0.9));
    const fuera = (sv: number) => camino(sv).addScaledVector(Y, 0.08).addScaledVector(Y.clone().cross(camino(sv + 0.001).sub(camino(sv)).normalize()), 0.05);
    const c3 = rigDe(fuera(0.04));
    // Off the river, outside the swarm, the Sun ahead; then far away.
    const lejos = rigDe(LEJOS);
    // The spark comes on from the system's act in mid air (vuelo.ts: one flight), and the camera
    // chasing it with it: across to Mercury, down onto its rail as onto the Moon's, fired along it as
    // the coils light (the loads fly with it), and down the river of rock towards the Sun; then round
    // the Sun among the collectors (the orbit below takes it over).
    const vuelo = vueloInterior();
    const T_C = vuelo.tauDe('corte');
    const T_M0 = vuelo.tauDe('merc0') - T_C;
    const T_RIO = vuelo.tauDe('rio1') - T_C;
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, ...c0, yaw: 90, pitch: -90, roll: 0, fov: 44, lw: 1, mx: 0, my: 0, vel: 0, sw: 0, swA: 0, swR: 0, swE: 0, swK: 0, swF: 40, mina: 0, riel: 0, rio: 0, rioOn: 1, cubre: 0, ir: 0, mapa: 0, nombres: 0 });
    tl.wait(T_M0 - 4.4);
    tl.label('mina').caption(3.2, 'Desarmar Mercurio', 'Para el enjambre hace falta materia. Máquinas que se copian deshacen Mercurio en menos de una vida.');
    luego(0, 4.4, { mina: 0.62 });
    // (the rail lights before the spark comes down onto it)
    luego(1.2, 1.6, { riel: 1 });
    tl.wait(3.4);
    const P_PARED = T_RIO - 3.4;
    tl.label('catapulta').caption(P_PARED - (T_M0 - 1.0) - 0.2, 'La catapulta', 'Sin aire que frene, un riel lanza la roca al espacio. Vamos en una carga.');
    luego(0.5, 5.0, { rio: 0.55 });
    tl.wait(P_PARED - tl.at('catapulta'));

    // The river carries the camera into the swarm's shell; off it, round the Sun among the
    // collectors (they cross its face, dark; they flash as they turn their light to us); and out
    // through the shell as it closes: from outside, the Sun goes out behind it.
    // One unbroken move from here to the end of the act (Diego, 30 Oct: the swarm is one of the
    // work's most important moments; fluid and cinematic, never back and forth): the river carries
    // the camera into the swarm's shell, and the camera goes on round the Sun, always the same way,
    // with the spark just ahead: down among the collectors (they cross the Sun's face, dark; they
    // flash as they turn its light to us; the nearest pass large), up through the shell as it
    // closes, and out, still turning, until the Sun is a dim point in its swarm far away.
    tl.label('pared').caption(12.6, 'La pared que tapa el Sol', 'No es una cáscara: es un enjambre, cada colector en su órbita. Desde afuera, el Sol se va apagando.');
    luego(0, 3.6, { rio: 1 });
    luego(0.4, 6.4, { cubre: 0.8 });
    tl.to(4.2, { sc: 0.93 });
    luego(-1.2, 1.4, { vel: 0.25 });
    luego(0.6, 1.6, { vel: 0 });
    luego(5.2, 3.2, { cubre: 1 });
    tl.wait(8.4);

    // The reveal: far out, the whole system ours, the Sun dim in its swarm; the names a moment; still.
    tl.label('lejos').caption(8.0, 'Visto desde lejos', 'Desde otra estrella, un Sol así se vería débil y tibio. Así buscamos a otros. Hasta ahora, nadie.');
    luego(0.6, 3.4, { ir: 1, rioOn: 0 });
    luego(2.6, 2.2, { mapa: 1 });
    luego(4.2, 1.4, { nombres: 1 });
    tl.wait(5.0);
    luego(1.6, 1.2, { nombres: 0 });
    luego(1.8, 1.2, { mapa: 0 });
    tl.wait(3.0);
    // The orbit's keys (laid over the moments above): its angle only grows; inside the shell, then
    // out to where the Sun's act takes over (LEJOS: the same place, one turn on).
    {
      const L0 = tl.at('lejos');
      const P0 = tl.at('pared');
      const fin = tl.length;
      const A_L = Math.atan2(LEJOS.x, LEJOS.z);
      const A0 = PHI0 + PHI * 0.95;
      const A_FIN = A_L + Math.PI * 2 * Math.ceil((A0 + 4 - A_L) / (Math.PI * 2));
      const E_L = THREE.MathUtils.radToDeg(Math.asin(LEJOS.y / LEJOS.length()));
      const clave = (b: number, v: Record<string, number>) => tl.keyAt(b, v);
      clave(P0 + 2.8, { sw: 0, swA: A0, swR: Math.log10(3.35), swE: 1.4, swK: 0.35, swF: 40 });
      clave(P0 + 5.6, { swK: 0.8 });
      clave(P0 + 4.8, { sw: 1 });
      clave(P0 + 6.8, { swR: Math.log10(2.9), swE: 4.5, swF: 54 });
      clave(P0 + 9.8, { swR: Math.log10(3.05), swE: -3.5, swK: 0.6 });
      clave(L0, { swA: A0 + (A_FIN - A0) * 0.62, swR: Math.log10(7.5), swE: 9, swK: 0.12, swF: 44 });
      clave(fin, { swA: A_FIN, swR: Math.log10(LEJOS.length()), swE: E_L, swK: 0, swF: 30 });
    }

    // The spark: the flight (on from the system's act), then round the Sun with the camera, a little
    // ahead of it, the same way (blended where the river's end meets the orbit).
    const orbitaEn = (q: number, out: THREE.Vector3) => {
      const a = tl.get('swA', q) + 0.05 + 0.37 * THREE.MathUtils.smoothstep(q, tl.at('pared') + 3.4, tl.at('pared') + 6.4);
      const R = THREE.MathUtils.lerp(3.2, 3.02, THREE.MathUtils.smoothstep(q, tl.at('pared') + 3.4, tl.at('pared') + 6.4));
      return out.set(Math.sin(a) * R, 0.02 + 0.12 * Math.sin(((q - tl.at('pared') - 3.4) / 8) * 2.2), Math.cos(a) * R);
    };
    const tmpO = V();
    const caminoCh: Camino = (sv, out) => {
      const tSw = tl.at('pared') + 3.4;
      vuelo.camino(T_C + sv, out);
      const k = THREE.MathUtils.smoothstep(sv, tSw - 0.5, tSw + 0.7);
      if (k > 0) out.lerp(orbitaEn(sv, tmpO), k);
      return out;
    };
    // (the spark is lit the whole act)
    tl.keyAt(0, { on: 1 });
    // The shots (chasis/toma.ts): round the spark all the act, as the old chase framed it (written
    // every 1.2 beats, its jitter averaged out): across to Mercury, down its rail, along the river,
    // round the Sun among the collectors with the spark to one side, and out until the Sun is a dim
    // point. It comes in on the contract from the system's act.
    tl.keyAt(0, { az: 170.5, el: 21.1, ld: 0.67, ...CONTRATO });
    let azM = 170.5;
    for (const [p, az, el, ld, mx, my, fov] of VUELO_MERCURIO) {
      const a = az + 360 * Math.round((azM - az) / 360);
      azM = a;
      tl.keyAt(p, { az: a, el, ld, mx, my, fov });
    }
    tl.keyAt(tl.length, { az: -43.9 + 360 * Math.round((azM + 43.9) / 360), el: 19.6, ld: 2.22, mx: 0.4, my: -0.3, fov: 30 });
    // First person (DIRECCION.md 26–27): from the system's act's handover on, the camera flies the way
    // itself: across to Mercury, held on it as it comes and as the rail fires (you ride a load), and
    // down the river of rock towards the Sun, until the swarm, where the written orbit takes it.
    const P_FP = tl.at('pared');
    const enPrimera = primeraPersona(caminoCh, [
      { c: M, R: RM, cerca: 0.75, destino: [0.4, T_M0 - 1.0], visita: [T_M0 - 3.2, T_M0 + 1.2] },
      // (down the river the Sun is the way's end: the gaze half on it, not on the river's far end, where
      // its rock piles into one glare)
      { c: V(), R: 1, cerca: 0.55, visita: [T_RIO - 7.5, P_FP + 3.6], alcance: 3 },
    ]);
    const q = V();
    const solV = V();
    const mercV = V();
    const aqui = V();
    const adelante = V();
    return {
      id: 'mercurio',
      tl,
      grupo: root as THREE.Group,
      listo,
      cerca: 1e-4,
      lejos: 2000,
      film: { strength: 0.6, radius: 0.55, threshold: 0.62, exposure: 1.05 },
      presencias: ['mina', 'riel', 'rio', 'rioOn', 'cubre', 'mapa', 'nombres'],
      salida: { pos: V(), escala: 1 },
      // (the system's act hands the flight over in mid air: the same flight, the same worlds)
      costura: 'cuadro',
      continuo: true,
      guia(p, out) {
        caminoCh(p, out);
        return true;
      },
      camara(p, ch, out) {
        plano(tl, p, ch, out);
        const w = THREE.MathUtils.smootherstep(p, 0.3, 1.9) * (1 - THREE.MathUtils.smootherstep(p, P_FP + 2.0, P_FP + 3.8));
        if (w > 0) mezclar(out, enPrimera(p), w, out);
      },
      escalera: false,
      efectos(p) {
        const rap = vuelo.velEn(T_C + p, V()).length() * (1 - tl.get('sw', p));
        return { vel: Math.max(0.14 * THREE.MathUtils.smoothstep(rap, 4, 12), tl.get('vel', p)) };
      },
      cuenta(p) {
        const c: Cuenta = p < tl.at('catapulta') ? potencia(16.6) : p < tl.at('pared') ? potencia(17.4) : potencia(18 + 8.58 * tl.get('cubre', p));
        // How far we reach: the five worlds, then the Sun itself, once the swarm closes.
        const sol1 = tl.at('pared') + 5.4;
        c.alcance = p < T_M0 ? '4 mundos' : p < sol1 ? '5 mundos' : '1 estrella';
        const desde = p >= sol1 ? sol1 : p >= T_M0 ? T_M0 : -1e9;
        c.nuevo = 1 - THREE.MathUtils.smoothstep(p, desde, desde + 1.8);
        return c;
      },
      placa(g, f) {
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
      },
      anio(p) {
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[0, 2058], [a('catapulta'), 2063], [a('pared'), 2070], [a('lejos'), 2085], [tl.length, 2090]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'III · El sistema solar trabaja', name: c.name, fact: c.fact } : null;
      },
      update(f: FrameActo) {
        const p = f.p;
        const t = f.time;
        const camera = f.camera;
        // Seen from outside the swarm, the Sun goes out behind it as it closes.
        const afuera = THREE.MathUtils.smoothstep(camera.position.length(), 2.6, 3.9);
        sol.u.uBrillo.value = 2.2 * (1 - 0.86 * tl.get('cubre', p) * afuera);
        sol.update({ sol: V(1, 0, 0), camara: camera.position.clone(), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: f.presencia });
        merc.update({ sol: M.clone().negate().normalize(), camara: camera.position.clone().sub(M).divideScalar(RM), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: f.presencia });
        minaU.uMina.value = tl.get('mina', p);
        minaU.uLejos.value = 0.3 + 0.7 * THREE.MathUtils.smoothstep(camera.position.distanceTo(M) / RM, 1.9, 4.0);
        riel.u.uRiel.value = tl.get('riel', p) * tl.get('rioOn', p);
        rielM.u.uRiel.value = riel.u.uRiel.value;
        rielM.u.uTime.value = t;
        cargas.u.uRiel.value = riel.u.uRiel.value;
        rio.u.uRio.value = tl.get('rio', p);
        rio.u.uRioOn.value = tl.get('rioOn', p);
        enjambre.u.uCubre.value = tl.get('cubre', p);
        enjambre.u.uIR.value = tl.get('ir', p);
        enjambre.u.uCam.value.copy(camera.position);

        // The Sun hides what is behind it; Mercury hides the river behind it.
        solV.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
        mercV.copy(M).applyMatrix4(camera.matrixWorldInverse);
        enjambre.u.uOcc.value.set(solV.x, solV.y, solV.z, 1.0);
        rio.u.uOcc.value.set(mercV.x, mercV.y, mercV.z, RM);
        riel.u.uOcc.value.set(mercV.x, mercV.y, mercV.z, RM * 0.998);
        rielM.u.uOcc.value.set(mercV.x, mercV.y, mercV.z, RM * 0.998);
        cargas.u.uOcc.value.set(mercV.x, mercV.y, mercV.z, RM * 0.998);
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        // (among the collectors, the nearest pass large)
        enjambre.u.uMaxPx.value = 70 * f.dpr;
        const mapa = tl.get('mapa', p);
        orbs.u.uOn.value = mapa;
        enfocarMarcas(lasMarcas, f.dpr, mapa);
        void q;
      },
    };
  },
};
