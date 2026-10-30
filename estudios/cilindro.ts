import * as THREE from 'three';
import { materia, materiaBuilder, type Nube } from './motor/materia';
import { gauss } from './motor/math';

/**
 * A world that turns (an O'Neill cylinder), drawn as surfaces of light rather than a cloud of points
 * (Diego, 30 Oct: the cylinder needed it most): three strips of land and three of windows, its end
 * walls and three mirrors, all turning together round the axis.
 *
 * - Inside (the land, seen from within): a landscape worked out in the shader, fields and hedges,
 *   woods, a river down each strip, towns, a haze that thickens with distance, so the land that
 *   rises up the sides and passes overhead reads as land, far and near. The windows let the stars
 *   through and a glow of sunlight in.
 * - Outside (the hull): dark, with fine panel lines and a rim of light; the windows are glass,
 *   through which the land of the far side shows. The mirrors are bright glass panels.
 * - Clouds, in points, float in the middle.
 *
 * Local frame: the axis is +Z (sunward), radius `RC`, length `LC`. Strip k (0..5) spans the angle
 * [k·π/3, (k+1)·π/3]; even strips are land, odd ones windows. `giro` turns everything.
 */

export interface Cilindro {
  grupo: THREE.Group;
  /** Turns with the world (the clouds and the surfaces). */
  giro: THREE.Group;
  nubes: Nube;
  /** Per frame: presence (0..1), the turn (radians), and the camera (world). */
  update(on: number, ag: number, cam: THREE.Vector3): void;
}

const COMUN = /* glsl */ `
  uniform float uOn, uFundido, uRC, uLC;
  uniform vec3 uCamL;
  varying vec3 vL;
  varying vec3 vV;
  #define TERCIO 1.0471976
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float ruido(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { return 0.5 * ruido(p) + 0.25 * ruido(p * 2.03) + 0.125 * ruido(p * 4.01) + 0.0625 * ruido(p * 8.02); }
  // A line of width w (in the pattern's units) at the integer values of x, anti-aliased.
  float raya(float x, float w) {
    float d = abs(fract(x + 0.5) - 0.5);
    float fw = max(fwidth(x), 1e-6);
    return 1.0 - smoothstep(w - fw, w + fw, d);
  }
  // The strip (0..5) and where across it (0..1) and along the axis (0..1) this point is.
  vec3 franja() {
    float fi = atan(vL.y, vL.x);
    if (fi < 0.0) fi += 6.2831853;
    float s = fi / TERCIO;
    return vec3(floor(s), fract(s), vL.z / uLC + 0.5);
  }
`;

const VERT = /* glsl */ `
  varying vec3 vL;
  varying vec3 vV;
  void main() {
    vL = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

/** The land, seen from inside (and, through the windows, from outside). */
const TIERRA = /* glsl */ `
  ${COMUN}
  void main() {
    vec3 f = franja();
    float k = f.x;
    float u = f.y;
    float v = f.z;
    // Haze: the air inside, thicker the farther the view runs through it (the far end and the land
    // overhead go pale blue); from outside, only the stretch inside counts.
    vec3 dirL = vL - uCamL;
    float d = length(dirL);
    dirL /= max(d, 1e-9);
    float a2 = dot(dirL.xy, dirL.xy);
    float b2 = dot(uCamL.xy, dirL.xy);
    float c2 = dot(uCamL.xy, uCamL.xy) - uRC * uRC;
    float tIn = 0.0;
    if (c2 > 0.0 && a2 > 1e-9) tIn = max(0.0, (-b2 - sqrt(max(b2 * b2 - a2 * c2, 0.0))) / a2);
    float bruma = 1.0 - exp(-max(d - tIn, 0.0) / (uLC * 0.7));
    vec3 aire = vec3(0.42, 0.52, 0.64);
    if (mod(k, 2.0) > 0.5) {
      // A window: the stars through it, and the sunlight the mirrors send in, a soft glow.
      float borde = smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.92, u);
      float marco = raya(vL.z / uLC * 36.0, 0.04) * 0.12;
      vec3 luz = vec3(0.95, 0.92, 0.82) * 0.10 * borde + vec3(0.5, 0.56, 0.62) * marco;
      gl_FragColor = vec4(luz * uOn * uFundido, 0.0);
      return;
    }
    // In world units across and along the strip.
    vec2 q = vec2(u * TERCIO * uRC, vL.z);
    float semilla = k * 13.7;
    // The river down the strip, meandering.
    float xr = 0.5 + 0.26 * sin(v * 9.0 + semilla) + 0.07 * sin(v * 31.0 + semilla * 2.0);
    float dr = abs(u - xr) * TERCIO * uRC;
    float rio = 1.0 - smoothstep(0.0016, 0.0016 + fwidth(dr) * 1.5, dr);
    float orilla = 1.0 - smoothstep(0.0016, 0.006, dr);
    // Fields: a patchwork of plots (slightly askew), each its own crop; hedges between.
    vec2 c = q / vec2(0.005, 0.008) + vec2(0.0, 0.3 * sin(q.x * 120.0));
    vec2 id = floor(c);
    float h = h21(id + semilla);
    vec3 campo = h < 0.3 ? vec3(0.13, 0.25, 0.07) : h < 0.55 ? vec3(0.22, 0.32, 0.08) : h < 0.75 ? vec3(0.40, 0.36, 0.12) : h < 0.9 ? vec3(0.30, 0.21, 0.11) : vec3(0.17, 0.30, 0.12);
    campo *= 0.85 + 0.3 * ruido(q * 900.0);
    // Furrows in some fields.
    if (h > 0.55 && h < 0.9) campo *= 0.9 + 0.1 * sin((h > 0.75 ? c.x : c.y) * 40.0);
    float seto = max(raya(c.x, 0.04), raya(c.y, 0.025));
    campo = mix(campo, vec3(0.09, 0.14, 0.07), seto * 0.8);
    // Woods.
    float bosque = smoothstep(0.58, 0.64, fbm(q * 55.0 + semilla));
    campo = mix(campo, vec3(0.07, 0.13, 0.07) * (0.7 + 0.6 * ruido(q * 1400.0)), bosque);
    // Towns along the river: pale roofs in a grid, a few warm lights.
    float pueblo = 0.0;
    for (int i = 0; i < 4; i++) {
      float vt = (float(i) + 0.5) / 4.0 + 0.07 * sin(semilla + float(i));
      float ut = 0.5 + 0.26 * sin(vt * 9.0 + semilla) + 0.07 * sin(vt * 31.0 + semilla * 2.0) + 0.08 * (h21(vec2(float(i), semilla)) - 0.5);
      vec2 dq = vec2((u - ut) * TERCIO * uRC, (v - vt) * uLC);
      pueblo = max(pueblo, 1.0 - smoothstep(0.004, 0.016, length(dq * vec2(1.0, 0.6))));
    }
    vec2 cc = q / 0.0022;
    float manzana = (1.0 - max(raya(cc.x, 0.12), raya(cc.y, 0.12))) * step(0.35, h21(floor(cc)));
    vec3 tejados = mix(vec3(0.42, 0.40, 0.36), vec3(0.62, 0.58, 0.5), h21(floor(cc) + 3.0));
    campo = mix(campo, mix(vec3(0.3, 0.3, 0.28), tejados, manzana), pueblo * 0.9);
    // The river and its banks.
    campo = mix(campo, vec3(0.16, 0.22, 0.12), orilla * 0.5);
    vec3 agua = vec3(0.24, 0.40, 0.52) + 0.25 * pow(ruido(q * 2000.0), 6.0);
    campo = mix(campo, agua, rio);
    // Along the window edges, the shore of the land: a pale road.
    float costa = smoothstep(0.035, 0.0, u) + smoothstep(0.965, 1.0, u);
    campo = mix(campo, vec3(0.45, 0.46, 0.43), costa * 0.8);
    // Light: sunlight through the windows, brightest beside them.
    float sol = 0.75 + 0.35 * (smoothstep(0.3, 0.0, u) + smoothstep(0.7, 1.0, u));
    vec3 col = campo * sol * 1.25;
    col = mix(col, aire, bruma * 0.8);
    gl_FragColor = vec4(col * uOn * uFundido, uOn * uFundido);
  }
`;

/** The hull, seen from outside: dark panels and fine lines; the windows are glass. */
const CASCO = /* glsl */ `
  ${COMUN}
  varying vec3 vN;
  void main() {
    vec3 f = franja();
    float k = f.x;
    float u = f.y;
    vec3 n = normalize(vN);
    float rim = pow(1.0 - abs(dot(n, normalize(-vV))), 3.0);
    if (mod(k, 2.0) > 0.5) {
      // Glass: mostly clear (the land of the far side shows through); mullions across.
      float mull = raya(vL.z / uLC * 36.0, 0.05);
      float cant = smoothstep(0.03, 0.0, u) + smoothstep(0.97, 1.0, u);
      vec3 col = vec3(0.03, 0.05, 0.07) + vec3(0.5, 0.58, 0.66) * (mull * 0.2 + cant * 0.6) + vec3(0.35, 0.45, 0.55) * rim * 0.6;
      float a = 0.1 + 0.3 * mull + 0.8 * cant;
      gl_FragColor = vec4(col * uOn * uFundido, clamp(a, 0.0, 1.0) * uOn * uFundido);
      return;
    }
    // Panels: rings round the hull, seams along it.
    float anillos = raya(vL.z / uLC * 30.0, 0.03);
    float costuras = raya(u * 6.0, 0.025);
    float bordes = smoothstep(0.02, 0.0, u) + smoothstep(0.98, 1.0, u);
    vec3 col = vec3(0.022, 0.025, 0.03) * (0.8 + 0.4 * ruido(vec2(u * 30.0, vL.z * 200.0)));
    col += vec3(0.32, 0.36, 0.4) * (anillos * 0.13 + costuras * 0.09 + bordes * 0.4);
    col += vec3(0.3, 0.38, 0.46) * rim * 0.7;
    gl_FragColor = vec4(col * uOn * uFundido, uOn * uFundido);
  }
`;

/** The end walls: dark discs with rings and spokes; open in the middle (the door). */
const PARED = /* glsl */ `
  ${COMUN}
  varying vec3 vN;
  void main() {
    float r = length(vL.xy) / uRC;
    float fi = atan(vL.y, vL.x);
    float anillos = raya(r * 7.0, 0.04);
    float rayos = raya(fi / 6.2831853 * 24.0, 0.03);
    float borde = smoothstep(0.96, 1.0, r) + smoothstep(0.36, 0.32, r);
    vec3 n = normalize(vN);
    float rim = pow(1.0 - abs(dot(n, normalize(-vV))), 3.0);
    vec3 col = vec3(0.03, 0.034, 0.04) + vec3(0.32, 0.36, 0.4) * (anillos * 0.1 + rayos * 0.06 + borde * 0.35) + vec3(0.3, 0.38, 0.46) * rim * 0.4;
    gl_FragColor = vec4(col * uOn * uFundido, uOn * uFundido);
  }
`;

/** A mirror: bright glass that catches the Sun, framed. */
const ESPEJO = /* glsl */ `
  ${COMUN}
  varying vec3 vN;
  varying vec2 vUv;
  void main() {
    vec3 n = normalize(vN);
    float fres = pow(1.0 - abs(dot(n, normalize(-vV))), 2.0);
    float marco = max(smoothstep(0.02, 0.0, vUv.x) + smoothstep(0.98, 1.0, vUv.x), smoothstep(0.012, 0.0, vUv.y) + smoothstep(0.988, 1.0, vUv.y));
    float vetas = raya(vUv.y * 12.0, 0.03) * 0.25;
    // (the Sun caught in it: a soft bright band that slides with the view)
    float brillo = pow(max(0.0, 1.0 - abs(vUv.x - 0.5 - 0.3 * n.x) * 2.2), 4.0) * 0.18;
    vec3 col = vec3(0.025, 0.035, 0.05) + vec3(0.35, 0.42, 0.5) * fres * 0.35 + vec3(0.9, 0.88, 0.8) * brillo + vec3(0.5, 0.56, 0.62) * (marco * 0.6 + vetas * 0.15);
    float a = 0.35 + 0.3 * fres + marco;
    // (from inside, through the windows, only their backs: dim, the stars mostly through)
    float dentro = (1.0 - smoothstep(uRC * 0.9, uRC * 1.05, length(uCamL.xy))) * (1.0 - smoothstep(uLC * 0.5, uLC * 0.5 + 0.05, abs(uCamL.z)));
    col *= mix(1.0, 0.3, dentro);
    a *= mix(1.0, 0.45, dentro);
    gl_FragColor = vec4(col * uOn * uFundido, clamp(a, 0.0, 1.0) * uOn * uFundido);
  }
`;

const VERT_N = /* glsl */ `
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

export function crearCilindro(RC: number, LC: number): Cilindro {
  const grupo = new THREE.Group();
  const giro = new THREE.Group();
  grupo.add(giro);
  const uniforms = { uOn: { value: 0 }, uFundido: { value: 1 }, uRC: { value: RC }, uLC: { value: LC }, uCamL: { value: new THREE.Vector3() } };
  const mat = (frag: string, side: THREE.Side, vert = VERT, depthWrite = true) =>
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      side,
      transparent: true,
      depthTest: true,
      depthWrite,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
  // The tube, axis along +Z.
  const tubo = new THREE.CylinderGeometry(RC, RC, LC, 240, 48, true);
  tubo.rotateX(Math.PI / 2);
  const tierra = new THREE.Mesh(tubo, mat(TIERRA, THREE.BackSide));
  tierra.renderOrder = -2;
  const casco = new THREE.Mesh(tubo, mat(CASCO, THREE.FrontSide, VERT_N));
  casco.renderOrder = -1;
  giro.add(tierra, casco);
  // The end walls (an annulus each: the middle is the door).
  for (const z of [-LC / 2, LC / 2]) {
    const g = new THREE.RingGeometry(RC * 0.32, RC, 120, 6);
    const pared = new THREE.Mesh(g, mat(PARED, THREE.DoubleSide, VERT_N));
    pared.position.z = z;
    pared.renderOrder = -1;
    giro.add(pared);
  }
  // The mirrors: one beside each window, hinged at the shaded end (−Z), opened 28° outwards.
  const abre = THREE.MathUtils.degToRad(28);
  for (let k = 0; k < 3; k++) {
    const fi0 = ((2 * k + 1) * Math.PI) / 3;
    const g = new THREE.PlaneGeometry(1, 1, 24, 8);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const a = uv.getX(i);
      const b = uv.getY(i);
      const fi = fi0 + a * (Math.PI / 3);
      const rr = RC + b * LC * Math.sin(abre);
      pos.setXYZ(i, Math.cos(fi) * rr, Math.sin(fi) * rr, -LC / 2 + b * LC * Math.cos(abre));
    }
    g.computeVertexNormals();
    const espejo = new THREE.Mesh(g, mat(ESPEJO, THREE.DoubleSide, VERT_N, false));
    espejo.renderOrder = 0;
    giro.add(espejo);
  }
  // Clouds in the middle, between the land and the axis.
  const b = materiaBuilder(133);
  const r = b.r;
  for (let k = 0; k < 46; k++) {
    const fi = r() * Math.PI * 2;
    const q = RC * (0.42 + r() * 0.2);
    const z = (r() - 0.5) * LC * 0.85;
    for (let i = 0; i < 220; i++) b.push(Math.cos(fi) * q + gauss(r) * 0.005, Math.sin(fi) * q + gauss(r) * 0.005, z + gauss(r) * 0.011, 0xffffff, 0.0016, 0.16, { kind: 3 });
  }
  const nubes = materia(b.data(), {
    pre: /* glsl */ `uniform float uCil;`,
    move: /* glsl */ `em *= uCil;`,
    uniforms: { uCil: { value: 0 } },
  });
  nubes.u.uSpread.value = 0;
  nubes.u.uFuente.value = 0.2;
  giro.add(nubes.points);
  const inv = new THREE.Matrix4();
  return {
    grupo,
    giro,
    nubes,
    update(on, ag, cam) {
      uniforms.uOn.value = on;
      giro.rotation.z = ag;
      giro.updateMatrixWorld(true);
      uniforms.uCamL.value.copy(cam).applyMatrix4(inv.copy(giro.matrixWorld).invert());
      nubes.u.uCil.value = on;
      const vis = on > 0.002;
      giro.visible = vis;
    },
  };
}
