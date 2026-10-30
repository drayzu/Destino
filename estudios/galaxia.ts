import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { TEAL, potencia } from './remake';
import { aplicarToma, toma } from './rig';
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

/** A blue world (points; its own units, radius 1) and a shell of teal probes round it at a distance, with a gap facing the world: kept away. */
function zooDatos(): MateriaData {
  const b = materiaBuilder(211);
  const r = b.r;
  const ga = Math.PI * (3 - Math.sqrt(5));
  const c = new THREE.Color();
  for (let i = 0; i < 26000; i++) {
    const y = 1 - ((i + 0.5) / 26000) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i;
    const x = Math.cos(th) * rr;
    const z = Math.sin(th) * rr;
    const tierra = Math.sin(x * 5 + Math.sin(z * 4)) * Math.sin(z * 6 + y * 3) > 0.25;
    const nube = Math.sin(x * 11 + y * 7) * Math.sin(z * 9) > 0.55;
    c.set(nube ? 0xf2f4f8 : tierra ? 0x4f7f43 : 0x1d4f9a);
    b.push(x, y, z, c, 0.035, nube ? 0.5 : 0.32, { kind: 0 });
  }
  for (let i = 0; i < 9000; i++) {
    const [x, y, z] = b.onSphere();
    if (z > 0.35) continue;
    b.push(x * 3.2, y * 3.2, z * 3.2, TEAL, 0.03, 0.7, { kind: 1 });
  }
  return b.data();
}

/** A cluster of stars (its own units). */
function callanDatos(): MateriaData {
  const b = materiaBuilder(223);
  const c = new THREE.Color();
  for (let i = 0; i < 700; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(b.r()) * 1;
    c.setRGB(1, 0.86, 0.68).lerp(new THREE.Color(0.75, 0.84, 1), b.r());
    b.push(x * q, y * q * 0.6, z * q, c, 0.02, 1.4);
  }
  return b.data();
}

/** A dead swarm: ash-grey collectors on a broken shell round a dim red star, some adrift (its own units: the star's radius is 1). */
function filtroDatos(): MateriaData {
  const b = materiaBuilder(227);
  const r = b.r;
  for (let i = 0; i < 1800; i++) {
    const [x, y, z] = b.onSphere();
    const q = r() * 0.95;
    b.push(x * q, y * q, z * q, new THREE.Color(1.0, 0.35, 0.18), 0.12, 0.5, { kind: 0 });
  }
  for (let i = 0; i < 46000; i++) {
    const [x, y, z] = b.onSphere();
    const roto = Math.sin(x * 5 + y * 3) * Math.sin(z * 4) > 0.2;
    if (roto && r() < 0.85) continue;
    const q = 3.2 + gauss(r) * 0.08 + (r() < 0.05 ? r() * 3 : 0);
    b.push(x * q, y * q, z * q, new THREE.Color(0.5, 0.48, 0.45), 0.03, 0.16 + r() * 0.12, { kind: 1 });
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
    const zooG = grupo(ZOO, 0.0004);
    const zoo = add(materia(zooDatos(), { pre: `uniform float uOn;`, move: `em *= uOn; if (aKind > 0.5) em *= 0.5 + 0.5 * sin(uTime * 0.8 + seed * 20.0);`, uniforms: { uOn: { value: 0 } } }), zooG, 4);
    const callanG = grupo(CALLAN, 0.006);
    const callan = add(
      materia(callanDatos(), {
        pre: /* glsl */ `uniform float uOn, uCalla;`,
        post: /* glsl */ `
          // The ones you look at go out.
          vec2 ndc = gl_Position.xy / gl_Position.w;
          em *= mix(1.0, smoothstep(0.12, 0.55, length(ndc * vec2(1.6, 1.0))), uCalla);
        `,
        move: `em *= uOn;`,
        uniforms: { uOn: { value: 0 }, uCalla: { value: 0 } },
      }),
      callanG,
      4,
    );
    const filtroG = grupo(FILTRO, 0.0005);
    const filtro = add(
      materia(filtroDatos(), {
        pre: /* glsl */ `uniform float uOn;`,
        move: /* glsl */ `
          float ag = uTime * 0.03 * (1.0 + 0.3 * fract(seed * 9.1));
          if (aKind > 0.5) p.xz = vec2(cos(ag) * p.x - sin(ag) * p.z, sin(ag) * p.x + cos(ag) * p.z);
          em *= uOn;
        `,
        uniforms: { uOn: { value: 0 } },
      }),
      filtroG,
      4,
    );

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
    const fuera = S.clone().setY(0).normalize();
    const lado = V(0, 1, 0).cross(fuera).normalize();
    const saltos = new THREE.CatmullRomCurve3([
      Q.clone(),
      Q.clone().addScaledVector(fuera, 0.25).addScaledVector(lado, 0.12).add(V(0, 0.02, 0)),
      Q.clone().addScaledVector(fuera, 0.7).addScaledVector(lado, -0.1).add(V(0, -0.03, 0)),
      Q.clone().addScaledVector(fuera, 1.3).addScaledVector(lado, 0.3).add(V(0, 0.04, 0)),
      Q.clone().addScaledVector(fuera, 2.2).addScaledVector(lado, 0.1).add(V(0, 0.0, 0)),
    ]);
    const paradas = [saltos.getPoint(1), ZOO.clone().add(V(0.002, 0.0006, 0.001)), CALLAN.clone().add(V(0.004, 0.002, 0)), FILTRO.clone().add(V(0.004, 0.0012, 0.001)), UNA.clone().add(V(-0.0006, 0, 0))];
    const caminoCh: Camino = (sv, out) => {
      if (sv <= 1) return out.copy(saltos.getPoint(Math.max(0, sv)));
      const i = Math.min(Math.floor(sv - 1), paradas.length - 2);
      const t = THREE.MathUtils.smoothstep(sv - 1 - i, 0, 1);
      return out.copy(paradas[i]).lerp(paradas[i + 1], t);
    };
    tl.set({ ...Cn(Q), ox: 0, oy: 0, oz: 0, az: 120, el: 10, ld: Math.log10(D0), yaw: 90, pitch: -90, roll: 0, fov: 40, bur: 0, ir: 0, gal: 1, zoo: 0, callan: 0, calla: 0, filtro: 0, una: 0, ch: 0, lw: 0, tit: 0, mapa: 0, nombres: 0 });

    // Copied from star to star: the camera rides one branch, the stars it touches turn ours.
    tl.label('burbuja').caption(6.4, 'La burbuja', 'Sondas que se copian en cada estrella que tocan. Aunque vayan lento, el movimiento de las estrellas las reparte.');
    tl.with(1.2, { lw: 1 });
    tl.to(6.4, { ch: 1 });

    // The reveal: far back, the bubble spreads over the galaxy.
    tl.label('freno').caption(7.8, 'La luz pone el freno', 'La luz tarda cien mil años en cruzar la galaxia. Desde aquí, el tiempo se mide en millones de años.');
    tl.with(1.4, { lw: 0, ...Cn(paradas[0]), ld: -0.6, az: 150, el: 20 });
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

    // Down into the disc: three encounters.
    tl.label('zoo').caption(5.4, 'El zoológico', '¿Por qué no vemos a nadie? Quizá alguien nos vio y nos dejó tranquilos. Al pasar, nosotros también dejamos un mundo vivo en paz.');
    tl.with(1.2, { ...Cn(ZOO), ir: 0.35 });
    luego(1.4, 1.4, { zoo: 1 });
    luego(0.4, 2.0, { ch: 2 });
    tl.to(3.2, { ld: Math.log10(0.004), el: 14, az: 250 });
    tl.to(2.2, { ld: Math.log10(0.0032), az: 275 });

    tl.label('callan').caption(5.0, 'Los que callan', 'O callan a propósito, porque hacerse oír puede ser peligroso.');
    luego(0.6, 1.0, { zoo: 0 });
    luego(0.6, 1.6, { ...Cn(CALLAN) });
    luego(1.6, 1.2, { callan: 1 });
    luego(0.6, 2.4, { ch: 3 });
    luego(2.6, 2.0, { calla: 1 });
    tl.to(2.0, { ld: 0.5, el: 20, az: 300 });
    tl.to(3.0, { ld: Math.log10(0.016), el: 10, az: 320 });

    tl.label('filtro').caption(5.4, 'El Gran Filtro', 'O casi todas se apagan antes de llegar tan lejos, como este enjambre muerto. ¿Ese filtro quedó atrás, o nos espera?');
    luego(0.4, 1.0, { callan: 0, calla: 0 });
    luego(0.6, 1.6, { ...Cn(FILTRO) });
    luego(1.6, 1.4, { filtro: 1 });
    luego(0.6, 2.4, { ch: 4 });
    luego(3.0, 1.8, { tit: 1 });
    tl.to(2.0, { ld: 0.5, el: 22, az: 340 });
    tl.to(3.4, { ld: Math.log10(0.0045), el: 12, az: 370 });

    tl.label('borde').caption(5.8, 'El borde y el silencio', 'Llegamos al borde, y vuelve la pregunta del principio: ¿dónde están todos? Quizá se fueron hacia adentro.');
    luego(0.4, 1.2, { filtro: 0 });
    luego(0.8, 2.0, { ...Cn(UNA), una: 1 });
    luego(0.2, 0.6, { tit: 0 });
    luego(0.8, 3.0, { ch: 5 });
    luego(0.4, 2.4, { ir: 0 });
    tl.to(2.6, { ld: 0.9, el: 8, az: 395 });
    tl.to(3.2, { ld: Math.log10(0.0021), el: 4, az: 410 });

    const chispa = crearChispa();
    root.add(chispa.nube.points);
    const tm = toma(tl, 0);
    const camFin = toma(tl, tl.length);
    return {
      tl,
      entrada: { pos: Q.clone(), escala: D0 / 9 },
      salida: { pos: UNA.clone(), escala: camFin.pos.distanceTo(UNA) / 21 },
      escalera: false,
      cuenta(p) {
        const c: Cuenta = p < tl.at('burbuja') ? potencia(27.4) : p < tl.at('tipo') ? potencia(27.4 + (tl.get('bur', p) / 34) * 6) : potencia(37);
        // How far we reach: the stars inside the bubble, then the whole galaxy.
        const toda = tl.at('tipo') + 2.4;
        c.alcance = p < toda ? cuantas(Math.max(2, estrellasEn(alcanceR)), 'estrella', 'estrellas') : 'la galaxia';
        c.nuevo = p >= toda ? 1 - THREE.MathUtils.smoothstep(p, toda, toda + 1.8) : 0;
        return c;
      },
      placa(g, f) {
        nombres(g, f, NOMBRES, tl.get('nombres', f.p));
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
        const m = montar(caminoCh, ch, 0.03, 0.06, 0.02);
        aplicarToma(camera, toma(tl, p, tm, { punto: m.mira, peso: lw }, { punto: m.lugar, peso: lw }));
        chispa.update(caminoCh, ch, 0.0015, 1, tl.get('tit', p), camera.position, f.focal, f.dpr, f.time);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        estrellas.u.uBur.value = Math.max(tl.get('bur', p), p < tl.at('freno') + 2 ? chispa.pos.distanceTo(S) + 0.2 : 0);
        // The reach counts from where the spark has been (the bubble's own edge once it spreads).
        alcanceR = Math.max(tl.get('bur', p), p < tl.at('freno') + 2 ? chispa.pos.distanceTo(S) : 0);
        estrellas.u.uIR.value = tl.get('ir', p);
        estrellas.u.uCamG.value.copy(camera.position);
        polvo.u.uCamG.value.copy(camera.position);
        const px = (n: number, en: THREE.Vector3) => (n * camera.position.distanceTo(en)) / f.focal;
        nave.u.uSizeUnit.value = px(6, Q);
        nave.u.uGain.value = 0;
        una.u.uSizeUnit.value = px(7, UNA);
        una.u.uGain.value = tl.get('una', p);
        zoo.u.uOn.value = tl.get('zoo', p);
        callan.u.uOn.value = tl.get('callan', p);
        callan.u.uCalla.value = tl.get('calla', p);
        filtro.u.uOn.value = tl.get('filtro', p);
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        enfocarMarcas(aroSol, f.dpr, tl.get('mapa', p));
        estrellas.u.uMaxPx.value = 3.2 * f.dpr;
        zoo.u.uSizeUnit.value = zooG.scale.x;
        callan.u.uSizeUnit.value = callanG.scale.x;
        filtro.u.uSizeUnit.value = filtroG.scale.x;
        void Y;
      },
      dispose() {},
    };
  },
};
