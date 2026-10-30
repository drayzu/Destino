import { logDepth } from './motor/logdepth';
import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { sol as solHorizontes } from '../src/horizontes';
import { TEAL, potencia, puntoTu, anioEn } from './remake';
import { aplicarToma, toma, type Toma } from './rig';
import { crearChispa, type Camino } from './chispa';
import type { Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Study C of the remake: scenes 18 and 19 of ESCALETA.md, «Pensar con una estrella» and «Dejar de
 * ser materia» (GUION.md, moments 43–46).
 *
 * A star is wrapped, shell by shell, in computers: five spheres of points, each the colour of its
 * temperature (white, orange, red, deep red, the false colour of the infrared), and the star goes
 * dim inside them. The camera goes in through the shells to the gap between the third and the
 * fourth: a glowing floor below, a ceiling that sparkles above. The points compute (they blink,
 * faster the colder the shell: cold thinks cheaper). Then the points of the shell leave it and
 * gather, in front of the camera, into a network that thinks: knots and threads with pulses. A teal
 * point lights among them and becomes one more knot. At the end the network spreads out into the
 * dark and cools to blue.
 *
 * Ways: 1 «Puntos», the computers and the bits as points of light; 2 «Cuadros», as small square tiles
 * (the bits of the first studies, 26 Oct).
 *
 * Units: the star's radius.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RADIOS = [1.8, 2.6, 3.6, 4.9, 6.5];
const COLORES = [new THREE.Color(1.0, 0.78, 0.5), new THREE.Color(1.0, 0.55, 0.2), new THREE.Color(1.0, 0.3, 0.09), new THREE.Color(0.85, 0.16, 0.06), new THREE.Color(0.6, 0.1, 0.08)];
const LUCES = [0.5, 0.48, 0.44, 0.38, 0.3];
const PUNTOS = [50000, 70000, 95000, 125000, 165000];
const AZUL = new THREE.Color(0.42, 0.62, 1.0);

/** The shells: Fibonacci spheres, `aKind` the shell (0 inside .. 4 outside). */
function capasDatos(cuadro: boolean): MateriaData {
  const b = materiaBuilder(61);
  const ga = Math.PI * (3 - Math.sqrt(5));
  RADIOS.forEach((R, k) => {
    const n = PUNTOS[k];
    const paso = Math.sqrt((4 * Math.PI) / n);
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 2;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const th = ga * i;
      const j = R * (1 + gauss(b.r) * 0.004);
      b.push(Math.cos(th) * rr * j, y * j, Math.sin(th) * rr * j, COLORES[k], R * paso * (cuadro ? 0.42 : 0.5), LUCES[k], { kind: k });
    }
  });
  return b.data();
}

/**
 * The network: knots in the gap between the third and fourth shells, each joined to its nearest
 * three by a thread. Each point comes from a place on those shells (`aFrom`): the shells' matter,
 * reordered. `aDat`: kind (0 knot, 1 thread), how far along its thread, a phase.
 */
function redDatos(): { data: MateriaData; dat: Float32Array; nodos: THREE.Vector3[] } {
  const b = materiaBuilder(67);
  const r = b.r;
  const dat: number[] = [];
  const nodos: THREE.Vector3[] = [];
  for (let i = 0; i < 1500; i++) {
    const [x, y, z] = b.onSphere();
    nodos.push(V(x, y, z).multiplyScalar(3.8 + r() * 0.95));
  }
  const desde = () => {
    const [x, y, z] = b.onSphere();
    const R = r() < 0.5 ? RADIOS[2] : RADIOS[3];
    return [x * R, y * R, z * R] as [number, number, number];
  };
  const BLANCO = new THREE.Color(0.9, 1.0, 0.97);
  for (const n of nodos) {
    for (let k = 0; k < 16; k++) {
      b.push(n.x + gauss(r) * 0.012, n.y + gauss(r) * 0.012, n.z + gauss(r) * 0.012, k < 4 ? BLANCO : TEAL, 0.012, k < 4 ? 1.4 : 0.8, { from: desde(), delay: r() });
      dat.push(0, 0, r(), 0);
    }
  }
  const hechos = new Set<string>();
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
      const cuantos = Math.round(d * 220);
      const fase = r();
      for (let q = 0; q < cuantos; q++) {
        const t = r();
        b.push(n.x + (m.x - n.x) * t, n.y + (m.y - n.y) * t, n.z + (m.z - n.z) * t, TEAL, 0.006, 0.42, { from: desde(), delay: r() });
        dat.push(1, i < j ? t : 1 - t, fase, 0);
      }
    }
  });
  return { data: b.data(), dat: new Float32Array(dat), nodos };
}

/**
 * The shells as surfaces of computers (Diego, 30 Oct: the old Destino's cubes and blinking were more
 * striking): each shell a sphere tiled in square panels (a cube-sphere grid, even everywhere), the
 * colour of its temperature, with gaps between some tiles through which the hotter shells inside
 * glow. Built by fronts sweeping from three places; once thinking, the tiles blink (faster the
 * colder the shell) and waves of computation sweep across each shell. The third and fourth give
 * their tiles to the network; then all cools to black.
 */
function capaMalla(k: number) {
  const R = RADIOS[k];
  const mat = logDepth(new THREE.ShaderMaterial({
    uniforms: {
      uK: { value: k },
      uN: { value: Math.round(46 * (R / RADIOS[0])) },
      uBrillo: { value: [1.0, 0.85, 0.7, 0.55, 0.42][k] },
      uColor: { value: COLORES[k].clone() },
      uHueco: { value: [0.04, 0.1, 0.16, 0.22, 0.3][k] },
      uCapas: { value: 0 },
      uBits: { value: 0 },
      uPiensa: { value: 0 },
      uSale: { value: 0 },
      uFrio: { value: 0 },
      uTime: { value: 0 },
      uFundido: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vL;
      void main() {
        vL = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uK, uN, uHueco, uCapas, uBits, uPiensa, uSale, uFrio, uTime, uFundido, uBrillo;
      uniform vec3 uColor;
      varying vec3 vL;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vL);
        vec3 a = abs(d);
        float cara;
        vec2 uv;
        if (a.x >= a.y && a.x >= a.z) { cara = d.x > 0.0 ? 0.0 : 1.0; uv = d.yz / a.x; }
        else if (a.y >= a.z) { cara = d.y > 0.0 ? 2.0 : 3.0; uv = d.xz / a.y; }
        else { cara = d.z > 0.0 ? 4.0 : 5.0; uv = d.xy / a.z; }
        // (equal-angle: the tiles the same size over the whole face)
        uv = atan(uv) * 1.2732395;
        vec2 g = (uv * 0.5 + 0.5) * uN;
        vec2 id = floor(g);
        vec2 fr = fract(g);
        vec2 tid = id + vec2(cara * 97.0, cara * 31.0) + uK * 13.1;
        float h = h21(tid);
        // Some tiles missing: through the gaps, the hotter shells inside.
        if (h < uHueco) discard;
        // The third and fourth give their tiles to the network.
        if (uK > 1.5 && uK < 3.5 && h21(tid + 5.0) < uSale * 0.8) discard;
        // Built by fronts from three places.
        float ang = min(min(acos(clamp(dot(d, vec3(0.28, 0.93, 0.19)), -1.0, 1.0)), acos(clamp(dot(d, vec3(-0.83, -0.31, 0.46)), -1.0, 1.0))), acos(clamp(dot(d, vec3(0.42, -0.59, -0.69)), -1.0, 1.0))) / 2.0;
        ang += 0.04 * h;
        float hecho = (uCapas * 5.0 - uK) * 1.25;
        if (hecho < ang) discard;
        float frente = exp(-pow((hecho - ang) / 0.04, 2.0));
        // The tile's edge: a dark seam.
        float m = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
        float fw = max(fwidth(g.x), 1e-5) * 1.2;
        float cuerpo = smoothstep(0.06, 0.06 + fw, m);
        // Thinking: each tile blinks (faster the colder the shell), and waves sweep across the shell.
        float rate = (1.0 + 1.7 * uK) * uPiensa;
        float cel = floor(uTime * rate + h * 50.0);
        float bit = step(0.55, fract(sin(cel * 12.9898 + h * 78.233) * 43758.5453));
        float w1 = sin(dot(d, normalize(vec3(0.3, 1.0, 0.2))) * (14.0 + 3.0 * uK) - uTime * 1.4 + uK);
        float w2 = sin(dot(d, normalize(vec3(-0.8, 0.1, 0.6))) * (20.0 + 2.0 * uK) - uTime * 1.9);
        float ola = smoothstep(0.82, 1.0, w1) + smoothstep(0.88, 1.0, w2);
        float luz = 0.16 + uBits * (0.45 * bit + 1.1 * ola * (0.4 + 0.6 * bit));
        vec3 col = (uColor * luz * cuerpo + uColor * 0.025) * uBrillo;
        col += vec3(1.0, 0.92, 0.8) * frente * 0.55;
        col *= 1.0 - uFrio;
        gl_FragColor = vec4(col * uFundido, uFundido * (1.0 - uFrio * 0.9));
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  }));
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 96), mat);
  // (inner first: an outer shell covers what it hides, its gaps show what is inside)
  m.renderOrder = 20 + k;
  return { mesh: m, u: mat.uniforms };
}

export const estrella: Escena = {
  id: 'estrella',
  nombre: 'C · Pensar con una estrella',
  estilos: [
    { key: '1', nombre: 'Puntos', nota: 'Las computadoras y los bits como puntos de luz, de la misma materia que todo lo demás.' },
    { key: '2', nombre: 'Cuadros', nota: 'Las computadoras y los bits como cuadritos que se encienden y se apagan (los bits de los primeros estudios).' },
  ],
  montar(stage, estilo): Instancia {
    const cuadro = estilo === 1;
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.7;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.55;
    stage.renderer.toneMappingExposure = 1.05;

    const sol = solHorizontes({ puntos: 260000, corona: 120000, llamaradas: 0 });
    root.add(sol.group);

    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root) => {
      parent.add(n.points);
      nubes.push(n);
      return n;
    };

    const capas = add(
      materia(capasDatos(cuadro), {
        cuadro,
        pre: /* glsl */ `uniform float uCapas, uBits, uPiensa, uSale, uFrio;`,
        move: /* glsl */ `
          float kc = aKind;
          // Each shell is built from three places outwards: fronts that sweep over it, bright where
          // they pass.
          vec3 dd = normalize(p);
          float ang = min(min(acos(clamp(dot(dd, vec3(0.28, 0.93, 0.19)), -1.0, 1.0)), acos(clamp(dot(dd, vec3(-0.83, -0.31, 0.46)), -1.0, 1.0))), acos(clamp(dot(dd, vec3(0.42, -0.59, -0.69)), -1.0, 1.0))) / 2.0;
          ang += 0.05 * fract(seed * 13.7);
          float hecho = (uCapas * 5.0 - kc) * 1.25;
          float on = smoothstep(ang, ang + 0.03, hecho);
          float frente = exp(-pow((hecho - ang) / 0.035, 2.0)) * step(0.0, hecho);
          em += vec3(1.0, 0.92, 0.8) * frente * 2.0;
          // Its computers blink: faster the colder the shell.
          float rate = (1.0 + 1.7 * kc) * uPiensa;
          float cel = floor(uTime * rate + seed * 50.0);
          float bit = step(0.5, fract(sin(cel * 12.9898 + seed * 78.233) * 43758.5453));
          em *= on * mix(1.0, 0.18 + 1.4 * bit, uBits);
          // The third and fourth shells give their points to the network.
          em *= 1.0 - 0.75 * uSale * step(1.5, kc) * step(kc, 3.5);
          em *= 1.0 - uFrio;
        `,
        uniforms: { uCapas: { value: 0 }, uBits: { value: 0 }, uPiensa: { value: 0 }, uSale: { value: 0 }, uFrio: { value: 0 } },
      }),
    );
    capas.u.uSpread.value = 0;
    capas.u.uFuente.value = 0.35;
    // (the shells are surfaces now: capaMalla; the points stay for the way 'Cuadros' alone)
    capas.points.visible = false;
    const mallas = RADIOS.map((_, k) => capaMalla(k));
    for (const m of mallas) root.add(m.mesh);

    const rd = redDatos();
    const redG = new THREE.Group();
    root.add(redG);
    const red = add(
      materia(rd.data, {
        cuadro,
        pre: /* glsl */ `
          attribute vec4 aDat;
          uniform float uRed, uFrioR;
          uniform vec3 uTeal, uAzul;
        `,
        move: /* glsl */ `
          float pulso = aDat.x > 0.5 ? smoothstep(0.86, 1.0, fract(aDat.y - uTime * 0.55 + aDat.z * 9.0)) * 3.5 : 0.0;
          vec3 tinte = mix(uTeal, uAzul, uFrioR);
          em = tinte * length(em) * 0.6 * (1.0 + pulso);
          em *= uRed;
        `,
        uniforms: { uRed: { value: 0 }, uFrioR: { value: 0 }, uTeal: { value: TEAL.clone() }, uAzul: { value: AZUL.clone() } },
        extra: { aDat: [rd.dat, 4] },
      }),
      redG,
    );
    red.u.uSpread.value = 1.4;
    red.u.uFuente.value = 0.3;
    red.points.renderOrder = 30;

    // The heat each shell gives to the next: a rain of light rising from one to the other, from the
    // colour of the hotter to the colour of the colder.
    const fb = materiaBuilder(71);
    const huecoF: number[] = [];
    const colaF: number[] = [];
    for (let i = 0; i < 30000; i++) {
      const [x, y, z] = fb.onSphere();
      // Most of it in the gap the camera goes into (between the third and the fourth).
      const k = fb.r() < 0.65 ? 2 : Math.floor(fb.r() * 4);
      const fase = fb.r();
      // Each drop a short streak: a head and a fading tail below it.
      for (let j = 0; j < 5; j++) {
        fb.push(x, y, z, COLORES[k].clone().lerp(COLORES[k + 1], 0.5), 0.005, 0.6, { kind: k });
        huecoF.push(fase);
        colaF.push(j);
      }
    }
    const flujo = add(
      materia(fb.data(), {
        pre: /* glsl */ `attribute float aFase, aCola; uniform float uFlujo; uniform float uR[5]; uniform vec3 uC[5];`,
        move: /* glsl */ `
          int kk = int(aKind + 0.5);
          float r0 = kk == 0 ? uR[0] : kk == 1 ? uR[1] : kk == 2 ? uR[2] : uR[3];
          float r1 = kk == 0 ? uR[1] : kk == 1 ? uR[2] : kk == 2 ? uR[3] : uR[4];
          vec3 c0 = kk == 0 ? uC[0] : kk == 1 ? uC[1] : kk == 2 ? uC[2] : uC[3];
          vec3 c1 = kk == 0 ? uC[1] : kk == 1 ? uC[2] : kk == 2 ? uC[3] : uC[4];
          float sube = fract(uTime * 0.12 + aFase) - aCola * 0.03;
          p = normalize(position) * mix(r0, r1, sube);
          em = mix(vec3(1.0, 0.9, 0.75), mix(c0, c1, sube), 0.4) * 1.4 * (1.0 - aCola / 5.0) * smoothstep(0.0, 0.12, sube) * (1.0 - smoothstep(0.82, 1.0, sube)) * uFlujo;
        `,
        uniforms: { uFlujo: { value: 0 }, uR: { value: RADIOS.slice() }, uC: { value: COLORES.map((c) => c.clone()) } },
        extra: { aFase: [new Float32Array(huecoF), 1], aCola: [new Float32Array(colaF), 1] },
      }),
    );
    flujo.u.uSpread.value = 0;
    flujo.u.uFuente.value = 0.4;
    flujo.points.renderOrder = 30;

    const listo = sol.listo;

    // ---------------------------------------------------------------- the moments (GUION.md 43–46)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: 18, el: 16, ld: 2.3, yaw: 90, pitch: -90, roll: 0, fov: 40, capas: 0, bits: 0, piensa: 0, forma: 0, sale: 0, red: 0, tu: 0, expande: 0, frio: 0, flujo: 0 });

    tl.label('estrella').caption(8.0, 'Pensar con una estrella', 'Hacia adentro: envolver una estrella en capas de computadoras, y ponerla a pensar.');
    luego(0.3, 7.0, { capas: 1 });
    luego(4.6, 2.4, { bits: 1, piensa: 1 });
    tl.to(4.0, { az: 32, el: 22, ld: 1.22 });
    tl.to(4.0, { az: 44, el: 14, ld: 1.1 });

    // In through the shells, to the gap between the third and the fourth; then the gaze lifts to the
    // curved walls: the hot floor below, the cold ceiling above.
    tl.label('frio').caption(8.0, 'El frío piensa más', 'Cada capa vive del calor de la anterior. Y cuanto más fría, más barato le sale pensar.');
    luego(0.6, 2.4, { flujo: 1 });
    tl.to(3.2, { az: 52, el: 9, ld: 0.63, fov: 50 });
    tl.to(2.2, { az: 58, pitch: -18, yaw: 70 });
    tl.to(2.6, { az: 63, pitch: -12, yaw: 76 });

    tl.label('materia').caption(6.0, 'Dejar de ser materia', 'Una mente así ya no necesita cuerpo: es cálculo. De ti quedaría la forma en que piensas.');
    luego(0.2, 3.6, { forma: 1, sale: 1, red: 1 });
    luego(0.4, 2.0, { flujo: 0.25 });
    luego(2.8, 1.0, { tu: 1 });
    tl.to(6.0, { az: 63, pitch: -10, yaw: 80 });

    tl.label('fin').caption(5.4, 'El frío', 'Pero pensar cuesta, y todo termina como calor. Nada se enfría más que el fondo del universo.');
    luego(0.4, 4.6, { expande: 1, frio: 1 });
    luego(0.2, 1.4, { tu: 0 });
    tl.to(5.4, { az: 80, el: 20, ld: 1.45, pitch: -90, yaw: 90, fov: 40 });

    // «Tú»: a knot in front of the camera where the network forms.
    const tm = toma(tl, tl.at('materia') + 4);
    const tuPos = tm.pos.clone().addScaledVector(tm.dir, 0.42).addScaledVector(tm.up, -0.05);
    const tu = add(puntoTu(tuPos, 0.02), redG);
    // The spark: a little ahead of the camera on its way in (where the camera will be, nearer the star);
    // in the network it goes to its knot, where «tú» lights.
    const chispa = crearChispa();
    root.add(chispa.nube.points);
    tu.points.renderOrder = 31;
    const tmp: Toma = toma(tl, 0);
    const caminoCh: Camino = (sv, out) => {
      const enRed = THREE.MathUtils.smoothstep(sv, tl.at('materia') + 1.0, tl.at('materia') + 3.6);
      out.copy(toma(tl, Math.max(0, sv), tmp).pos).multiplyScalar(0.84);
      return out.lerp(tuPos, enRed);
    };
    tu.u.uSpread.value = 0;

    return {
      tl,
      listo,
      entrada: { pos: V(), escala: 1 },
      salida: { pos: V(), escala: 12 },
      escalera: false,
      cuenta() {
        return { ...potencia(37), alcance: 'la galaxia' };
      },
      anio(p) {
        return anioEn(p, [[0, 3e6], [tl.length, 5e6]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'VI · Hacia adentro', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-3;
        camera.far = 500;
        aplicarToma(camera, toma(tl, p, tm));
        chispa.update(caminoCh, p, 0.03, 1 - THREE.MathUtils.smoothstep(p, tl.at('materia') + 3.4, tl.at('materia') + 4.2), 0, camera.position, f.focal, f.dpr, f.time);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        const cap = tl.get('capas', p);
        const dentro = THREE.MathUtils.smoothstep(camera.position.length(), RADIOS[0], RADIOS[4]);
        sol.u.uBrillo.value = 1.5 * (1 - 0.88 * cap * dentro) * (1 - tl.get('frio', p));
        sol.update({ sol: V(1, 0, 0), camara: camera.position.clone(), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: f.fundido ?? 1 });

        capas.u.uCapas.value = cap;
        capas.u.uBits.value = tl.get('bits', p);
        capas.u.uPiensa.value = tl.get('piensa', p);
        capas.u.uSale.value = tl.get('sale', p);
        capas.u.uFrio.value = tl.get('frio', p);
        for (const m of mallas) {
          m.u.uCapas.value = cap;
          m.u.uBits.value = tl.get('bits', p);
          m.u.uPiensa.value = tl.get('piensa', p);
          m.u.uSale.value = tl.get('sale', p);
          m.u.uFrio.value = tl.get('frio', p);
          m.u.uTime.value = t;
        }
        flujo.u.uFlujo.value = tl.get('flujo', p) * (1 - tl.get('frio', p));
        red.u.uK.value = tl.get('forma', p);
        red.u.uRed.value = tl.get('red', p);
        red.u.uFrioR.value = tl.get('frio', p);
        redG.scale.setScalar(1 + tl.get('expande', p) * 1.8);
        tu.u.uGain.value = tl.get('tu', p) * (1 + 0.25 * Math.sin(t * 1.5));
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
      },
      dispose() {},
    };
  },
};
