import * as THREE from 'three';

/**
 * Galaxies as the sky has them, not one spiral copied (Diego, 30 Oct: «todas se ven iguales y
 * perfectas»): grand-design spirals, open or tight; barred spirals; spirals of many ragged arms;
 * ellipticals, round or flattened, old and warm; lenticulars, a disc with no arms; irregulars, clumpy
 * and blue. Each its own size, tilt, lopsidedness and colour.
 *
 * `formaGalaxia` draws one round a centre into `emit(x, y, z, t, luz, tinte)`: the offset from the
 * centre, how far out (0 core .. 1 edge, for colour ramps), the light, and a tint to multiply the
 * scene's own colour by (warm cores, blue arms, pink star-forming knots).
 */

export type Emitir = (x: number, y: number, z: number, t: number, luz: number, tinte: THREE.Color) => void;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CALIDO = new THREE.Color(1.0, 0.86, 0.66);
const VIEJO = new THREE.Color(1.0, 0.8, 0.58);
const AZUL = new THREE.Color(0.78, 0.88, 1.0);
const BLANCO = new THREE.Color(1, 1, 1);
const ROSA = new THREE.Color(1.0, 0.62, 0.72);

/** What a galaxy is, for a glow drawn under its points: its size, its disc's frame, its kind (0
 * spiral, 1 elliptical, 2 lenticular, 3 irregular) and, for a spiral, its arms. */
export interface FormaGalaxia {
  R: number;
  eje: THREE.Vector3;
  t1: THREE.Vector3;
  t2: THREE.Vector3;
  clase: number;
  brazos: number;
  paso: number;
  giro: number;
}

/** One galaxy of `n` points, about `R` across its disc, round the origin. */
export function formaGalaxia(r: () => number, n: number, R0: number, emit: Emitir): FormaGalaxia {
  const g = () => (r() + r() + r() + r() - 2) * 0.866;
  // Its size: most small, a few large.
  const R = R0 * Math.exp(g() * 0.45);
  // Its tilt, and a disc frame.
  const eje = V(g(), g(), g()).normalize();
  const t1 = V(0, 1, 0).cross(eje);
  if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
  t1.normalize();
  const t2 = eje.clone().cross(t1);
  const en = (a: number, b: number, h: number, t: number, luz: number, tinte: THREE.Color) => {
    emit(t1.x * a + t2.x * b + eje.x * h, t1.y * a + t2.y * b + eje.y * h, t1.z * a + t2.z * b + eje.z * h, t, luz, tinte);
  };
  const tipo = r();
  const forma: FormaGalaxia = { R, eje, t1, t2, clase: 0, brazos: 2, paso: 0, giro: 0 };
  const sp = (brazos: number, paso: number, ...mas: boolean[]) => {
    forma.brazos = brazos;
    forma.paso = paso;
    forma.giro = espiral(r, g, n, R, en, brazos, paso, ...mas);
  };
  if (tipo < 0.26) sp(2, 1.4 + r() * 2.2, r() < 0.3);
  else if (tipo < 0.42) sp(2, 1.6 + r() * 1.4, true, true);
  else if (tipo < 0.58) sp(3 + Math.floor(r() * 3), 1.2 + r() * 1.6, false, false, true);
  else if (tipo < 0.78) {
    forma.clase = 1;
    eliptica(r, g, n, R, en);
  } else if (tipo < 0.88) {
    forma.clase = 2;
    lenticular(r, g, n, R, en);
  } else {
    forma.clase = 3;
    irregular(r, g, n, R, en);
  }
  return forma;
}

type En = (a: number, b: number, h: number, t: number, luz: number, tinte: THREE.Color) => void;

/** A spiral: a bulge, `brazos` arms winding at `paso`, perhaps a bar, perhaps ragged and clumpy. */
function espiral(r: () => number, g: () => number, n: number, R: number, en: En, brazos: number, paso: number, lado = false, barra = false, grumos = false): number {
  const giro = r() * Math.PI * 2;
  const bulbo = 0.12 + r() * 0.12;
  const largoBarra = barra ? 0.25 + r() * 0.2 : 0;
  // Lopsided a little: one side's arms a touch longer.
  const ladeo = lado ? 0.25 : 0.08;
  const nucleo = Math.floor(n * (0.18 + 0.1 * r()));
  for (let k = 0; k < n; k++) {
    if (k < nucleo) {
      en(g() * R * bulbo, g() * R * bulbo, g() * R * bulbo * 0.7, 0, 1.0, CALIDO);
      continue;
    }
    if (barra && k < nucleo * 1.6) {
      const x = (r() * 2 - 1) * R * largoBarra;
      en(x * Math.cos(giro) - g() * R * 0.04 * Math.sin(giro), x * Math.sin(giro) + g() * R * 0.04 * Math.cos(giro), g() * R * 0.03, 0.15, 0.8, CALIDO);
      continue;
    }
    const b = k % brazos;
    const q0 = Math.sqrt(r());
    const q = (largoBarra + (1 - largoBarra) * q0) * R * (1 + ladeo * Math.cos(giro + (b / brazos) * Math.PI * 2));
    const fase = (b / brazos) * Math.PI * 2 + giro + Math.log(q / R + 0.05) * paso;
    const ancho = grumos ? 0.55 : 0.32;
    const a = fase + g() * ancho * (0.6 + q0);
    let x = Math.cos(a) * q;
    let y = Math.sin(a) * q;
    // Ragged arms: points gathered in knots along them.
    if (grumos && r() < 0.5) {
      const kx = Math.round(x / (R * 0.12)) * R * 0.12;
      const ky = Math.round(y / (R * 0.12)) * R * 0.12;
      x = kx + g() * R * 0.03;
      y = ky + g() * R * 0.03;
    }
    const rosa = r() < 0.05;
    en(x, y, g() * R * 0.04, 0.15 + 0.7 * q0, rosa ? 0.9 : 0.5, rosa ? ROSA : q0 < 0.3 ? BLANCO : AZUL);
  }
  return giro;
}

/** An elliptical: a smooth swarm, brightest at the middle, round or flattened, old and warm. */
function eliptica(r: () => number, g: () => number, n: number, R: number, en: En) {
  const b = 0.45 + r() * 0.55;
  const c = 0.35 + r() * 0.65;
  for (let k = 0; k < n; k++) {
    // Steep towards the middle (most of its light in its heart).
    const q = Math.pow(r(), 2.2) * R * 0.9;
    const x = g();
    const y = g();
    const z = g();
    const l = Math.hypot(x, y, z) || 1;
    en((x / l) * q, (y / l) * q * b, (z / l) * q * c, q / R, 0.45 + 0.6 * (1 - q / R), VIEJO);
  }
}

/** A lenticular: a bulge and a smooth disc, no arms. */
function lenticular(r: () => number, g: () => number, n: number, R: number, en: En) {
  for (let k = 0; k < n; k++) {
    if (k < n * 0.35) {
      en(g() * R * 0.18, g() * R * 0.18, g() * R * 0.12, 0, 0.95, CALIDO);
      continue;
    }
    const a = r() * Math.PI * 2;
    const q = (0.1 + Math.pow(r(), 0.8) * 0.9) * R;
    en(Math.cos(a) * q, Math.sin(a) * q, g() * R * 0.025, q / R, 0.45, VIEJO);
  }
}

/** An irregular: clumps of young blue stars and pink nebulae, no order. */
function irregular(r: () => number, g: () => number, n: number, R: number, en: En) {
  const nudos = 3 + Math.floor(r() * 5);
  const cs = Array.from({ length: nudos }, () => [g() * R * 0.5, g() * R * 0.35, g() * R * 0.2]);
  for (let k = 0; k < n; k++) {
    const c = cs[Math.floor(r() * nudos)];
    const s = R * (0.08 + 0.12 * r());
    const rosa = r() < 0.12;
    en(c[0] + g() * s, c[1] + g() * s, c[2] + g() * s * 0.6, 0.5, rosa ? 0.85 : 0.5, rosa ? ROSA : AZUL);
  }
}

/**
 * The galaxies' diffuse light, under their points (Diego, 31 Oct: what gains from not being dots):
 * one soft glow each, in its own disc's plane, a warm heart, a disc fading out and, for a spiral, its
 * arms winding as its points do; seen edge-on, little. `uOn` the light, `uTinte` the colour of their
 * discs (warmer at the heart).
 */
export function brillosGalaxias(galaxias: { c: THREE.Vector3; f: FormaGalaxia }[], tinte: THREE.Color) {
  const n = galaxias.length;
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(2, 2, 1, 1);
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  const centro = new Float32Array(n * 3);
  const e1 = new Float32Array(n * 3);
  const e2 = new Float32Array(n * 3);
  const forma = new Float32Array(n * 4);
  galaxias.forEach(({ c, f }, i) => {
    centro.set([c.x, c.y, c.z], i * 3);
    const k = f.R * (f.clase === 1 ? 1.0 : 1.25);
    e1.set([f.t1.x * k, f.t1.y * k, f.t1.z * k], i * 3);
    e2.set([f.t2.x * k, f.t2.y * k, f.t2.z * k], i * 3);
    forma.set([f.clase, f.brazos, f.paso, f.giro], i * 4);
  });
  geo.setAttribute('aCentro', new THREE.InstancedBufferAttribute(centro, 3));
  geo.setAttribute('aE1', new THREE.InstancedBufferAttribute(e1, 3));
  geo.setAttribute('aE2', new THREE.InstancedBufferAttribute(e2, 3));
  geo.setAttribute('aForma', new THREE.InstancedBufferAttribute(forma, 4));
  geo.instanceCount = n;
  const u = { uOn: { value: 0 }, uFundido: { value: 1 }, uTinte: { value: tinte.clone() } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      attribute vec3 aCentro, aE1, aE2;
      attribute vec4 aForma;
      varying vec2 vQ;
      varying vec4 vForma;
      varying float vCara;
      void main() {
        vQ = position.xy;
        vForma = aForma;
        vec3 w = aCentro + aE1 * position.x + aE2 * position.y;
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        vec3 nrm = normalize(normalMatrix * cross(aE1, aE2));
        vCara = abs(dot(nrm, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOn, uFundido;
      uniform vec3 uTinte;
      varying vec2 vQ;
      varying vec4 vForma;
      varying float vCara;
      void main() {
        float r = length(vQ);
        if (r > 1.0) discard;
        float th = atan(vQ.y, vQ.x);
        float disco = exp(-r * 3.6) * (1.0 - smoothstep(0.5, 0.98, r));
        float corazon = exp(-r * 16.0);
        float brazos = 0.0;
        if (vForma.x < 0.5) {
          float m = 0.5 + 0.5 * cos(vForma.y * (th - vForma.w - log(r + 0.05) * vForma.z));
          brazos = pow(m, 3.0) * smoothstep(0.08, 0.25, r) * exp(-r * 2.4) * (1.0 - smoothstep(0.55, 0.95, r));
        }
        float liso = vForma.x > 0.5 && vForma.x < 1.5 ? exp(-r * 4.5) * 1.2 : 0.0;
        vec3 col = mix(uTinte, vec3(1.0, 0.82, 0.6), 0.6) * (corazon * 0.9 + liso * 0.5) + uTinte * (disco * 0.22 + brazos * 0.5);
        float cara = mix(0.25, 1.0, smoothstep(0.05, 0.6, vCara));
        gl_FragColor = vec4(col * cara * uOn * uFundido, 0.0);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return { mesh, u };
}
