import * as THREE from 'three';
import { Timeline } from '../../estudios/timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from '../../estudios/motor/materia';
import { gauss } from '../../estudios/motor/math';
import { ease, mapaTierra } from '../../estudios/comun';
import { pantalla, FONDOS } from '../../estudios/motor/pantalla';
import { tierra as tierraHorizontes } from '../../src/horizontes';
import { FONT, ink, type Cuenta, type Rotulo } from '../../estudios/placa';
import { capaLuz, caraHacia, potencia, puntoTu, anioEn } from '../../estudios/remake';
import { CARA, SOL, llegada, luces } from './tierra';
import { mezclar, toma as plano, vuelo } from '../toma';
import type { Acto, EscenaChasis, FrameActo } from '../tipos';

/**
 * Scenes 4–5 of ESCALETA.md: «Lo que piensa» and «Ocho mil millones» (GUION.md, moments 10–14).
 *
 * The yellow star's light fills the frame, and that light is the light coming down into the sea of
 * the young Earth. In the blue, a cell: a membrane of points that shrinks when the light touches it.
 * It becomes many, joined by threads, a net like a jellyfish of light with sparks running along it.
 * The net grows and folds into a brain; the camera goes inside, among neurons and pulses, and there
 * the teal point lights: twenty watts, like yours. Pulling back out, the same network of light lays
 * itself over the night Earth: its knots are our cities. Some turn a colder white and grow: the
 * machines that think.
 *
 * Units: Earth radii at the end (the brain is drawn the size of the Earth it turns into).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** What passes by the lens fades out instead of growing into a blot (the flight goes through it all). */
const LENTE = /* glsl */ `
  float dCam = length(mv.xyz) / max(uEscalaMundo, 1e-30);
  em *= smoothstep(0.012, 0.06, dCam);
  occ *= smoothstep(0.012, 0.06, dCam);
`;
const VIOLETA = new THREE.Color(0.66, 0.5, 1.0);
const CORAL = new THREE.Color(1.0, 0.5, 0.42);
const MAR = new THREE.Color(0.35, 0.62, 0.9);

/** The cell: a membrane, its inside and its nucleus; and motes in the water round it. */
function celulaDatos(): MateriaData {
  const b = materiaBuilder(101);
  const r = b.r;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 9000; i++) {
    const y = 1 - ((i + 0.5) / 9000) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i;
    b.push(Math.cos(th) * rr * 0.42, y * 0.42, Math.sin(th) * rr * 0.42, new THREE.Color(0.6, 0.86, 1.0), 0.006, 0.55, { kind: 0 });
  }
  for (let i = 0; i < 2500; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r()) * 0.36;
    b.push(x * q, y * q, z * q, new THREE.Color(0.5, 0.75, 0.95), 0.005, 0.22, { kind: 1 });
  }
  for (let i = 0; i < 900; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(r()) * 0.1;
    b.push(x * q + 0.06, y * q - 0.03, z * q, new THREE.Color(0.75, 0.82, 1.0), 0.006, 0.5, { kind: 1 });
  }
  // The sea: motes drifting, all round.
  for (let i = 0; i < 16000; i++) {
    const [x, y, z] = b.onSphere();
    const q = 0.6 + Math.cbrt(r()) * 5;
    b.push(x * q, y * q, z * q, MAR, 0.004 + r() * 0.006, 0.12 + r() * 0.2, { kind: 2 });
  }
  return b.data();
}

/** The net: a bell of radial nerves and a ring at its rim, with fine threads between; `aKind` 0 nerve, 1 fine, 2 tentacle; `aDelay` how far along. */
const campana = (t: number, a: number) => {
  const ph = t * 1.35;
  return V(Math.sin(ph) * Math.cos(a), Math.cos(ph) * 0.75 - 0.2, Math.sin(ph) * Math.sin(a)).multiplyScalar(1.1);
};

function redNerviosaDatos(): MateriaData {
  const b = materiaBuilder(103);
  const r = b.r;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    for (let i = 0; i < 700; i++) {
      const t = r();
      const p = campana(t, a);
      b.push(p.x + gauss(r) * 0.006, p.y + gauss(r) * 0.006, p.z + gauss(r) * 0.006, VIOLETA, 0.008, 0.55, { kind: 0, delay: t });
    }
  }
  // (the ring that joins them grows out from each strand's tip, to meet the next one halfway: whole
  // at once it popped up from nothing)
  for (let i = 0; i < 4000; i++) {
    const a = r() * Math.PI * 2;
    const p = campana(1, a);
    const medio = Math.abs(((a / (Math.PI * 2)) * 16) % 1 - 0.5);
    b.push(p.x, p.y + gauss(r) * 0.01, p.z, VIOLETA, 0.008, 0.6, { kind: 0, delay: 1 + 0.18 * (1 - 2 * medio) });
  }
  for (let i = 0; i < 9000; i++) {
    const p = campana(0.15 + r() * 0.85, r() * Math.PI * 2);
    b.push(p.x, p.y, p.z, VIOLETA, 0.005, 0.18, { kind: 1, delay: r() });
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const p0 = campana(1, a);
    for (let i = 0; i < 260; i++) {
      const t = r();
      b.push(p0.x * (1 - 0.15 * t) + Math.sin(t * 9 + k) * 0.03, p0.y - t * 1.4, p0.z * (1 - 0.15 * t) + Math.cos(t * 7 + k) * 0.03, VIOLETA, 0.005, 0.3, { kind: 2, delay: t });
    }
  }
  return b.data();
}

/**
 * A point of the brain's surface from a direction: two hemispheres apart (the fissure), the temporal
 * lobes low at the sides, folds (gyri and sulci). Returns the place and how much it is a ridge (0..1),
 * so ridges shine and grooves stay dark: the folds read in points.
 */
function corteza(d: THREE.Vector3): [THREE.Vector3, number] {
  const pliegue = Math.sin(10 * d.x + 3 * Math.sin(8 * d.y) + 2 * Math.sin(6 * d.z)) * Math.sin(12 * d.z + 2 * Math.sin(6 * d.x) + 3 * Math.sin(5 * d.y));
  const f = 1 + 0.045 * pliegue;
  const p = V(d.x * 0.78, d.y * 0.66, d.z * 1.0).multiplyScalar(f);
  p.x += Math.sign(d.x || 1) * 0.1;
  // The temporal lobes: lower and forward at the sides.
  const tem = Math.exp(-((d.y + 0.45) ** 2) / 0.05) * Math.exp(-((d.z - 0.1) ** 2) / 0.25) * Math.abs(d.x);
  p.y -= 0.12 * tem;
  p.x += Math.sign(d.x || 1) * 0.06 * tem;
  if (d.y < -0.25) p.y = -0.25 * 0.66 + (p.y + 0.25 * 0.66) * 0.55;
  return [p, Math.max(0, pliegue)];
}

/**
 * The brain: its folded cortex, and a network of neurons inside (knots and threads). The network's
 * points also know where they go on the night Earth (`position`) and start in the brain (`aFrom`):
 * the same light, reordered into our cities. `aDat`: kind (0 knot, 1 thread), along, phase, city size.
 */
function cerebroDatos(img: ImageData) {
  const corteza0 = materiaBuilder(107);
  const r = corteza0.r;
  for (let i = 0; i < 70000; i++) {
    const [x, y, z] = corteza0.onSphere();
    const [p, g] = corteza(V(x, y, z));
    corteza0.push(p.x, p.y, p.z, CORAL, 0.006, 0.05 + 0.5 * g * g);
  }
  // The cerebellum, finely striped, low at the back.
  for (let i = 0; i < 9000; i++) {
    const [x, y, z] = corteza0.onSphere();
    const raya = 0.5 + 0.5 * Math.sin(y * 40);
    corteza0.push(x * 0.42, y * 0.2 - 0.42, z * 0.26 - 0.72, CORAL, 0.005, 0.06 + 0.35 * raya * raya);
  }
  // The network inside.
  const nodos: THREE.Vector3[] = [];
  while (nodos.length < 1800) {
    const p = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    const q = V(p.x / 0.8, p.y / 0.62, p.z / 0.96);
    if (q.lengthSq() < 0.92) nodos.push(p);
  }
  const red = materiaBuilder(109);
  const dat: number[] = [];
  const posiciones: [number, number, number][] = [];
  const BLANCO = new THREE.Color(1.0, 0.86, 0.76);
  for (const n of nodos) {
    for (let k = 0; k < 10; k++) {
      posiciones.push([n.x + gauss(r) * 0.008, n.y + gauss(r) * 0.008, n.z + gauss(r) * 0.008]);
      dat.push(0, 0, r(), 0);
    }
  }
  const hechos = new Set<string>();
  // (the links as continuous fibres too: drawn as lines while it is a brain)
  const fibras: number[] = [];
  const fibraT: number[] = [];
  nodos.forEach((n, i) => {
    const cerca = nodos
      .map((m, j) => ({ j, d: m.distanceTo(n) }))
      .filter((x) => x.j !== i)
      .sort((a, z) => a.d - z.d)
      .slice(0, 3);
    for (const { j, d } of cerca) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (hechos.has(key)) continue;
      hechos.add(key);
      const m = nodos[j];
      const cuantos = Math.round(d * 160);
      const fase = r();
      fibras.push(n.x, n.y, n.z, m.x, m.y, m.z);
      fibraT.push(i < j ? 0 : 1, fase, i < j ? 1 : 0, fase);
      for (let q = 0; q < cuantos; q++) {
        const t = r();
        posiciones.push([n.x + (m.x - n.x) * t, n.y + (m.y - n.y) * t, n.z + (m.z - n.z) * t]);
        dat.push(1, i < j ? t : 1 - t, fase, 0);
      }
    }
  });
  // Where each one goes: a light of the night Earth (the Earth turned as in scene 6).
  const l = luces(img, false);
  const n = posiciones.length;
  const q = caraHacia(CARA.lat, CARA.lon);
  const destino = V();
  const total = l.data.position.length / 3;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * total);
    destino.set(l.data.position[k * 3], l.data.position[k * 3 + 1], l.data.position[k * 3 + 2]).applyQuaternion(q);
    const [x, y, z] = posiciones[i];
    const nudo = dat[i * 4] < 0.5;
    const lc = new THREE.Color(l.data.color[k * 3], l.data.color[k * 3 + 1], l.data.color[k * 3 + 2]);
    red.push(destino.x, destino.y, destino.z, nudo ? BLANCO : CORAL, nudo ? 0.008 : 0.005, nudo ? 0.34 : 0.11, { from: [x, y, z], delay: r() });
    // The colour it ends with: the light's own (in `aDat.w`, its brightness).
    dat[i * 4 + 3] = (lc.r + lc.g + lc.b) / 3;
  }
  return { corteza: corteza0.data(), red: red.data(), dat: new Float32Array(dat), fibras: new Float32Array(fibras), fibraT: new Float32Array(fibraT) };
}

export const despierta: EscenaChasis = {
  id: 'despierta',
  montar(stage): Acto {
    const root = stage.root;

    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root) => {
      n.u.uSpread.value = 0;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };

    // The sea: light from above, deep blue below (a background that turns with the camera).
    const agua = pantalla(
      /* glsl */ `
      uniform float uAgua;
      void main() {
        vec3 d = normalize(vDir);
        float arriba = smoothstep(-0.6, 1.0, d.y);
        float rayos = pow(max(0.0, 0.5 + 0.5 * sin(atan(d.x, d.z) * 9.0 + d.y * 3.0)), 6.0) * smoothstep(0.0, 1.0, d.y);
        vec3 c = mix(vec3(0.0, 0.012, 0.03), vec3(0.05, 0.16, 0.24), arriba * arriba) + vec3(0.06, 0.14, 0.16) * rayos * 0.5;
        gl_FragColor = vec4(c * uAgua, 1.0);
      }`,
      { uAgua: { value: 1 } },
    );
    agua.mesh.renderOrder = -100;
    root.add(agua.mesh);
    FONDOS.push(agua);

    const celula = add(
      materia(celulaDatos(), {
        pre: /* glsl */ `uniform float uCel, uMar, uToque;`,
        move: /* glsl */ `
          if (aKind < 1.5) {
            // It shrinks when the light touches it, and breathes.
            float enc = 1.0 - 0.14 * uToque * (0.5 + 0.5 * sin(uTime * 3.0));
            p *= enc * (1.0 + 0.02 * sin(uTime * 1.3 + p.y * 9.0));
            // (its membrane is a shell of light now: its own points only a faint grain on it)
            em *= uCel * (aKind < 0.5 ? 0.16 : 1.0);
          } else {
            p += vec3(sin(uTime * 0.11 + seed * 40.0), cos(uTime * 0.09 + seed * 30.0), sin(uTime * 0.07 + seed * 20.0)) * 0.06;
            em *= uMar;
          }
        `,
        post: LENTE,
        uniforms: { uCel: { value: 1 }, uMar: { value: 1 }, uToque: { value: 0 } },
      }),
    );
    celula.u.uFuente.value = 0.4;
    const membrana = capaLuz(new THREE.Color(0.6, 0.86, 1.0), { cara: 0.04, grano: 0.45 });
    root.add(membrana.mesh);

    const nervios = add(
      materia(redNerviosaDatos(), {
        pre: /* glsl */ `uniform float uNer, uCrece;`,
        move: /* glsl */ `
          p *= uCrece;
          // It swims: the bell closes at its rim and opens again, and rises a little with each beat.
          float nado = pow(0.5 + 0.5 * sin(uTime * 1.7), 3.0);
          p.xz *= 1.0 - 0.11 * nado * (1.0 - smoothstep(-0.1, 0.7, p.y / max(uCrece, 0.05)));
          p.y += 0.05 * sin(uTime * 0.8) + 0.03 * nado;
          float chispa = aKind < 0.5 ? (smoothstep(0.88, 0.952, fract(aDelay * 2.0 - uTime * 0.7)) * (1.0 - smoothstep(0.952, 1.0, fract(aDelay * 2.0 - uTime * 0.7)))) * 4.0 : 0.0;
          // (each point lit as the net reaches it, softly, not switched on)
          em *= uNer * (1.0 + chispa) * smoothstep(aDelay - 0.02, aDelay + 0.05, uNer * 1.2 + 0.05);
        `,
        post: LENTE,
        uniforms: { uNer: { value: 0 }, uCrece: { value: 0.3 } },
      }),
    );
    nervios.u.uFuente.value = 0.4;

    let corteza: Nube | null = null;
    let red: Nube | null = null;
    let fibras: { uOn: { value: number }; uTime: { value: number }; uFundido: { value: number } } | null = null;
    const tierraG = new THREE.Group();
    tierraG.quaternion.copy(caraHacia(CARA.lat, CARA.lon));
    root.add(tierraG);
    const base = `${import.meta.env.BASE_URL}texturas/`;
    const planeta = tierraHorizontes(base, { giro: 0 });
    tierraG.add(planeta.group);
    const listo = (async () => {
      const img = await mapaTierra();
      const d = cerebroDatos(img);
      corteza = add(materia(d.corteza, { pre: `uniform float uCor;`, move: `em *= uCor;`, post: LENTE, uniforms: { uCor: { value: 0 } } }));
      corteza.u.uFuente.value = 0.3;
      red = add(
        materia(d.red, {
          pre: /* glsl */ `
            attribute vec4 aDat;
            uniform float uRed, uMaq;
            uniform vec3 uLuz, uFria, uCamW;
          `,
          move: /* glsl */ `
            float pulso = aDat.x > 0.5 ? (smoothstep(0.86, 0.944, fract(aDat.y - uTime * 0.5 + aDat.z * 9.0)) * (1.0 - smoothstep(0.944, 1.0, fract(aDat.y - uTime * 0.5 + aDat.z * 9.0)))) * 3.5 * (1.0 - uK) : 0.0;
            // On the Earth: the colour of night lights; the biggest knots turn cold white (the machines).
            vec3 noche = uLuz * (0.25 + 0.7 * aDat.w);
            em = mix(em, noche, uK) * (1.0 + pulso);
            // (while it is a brain its links are fibres of light: their points only a grain on them)
            em *= aDat.x > 0.5 ? mix(0.35, 1.0, smoothstep(0.0, 0.3, uK)) : 1.0;
            float maq = uMaq * step(0.5, 1.0 - aDat.x) * step(0.82, aDat.z);
            em = mix(em, uFria * 2.2, maq);
            em *= uRed;
            vec3 nn = normalize(position);
            em *= mix(1.0, smoothstep(-0.015, 0.03, dot(nn, normalize(uCamW - position))), uK);
          `,
          post: LENTE,
          uniforms: { uCamW: { value: V() }, uRed: { value: 0 }, uMaq: { value: 0 }, uLuz: { value: new THREE.Color(1.0, 0.56, 0.22) }, uFria: { value: new THREE.Color(0.7, 0.86, 1.0) } },
          extra: { aDat: [d.dat, 4] },
        }),
      );
      red.u.uSpread.value = 1.2;
      red.u.uFuente.value = 0.45;
      {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(d.fibras, 3));
        g.setAttribute('aT', new THREE.BufferAttribute(d.fibraT, 2));
        const u = { uOn: { value: 0 }, uTime: { value: 0 }, uFundido: { value: 1 } };
        const m = new THREE.ShaderMaterial({
          uniforms: u,
          vertexShader: /* glsl */ `
            attribute vec2 aT;
            varying vec2 vT;
            void main() {
              vT = aT;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform float uOn, uTime, uFundido;
            varying vec2 vT;
            void main() {
              // (a faint fibre, a spark running along it now and then, as the points' pulses)
              float pulso = (smoothstep(0.86, 0.944, fract(vT.x - uTime * 0.5 + vT.y * 9.0)) * (1.0 - smoothstep(0.944, 1.0, fract(vT.x - uTime * 0.5 + vT.y * 9.0)))) * 3.5;
              gl_FragColor = vec4(vec3(1.0, 0.5, 0.42) * (0.12 + pulso * 0.5) * uOn * uFundido, 0.0);
            }
          `,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.CustomBlending,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneMinusSrcAlphaFactor,
        });
        const lineas = new THREE.LineSegments(g, m);
        lineas.frustumCulled = false;
        lineas.renderOrder = 2;
        root.add(lineas);
        fibras = u;
      }
      await planeta.listo;
    })();

    // ---------------------------------------------------------------- the moments (DIRECCION.md 11–14)
    // Scene 4, «La vida»: one place and one slow look. The cell, the jellyfish and the brain are each
    // born where the last one was, and the camera only drifts round them, coming in at the end to the
    // point in the brain. Then the one leap (14): out of the brain as its network becomes the night
    // Earth's lights, and down to glide low over them, where tierra.ts goes on (`llegada`).
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: -20, el: 14, ld: 0.22, yaw: 90, pitch: -90, roll: 0, mx: 0, my: 0, fov: 40, blanco: 1, agua: 1, cel: 1, mar: 1, toque: 0, ner: 0, crece: 0.3, cor: 0, red: 0, forma: 0, tu: 0, tierra: 0, maq: 0, lw: 0, vel: 0, vu: 0, vm: 0, vh: 0 });

    // The light touches the cell, and it flinches.
    tl.label('celula').caption(4.6, 'Una célula que reacciona', 'Antes de pensar, la materia aprendió a reaccionar. Empezó en el mar, con una célula.');
    tl.with(1.4, { blanco: 0 });
    luego(1.6, 1.4, { toque: 1 });
    tl.wait(4.6);

    // Where the cell was, a bell of nerves grows: the jellyfish, its sparks running round it.
    tl.label('nervios').caption(5.0, 'Nervios', 'Después, unas células empezaron a pasarse chispas. Con ellas, un cuerpo entero reacciona a la vez.');
    tl.with(1.6, { cel: 0, toque: 0 });
    luego(0.3, 2.4, { ner: 1, crece: 1 });
    tl.wait(5.0);

    // Where the bell was, the brain folds; at its heart, the point.
    tl.label('cerebro').caption(5.8, 'Un cerebro', 'Lo más complejo que conocemos, y funciona con veinte vatios. Como el tuyo, ahora.');
    tl.with(2.0, { ner: 0, cor: 1, red: 1, mar: 0, agua: 0 });
    luego(3.0, 1.2, { tu: 1 });
    tl.wait(5.8);

    // The leap: its network lays itself over the night Earth, and down to it.
    tl.label('ocho').caption(6.0, 'Ocho mil millones de cerebros', 'Están ahí, donde de noche hay luz. Todos juntos piensan con menos del uno por ciento de lo que gastamos.');
    tl.with(1.0, { tu: 0 });
    luego(0.4, 2.2, { cor: 0 });
    luego(0.4, 3.0, { forma: 1, tierra: 1 });
    luego(0.5, 1.3, { vel: 0.45 });
    luego(1.8, 1.4, { vel: 0 });
    luego(3.4, 1.0, { vel: 0.18 });
    luego(4.6, 1.2, { vel: 0 });
    tl.wait(6.0);

    // The camera: one flight, first person (chasis/toma.ts `vuelo`), down through the sea to the cell,
    // along its skin and in through it; there, where it was, under the bell of nerves as it grows round
    // us; out between the tentacles, round to see the brain fold where the bell was, and into it, along
    // its network, to the point at its heart. Every knot: [beat, where]; the flight's pace runs through
    // them smoothly (`vu`, by length).
    const TU = V(0, 0.02, 0.04);
    const NUDOS: [number, THREE.Vector3][] = [
      [0.0, V(0.7, 1.55, 2.3)],
      [1.4, V(0.56, 1.05, 1.62)],
      [2.5, V(0.42, 0.62, 1.12)],
      [3.3, V(0.05, 0.5, 0.72)],
      [4.0, V(-0.24, 0.26, 0.5)],
      [4.6, V(-0.2, 0.06, 0.24)],
      [6.8, V(0.04, -0.24, 0.3)],
      [8.0, V(0.36, -0.74, 0.76)],
      [9.0, V(0.95, -1.15, 1.5)],
      [9.9, V(1.6, -0.9, 2.1)],
      [10.9, V(2.3, -0.2, 1.7)],
      [11.9, V(2.0, 0.3, 0.9)],
      [12.8, V(1.1, 0.22, 0.55)],
      [13.6, V(0.55, 0.12, 0.3)],
      [14.4, V(0.2, 0.06, 0.18)],
      [15.4, V(0.1, 0.05, 0.13)],
    ];
    const ruta = new THREE.CatmullRomCurve3(NUDOS.map(([, v]) => v), false, 'centripetal');
    {
      const K = 40;
      const largos = ruta.getLengths((NUDOS.length - 1) * K);
      const total = largos[largos.length - 1];
      NUDOS.forEach(([b], k) => tl.keyAt(b, { vu: largos[k * K] / total }));
      // (at rest at the point: the pull-back starts from stillness)
      tl.keyAt(NUDOS[NUDOS.length - 1][0] + 0.6, { vu: 1 });
    }
    // Where it looks: as much as `vm` at `cx…`, else ahead along the way.
    const mira = (b: number, c: THREE.Vector3, vm: number) => tl.keyAt(b, { cx: c.x, cy: c.y, cz: c.z, vm });
    const CERO = V();
    const NUCLEO = V(0.06, -0.03, 0);
    const CIMA = V(0, 0.45, -0.35);
    const DENTRO = V(0.2, -0.1, -0.3);
    mira(0, CERO, 0.92);
    mira(2.5, CERO, 0.85);
    mira(3.3, CERO, 0.85);
    mira(4.0, NUCLEO, 0.85);
    mira(4.6, DENTRO, 1);
    // (up into the bell as it grows from its top: never straight up, where «up» is lost)
    mira(6.0, CIMA, 1);
    mira(6.8, CIMA, 1);
    // (out between the tentacles, mostly ahead; then round to the bell, and to the brain where it was)
    mira(8.0, V(0, 0.0, 0), 0.8);
    mira(8.6, V(0, 0.0, 0), 0.82);
    mira(9.8, V(0, 0.05, 0), 0.95);
    mira(11.6, CERO, 1);
    mira(12.4, TU, 0.85);
    mira(13.2, TU, 0.6);
    mira(14.2, TU, 0.9);
    mira(15.0, TU, 1);
    // The leap (chasis/toma.ts `toma`, round the point and then the Earth's centre): from where the flight
    // rests, straight back out as the network streams past into the Earth's lights, round to its night
    // face; then down, banking, the gaze rising to the horizon, onto the glide tierra.ts goes on with.
    const o8 = tl.at('ocho');
    const enTu = (() => {
      const v = NUDOS[NUDOS.length - 1][1].clone().sub(TU);
      return { az: THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z)), el: THREE.MathUtils.radToDeg(Math.asin(v.y / v.length())), ld: Math.log10(v.length()) };
    })();
    tl.keyAt(o8 - 0.6, { ...enTu, pitch: -90, yaw: 90, fov: 40, roll: 0 });
    tl.keyAt(o8, { ...enTu });
    tl.keyAt(o8 + 0.5, { ld: enTu.ld + 0.1 });
    tl.keyAt(o8 + 1.4, { az: enTu.az * 0.4 - 8, el: 11, ld: 0.0 });
    tl.keyAt(o8 + 2.2, { ld: 0.36 });
    tl.keyAt(o8 + 3.2, { az: -16, el: 12, ld: 0.58, pitch: -90, yaw: 90, fov: 40, roll: 0 });
    const fin = tl.length;
    const medio = llegada(-1.6);
    tl.keyAt(o8 + 4.5, { az: medio.az / 2, el: (8 + medio.el) / 2, ld: 0.3, pitch: -72, yaw: 80, fov: 45, roll: 9 });
    for (const t of [-0.7, 0]) tl.keyAt(fin + t, { ...llegada(t), roll: 0 });
    // (round the point, then the Earth's centre: the same place within a hair)
    tl.keyAt(o8 - 0.6, { cx: TU.x, cy: TU.y, cz: TU.z }).keyAt(o8 + 0.4, { cx: TU.x, cy: TU.y, cz: TU.z }).keyAt(o8 + 2.0, { cx: 0, cy: 0, cz: 0 });
    /** Where the flight hands over to the shot. */
    const RELEVO_TOMA = [o8 - 0.3, o8 + 0.1];
    const cVuelo = { pos: V(), quat: new THREE.Quaternion(), fov: 40, dist: 1, lw: 0 };
    const tu = add(puntoTu(TU, 0.006));
    const solL = V();
    const camL = V();
    const inv = new THREE.Quaternion();
    return {
      id: 'despierta',
      tl,
      grupo: root as THREE.Group,
      listo,
      costura: 'corte',
      // (tierra.ts lands on the same Earth, at the same place)
      salida: { pos: V(), escala: 1 },
      cerca: 1e-4,
      lejos: 200,
      film: { strength: 0.7, radius: 0.6, threshold: 0.5, exposure: 1.1 },
      presencias: ['blanco', 'agua', 'cel', 'mar', 'ner', 'cor', 'red', 'tu', 'tierra', 'on'],
      chispa() {
        return false;
      },
      camara(p, _ch, out) {
        if (p >= RELEVO_TOMA[1]) {
          plano(tl, p, null, out);
          return;
        }
        vuelo(tl, p, ruta, p > RELEVO_TOMA[0] ? cVuelo : out, { adelante: 0.04, alabeo: 0, nivel: true });
        if (p > RELEVO_TOMA[0]) mezclar(cVuelo, plano(tl, p, null, out), THREE.MathUtils.smoothstep(p, RELEVO_TOMA[0], RELEVO_TOMA[1]), out);
      },
      tapa(p) {
        return tl.get('blanco', p);
      },
      efectos(p) {
        return { vel: tl.get('vel', p) };
      },
      escalera: false,
      cuenta(p): Cuenta | null {
        if (p < tl.at('nervios')) return { pisos: ['10', '-12'], unidad: 'W', linea: 'una célula', h: 1 };
        if (p < tl.at('cerebro')) return { pisos: ['10', '-3'], unidad: 'W', linea: 'nervios', h: 1 };
        if (p < tl.at('ocho')) return { pisos: ['20'], unidad: 'W', linea: 'un cerebro, como el tuyo', h: 1 };
        if (p < tl.at('maquinas')) return { ...potencia(11.2, 'todos los cerebros · '), alcance: '1 mundo' };
        return { ...potencia(13.28), alcance: '1 mundo' };
      },
      // The years: from the first cell to today, the ages going by at an even pace.
      anio(p) {
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[a('celula'), -3.8e9], [a('nervios') - 1, -3.8e9], [a('nervios') + 0.6, -6e8], [a('cerebro') - 1, -6e8], [a('cerebro') + 0.6, -3e5], [a('ocho') - 0.8, -3e5], [a('ocho') + 1.4, 2026]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'I · La materia despierta', name: c.name, fact: c.fact } : null;
      },
      update(f: FrameActo) {
        const p = f.p;
        const t = f.time;
        const camera = f.camera;
        agua.u.uAgua.value = tl.get('agua', p);
        celula.u.uCel.value = tl.get('cel', p);
        celula.u.uMar.value = tl.get('mar', p);
        celula.u.uToque.value = tl.get('toque', p);
        // (the membrane shrinks with the cell when the light touches it, and breathes)
        membrana.mesh.scale.setScalar(0.42 * (1 - 0.14 * tl.get('toque', p) * (0.5 + 0.5 * Math.sin(t * 3))));
        membrana.u.uOn.value = 0.6 * tl.get('cel', p);
        membrana.u.uTime.value = t;
        nervios.u.uNer.value = tl.get('ner', p);
        nervios.u.uCrece.value = tl.get('crece', p);
        if (corteza) corteza.u.uCor.value = tl.get('cor', p);
        if (fibras) {
          fibras.uOn.value = tl.get('red', p) * (1 - THREE.MathUtils.smoothstep(tl.get('forma', p), 0, 0.3));
          fibras.uTime.value = t;
        }
        if (red) {
          red.u.uRed.value = tl.get('red', p);
          red.u.uK.value = tl.get('forma', p);
          red.u.uMaq.value = tl.get('maq', p);
          red.u.uCamW.value.copy(camera.position);
        }
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.25 * Math.sin(t * 1.5));

        tierraG.updateMatrixWorld();
        inv.copy(tierraG.quaternion).invert();
        solL.copy(SOL).applyQuaternion(inv);
        camL.copy(camera.position).applyQuaternion(inv);
        const pres = tl.get('tierra', p);
        planeta.group.visible = pres > 0.002;
        planeta.update({ sol: solL, camara: camL, focal: f.focal, dpr: f.dpr, tiempo: t, presencia: pres });
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        // Flying low through the network as it becomes the Earth's lights: fine points, not big blobs.
        const bajo = THREE.MathUtils.smoothstep(p, tl.at('ocho'), tl.at('ocho') + 1.5);
        if (bajo > 0) for (const n of nubes) n.u.uMaxPx.value = THREE.MathUtils.lerp(24, 8, bajo) * f.dpr;
      },
      placa(g, f) {
        // The Sun's light, still filling the frame as the sea comes up.
        const b = tl.get('blanco', f.p);
        if (b > 0.002) {
          g.save();
          g.globalAlpha = ease(0, 1, b);
          g.fillStyle = '#fff6e6';
          g.fillRect(0, 0, f.W, f.H);
          g.restore();
        }
        void FONT;
        void ink;
      },
    };
  },
};
