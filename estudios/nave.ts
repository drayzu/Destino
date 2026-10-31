import { logDepth } from './motor/logdepth';
import { materia, materiaBuilder, type Nube } from './motor/materia';
import * as THREE from 'three';

/**
 * The ship that is a world, from outside, as surfaces (Diego, 30 Oct: «mostraría la nave e intentaría
 * mejorar su diseño exterior para que parezca más nave»; 31 Oct: three rings, the radiators clear of
 * them, a smaller dish, nothing toy-like aft; later the stern of the first Destino's ship, which he
 * liked better): a spine braced along the rings, three rings (cilindro.ts) on their spokes, at the
 * bow a small shallow dish of shielding plates against the dust; aft four swept radiator fins glowing
 * dull red with the heat they shed, six propellant tanks in banded insulation round the spine, and
 * the drive: a magnetic nozzle (an open bell of coils and ribs), its throat a knot of light, and a jet
 * of plasma in points. Running lights. Its own units: about 1 long, along +Z (the bow); the rings 0.13
 * in radius.
 */

const VERT = /* glsl */ `
  varying vec3 vL;
  varying vec3 vV;
  varying vec3 vN;
  varying vec2 vUv;
  void main() {
    vL = position;
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const COMUN = /* glsl */ `
  uniform float uOn, uFundido, uTime;
  varying vec3 vL;
  varying vec3 vV;
  varying vec3 vN;
  varying vec2 vUv;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float raya(float x, float w) {
    float d = abs(fract(x + 0.5) - 0.5);
    float fw = max(fwidth(x), 1e-6);
    return 1.0 - smoothstep(w - fw, w + fw, d);
  }
  float borde() { return pow(clamp(1.0 - abs(dot(normalize(vN), normalize(-vV))), 0.0, 1.0), 3.0); }
`;

/** Dark hull: panels in a grid on (u, v), fine seams, a cold rim of light, a few lit ports. */
const CASCO = /* glsl */ `
  ${COMUN}
  uniform vec2 uRejilla;
  void main() {
    vec2 q = vUv * uRejilla;
    vec2 id = floor(q);
    float tono = h21(id);
    float costura = max(raya(q.x, 0.02), raya(q.y, 0.02));
    vec3 col = vec3(0.03, 0.034, 0.04) * (0.75 + 0.5 * tono) + vec3(0.4, 0.45, 0.5) * costura * 0.12;
    float puerto = step(0.93, h21(id + 7.0)) * (1.0 - smoothstep(0.12, 0.2, length(fract(q) - 0.5)));
    col += vec3(1.0, 0.82, 0.55) * puerto * 0.9;
    col += vec3(0.32, 0.4, 0.5) * borde() * 0.7;
    gl_FragColor = vec4(col * uOn * uFundido, uOn * uFundido);
  }
`;

/** The shield: overlapping hexagonal plates, dark, scuffed; its rim catching the light. */
const ESCUDO = /* glsl */ `
  ${COMUN}
  vec3 hexa(vec2 p) {
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h;
    vec2 b = mod(p - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    vec2 q = abs(gv);
    return vec3(0.5 - max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x), p - gv);
  }
  void main() {
    vec3 hx = hexa(vL.xy * 95.0);
    float costura = 1.0 - smoothstep(0.02, 0.02 + 1.5 * fwidth(hx.x), hx.x);
    float tono = h21(hx.yz);
    float r = length(vL.xy) / 0.085;
    vec3 col = vec3(0.045, 0.045, 0.05) * (0.7 + 0.6 * tono) * (1.0 - costura * 0.6);
    col += vec3(0.75, 0.72, 0.66) * smoothstep(0.88, 1.0, r) * 0.35;
    col += vec3(0.35, 0.42, 0.5) * borde() * 0.6;
    gl_FragColor = vec4(col * uOn * uFundido, uOn * uFundido);
  }
`;

/**
 * A radiator fin, as the first Destino's: a lattice of panels glowing dull red with the heat they
 * shed, each its own glow, hottest by the spine and cooler out to the tip, and see-through: light
 * only, the dark between the panels empty (Diego, 31 Oct: as solid plates they read heavy).
 */
const RADIADOR = /* glsl */ `
  ${COMUN}
  void main() {
    // (u: out from the spine; v: along the ship)
    vec2 q = vec2(vUv.x * 7.0, vUv.y * 5.0);
    vec2 id = floor(q);
    vec2 fr = fract(q);
    float m = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
    float panel = smoothstep(0.08, 0.08 + 1.5 * max(fwidth(q.x), 1e-5), m);
    // (fine heat pipes across each panel)
    float tubo = 0.75 + 0.25 * raya(vUv.y * 40.0, 0.12);
    float calor = (0.5 + 0.6 * h21(id)) * (1.0 - 0.55 * vUv.x);
    calor *= 0.93 + 0.07 * sin(uTime * 0.8 + h21(id + 5.0) * 6.2832);
    vec3 col = vec3(0.85, 0.24, 0.08) * 0.42 * calor * calor * panel * tubo;
    // (a faint frame holds them)
    float marco = 1.0 - smoothstep(0.0, 0.025, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    col += vec3(0.3, 0.12, 0.07) * marco * 0.25;
    gl_FragColor = vec4(col * uOn * uFundido, 0.0);
  }
`;

/** A propellant tank: the hull's own dark panels and seams, its cold rim, no ports (in a colour of
 * its own it read as a part from another ship). */
const TANQUE = /* glsl */ `
  ${COMUN}
  void main() {
    vec2 q = vUv * vec2(10.0, 9.0);
    vec2 id = floor(q);
    float costura = max(raya(q.x, 0.02), raya(q.y, 0.02));
    float luz = 0.5 + 0.5 * dot(normalize(vN), normalize(vec3(0.4, 0.7, 0.6)));
    vec3 col = vec3(0.034, 0.038, 0.044) * (0.75 + 0.5 * h21(id)) * (0.7 + 0.6 * luz) + vec3(0.4, 0.45, 0.5) * costura * 0.12;
    col += vec3(0.32, 0.4, 0.5) * borde() * 0.7;
    gl_FragColor = vec4(col * uOn * uFundido, uOn * uFundido);
  }
`;

/** Dark metal (tanks, booms): a soft sheen, a cold rim. */
const METAL = /* glsl */ `
  ${COMUN}
  void main() {
    float luz = 0.5 + 0.5 * dot(normalize(vN), normalize(vec3(0.4, 0.7, 0.6)));
    vec3 col = vec3(0.05, 0.055, 0.06) * (0.6 + 0.8 * luz) + vec3(0.3, 0.36, 0.42) * borde() * 0.45;
    gl_FragColor = vec4(col * uOn * uFundido, uOn * uFundido);
  }
`;

/**
 * The drive: a smooth bell of dark metal ringed by its magnetic coils (bright bands), its inside
 * glowing hot towards the throat (as an open lattice it read as something crawling).
 */
const TOBERA = /* glsl */ `
  ${COMUN}
  const bool uDentro = true;
  void main() {
    // (v: 0 at the throat, 1 at the mouth; clamped: a pow of a negative is a NaN that blacks out the
    // whole frame through the glow)
    float v = clamp(vUv.y, 0.0, 1.0);
    float bobina = raya(v * 4.0 + 0.5, 0.09);
    float luz = 0.5 + 0.5 * dot(normalize(vN), normalize(vec3(0.4, 0.7, 0.6)));
    vec3 col = vec3(0.05, 0.052, 0.058) * (0.6 + 0.8 * luz) + vec3(0.32, 0.36, 0.42) * borde() * 0.4;
    col += vec3(0.5, 0.52, 0.56) * bobina * 0.25;
    if (gl_FrontFacing == uDentro) col = mix(vec3(0.06, 0.04, 0.04), vec3(1.0, 0.6, 0.32), pow(1.0 - v, 2.0)) + vec3(0.7, 0.85, 1.0) * pow(1.0 - v, 8.0);
    gl_FragColor = vec4(col * uOn * uFundido, uOn * uFundido);
  }
`;

/**
 * The jet: plasma running out of the nozzle, a stream of points as the first Destino's (a smooth
 * plume read as smoke), dense and white in its core, widening and fading as it goes; and in the
 * throat a knot of light. `aKind`: where along the jet it starts (it runs on with the time); below
 * zero, the throat's, which stays.
 */
function chorroNube(z0: number, largo: number): Nube {
  const b = materiaBuilder(431);
  for (let i = 0; i < 9000; i++) {
    const a = b.r() * Math.PI * 2;
    const r = Math.min(1, Math.sqrt(-Math.log(1 - b.r() * 0.98)) * 0.45);
    const nucleo = r < 0.25;
    b.push(Math.cos(a) * r, Math.sin(a) * r, 0, nucleo ? 0xffffff : 0xa8c8ff, nucleo ? 0.0026 : 0.002, nucleo ? 1.3 : 0.8, { kind: b.r() });
  }
  for (let i = 0; i < 400; i++) {
    const [x, y, z] = b.onSphere();
    const q = Math.cbrt(b.r()) * 0.011;
    b.push(x * q, y * q, z0 + z * q, 0xdfeaff, 0.003, 1.6, { kind: -1 });
  }
  const n = materia(b.data(), {
    pre: /* glsl */ `uniform float uChorro;`,
    move: /* glsl */ `
      if (aKind >= 0.0) {
        float f = fract(aKind + uTime * 0.45);
        p.xy *= 0.007 + 0.03 * pow(f, 0.85);
        p.z = ${z0.toFixed(4)} - f * ${largo.toFixed(4)};
        em *= pow(1.0 - f, 1.8) * smoothstep(0.0, 0.03, f);
        sz *= 1.0 + 1.5 * f;
      }
      em *= uChorro;
    `,
    // (fading where it comes near the camera: flying past it never floods the frame)
    post: /* glsl */ `em *= smoothstep(0.12, 0.45, -mv.z);`,
    uniforms: { uChorro: { value: 0 } },
  });
  // (hidden behind the hull: it tests the depth the ship writes, logarithmic as the rest)
  const m = logDepth(n.points.material as THREE.ShaderMaterial);
  m.depthTest = true;
  n.u.uGain.value = 0.35;
  n.u.uFuente.value = 0.5;
  return n;
}

/** A running light: a small bright point that blinks (red, green, white). */
const LUZ = /* glsl */ `
  ${COMUN}
  uniform vec3 uColor;
  uniform float uFase;
  void main() {
    float f = fract(uTime * 0.7 + uFase);
    float on = smoothstep(0.0, 0.03, f) * (1.0 - smoothstep(0.1, 0.16, f));
    gl_FragColor = vec4(uColor * (0.15 + 3.0 * on) * uOn * uFundido, 0.0);
  }
`;

export interface NaveMalla {
  grupo: THREE.Group;
  /** The drive's jet, in points (the scene adds it beside the ship and keeps it focused). */
  chorro: Nube;
  update(on: number, time: number): void;
}

export function crearNaveMalla(anillos: number[], R: number): NaveMalla {
  const grupo = new THREE.Group();
  const uniforms = { uOn: { value: 0 }, uFundido: { value: 1 }, uTime: { value: 0 } };
  const mat = (frag: string, extra: Record<string, THREE.IUniform> = {}, aditivo = false, side: THREE.Side = THREE.FrontSide) =>
    logDepth(new THREE.ShaderMaterial({
      uniforms: { ...uniforms, ...extra },
      vertexShader: VERT,
      fragmentShader: frag,
      side,
      transparent: true,
      depthTest: !aditivo,
      depthWrite: !aditivo,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
  const hull = (rejilla: [number, number]) => mat(CASCO, { uRejilla: { value: new THREE.Vector2(...rejilla) } });

  // The spine, from the drive to the antenna at the bow, braced along the rings by four longerons.
  const espina = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.07, 32, 1), hull([24, 84]));
  espina.rotation.x = Math.PI / 2;
  espina.position.z = (0.45 - 0.62) / 2;
  grupo.add(espina);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const larguero = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.56, 8, 1), hull([2, 44]));
    larguero.rotation.x = Math.PI / 2;
    larguero.position.set(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0);
    grupo.add(larguero);
  }
  // Spokes to each ring, and a hub.
  for (const z of anillos) {
    const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 24, 1), hull([12, 2]));
    cubo.rotation.x = Math.PI / 2;
    cubo.position.z = z;
    grupo.add(cubo);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const L = R - 0.02 - 0.03;
      const rayo = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, L, 8, 1), hull([2, 20]));
      rayo.position.set(Math.cos(a) * (0.03 + L / 2), Math.sin(a) * (0.03 + L / 2), z);
      rayo.rotation.z = a - Math.PI / 2;
      grupo.add(rayo);
    }
  }
  // At the bow, on the spine as it comes, the shield: a small shallow dish of plates against the dust
  // (smaller twice over: Diego, 31 Oct).
  const R_ESCUDO = 0.085;
  const escudoG = new THREE.SphereGeometry(0.2, 96, 16, 0, Math.PI * 2, 0, Math.asin(R_ESCUDO / 0.2));
  escudoG.rotateX(Math.PI / 2);
  const escudo = new THREE.Mesh(escudoG, mat(ESCUDO, {}, false, THREE.DoubleSide));
  escudo.position.z = 0.46 - 0.2;
  grupo.add(escudo);
  // Aft of the rings, clear of them, the radiators: four fins swept back from a collar on the spine.
  const Z_RAD = -0.295;
  const colector = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.19, 32, 1), hull([16, 12]));
  colector.rotation.x = Math.PI / 2;
  colector.position.z = Z_RAD - 0.095;
  grupo.add(colector);
  const R0 = 0.024;
  const R1 = 0.19;
  const ZF = Z_RAD;
  const ZB = Z_RAD - 0.16;
  const BARRE = 0.05;
  const aletaG = new THREE.BufferGeometry();
  aletaG.setAttribute('position', new THREE.Float32BufferAttribute([R0, 0, ZF, R0, 0, ZB, R1, 0, ZB - BARRE, R1, 0, ZF - BARRE], 3));
  aletaG.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  aletaG.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
  aletaG.setIndex([0, 1, 2, 0, 2, 3]);
  // (light only, tested against the hull's depth so the rings still hide them, writing none)
  const matRad = mat(RADIADOR, {}, true, THREE.DoubleSide);
  matRad.depthTest = true;
  for (let k = 0; k < 4; k++) {
    const aleta = new THREE.Mesh(aletaG, matRad);
    aleta.rotation.z = (k / 4) * Math.PI * 2 + Math.PI / 4;
    grupo.add(aleta);
  }
  // The propellant: four long tanks round the spine behind the radiators, between their fins, as the
  // Shuttle's external tank (Diego, 31 Oct): a rounded aft dome, a pointed nose to the bow, orange
  // foam, a feed line along the outside, held to the spine by struts.
  const RT = 0.0135;
  const LT = 0.12;
  const NARIZ = 0.034;
  const perfilT: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    perfilT.push(new THREE.Vector2(RT * Math.sin((t * Math.PI) / 2) + 1e-4, RT * (1 - Math.cos((t * Math.PI) / 2))));
  }
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    perfilT.push(new THREE.Vector2(RT * Math.pow(Math.max(0, 1 - t * t), 0.55) + 1e-4, LT - NARIZ + t * NARIZ));
  }
  const tanqueG = new THREE.LatheGeometry(perfilT, 40);
  tanqueG.rotateX(Math.PI / 2);
  const matTanque = mat(TANQUE);
  const Z_TANQUE = -0.615;
  const R_TANQUE = 0.042;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const tanque = new THREE.Mesh(tanqueG, matTanque);
    tanque.position.set(c * R_TANQUE, sn * R_TANQUE, Z_TANQUE);
    grupo.add(tanque);
    const linea = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, LT * 0.8, 8, 1), mat(METAL));
    linea.rotation.x = Math.PI / 2;
    linea.position.set(c * (R_TANQUE + RT + 0.002), sn * (R_TANQUE + RT + 0.002), Z_TANQUE + LT * 0.45);
    grupo.add(linea);
    for (const z of [Z_TANQUE + 0.025, Z_TANQUE + LT - NARIZ - 0.005]) {
      const L = R_TANQUE - RT - 0.014;
      const puntal = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, L, 6, 1), mat(METAL));
      puntal.position.set(c * (0.016 + L / 2), sn * (0.016 + L / 2), z);
      puntal.rotation.z = a - Math.PI / 2;
      grupo.add(puntal);
    }
  }
  // The drive at the stern: the magnetic nozzle, its bell flaring out from the throat, and the jet.
  const Z_GARGANTA = -0.625;
  const perfil: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    perfil.push(new THREE.Vector2(0.012 + 0.038 * t * t, -t * 0.08));
  }
  const toberaG = new THREE.LatheGeometry(perfil, 64);
  toberaG.rotateX(Math.PI / 2);
  const tobera = new THREE.Mesh(toberaG, mat(TOBERA, {}, false, THREE.DoubleSide));
  tobera.position.z = Z_GARGANTA;
  grupo.add(tobera);
  const chorro = chorroNube(Z_GARGANTA - 0.012, 0.75);
  // Running lights: red and green on the upper fins' tips, white at the dish and the stern.
  const punta = (a: number) => new THREE.Vector3(Math.cos(a) * (R1 + 0.004), Math.sin(a) * (R1 + 0.004), (ZF + ZB) / 2 - BARRE);
  const luces: [THREE.Vector3, THREE.Color, number][] = [
    [punta((3 * Math.PI) / 4), new THREE.Color(1.0, 0.18, 0.12), 0.0],
    [punta(Math.PI / 4), new THREE.Color(0.2, 1.0, 0.45), 0.0],
    [new THREE.Vector3(0, 0, 0.466), new THREE.Color(1, 1, 1), 0.5],
    [new THREE.Vector3(0, 0.022, Z_GARGANTA + 0.01), new THREE.Color(1, 1, 1), 0.25],
  ];
  for (const [q, c, fase] of luces) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 10, 6), mat(LUZ, { uColor: { value: c }, uFase: { value: fase } }, true));
    l.position.copy(q);
    l.renderOrder = 4;
    grupo.add(l);
  }
  return {
    grupo,
    chorro,
    update(on, time) {
      uniforms.uOn.value = on;
      uniforms.uTime.value = time;
      chorro.u.uChorro.value = on;
      grupo.visible = on > 0.002;
    },
  };
}
