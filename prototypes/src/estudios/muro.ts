import * as THREE from 'three';
import { Timeline } from '../timeline';
import { cielo } from '../cielo';
import { CIUDADES, esfera, tierra } from '../tierra';
import { cercanias } from '../obras';
import { enfocar, materia, materiaBuilder } from '../materia';
import { clamp, gauss, lerp, smoothstep } from '../math';
import { FONT, TEAL, cifra, ink, nota, sup, vatios } from '../placa';
import { flecha, linea, pr, texto, type P2 } from './lamina';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Study · a wall: «El calor nos echa». All the energy a civilization uses ends as heat, and a
 * planet can only shed heat by radiating it. At 10¹⁶ W (Sagan's Type I) generated on the surface,
 * the Earth would warm at least ~6 K from waste heat alone, before any feedback (investigacion.md
 * § 18; Balbi & Lingam 2025 put the ceiling of a planet-bound technosphere at K ≈ 0.85–0.9). So the
 * industry leaves for space, where its heat goes straight to the void: the first wall pushes the
 * first step out.
 *
 * Three ways of showing the same wall:
 * 1 · The Earth turns the colour of its heat (infrared, behind a curtain, as in the swarm station).
 * 2 · The ladder marks it: the power ladder, close up, with the heat each step would cost; the wall
 *     crosses it and the whole screen.
 * 3 · The energy balance drawn on the Earth: what comes in, what goes out, and our share.
 *
 * World units: Earth radii, the Earth at the origin (north up, as `esfera`).
 */

const F_ABS = 1.22e17; // W of sunlight the Earth absorbs (albedo 0.30)
const F_IN = 1.74e17; // W it intercepts
const T0 = 288; // K, the mean surface temperature
/** Warming from waste heat alone, no feedback: the planet must radiate F_ABS + P instead of F_ABS. */
export const calentamiento = (P: number) => T0 * (Math.pow(1 + P / F_ABS, 0.25) - 1);
const coma = (v: number, d: number) => v.toFixed(d).replace('.', ',');
export const grados = (k: number) => `+${k < 0.095 ? coma(k, 2) : k < 9.5 ? coma(k, 1) : Math.round(k)} K`;

const D2R = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The heat of our machines on the map (where energy is used): blobs around the cities. */
function mapaCalor() {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'lighter';
  for (const [la, lo, pop] of CIUDADES) {
    const px = ((lo + 180) / 360) * W;
    const py = ((90 - la) / 180) * H;
    const r = (3 + 2.2 * Math.sqrt(pop)) * (W / 360) / Math.max(0.35, Math.cos(la * D2R));
    const ry = (3 + 2.2 * Math.sqrt(pop)) * (H / 180);
    const a = Math.min(0.5, 0.05 + pop * 0.012);
    x.save();
    x.translate(px, py);
    x.scale(r / ry, 1);
    const grd = x.createRadialGradient(0, 0, 0, 0, 0, ry);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(0.35, `rgba(255,255,255,${a * 0.45})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grd;
    x.beginPath();
    x.arc(0, 0, ry, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** The planet in infrared (false colour): its own warmth, plus our heat; only right of the curtain. */
function infrarrojo() {
  const uni = {
    uHeat: { value: mapaCalor() },
    uLocal: { value: 0 },
    uGlobal: { value: 0 },
    uWipePx: { value: 1e9 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.004, 160, 96),
    new THREE.ShaderMaterial({
      uniforms: uni,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        void main() {
          vN = normalize(position);
          vUv = uv;
          vV = normalize((inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz - position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uHeat; uniform float uLocal, uGlobal, uWipePx;
        varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        vec3 ramp(float t) {
          vec3 a = vec3(0.08, 0.01, 0.01), b = vec3(0.38, 0.045, 0.025), c = vec3(0.95, 0.3, 0.07), d = vec3(1.15, 0.78, 0.32), e = vec3(1.4, 1.3, 1.0);
          return t < 0.3 ? mix(a, b, t / 0.3) : t < 0.6 ? mix(b, c, (t - 0.3) / 0.3) : t < 0.95 ? mix(c, d, (t - 0.6) / 0.35) : mix(d, e, clamp((t - 0.95) / 0.5, 0.0, 1.0));
        }
        void main() {
          #include <logdepthbuf_fragment>
          if (gl_FragCoord.x < uWipePx) discard;
          vec3 n = normalize(vN);
          float mu = max(dot(n, normalize(vV)), 0.0);
          // The planet's own warmth (288 K): the tropics warmer than the poles.
          float own = 0.16 + 0.1 * (1.0 - n.y * n.y);
          float h = texture2D(uHeat, vUv).r;
          float t = own + uGlobal + uLocal * h;
          vec3 col = ramp(t) * (0.45 + 0.55 * sqrt(mu)) * 0.85;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  mesh.renderOrder = 6;
  return { mesh, uni };
}

/**
 * The industry that leaves: points that start where the energy is used (around the cities) and rise
 * to orbit (a band around the orbital ring), where they keep circling. In infrared they glow with
 * the heat their radiators give to space.
 */
function industria() {
  const b = materiaBuilder(97);
  const total = CIUDADES.reduce((s, c) => s + c[2], 0);
  const teal = new THREE.Color(0.55, 1.0, 0.86);
  const N = 14000;
  for (let i = 0; i < N; i++) {
    // A city, by its size.
    let r = b.r() * total;
    let c = CIUDADES[0];
    for (const x of CIUDADES) {
      r -= x[2];
      if (r <= 0) {
        c = x;
        break;
      }
    }
    const [fx, fy, fz] = esfera(c[0] + gauss(b.r) * 1.6, c[1] + gauss(b.r) * 1.6, 1.003);
    // Its place in orbit: most in a thin band near the ring, a few higher.
    const R = b.r() < 0.8 ? 1.07 + Math.pow(b.r(), 1.6) * 0.32 : 1.4 + b.r() * 1.1;
    const a = b.r() * Math.PI * 2;
    const inc = gauss(b.r) * 0.05;
    b.push(Math.cos(a) * R, Math.sin(a) * R * inc, -Math.sin(a) * R, teal, 0.0035, b.r() < 0.06 ? 3 : 1.1, { from: [fx, fy, fz], delay: b.r() });
  }
  const n = materia(b.data(), {
    pre: /* glsl */ `uniform vec3 uCamL; uniform float uSpin, uIR, uWipe;
      bool tapado(vec3 q, vec3 c) { vec3 d = q - c; float t = clamp(-dot(c, d) / dot(d, d), 0.0, 1.0); return t < 0.995 && length(c + d * t) < 0.996; }`,
    move: /* glsl */ `
      float rr = max(length(position), 1.0);
      float ang = uSpin * k / (rr * sqrt(rr));
      float ca = cos(ang), sa = sin(ang);
      p = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
      // Rising: a spark; parked in orbit: a steady light.
      float rising = k * (1.0 - k) * 4.0;
      em *= (0.25 + 0.75 * k) * (1.0 + 2.5 * rising);
      em *= step(0.002, k);
      fuente = 1.0;
      if (tapado(p, uCamL)) { em *= 0.0; }`,
    post: /* glsl */ `
      if (uIR > 0.5 && gl_Position.x / gl_Position.w > uWipe) { em = vec3(1.0, 0.45, 0.14) * 2.6 * step(0.002, k) * (0.3 + 0.7 * k); sz *= 1.6; }`,
    uniforms: { uCamL: { value: V() }, uSpin: { value: 0 }, uIR: { value: 0 }, uWipe: { value: 2 } },
  });
  n.u.uSpread.value = 1.6;
  n.u.uK.value = 0;
  return n;
}

export const muro: Escena = {
  id: 'muro',
  nombre: 'El calor nos echa',
  estilos: [
    { key: '1', nombre: 'La Tierra se tiñe', nota: 'La Tierra toma el color de su calor (infrarrojo, tras una cortina): primero las ciudades, después el planeta entero.' },
    { key: '2', nombre: 'La escalera lo marca', nota: 'La escalera de potencia de cerca, con lo que cuesta en grados cada peldaño: el muro la cruza a ella y a la pantalla.' },
    { key: '3', nombre: 'El balance', nota: 'El balance de energía dibujado sobre la Tierra: lo que entra, lo que sale y nuestra parte.' },
  ],
  montar(stage, estilo): Instancia {
    const s = estilo + 1;
    stage.bloom.strength = 0.6;
    stage.bloom.radius = 0.35;
    stage.bloom.threshold = 0.65;
    stage.renderer.toneMappingExposure = 1.0;
    const root = new THREE.Group();
    stage.root.add(root);

    const sky = cielo(0.9);
    root.add(sky.mesh);
    const earth = tierra();
    root.add(earth.group);
    const near = cercanias();
    root.add(near.group);
    const ir = infrarrojo();
    root.add(ir.mesh);
    const ind = industria();
    root.add(ind.points);
    const nubes = [...near.nubes, ind];

    // ------------------------------------------------------------ the journey (the same in all three)
    const tl = new Timeline({ lp: 13.28, ly: -1, lr: 5.6, luces: 0.36, sube: 0, wipe: 1.25 });
    const cap = (d: number, n: string, f: string) => tl.caption(d, n, f);
    tl.set({ lp: 13.28, ly: -1, lr: 5.6, luces: 0.36 });
    cap(1.6, 'Hoy', 'Usamos unos 19 TW. Toda esa energía termina en calor, y hoy ese calor apenas suma una centésima de grado.');
    tl.label('hoy').to(1.6, {});
    if (s === 1) tl.with(1.6, { wipe: 0.02 });
    cap(3.0, 'Más energía, más calor', 'Si seguimos creciendo, las luces llenan la Tierra y el calor que sueltan crece con ellas.');
    tl.label('crece').to(3.0, { lp: 15.0, ly: 2.35, luces: 0.62 });
    cap(2.6, 'El calor nos echa', 'Un planeta solo suelta su calor radiando. Con 10¹⁶ W en su superficie, la Tierra se calentaría al menos 6 grados.');
    tl.label('muro');
    if (s === 1) tl.with(1.3, { wipe: -1.25 });
    tl.to(2.6, { lp: 16.0, ly: 2.54 });
    cap(3.4, 'La industria sale al espacio', 'En órbita, el calor se va directo al vacío sin calentar el planeta. Así se puede seguir creciendo.');
    tl.label('sale').to(3.0, { sube: 1, lp: 16.25, ly: 2.6, lr: 7.3, luces: 0.55 });
    if (s === 1) tl.with(1.3, { wipe: 1.25 });
    tl.to(1.6, {});
    const P = (l: string) => tl.at(l);
    const ease = smoothstep;

    // The heat that stays on the planet: everything until the industry leaves, then little.
    const potencia = (p: number) => Math.pow(10, tl.get('lp', p));
    const enSuperficie = (p: number) => {
      const k = tl.get('sube', p);
      return Math.exp(lerp(Math.log(potencia(p)), Math.log(1.2e14), k));
    };
    const dT = (p: number) => calentamiento(enSuperficie(p));

    // ------------------------------------------------------------ the camera
    const UP = V(0, 1, 0);
    // Looking at the night over Europe, Africa and Asia; the Sun almost behind the planet.
    const VIEW = new THREE.Vector3(...esfera(24, 38)).normalize();
    const look = VIEW.clone().negate();
    const right = look.clone().cross(UP).normalize();
    const sunA = VIEW.clone().multiplyScalar(-0.77).addScaledVector(right, 0.64).normalize();
    // The balance (3): the Sun from the left, the Earth half lit, smaller to leave room for the arrows.
    const sunC = right.clone().multiplyScalar(-1).addScaledVector(VIEW, 0.12).normalize();
    const sunW = s === 3 ? sunC : sunA;

    function camara(p: number) {
      const out = ease(P('sale'), P('sale') + 2.2, p);
      let d: number;
      let fov: number;
      let target: THREE.Vector3;
      let dir = VIEW.clone();
      if (s === 3) {
        d = lerp(4.6, 5.4, out);
        fov = 38;
        target = right.clone().multiplyScalar(0.9);
      } else {
        // Closer as the heat rises, back out when the industry rises (to see the band in orbit).
        d = lerp(lerp(4.1, 3.55, ease(P('crece'), P('muro') + 1.5, p)), 5.2, out);
        fov = 38;
        target = s === 2 ? right.clone().multiplyScalar(0.55).add(V(0, -0.05, 0)) : V(0, -0.04, 0);
      }
      // A slow drift: the world is alive while you read.
      dir.applyAxisAngle(UP, -0.12 + 0.024 * p).applyAxisAngle(right, -0.05 - 0.12 * out);
      dir.normalize();
      return { pos: target.clone().addScaledVector(dir, d), target, fov };
    }

    const tmp = V();
    return {
      tl,
      listo: earth.listo,
      escalera: s !== 2,
      lectura: (p) => ({ lp: tl.get('lp', p), ly: tl.get('ly', p), lr: tl.get('lr', p) }),
      rotulo: (p) => tl.captionAt(p),
      muro: (p) => {
        const lp = tl.get('lp', p);
        const k = tl.get('sube', p);
        return { lp: 15, label: 'muro · el calor', a: ease(P('crece') + 1, P('crece') + 2, p), choque: ease(14.9, 15.6, lp) * (1 - k), fuera: k };
      },
      update(f: Frame) {
        const { camera, p, time } = f;
        const v = camara(p);
        camera.position.copy(v.pos);
        camera.up.copy(UP);
        camera.lookAt(v.target);
        camera.fov = v.fov;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        earth.update(sunW, camera.position, tl.get('luces', p));
        near.uni.uSun.value.copy(sunW);
        near.uni.uCamL.value.copy(camera.position);
        near.uni.uTime.value = time;
        // The ring and the elevator: the way up, once the industry starts to leave.
        const way = ease(P('muro') + 1.6, P('sale') + 0.4, p);
        for (const n of near.nubes) n.u.uGain.value = way;
        // The industry rising.
        ind.u.uK.value = clamp(tl.get('sube', p), 0, 1);
        ind.u.uSpin.value = 0.6 * ease(P('sale'), P('sale') + 4, p) + time * 0.01;
        ind.u.uCamL.value.copy(camera.position);
        // Infrared (way 1), behind the curtain.
        const wipe = s === 1 ? tl.get('wipe', p) : 1.25;
        const wipePx = ((wipe + 1) / 2) * f.W;
        const on = s === 1 && wipe < 1.2 ? 1 : 0;
        ir.mesh.visible = on > 0;
        ir.uni.uWipePx.value = wipePx;
        sky.u.uIR.value = on;
        sky.u.uWipePx.value = wipePx;
        ind.u.uIR.value = on;
        ind.u.uWipe.value = wipe;
        const P0 = enSuperficie(p);
        // Our heat: where it is used first (the cities), then the whole planet warms.
        ir.uni.uLocal.value = 0.1 + 0.55 * smoothstep(13.2, 15.6, Math.log10(P0));
        ir.uni.uGlobal.value = 0.45 * Math.min(1.2, dT(p) / 6);
        for (const n of [...nubes, ...earth.nubes]) {
          enfocar(n, f.H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), f.dpr, time);
          n.u.uSizeUnit.value = 1;
          n.u.uMinPx.value = 1.4 * f.dpr;
        }
        // The towns are smaller than a pixel from here: let them keep some light, so the land fills.
        for (const n of earth.nubes) {
          n.u.uFuente.value = 0.08;
          if (n.u.uNuevas) n.u.uNuevas.value = 0.8;
        }
      },
      placa(g: CanvasRenderingContext2D, f: Frame) {
        const { p, W, H, u, camera } = f;
        const P0 = enSuperficie(p);
        const k = tl.get('sube', p);
        const lp = tl.get('lp', p);
        const dt = dT(p);
        const proj = (v: THREE.Vector3) => pr(v, camera, W, H);
        const E = proj(V())!;
        const limb = proj(camera.position.clone().normalize().cross(UP).normalize().negate())!;
        const rPx = Math.hypot(limb.x - E.x, limb.y - E.y);
        const showT = ease(P('hoy') + 0.3, P('hoy') + 0.9, p);
        if (s === 1) {
          // The curtain.
          const wipe = tl.get('wipe', p);
          const x = ((wipe + 1) / 2) * W;
          if (x > 10 && x < W - 10) {
            linea(g, u, [{ x, y: 96 * u }, { x, y: H - 280 * u }], ink(0.6), 1);
            texto(g, u, x - 12 * u, 112 * u, 'luz visible', ink(0.85), 1, 10, 'right');
            texto(g, u, x + 12 * u, 112 * u, 'infrarrojo · falso color', '#ff9a6a', 1, 10);
          } else if (wipe < 0) {
            texto(g, u, W / 2, 112 * u, 'infrarrojo · falso color · el calor de nuestras máquinas, realzado', '#ff9a6a', ease(P('hoy') + 1.4, P('hoy') + 1.9, p) * (1 - ease(P('sale') + 2.6, P('sale') + 3.0, p)), 10, 'center');
          }
          // The planet's warming, as a big number by it.
          const a = showT;
          cifra(g, u, E.x + rPx * 0.98 + 70 * u, E.y - rPx * 0.62, grados(dt), '', 58, a, dt > 3 ? '#ff8a5a' : dt > 0.4 ? '#ffb08a' : ink(0.9), k > 0.5 ? 'calor que se queda en la Tierra' : 'calor de nuestra energía');
        }
        if (s === 2) escaleraGrande(g, f, lp, k, dt, E, rPx);
        if (s === 3) balance(g, f, lp, k, dt, P0, E, rPx);
        // The band in orbit (all ways), once it fills.
        const band = ease(P('sale') + 1.2, P('sale') + 2.0, p);
        if (band > 0.01) {
          const q = proj(tmp.copy(right).multiplyScalar(-1.25).add(V(0, 0.02, 0)).addScaledVector(VIEW, 0.3));
          if (q) nota(g, u, q.x, q.y, 'fábricas y cómputo en órbita', -60, -36, band * (1 - ease(P('sale') + 3.6, P('sale') + 4.2, p) * 0));
        }
      },
      dispose() {
        ir.uni.uHeat.value.dispose();
      },
    };

    // ------------------------------------------------------------ 2 · the ladder, up close
    function escaleraGrande(g: CanvasRenderingContext2D, f: Frame, lp: number, k: number, dt: number, E: P2, rPx: number) {
      const { p, W, H, u } = f;
      void E;
      void rPx;
      const A = ease(P('hoy') + 0.1, P('hoy') + 0.8, p);
      if (A < 0.01) return;
      const L0 = 12.5;
      const L1 = 17.6;
      const x = W - 250 * u;
      const y0 = H - 110 * u;
      const y1 = 140 * u;
      const yOf = (v: number) => y0 + ((v - L0) / (L1 - L0)) * (y1 - y0);
      g.save();
      g.globalAlpha = A;
      // The rail and its decades.
      linea(g, u, [{ x, y: yOf(L0) }, { x, y: yOf(13.3) }], ink(0.5), 1, [], 1.2);
      linea(g, u, [{ x, y: yOf(13.3) }, { x, y: yOf(L1) }], ink(0.45), 1, [5, 4], 1.2);
      for (let v = 13; v <= 17; v++) {
        const yy = yOf(v);
        linea(g, u, [{ x: x - 7 * u, y: yy }, { x, y: yy }], ink(0.4), 1, [], 1);
        g.font = FONT.serif(15 * u);
        g.fillStyle = ink(0.55);
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText(`10${sup(v)}`, x + 12 * u, yy);
      }
      g.restore();
      const wallY = yOf(15);
      // The fill: teal up to the wall; beyond it (still on the surface) the heat that would stay, in red.
      const yp = yOf(clamp(lp, L0, L1));
      const yw = Math.max(yp, wallY);
      g.save();
      g.globalAlpha = A;
      const grd = g.createLinearGradient(0, y0, 0, yw);
      grd.addColorStop(0, 'rgba(111,227,193,0.08)');
      grd.addColorStop(1, 'rgba(111,227,193,0.95)');
      g.fillStyle = grd;
      g.fillRect(x - 2.5 * u, yw, 5 * u, y0 - yw);
      if (lp > 15) {
        const hot = 1 - k;
        g.fillStyle = `rgba(255,96,64,${0.9 * hot})`;
        g.shadowColor = '#ff5b4a';
        g.shadowBlur = 16 * u * hot;
        g.fillRect(x - 2.5 * u, yp, 5 * u, wallY - yp);
        g.shadowBlur = 0;
        // Off the planet: the climb goes around the wall.
        if (k > 0.01) {
          g.globalAlpha = A * k;
          g.strokeStyle = TEAL;
          g.lineWidth = Math.max(1, 2.2 * u);
          g.setLineDash([4 * u, 4 * u]);
          g.beginPath();
          g.moveTo(x, wallY + 14 * u);
          g.bezierCurveTo(x - 60 * u, wallY + 4 * u, x - 60 * u, yp + 10 * u, x, yp);
          g.stroke();
          g.setLineDash([]);
          texto(g, u, x - 66 * u, (wallY + yp) / 2 + 4 * u, 'fuera del planeta', TEAL, A * k, 10, 'right');
        }
      }
      // You are here.
      g.globalAlpha = A;
      g.fillStyle = k > 0.5 || lp <= 15 ? TEAL : '#ff7a5a';
      g.shadowColor = g.fillStyle as string;
      g.shadowBlur = 12 * u;
      g.beginPath();
      g.arc(x, yp, 5 * u, 0, Math.PI * 2);
      g.fill();
      g.restore();
      // Rungs: what each power is (left) and the heat it would leave on the planet (right).
      const rungs: [number, string][] = [
        [13.28, 'hoy · 19 TW'],
        [13.67, 'el calor interno de la Tierra'],
        [14.0, 'la fotosíntesis de todo el planeta'],
        [16.0, 'tipo I'],
        [17.09, 'la luz del Sol que absorbe la Tierra'],
      ];
      for (const [v, label] of rungs) {
        const yy = yOf(v);
        const near = 1 - smoothstep(0.9, 2.2, Math.abs(v - lp));
        const a = A * (0.45 + 0.55 * near);
        linea(g, u, [{ x: x - 12 * u, y: yy }, { x: x - 2 * u, y: yy }], v <= lp ? TEAL : ink(0.6), a, [], 1.2);
        texto(g, u, x - 18 * u, yy, label, v <= lp ? TEAL : ink(0.8), a, 9.5, 'right');
        const cost = calentamiento(Math.pow(10, v));
        const off = k > 0.5 && v > 15;
        texto(g, u, x + 62 * u, yy, off ? 'en órbita: no se queda' : grados(cost), off ? ink(0.4) : cost > 3 ? '#ff8a6a' : cost > 0.3 ? '#ffb898' : ink(0.6), a, 10.5, 'left', false);
      }
      texto(g, u, x + 62 * u, y1 - 34 * u, 'calor que quedaría', ink(0.55), A, 9, 'left');
      texto(g, u, x + 62 * u, y1 - 20 * u, 'en la Tierra', ink(0.55), A, 9, 'left');
      // The wall: across the ladder and across the whole screen.
      const wa = A * ease(P('crece') + 0.8, P('crece') + 1.8, p);
      const hit = ease(14.9, 15.5, lp) * (1 - k);
      g.save();
      g.globalAlpha = wa;
      g.strokeStyle = `rgba(255,106,74,${0.35 + 0.6 * hit})`;
      g.lineWidth = Math.max(1, (1.2 + 1.8 * hit) * u);
      g.shadowColor = '#ff5b4a';
      g.shadowBlur = 14 * hit * u;
      g.setLineDash([10 * u, 6 * u]);
      g.beginPath();
      g.moveTo(0, wallY);
      g.lineTo(x + 40 * u, wallY);
      g.stroke();
      g.restore();
      texto(g, u, x - 18 * u, wallY - 14 * u, 'muro · el límite de un planeta', '#ff8a6a', wa, 10.5, 'right');
      texto(g, u, x - 18 * u, wallY + 14 * u, 'Balbi y Lingam (2025): K ≈ 0,9', ink(0.55), wa, 9, 'right', false);
      void dt;
    }

    // ------------------------------------------------------------ 3 · the energy balance
    function balance(g: CanvasRenderingContext2D, f: Frame, lp: number, k: number, dt: number, P0: number, E: P2, rPx: number) {
      const { p, W, H, u, time } = f;
      const A = ease(P('hoy') + 0.2, P('hoy') + 1.0, p);
      if (A < 0.01) return;
      // Screen directions: the Sun is to the left.
      const sunScr = { x: -1, y: 0 };
      // Sunlight in: parallel arrows from the left edge to the day side.
      for (let i = 0; i < 7; i++) {
        const yy = E.y + (i / 6 - 0.5) * 1.5 * rPx;
        const hy = (yy - E.y) / rPx;
        const xs = E.x - Math.sqrt(Math.max(0, 1 - hy * hy)) * rPx;
        const run = ((time * 0.5 + i * 0.17) % 1) * 24;
        flecha(g, u, { x: 30 * u, y: yy }, { x: xs - 4 * u, y: yy }, '#ffe0a0', A * 0.85, 1.4, [7, 6], run);
      }
      nota(g, u, 90 * u, E.y - 0.75 * rPx, 'luz del Sol · 174 000 TW', 0, -26, A, '#ffe0a0');
      // Reflected (30 %): back out to the upper left.
      for (let i = 0; i < 2; i++) {
        const ang = Math.PI + 0.5 + i * 0.32;
        const a0 = { x: E.x + Math.cos(ang) * rPx, y: E.y - Math.sin(ang) * rPx * -1 };
        const a1 = { x: a0.x - 120 * u, y: a0.y - (70 + i * 30) * u };
        flecha(g, u, a0, a1, 'rgba(255,224,160,0.8)', A * 0.7, 1.2, [3, 5]);
      }
      const refl = { x: E.x - rPx * 0.9 - 120 * u, y: E.y - rPx * 0.4 - 90 * u };
      texto(g, u, refl.x - 6 * u, refl.y - 12 * u, 'reflejada · 30 %', 'rgba(255,224,160,0.85)', A, 9.5, 'left');
      // Heat out: waves leaving all around, warmer and stronger as the planet must shed more.
      const warm = Math.min(1, dt / 6);
      const heatCol = `rgba(255,${Math.round(120 - 50 * warm)},${Math.round(80 - 40 * warm)},1)`;
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2 + 0.2;
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        if (c < -0.6 && Math.abs(sn) < 0.55) continue; // leave the incoming sunlight clear
        const pts: P2[] = [];
        const len = (55 + 40 * warm) * u;
        for (let j = 0; j <= 20; j++) {
          const t = j / 20;
          const r = rPx * 1.04 + t * len;
          const w = Math.sin(t * 16 - time * 4 + i) * 4 * u * (1 - t * 0.3);
          pts.push({ x: E.x + c * r - sn * w, y: E.y + sn * r + c * w });
        }
        linea(g, u, pts, heatCol, A * (0.55 + 0.4 * warm), [], 1.3 + 1.2 * warm);
        flecha(g, u, pts[18], pts[20], heatCol, A * (0.55 + 0.4 * warm), 1.3);
      }
      nota(g, u, E.x + rPx * 0.75, E.y - rPx * 0.95, 'calor que sale (infrarrojo)', 40, -30, A, '#ff8a5a');
      // Our energy: teal arrows from the night side, joining the heat that leaves.
      const share = P0 / F_ABS;
      const ourW = 1 + Math.min(5, Math.sqrt(share) * 22);
      const ours = A * ease(P('hoy') + 0.6, P('hoy') + 1.2, p);
      for (let i = 0; i < 4; i++) {
        const ang = -0.55 + i * 0.36;
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        // Off the planet: the arrows leave from orbit instead.
        const r0 = rPx * lerp(0.92, 1.55, k);
        const a0 = { x: E.x + c * r0, y: E.y + sn * r0 };
        const len = (40 + 90 * Math.sqrt(share / 0.08)) * u;
        const a1 = { x: E.x + c * (r0 + len), y: E.y + sn * (r0 + len) };
        flecha(g, u, a0, a1, TEAL, ours * (0.4 + 0.6 * Math.min(1, ourW / 3)), ourW, [], 0);
      }
      const ourLabel = { x: E.x + rPx * lerp(0.98, 1.5, k), y: E.y - rPx * 0.12 };
      nota(g, u, ourLabel.x, ourLabel.y, k > 0.5 ? 'nuestra energía, desde la órbita' : 'nuestra energía · también sale como calor', 16, -46, ours);

      // The balance, as bars.
      const bx = W - 590 * u;
      const by = H - 330 * u;
      const bw = 300 * u;
      g.save();
      g.globalAlpha = A;
      g.fillStyle = 'rgba(4,6,8,0.72)';
      g.strokeStyle = 'rgba(236,231,219,0.18)';
      g.lineWidth = Math.max(1, u);
      g.beginPath();
      g.roundRect(bx - 20 * u, by - 44 * u, bw + 160 * u, 232 * u, 8 * u);
      g.fill();
      g.stroke();
      g.restore();
      texto(g, u, bx, by - 22 * u, 'balance de energía de la Tierra', ink(0.7), A, 9.5);
      const row = (y: number, label: string, base: number, extra: number, extraCol: string, value: string) => {
        texto(g, u, bx, y, label, ink(0.8), A, 9.5);
        const w0 = bw * base;
        g.save();
        g.globalAlpha = A;
        g.fillStyle = 'rgba(236,231,219,0.22)';
        g.fillRect(bx, y + 10 * u, w0, 12 * u);
        if (extra > 0) {
          g.fillStyle = extraCol;
          g.fillRect(bx + w0, y + 10 * u, Math.max(1.5 * u, bw * extra), 12 * u);
        }
        g.restore();
        texto(g, u, bx + bw + 14 * u, y + 16 * u, value, ink(0.75), A, 10, 'left', false);
      };
      const sh = share * 0.92;
      row(by, 'entra · luz del Sol absorbida', 0.92, 0, TEAL, '122 000 TW');
      row(by + 46 * u, 'sale · calor que radia', 0.92, sh, TEAL, `122 000 + ${vatios(Math.log10(Math.max(P0, 1e12)))}`);
      const space = Math.pow(10, lp) - P0;
      row(by + 92 * u, 'en órbita · se va al espacio', 0, k > 0.01 ? (space / F_ABS) * 0.92 * k : 0, TEAL, k > 0.05 ? vatios(Math.log10(Math.max(space, 1e12))) : '—');
      g.save();
      g.globalAlpha = A;
      g.font = FONT.sans(12.5 * u);
      g.fillStyle = ink(0.72);
      g.textBaseline = 'alphabetic';
      g.fillText('Para soltar también lo nuestro, la superficie se calienta:', bx, by + 152 * u);
      g.restore();
      cifra(g, u, bx + bw + 60 * u, by + 160 * u, grados(dt), '', 30, A, dt > 3 ? '#ff8a5a' : ink(0.92));
      void sunScr;
      void F_IN;
    }
  },
};
