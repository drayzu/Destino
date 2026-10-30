import * as THREE from 'three';
import { Timeline } from './timeline';
import { enfocar, materia, materiaBuilder, type MateriaData, type Nube } from './motor/materia';
import { gauss } from './motor/math';
import { sol as solH } from '../src/horizontes';
import { TEAL, potencia, anioEn } from './remake';
import { angulos, aplicarToma, toma } from './rig';
import { crearChispa, type Camino } from './chispa';
import { LEJOS, enjambreNube } from './mercurio';
import type { Rotulo } from './placa';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Scene 13 of ESCALETA.md, «El Sol trabajado» (GUION.md, moments 29–31). Same frame as Mercury's
 * scene (solar radii, the Sun at the origin), which hands over from far away.
 *
 * Back in, through the swarm, to the Sun. Matter is lifted off its poles in two jets and gathered
 * by rings of ours: with less mass it burns slower and lives longer (the star shrinks a little). On
 * one side a mirror, a vast curved sail of light, sends part of its light back, and the Sun moves,
 * slowly, its swarm with it, leaving a thread of teal where it was. Out again: all the Sun's light
 * is ours, type II; and the star is not enough.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const PLASMA = new THREE.Color(1.0, 0.62, 0.28);
/** Which way the mirror pushes (it sits on this side, the Sun moves away from it). */
const EMPUJE = V(-1, 0, 0.25).normalize();
const R_ESPEJO = 7.5;
/** How far ahead of the spark the orbiting camera goes round (radians): the spark keeps to the left. */
const ADELANTO = THREE.MathUtils.degToRad(26);

/** The jets off the poles: grains with a phase (`aKind`), a pole (`aDelay` < 0.5 south) and a place across (`aOff`); and the rings that gather them. */
function chorrosDatos() {
  const b = materiaBuilder(161);
  const off: number[] = [];
  for (let i = 0; i < 46000; i++) {
    b.push(0, 0, 0, PLASMA, 0.014, 0.12 + b.r() * 0.22, { kind: b.r(), delay: b.r() });
    off.push(gauss(b.r), gauss(b.r));
  }
  return { data: b.data(), off: new Float32Array(off) };
}

function anillosDatos(): MateriaData {
  const b = materiaBuilder(163);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7000; i++) {
      const a = b.r() * Math.PI * 2;
      const R = 0.75 + gauss(b.r) * 0.02;
      b.push(Math.cos(a) * R * 1.6, s * 6.6 + gauss(b.r) * 0.01, Math.sin(a) * R * 1.6, TEAL, 0.012, 0.22);
    }
  }
  return b.data();
}

/**
 * The mirror as a surface: a cap of a sphere round the Sun, tiled in hexagons. Its inside, facing
 * the Sun, glows with the light it sends back, each tile a little different; its outside is dark,
 * the tiles' seams catching a little light.
 */
function espejoMalla() {
  const ang = THREE.MathUtils.degToRad(55);
  const g = new THREE.SphereGeometry(R_ESPEJO, 160, 56, 0, Math.PI * 2, 0, ang);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, EMPUJE.clone().negate()));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uEsp: { value: 0 }, uFundido: { value: 1 }, uEje: { value: EMPUJE.clone().negate() }, uR: { value: R_ESPEJO } },
    vertexShader: /* glsl */ `
      varying vec3 vL;
      varying vec3 vV;
      varying vec3 vN;
      void main() {
        vL = position;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uEsp, uFundido, uR;
      uniform vec3 uEje;
      varying vec3 vL;
      varying vec3 vV;
      varying vec3 vN;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // Distance to the edge of the hexagonal tile this point is in (0 on a seam), and the tile.
      vec3 hexa(vec2 p) {
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(p, r) - h;
        vec2 b = mod(p - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        vec2 id = p - gv;
        vec2 q = abs(gv);
        float borde = 0.5 - max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
        return vec3(borde, id);
      }
      void main() {
        vec3 d = normalize(vL);
        // A flat map of the cap (round its axis), for the tiles.
        vec3 t1 = normalize(cross(uEje, abs(uEje.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 t2 = cross(uEje, t1);
        vec2 q = vec2(dot(d, t1), dot(d, t2)) * 26.0;
        vec3 hx = hexa(q);
        float fw = fwidth(hx.x);
        float costura = 1.0 - smoothstep(0.02, 0.02 + 1.5 * fw, hx.x);
        float tono = h21(hx.yz);
        float c = dot(d, uEje);
        float borde = smoothstep(cos(0.96), cos(0.86), c);
        vec3 col;
        float a;
        if (gl_FrontFacing) {
          // Outside: dark tiles, their seams faintly lit.
          col = vec3(0.025, 0.028, 0.034) * (0.8 + 0.4 * tono) + vec3(0.5, 0.42, 0.3) * costura * 0.18;
          a = 1.0;
        } else {
          // Inside, facing the Sun: its light, sent back, warm; each tile tilted a hair differently.
          col = vec3(1.0, 0.78, 0.46) * (0.22 + 0.16 * tono) * (1.0 - costura * 0.7) + vec3(1.0, 0.9, 0.7) * costura * 0.05;
          a = 0.9;
        }
        col += vec3(0.4, 0.95, 0.85) * (1.0 - borde) * 0.5;
        gl_FragColor = vec4(col * uEsp * uFundido, a * uEsp * uFundido);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 2;
  return { mesh: m, u: mat.uniforms };
}

/** The thread left behind: where the Sun has been (`aKind`, how far back along the push). */
function estelaDatos(): MateriaData {
  const b = materiaBuilder(171);
  for (let i = 0; i < 9000; i++) {
    const d = b.r() * 4;
    const p = EMPUJE.clone().multiplyScalar(d).add(V(gauss(b.r) * 0.05, gauss(b.r) * 0.05, gauss(b.r) * 0.05));
    b.push(p.x, p.y, p.z, TEAL, 0.02, 0.35, { kind: d });
  }
  return b.data();
}

export const solTrabajado: Escena = {
  id: 'sol',
  nombre: 'III · El Sol trabajado',
  estilos: [{ key: '1', nombre: 'Guion', nota: 'Los chorros de sus polos, el espejo que lo empuja, la estela; tipo II.' }],
  montar(stage): Instancia {
    const root = stage.root;
    const { camera } = stage;
    stage.bloom.strength = 0.65;
    stage.bloom.radius = 0.55;
    stage.bloom.threshold = 0.6;
    stage.renderer.toneMappingExposure = 1.05;

    const nubes: Nube[] = [];
    const add = (n: Nube, parent: THREE.Object3D = root, orden = 5) => {
      n.u.uSpread.value = 0;
      n.points.renderOrder = orden;
      parent.add(n.points);
      nubes.push(n);
      return n;
    };
    // Everything that moves with the Sun.
    const movil = new THREE.Group();
    root.add(movil);
    const sol = solH({ puntos: 300000, corona: 140000 });
    movil.add(sol.group);
    const enjambre = add(enjambreNube(false), movil, 10);
    const chispa = crearChispa();
    movil.add(chispa.nube.points);
    const caminoCh: Camino = (sv, out) => {
      const a = sv * 2.2;
      return out.set(Math.sin(a) * 3.1, 0.25 * Math.sin(sv * 3.1), Math.cos(a) * 3.1);
    };
    enjambre.u.uCubre.value = 1;

    const cd = chorrosDatos();
    const chorros = add(
      materia(cd.data, {
        pre: /* glsl */ `attribute vec2 aOff; uniform float uVida;`,
        move: /* glsl */ `
          float sv = fract(aKind + uTime * 0.06);
          float polo = aDelay < 0.5 ? -1.0 : 1.0;
          float abre = 0.12 + 0.75 * sv;
          p = vec3(aOff.x * abre, polo * (0.95 + sv * 5.7), aOff.y * abre);
          em = mix(vec3(1.0, 0.92, 0.75), em, smoothstep(0.0, 0.4, sv)) * (1.0 - smoothstep(0.75, 1.0, sv)) * uVida;
        `,
        uniforms: { uVida: { value: 0 } },
        extra: { aOff: [cd.off, 2] },
      }),
      movil,
    );
    chorros.u.uFuente.value = 0.5;
    const anillos = add(materia(anillosDatos(), { pre: `uniform float uVida;`, move: `em *= uVida;`, uniforms: { uVida: { value: 0 } } }), movil);
    anillos.u.uFuente.value = 0.4;
    const espejo = espejoMalla();
    movil.add(espejo.mesh);
    const estela = add(materia(estelaDatos(), { pre: `uniform float uMueve;`, move: `em *= step(aKind, uMueve) * (0.4 + 0.6 * smoothstep(uMueve - 1.5, uMueve, aKind));`, uniforms: { uMueve: { value: 0 } } }));
    estela.u.uFuente.value = 0.5;

    // ---------------------------------------------------------------- the moments (GUION.md 29–31)
    const tl = new Timeline();
    const luego = (off: number, dur: number, v: Record<string, number>) => {
      tl.wait(off);
      tl.with(dur, v);
      tl.wait(-off);
    };
    const lejos = angulos(LEJOS);
    const MUEVE = 3.2;
    const fin = EMPUJE.clone().multiplyScalar(MUEVE);
    tl.set({ cx: 0, cy: 0, cz: 0, ox: 0, oy: 0, oz: 0, az: lejos.az, el: lejos.el, ld: Math.log10(LEJOS.length()), yaw: 90, pitch: -90, roll: 0, fov: 30, ir: 1, vida: 0, encoge: 0, esp: 0, mueve: 0, satura: 0, orb: 0, oR: Math.log10(8), oEl: 12 });

    tl.label('vida').caption(7.4, 'Alargar la vida del Sol', 'Una estrella también se cuida: con menos masa arde más despacio, y vive más.');
    tl.with(2.0, { ir: 0 });
    luego(1.2, 2.4, { vida: 1 });
    luego(3.6, 3.0, { encoge: 1 });
    // The orbit: the camera goes round the Sun at the spark's pace, a little ahead of it, so the
    // spark stays in the left of the frame, going right, the Sun and all that works on it behind.
    luego(0.4, 3.6, { orb: 1 });
    luego(0, 7.4, { oR: Math.log10(6.4), oEl: 20 });
    tl.to(3.6, { az: lejos.az + 30, el: 14, ld: Math.log10(12), fov: 40 });
    // (up beside the north jet: the matter lifted off the pole, gathered by our ring)
    tl.to(3.8, { az: lejos.az + 62, el: 44, ld: Math.log10(6.2) });

    luego(0, 7.6, { oR: Math.log10(11.5), oEl: 10 });
    tl.label('mover').caption(7.6, 'Mover el Sol', 'Y se puede mover: un espejo le devuelve parte de su luz y lo empuja, despacio.');
    tl.with(2.4, { esp: 1 });
    luego(2.8, 4.8, { mueve: MUEVE, cx: fin.x, cy: fin.y, cz: fin.z });
    // (round to the mirror's open side: its glowing face behind the Sun; then the Sun comes towards
    // us as it moves, its thread behind it)
    const abierto = angulos(EMPUJE).az;
    tl.to(3.4, { az: abierto + 30, el: 14, ld: Math.log10(16) });
    tl.to(4.2, { az: abierto + 12, el: 20, ld: Math.log10(21) });

    tl.label('tipo').caption(5.6, 'Tipo II', 'Toda la luz del Sol: tipo II. Y la estrella ya no alcanza.');
    luego(0.4, 4.2, { orb: 0 });
    luego(1.0, 2.4, { satura: 1 });
    luego(1.6, 3.0, { ir: 1 });
    tl.to(5.6, { az: lejos.az + 150, el: 30, ld: 2.2, fov: 34 });

    const tm = toma(tl, 0);
    return {
      tl,
      entrada: { pos: V(), escala: 1 },
      salida: { pos: fin.clone(), escala: 1 },
      escalera: false,
      cuenta(p) {
        return { ...(p < tl.at('tipo') ? potencia(25.6) : potencia(26.58)), alcance: '1 estrella' };
      },
      anio(p) {
        const a = (l: string) => tl.at(l);
        return anioEn(p, [[0, 2090], [a('mover'), 2105], [a('tipo'), 2125], [tl.length, 2135]]);
      },
      rotulo(p): Rotulo | null {
        const c = tl.captionAt(p);
        return c ? { capitulo: 'III · El sistema solar trabaja', name: c.name, fact: c.fact } : null;
      },
      update(f: Frame) {
        const p = f.p;
        const t = f.time;
        camera.near = 1e-4;
        camera.far = 4000;
        const mueve0 = tl.get('mueve', p);
        const centro = EMPUJE.clone().multiplyScalar(mueve0);
        const orb = tl.get('orb', p);
        if (orb > 0.0005) {
          const A = p * 0.18 * 2.2 + ADELANTO;
          const R = Math.pow(10, tl.get('oR', p));
          const el = THREE.MathUtils.degToRad(tl.get('oEl', p));
          const sitio = centro.clone().add(V(Math.sin(A) * Math.cos(el), Math.sin(el), Math.cos(A) * Math.cos(el)).multiplyScalar(R));
          aplicarToma(camera, toma(tl, p, tm, { punto: centro, peso: orb }, { punto: sitio, peso: orb }));
        } else aplicarToma(camera, toma(tl, p, tm));
        // The spark keeps going round among the collectors; at type II it has nowhere left to go: it flickers.
        const camM = camera.position.clone().sub(EMPUJE.clone().multiplyScalar(mueve0));
        chispa.update(caminoCh, p * 0.18, 0.01, 1, tl.get('satura', p), camM, f.focal, f.dpr, f.time);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        const mueve = tl.get('mueve', p);
        movil.position.copy(EMPUJE).multiplyScalar(mueve);
        movil.updateMatrixWorld(true);
        const camL = camera.position.clone().sub(movil.position);
        // Inside the swarm the Sun is bright; from outside it is dim behind it (as in scene 12).
        const afuera = THREE.MathUtils.smoothstep(camL.length(), 2.6, 3.9);
        const enc = tl.get('encoge', p);
        sol.group.scale.setScalar(1 - 0.12 * enc);
        sol.u.uBrillo.value = 2.2 * (1 - 0.86 * afuera) * (1 - 0.15 * enc);
        sol.update({ sol: V(1, 0, 0), camara: camL.clone().divideScalar(1 - 0.12 * enc), focal: f.focal, dpr: f.dpr, tiempo: t, presencia: 1 });
        enjambre.u.uCam.value.copy(camL);
        enjambre.u.uIR.value = tl.get('ir', p);
        const solV = movil.position.clone().applyMatrix4(camera.matrixWorldInverse);
        enjambre.u.uOcc.value.set(solV.x, solV.y, solV.z, 1.0);
        chorros.u.uVida.value = tl.get('vida', p);
        anillos.u.uVida.value = tl.get('vida', p);
        const esp = tl.get('esp', p);
        espejo.u.uEsp.value = esp;
        espejo.mesh.scale.setScalar(THREE.MathUtils.lerp(0.6, 1.0, esp));
        espejo.mesh.visible = esp > 0.002;
        estela.u.uMueve.value = mueve;
        for (const n of nubes) enfocar(n, f.focal, f.dpr, t);
        void Y;
      },
      dispose() {},
    };
  },
};
