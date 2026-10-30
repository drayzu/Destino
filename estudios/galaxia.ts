import * as THREE from 'three';
import { EASE, Timeline } from './timeline';
import { DECADAS, LOG0, crearBurbuja, frente } from './burbuja';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { TEAL, potencia, anioEn } from './remake';
import { angulos, aplicarToma, toma } from './rig';
import { tierra as tierraH } from '../src/horizontes';
import { crearChispa, montar, type Camino } from './chispa';
import { S, brazo, galaxiaDatos, polvoDatos } from './apertura';
import { cuantas, enfocarMarcas, marcas, nombres, type Nombre } from './revelar';
import type { Cuenta, Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scenes 16–17 of ESCALETA.md, «La burbuja» and «¿Dónde están?» (GUION.md, moments 36–42). The same
 * galaxy as the opening (kly, the Sun 26 kly out), so it is recognised.
 *
 * The ship becomes a point crawling among the stars: light is slow here. A front of teal spreads from
 * the Sun, star after star, until the whole galaxy is ours: type III; and then it goes dark and warm,
 * as a galaxy that used all its light would look. None we have looked at does. Three encounters,
 * close: a blue living world that the front surrounds without touching (the zoo); stars that go out
 * as you look at them (the ones who keep quiet); a dead swarm adrift round a cold star (the Great
 * Filter). The edge of the galaxy, the dark, and a single star.
 *
 * The encounters are drawn far larger than they are (a world a few light-months across), each in a
 * group of its own so its small coordinates stay exact.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const D2R = THREE.MathUtils.degToRad;
const G = V();
/** Where the ship is, a little way from the Sun. */
const Q = S.clone().add(V(0.004, 0.0005, -0.003));
const enDisco = (R: number, j: number, off: number) => {
  const th = brazo(R, j) + off;
  return V(Math.sin(th) * R, 0.03, Math.cos(th) * R);
};
const ZOO = enDisco(30, 0, 0.5);
const CALLAN = enDisco(36, 1, 0.42);
const FILTRO = enDisco(42, 0, 0.62);
/** The single star past the edge. */
const UNA = enDisco(57, 1, 0.55).add(V(0, 0.4, 0));

/** The living world's own seas and lands (not ours): deep ocean, green and ochre lands, ice at the poles. */
const MUNDO_VIVO = /* glsl */ `
  float cv = fbm(n * 1.6 + vec3(3.1, 7.7, 1.3));
  float suelo = smoothstep(0.5, 0.53, cv);
  vec3 verde = mix(vec3(0.12, 0.26, 0.08), vec3(0.42, 0.34, 0.17), smoothstep(0.48, 0.72, fbm(n * 4.3 + 2.0)));
  float hielo = smoothstep(0.8, 0.9, abs(n.y) + 0.08 * fbm(n * 7.0));
  alb = mix(mix(vec3(0.025, 0.1, 0.27), verde, suelo), vec3(0.55, 0.58, 0.62), hielo);
`;

/** The probes that keep away: a still lattice round the living world, from three radii out (its units). */
function vigiasDatos(): MateriaData {
  const b = materiaBuilder(213);
  const n = 2200;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i;
    const q = 3.1 + b.r() * 0.6;
    b.push(Math.cos(th) * rr * q, y * q, Math.sin(th) * rr * q, TEAL, 0.03, 1.3);
  }
  return b.data();
}

/** A globular cluster: a few thousand old stars, crowded to the middle (its own units, radius ~1). */
function callanDatos(): MateriaData {
  const b = materiaBuilder(223);
  const c = new THREE.Color();
  for (let i = 0; i < 3200; i++) {
    const [x, y, z] = b.onSphere();
    const q = 0.08 + Math.pow(b.r(), 1.8) * 1.1;
    c.setRGB(1, 0.8, 0.58).lerp(new THREE.Color(0.78, 0.86, 1), b.r() * b.r());
    const brillo = 0.5 + 2.2 * Math.pow(b.r(), 6);
    b.push(x * q, y * q * 0.85, z * q, c, 0.006 + 0.01 * Math.pow(b.r(), 3), brillo);
  }
  return b.data();
}

/** A call: a sphere of teal that spreads from the spark (unit radius, scaled by the shader). */
function llamadaDatos(): MateriaData {
  const b = materiaBuilder(225);
  for (let i = 0; i < 5000; i++) {
    const [x, y, z] = b.onSphere();
    b.push(x, y, z, TEAL, 0.004, 0.22);
  }
  return b.data();
}

/** A dim red star (its own units: radius 1): points, a glow round them. */
function rojaDatos(): MateriaData {
  const b = materiaBuilder(227);
  const r = b.r;
  for (let i = 0; i < 14000; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.pow(r(), 0.25);
    b.push(x * q, y * q, z * q, new THREE.Color(1.0, 0.26, 0.1), 0.03, 0.09);
  }
  for (let i = 0; i < 2000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 1 + r() * r() * 1.6;
    b.push(x * q, y * q, z * q, new THREE.Color(0.8, 0.2, 0.08), 0.1, 0.018);
  }
  return b.data();
}

/**
 * A dead swarm: collectors, square and ash-grey, on a broken shell round the red star, tumbling
 * (they catch its light now and then); some adrift, out of the shell (its own units).
 */
function muertosDatos(): MateriaData {
  const b = materiaBuilder(229);
  const r = b.r;
  for (let i = 0; i < 52000; i++) {
    const [x, y, z] = b.onSphere();
    const roto = Math.sin(x * 5 + y * 3) * Math.sin(z * 4) > 0.2;
    if (roto && r() < 0.88) continue;
    const suelto = r() < 0.06;
    const q = suelto ? 3.3 + r() * 2.8 : 3.2 + gauss(r) * 0.06;
    const g = 0.35 + r() * 0.25;
    b.push(x * q, y * q, z * q, new THREE.Color(g * 1.1, g, g * 0.92), suelto ? 0.014 + r() * 0.03 : 0.012, 0.16 + r() * 0.12, { kind: suelto ? 1 : 0 });
  }
  return b.data();
}

export const galaxia: Escena = {
  id: 'galaxia',
  nombre: 'V · La galaxia',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'La nave se vuelve un punto; la burbuja de estrellas nuestras; tipo III, oscura y tibia; el zoológico, los que callan, el Gran Filtro; el borde.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.65;
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
    const estrellas = add(
      materia(galaxiaDatos(), {
        pre: /* glsl */ `uniform float uGal, uBur, uIR; uniform vec3 uSol, uTeal, uCamG;`,
        move: /* glsl */ `
          em *= smoothstep(0.25, 1.6, length(p - uCamG));
          // Ours: every star the front has reached is teal; the front itself brighter.
          float dS = length(p - uSol);
          float dentro = 1.0 - smoothstep(uBur - 1.5, uBur, dS);
          float frente = smoothstep(uBur - 2.5, uBur - 0.8, dS) * dentro;
          em = mix(em, uTeal * (0.55 + 0.6 * frente), dentro * step(0.18, fract(seed * 17.3)));
          // A galaxy that used all its light: dark, warm.
          em = mix(em, vec3(0.22, 0.05, 0.02) * (0.4 + 0.6 * fract(seed * 7.1)), uIR);
          em *= uGal;
        `,
        uniforms: { uGal: { value: 1 }, uBur: { value: 0 }, uIR: { value: 0 }, uSol: { value: S.clone() }, uTeal: { value: TEAL.clone() }, uCamG: { value: V() } },
      }),
    );
    estrellas.u.uFuente.value = 0.55;
    const polvo = add(materia(polvoDatos(), { pre: `uniform float uGal; uniform vec3 uCamG;`, move: `occ *= uGal * smoothstep(1.0, 4.0, length(p - uCamG));`, uniforms: { uGal: { value: 1 }, uCamG: { value: V() } } }), root, 2);
    polvo.u.uInk.value = 1;

    // A point that keeps a few pixels: the ship, and the single star at the end.
    const punto = (col: THREE.Color, luz: number) => {
      const b = materiaBuilder(5);
      b.push(0, 0, 0, col, 1, luz);
      for (let i = 0; i < 30; i++) {
        const [x, y, z] = b.onSphere();
        const q = Math.sqrt(b.r()) * 0.9;
        b.push(x * q, y * q, z * q, col, 0.5, luz * 0.12);
      }
      const n = materia(b.data());
      n.u.uFuente.value = 1;
      return n;
    };
    const nave = add(punto(TEAL, 2.0), root, 5);
    nave.points.position.copy(Q);
    const una = add(punto(new THREE.Color(1.0, 0.82, 0.6), 2.2), root, 5);
    una.points.position.copy(UNA);

    const grupo = (pos: THREE.Vector3, escala: number) => {
      const g = new THREE.Group();
      g.position.copy(pos);
      g.scale.setScalar(escala);
      root.add(g);
      return g;
    };
    // The living world: its own lands, the light of its star, turning; and the probes round it, kept away.
    const base = `${import.meta.env.BASE_URL}texturas/`;
    const R_ZOO = 0.0004;
    const zooG = grupo(ZOO, R_ZOO);
    const vivo = tierraH(base, { giro: 0.03, mar: false, puntos: 300000, superficie: { glsl: MUNDO_VIVO } });
    zooG.add(vivo.group);
    // Its star off to the side the camera turns towards: the world more and more lit as it goes.
    const SOL_ZOO = V(Math.cos(D2R(22)) * Math.sin(D2R(345)), Math.sin(D2R(22)), Math.cos(D2R(22)) * Math.cos(D2R(345)));
    const solZoo = add(punto(new THREE.Color(1.0, 0.92, 0.78), 2.6), root, 5);
    solZoo.points.position.copy(ZOO).addScaledVector(SOL_ZOO, R_ZOO * 90);
    const vigias = add(
      materia(vigiasDatos(), {
        pre: /* glsl */ `uniform float uOn;`,
        move: /* glsl */ `
          float ag = uTime * 0.012;
          p.xz = vec2(cos(ag) * p.x - sin(ag) * p.z, sin(ag) * p.x + cos(ag) * p.z);
          em *= uOn * (0.55 + 0.45 * sin(uTime * 1.1 + seed * 40.0));
        `,
        uniforms: { uOn: { value: 0 } },
      }),
      zooG,
      4,
    );
    vigias.u.uFuente.value = 0.6;

    // The cluster that keeps quiet: the spark calls, and every star the call reaches goes out.
    const R_CALLAN = 0.006;
    const callanG = grupo(CALLAN, R_CALLAN);
    const ORIGEN_LLAMADA = V(0.62, 0.22, 0.1);
    const callan = add(
      materia(callanDatos(), {
        pre: /* glsl */ `uniform float uOn, uCalla, uLlama; uniform vec3 uOrigen;`,
        move: /* glsl */ `
          float frente = uLlama * 1.5;
          float dl = length(p - uOrigen);
          float alcanzada = 1.0 - smoothstep(frente - 0.12, frente, dl);
          // At the front they flicker, then go out.
          float borde = smoothstep(frente - 0.35, frente - 0.12, dl) * alcanzada;
          float parpadeo = 0.5 + 0.5 * sin(uTime * 22.0 + seed * 90.0);
          em *= uOn * mix(1.0, 0.03, alcanzada * smoothstep(0.0, 0.05, uLlama)) * (1.0 + borde * parpadeo * 1.5);
        `,
        post: /* glsl */ `
          // And the ones you look at go out.
          vec2 ndc = gl_Position.xy / gl_Position.w;
          em *= mix(1.0, smoothstep(0.1, 0.5, length(ndc * vec2(1.6, 1.0))), uCalla);
        `,
        uniforms: { uOn: { value: 0 }, uCalla: { value: 0 }, uLlama: { value: 0 }, uOrigen: { value: ORIGEN_LLAMADA.clone() } },
      }),
      callanG,
      4,
    );
    callan.u.uFuente.value = 0.7;
    const llamada = add(
      materia(llamadaDatos(), {
        pre: /* glsl */ `uniform float uLlama; uniform vec3 uOrigen;`,
        move: /* glsl */ `
          float rr = uLlama * 1.5;
          p = uOrigen + p * rr;
          em *= smoothstep(0.0, 0.08, uLlama) * (1.0 - smoothstep(0.7, 1.0, uLlama));
        `,
        uniforms: { uLlama: { value: 0 }, uOrigen: { value: ORIGEN_LLAMADA.clone() } },
      }),
      callanG,
      5,
    );
    llamada.u.uFuente.value = 0.6;

    // The dead swarm round its red star.
    const R_FILTRO = 0.0005;
    const filtroG = grupo(FILTRO, R_FILTRO);
    const roja = add(materia(rojaDatos(), { pre: `uniform float uOn;`, move: `em *= uOn;`, uniforms: { uOn: { value: 0 } } }), filtroG, 3);
    roja.u.uFuente.value = 0.5;
    const muertos = add(
      materia(muertosDatos(), {
        cuadro: true,
        pre: /* glsl */ `uniform float uOn;`,
        move: /* glsl */ `
          // Drifting, and tumbling: now and then a face catches the red light.
          float ag = uTime * (aKind > 0.5 ? 0.02 : 0.008) * (0.6 + 0.8 * fract(seed * 9.1));
          p.xz = vec2(cos(ag) * p.x - sin(ag) * p.z, sin(ag) * p.x + cos(ag) * p.z);
          float cara = pow(abs(sin(uTime * (0.3 + 0.9 * fract(seed * 5.3)) + seed * 30.0)), 10.0);
          em = mix(em, vec3(1.0, 0.42, 0.22) * 0.9, cara * 0.8);
          em *= uOn;
        `,
        uniforms: { uOn: { value: 0 } },
      }),
      filtroG,
      4,
    );
    muertos.u.uFuente.value = 0.3;

    // ---------------------------------------------------------------- the moments (GUION.md 36–42)
    // Revealing: home ringed in teal, its name a moment (the galaxy names itself).
    const aroSol = add(marcas([{ pos: S, R: 0, color: new THREE.Color(1.0, 0.94, 0.82), nuestro: true }]), root, 40);
    const NOMBRES: Nombre[] = [
      { pos: S, texto: 'Sol', nuestro: true },
    ];
    /** How many stars a bubble this wide holds (units of this galaxy: ~830 light years). */
    const estrellasEn = (r: number) => {
      const A: [number, number][] = [[-2.3, 0.3], [-1.22, 3.3], [-0.22, 6.3], [0.78, 8.5], [1.53, 11], [2.08, 11.6]];
      const x = THREE.MathUtils.clamp(Math.log10(Math.max(r, 0.005)), A[0][0], A[A.length - 1][0]);
      let i = 0;
      while (x > A[i + 1][0]) i++;
      return Math.pow(10, THREE.MathUtils.mapLinear(x, A[i][0], A[i + 1][0], A[i][1], A[i + 1][1]));
    };
    let alcanceR = 0.005;

    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const Cn = (v: THREE.Vector3) => ({ cx: v.x, cy: v.y, cz: v.z });
    const D0 = 0.0006;
    // The spark's way (GUION.md v2, 39–45): copied from star to star outward from the ship (ch 0..1);
    // then to each encounter (2, 3, 4) and to the single star at the edge (5).
    const burb = crearBurbuja(S, ZOO.clone().sub(S).setY(0));
    add(burb.estrellas, root, 3);
    add(burb.hilos, root, 3);
    // (Where the camera ends up at each, so the spark waits in sight: among the probes, in the
    // cluster where its call starts, among the dead collectors; and beside the single star.)
    const dirDe = (az: number, el: number) => V(Math.cos(D2R(el)) * Math.sin(D2R(az)), Math.sin(D2R(el)), Math.cos(D2R(el)) * Math.cos(D2R(az)));
    const AZ_ZOO = 250;
    const AZ_FIL = 385;
    const paradas = [
      burb.hoja.clone(),
      ZOO.clone().addScaledVector(dirDe(AZ_ZOO + 30, 10), R_ZOO * 3.4).add(V(0, R_ZOO * 0.5, 0)),
      CALLAN.clone().addScaledVector(ORIGEN_LLAMADA, R_CALLAN),
      FILTRO.clone().addScaledVector(dirDe(AZ_FIL + 8, 7), R_FILTRO * 3.6).add(V(0, R_FILTRO * 0.3, 0)),
      UNA.clone().add(V(-0.0006, 0, 0)),
    ];
    const caminoCh: Camino = (sv, out) => {
      if (sv <= 1) return burb.rama(sv, out);
      const i = Math.min(Math.floor(sv - 1), paradas.length - 2);
      const t = THREE.MathUtils.smoothstep(sv - 1 - i, 0, 1);
      return out.copy(paradas[i]).lerp(paradas[i + 1], t);
    };
    tl.set({ ...Cn(Q), ox: 0, oy: 0, oz: 0, az: 120, el: 10, ld: LOG0 + 0.5, yaw: 90, pitch: -90, roll: 0, fov: 40, bur: 0, ir: 0, gal: 1, zoo: 0, callan: 0, calla: 0, filtro: 0, una: 0, ch: 0, lw: 0, tit: 0, mapa: 0, nombres: 0, llama: 0 });

    // Copied from star to star: the camera rides one branch, the stars it touches turn ours.
    // From star to star: the probes copy themselves at each star they reach and go on to the ones
    // around it, a network that branches like an organism. The camera rides one branch, then lets
    // go and pulls back at the very pace of the front (both in logarithm): at every scale, from a
    // few light years to thousands, the same network growing.
    tl.label('burbuja').caption(15.0, 'La burbuja', 'Sondas que se copian en cada estrella que tocan. Aunque vayan lento, el movimiento de las estrellas las reparte.');
    tl.with(1.2, { lw: 1 });
    tl.with(14.6, { ch: 1 }, EASE.sine);
    tl.with(14.6, { ld: LOG0 + DECADAS + 0.5 }, EASE.sine);
    luego(1.2, 1.6, { ...Cn(S) });
    luego(2.6, 2.6, { lw: 0 });
    tl.to(15.0, { az: 172, el: 30 });

    // The reveal: far back, the bubble spreads over the galaxy.
    tl.label('freno').caption(7.8, 'La luz pone el freno', 'La luz tarda cien mil años en cruzar la galaxia. Desde aquí, el tiempo se mide en millones de años.');
    luego(1.6, 4.2, { bur: 34 });
    luego(2.2, 2.6, { ...Cn(S.clone().lerp(G, 0.45)) });
    luego(3.4, 1.6, { mapa: 1 });
    luego(4.4, 1.4, { nombres: 1 });
    tl.to(5.8, { ld: 1.7, el: 40, az: 180 });
    tl.to(2.0, { az: 186 });

    tl.label('tipo').caption(5.4, 'Tipo III', 'Toda la luz de una galaxia: tipo III. Se vería oscura y tibia. Ninguna de las que revisamos es así.');
    luego(0.4, 1.0, { nombres: 0 });
    luego(3.4, 1.4, { mapa: 0 });
    tl.with(2.4, { bur: 120 });
    luego(2.6, 2.2, { ir: 1 });
    tl.to(5.4, { ...Cn(G), ld: 2.02, el: 62, az: 210 });

    // Down into the disc: three encounters, each a place of its own. The camera goes with the spark,
    // stays, and looks.
    const cerca = (a: number, ref: number) => a + 360 * Math.round((ref - a) / 360);

    // A living world, its own seas and lands, and round it a still lattice of probes that never
    // touch it. The spark takes its place among them.
    tl.label('zoo').caption(10.4, 'El zoológico', '¿Por qué no vemos a nadie? Quizá alguien nos vio y nos dejó tranquilos. Al pasar, nosotros también dejamos un mundo vivo en paz.');
    tl.with(1.2, { ...Cn(ZOO), ir: 0.35 });
    luego(0.6, 2.2, { zoo: 1 });
    luego(0.4, 3.4, { ch: 2 });
    tl.to(3.2, { ld: Math.log10(R_ZOO * 9), el: 16, az: AZ_ZOO });
    tl.to(3.4, { ld: Math.log10(R_ZOO * 4.4), el: 10, az: AZ_ZOO + 22, fov: 38 });
    tl.to(3.8, { ld: Math.log10(R_ZOO * 4.0), el: 7, az: AZ_ZOO + 44 });

    // A crowded cluster of old stars. In among them, the spark calls; every star the call reaches
    // goes out, and the ones you look at too.
    tl.label('callan').caption(10.0, 'Los que callan', 'O callan a propósito, porque hacerse oír puede ser peligroso.');
    luego(0.6, 1.2, { zoo: 0 });
    luego(0.6, 1.8, { ...Cn(CALLAN) });
    luego(1.4, 1.4, { callan: 1 });
    luego(0.6, 2.6, { ch: 3 });
    luego(4.6, 4.2, { llama: 1 });
    luego(6.4, 2.4, { calla: 1 });
    tl.to(2.2, { ld: 0.4, el: 20, az: 300 });
    tl.to(2.4, { ld: Math.log10(R_CALLAN * 1.8), el: 14, az: 322 });
    tl.to(2.6, { ld: Math.log10(R_CALLAN * 0.55), el: 9, az: 345, fov: 54 });
    tl.to(2.8, { az: 376, el: 3 });

    // A swarm that died: square collectors adrift round a cold red star, now and then one catching
    // its light. The spark flickers, as if it too would go out.
    tl.label('filtro').caption(10.6, 'El Gran Filtro', 'O casi todas se apagan antes de llegar tan lejos, como este enjambre muerto. ¿Ese filtro quedó atrás, o nos espera?');
    luego(0.4, 1.2, { callan: 0, calla: 0 });
    luego(0.6, 1.8, { ...Cn(FILTRO) });
    luego(1.6, 1.6, { filtro: 1 });
    luego(0.6, 2.8, { ch: 4 });
    luego(4.4, 2.0, { tit: 1 });
    tl.to(2.2, { ld: 0.45, el: 22, az: 340 });
    tl.to(2.6, { ld: Math.log10(R_FILTRO * 10), el: 14, az: AZ_FIL - 20 });
    tl.to(3.0, { ld: Math.log10(R_FILTRO * 6.2), el: 9, az: AZ_FIL, fov: 46 });
    tl.to(2.8, { ld: Math.log10(R_FILTRO * 5.4), az: AZ_FIL + 14, el: 5 });

    // The edge. Out past the last stars: the whole galaxy from its rim, ours; then round, to face
    // out: black, and one star.
    const azFuera = cerca(angulos(UNA.clone().sub(G).setY(0)).az, AZ_FIL + 14);
    tl.label('borde').caption(11.6, 'El borde y el silencio', 'Llegamos al borde, y vuelve la pregunta del principio: ¿dónde están todos? Quizá se fueron hacia adentro.');
    luego(0.4, 1.2, { filtro: 0 });
    luego(0.8, 2.2, { ...Cn(UNA), una: 1 });
    luego(0.2, 0.6, { tit: 0 });
    luego(0.8, 4.4, { ch: 5 });
    luego(0.4, 2.4, { ir: 0 });
    tl.to(2.6, { ld: 1.1, el: 26, az: azFuera, fov: 46 });
    tl.to(3.0, { ld: 0.95, el: 20, az: azFuera + 8 });
    tl.to(3.4, { ld: -0.4, el: 6, az: azFuera + 150 });
    tl.to(2.6, { ld: Math.log10(0.0021), el: 4, az: azFuera + 180, fov: 44 });

    const chispa = crearChispa();
    root.add(chispa.nube.points);
    const tm = toma(tl, 0);
    const camFin = toma(tl, tl.length);
    return {
      tl,
      listo: vivo.listo,
      entrada: { pos: Q.clone(), escala: D0 / 9 },
      salida: { pos: UNA.clone(), escala: camFin.pos.distanceTo(UNA) / 21 },
      escalera: false,
      cuenta(p) {
        // The power: the light of every star reached (two at first, the whole galaxy at the end).
        const n = Math.max(2, estrellasEn(alcanceR));
        const c: Cuenta = p < tl.at('tipo') + 2.4 ? potencia(Math.min(37, 27.4 + Math.log10(n / 2) * 0.85)) : potencia(37);
        // How far we reach: the stars inside the bubble, then the whole galaxy.
        const toda = tl.at('tipo') + 2.4;
        c.alcance = p < toda ? cuantas(n, 'estrella', 'estrellas') : 'la galaxia';
        c.nuevo = p >= toda ? 1 - THREE.MathUtils.smoothstep(p, toda, toda + 1.8) : 0;
        return c;
      },
      placa(g, f) {
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
      },
      // The years: the bubble's own, at an even twentieth of the speed of light (stopping at each
      // star to copy itself); then the encounters, deep in the galaxy's time.
      anio(p) {
        const burbuja = 2500 + (alcanceR * 830) / 0.05;
        if (p < tl.at('zoo')) return burbuja;
        return anioEn(p, [[tl.at('zoo'), burbuja], [tl.length, 3e6]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'V · La galaxia', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-8;
        camera.far = 2000;
        const ch = tl.get('ch', p);
        const lw = tl.get('lw', p);
        const m = montar(caminoCh, ch, 0.03, 0.06, ch < 1 ? 0.3 * frente(ch) : 0.02);
        aplicarToma(camera, toma(tl, p, tm, { punto: m.mira, peso: lw }, { punto: m.lugar, peso: lw }));
        chispa.update(caminoCh, ch, 0.0015, 1, tl.get('tit', p), camera.position, f.focal, f.dpr, f.time);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        const red = Math.min(1, Math.max(0, ch));
        estrellas.u.uBur.value = Math.max(tl.get('bur', p), frente(red));
        burb.estrellas.u.uRed.value = red;
        burb.hilos.u.uRed.value = red;
        burb.hilos.u.uOn.value = 1 - 0.85 * tl.get('ir', p);
        // The reach counts from where the spark has been (the bubble's own edge once it spreads).
        alcanceR = Math.max(tl.get('bur', p), frente(red));
        estrellas.u.uIR.value = tl.get('ir', p);
        estrellas.u.uCamG.value.copy(camera.position);
        polvo.u.uCamG.value.copy(camera.position);
        const px = (n: number, en: THREE.Vector3) => (n * camera.position.distanceTo(en)) / f.focal;
        nave.u.uSizeUnit.value = px(6, Q);
        nave.u.uGain.value = 0;
        una.u.uSizeUnit.value = px(7, UNA);
        una.u.uGain.value = tl.get('una', p);
        // The living world: lit by its star, turning; seen from the camera (both in its radii).
        const zooOn = tl.get('zoo', p);
        zooG.visible = zooOn > 0.001;
        if (zooG.visible) vivo.update({ sol: SOL_ZOO, camara: camera.position.clone().sub(ZOO).divideScalar(R_ZOO), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: zooOn });
        vigias.u.uOn.value = zooOn;
        polvo.u.uGal.value = 1 - Math.max(zooOn, tl.get('filtro', p));
        solZoo.u.uGain.value = zooOn;
        solZoo.u.uSizeUnit.value = px(9, solZoo.points.position);
        const callOn = tl.get('callan', p);
        callan.u.uOn.value = callOn;
        callan.u.uCalla.value = tl.get('calla', p);
        callan.u.uLlama.value = tl.get('llama', p);
        llamada.u.uLlama.value = tl.get('llama', p) * callOn;
        const filOn = tl.get('filtro', p);
        roja.u.uOn.value = filOn;
        muertos.u.uOn.value = filOn;
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        enfocarMarcas(aroSol, f.dpr, tl.get('mapa', p));
        estrellas.u.uMaxPx.value = 3.2 * f.dpr;
        vigias.u.uSizeUnit.value = R_ZOO;
        callan.u.uSizeUnit.value = R_CALLAN;
        llamada.u.uSizeUnit.value = R_CALLAN;
        callan.u.uMaxPx.value = 14 * f.dpr;
        roja.u.uSizeUnit.value = R_FILTRO;
        muertos.u.uSizeUnit.value = R_FILTRO;
        muertos.u.uMaxPx.value = 24 * f.dpr;
        void Y;
      },
      dispose() {},
    };
  },
};
