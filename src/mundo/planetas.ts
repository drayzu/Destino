import * as THREE from 'three';
import { materia, materiaBuilder, type Nube } from '../engine/materia';
import { gauss } from '../engine/math';
import { marte as marteEnPuntos, venus as venusEnPuntos, type Vista } from '../horizontes';
import { HORIZONTE, SPHERE_PRE, textura } from './tierra';

/**
 * The other planets at work (act III), each a group in its own radii:
 *
 * - Mars, warmed. Mirrors in orbit throw more light on the south pole to free its ice (Zubrin & McKay
 *   1993: mirrors ~100 km across); its own CO₂ is not enough for air like ours (Jakosky & Edwards
 *   2018: ~20 mbar at most), so people live under domes while green spreads from the lowest basins.
 * - Venus, in the shade. At ~50 km over the surface the air is at ~1 bar and 0–50 °C, and cities
 *   float there (Landis 2003); a parasol at the L1 point, ~1 million km towards the Sun, shades it to
 *   cool it (Birch 1991). To cover the whole disc from L1 it must be about twice as wide as Venus.
 *
 * Both are the real planets in points (src/horizontes, the series' shared bodies), as the Earth, the Moon and Mercury are;
 * what the civilization does to them is drawn on the same points.
 */

export const R_MARS = 3389.5 / 1.495978707e8;
export const R_VEN = 6051.8 / 1.495978707e8;
/** Venus–L1, in Venus radii (its Hill radius, ~1.0 million km). */
export const L1_VEN = 167;
/** The parasol's radius (Venus radii): the Sun's disc from L1, plus the planet. */
export const R_PARASOL = 2.1;

const LOG_V = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>`;
const LOG_F = /* glsl */ `#include <logdepthbuf_pars_fragment>`;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** Latitude and longitude (radians, east positive) to the planet's frame, as the maps have them. */
const toXYZ = (la: number, lo: number, r = 1) => V(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);

// ---------------------------------------------------------------- Mars

/** Where the domes are (latitude, longitude in radians): basins and canyons first. */
const CUPULAS: [number, number, number][] = [
  [-0.74, 1.23, 1.4], // Hellas
  [-0.24, -1.03, 1.2], // Valles Marineris
  [0.08, 1.35, 0.8],
  [0.35, -0.4, 0.7],
  [-0.4, 2.6, 0.6],
  [0.6, 0.6, 0.5],
  [-0.05, -2.3, 0.6],
  [0.25, 2.9, 0.4],
];

export function marte() {
  const group = new THREE.Group();
  group.scale.setScalar(R_MARS);
  const giro = new THREE.Group();
  group.add(giro);
  const uni = { uSun: { value: V(1, 0, 0) }, uCamL: { value: V(0, 0, 5) }, uCalor: { value: 0 }, uVerde: { value: 0 } };
  const suelo = marteEnPuntos(textura(''), {
    superficie: {
      uniforms: { uCalor: uni.uCalor, uVerde: uni.uVerde },
      pre: /* glsl */ `uniform float uCalor, uVerde;`,
      glsl: /* glsl */ `
        if (uVerde > 0.001 || uCalor > 0.001) {
          // How low the ground is: the north is lower, and so is Hellas, deep in the south.
          float a = fbm(n * 3.0);
          float low = (1.0 - fbm(n * 2.2 + 9.0)) * 0.7 + 0.35 * n.y + 0.5 * smoothstep(0.88, 0.97, dot(n, dirDe(-0.74, 1.23)));
          float on = step(0.001, uVerde);
          // What the warming brings: water in the deepest ground, a green that spreads from it.
          float sea = smoothstep(0.9 - 0.1 * uVerde, 0.91 - 0.1 * uVerde, low) * on;
          float green = smoothstep(0.86 - 0.34 * uVerde, 0.89 - 0.34 * uVerde, low) * on;
          float l = dot(alb, vec3(0.3, 0.5, 0.2));
          alb = mix(alb, mix(vec3(0.04, 0.09, 0.02), vec3(0.08, 0.14, 0.03), a) * clamp(l / 0.2, 0.5, 1.5), green * 0.85);
          alb = mix(alb, vec3(0.005, 0.02, 0.05), sea);
          // Where it is advancing: a faint seam of light.
          float edge = 0.86 - 0.34 * uVerde;
          extra += vec3(0.4, 1.0, 0.8) * exp(-((low - edge) / 0.008) * ((low - edge) / 0.008)) * 0.12 * on * (1.0 - sea);
          // The south cap shrinks as the mirrors warm it.
          float blanco = smoothstep(0.12, 0.35, alb.b) * step(n.y, 0.0);
          float lim = mix(0.975, 1.001, uCalor);
          alb = mix(alb, vec3(0.36, 0.1, 0.03), blanco * (1.0 - smoothstep(lim - 0.006, lim, -n.y)) * step(0.001, uCalor));
        }`,
    },
  });
  giro.add(suelo.group);

  // The domes: clusters of light, faint glints by day, warm by night.
  const b = materiaBuilder(1606);
  const site: number[] = [];
  CUPULAS.forEach(([la, lo, w], i) => {
    const n = Math.round(260 * w);
    for (let k = 0; k < n; k++) {
      const r = Math.abs(gauss(b.r)) * 0.035 * w;
      const t = b.r() * Math.PI * 2;
      const p = toXYZ(la + Math.sin(t) * r, lo + (Math.cos(t) * r) / Math.max(Math.cos(la), 0.3), 1.002);
      const teal = b.r() < 0.3;
      b.push(p.x, p.y, p.z, teal ? new THREE.Color(0.5, 1.0, 0.85) : new THREE.Color(1.0, 0.78, 0.5), 0.012, k < 3 ? 1.0 : 0.4);
      site.push(i / CUPULAS.length);
    }
  });
  // And smaller towns all over, each under its dome, growing in number.
  for (let i = 0; i < 70; i++) {
    const la = Math.asin(b.r() * 1.8 - 0.9);
    const lo = b.r() * Math.PI * 2;
    const at = 0.1 + b.r() * 0.85;
    const n = 4 + Math.floor(b.r() * 14);
    for (let k = 0; k < n; k++) {
      const p = toXYZ(la + gauss(b.r) * 0.012, lo + gauss(b.r) * 0.012, 1.002);
      b.push(p.x, p.y, p.z, b.r() < 0.3 ? new THREE.Color(0.5, 1.0, 0.85) : new THREE.Color(1.0, 0.78, 0.5), 0.011, k === 0 ? 0.9 : 0.4);
      site.push(at);
    }
  }
  const domes = materia(b.data(), {
    pre: `${SPHERE_PRE}\nattribute float aSite; uniform float uCupulas;`,
    move: /* glsl */ `
      float d = dot(normalize(p), uSun);
      em *= mix(0.12, 1.0, 1.0 - smoothstep(-0.15, 0.05, d));
      em *= step(aSite, uCupulas - 0.01);
      fuente = 1.0;
      ${HORIZONTE}`,
    uniforms: { ...uni, uCupulas: { value: 0 } },
    extra: { aSite: [new Float32Array(site), 1] },
  });
  domes.u.uSpread.value = 0;
  giro.add(domes.points);

  // The mirrors over the south pole: each a sail of light that throws the Sun down onto the cap.
  // (Their distance is illustrative: Zubrin and McKay put theirs ~60 radii away, past the planet.)
  const espejos: THREE.Vector3[] = [];
  const mb = materiaBuilder(77);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const p = V(Math.cos(a) * 0.95, -1.55, Math.sin(a) * 0.95);
    espejos.push(p);
    mb.push(p.x, p.y, p.z, new THREE.Color(1.0, 0.97, 0.88), 0.05, 3.0);
    for (let j = 0; j < 40; j++) mb.push(p.x + gauss(mb.r) * 0.06, p.y + gauss(mb.r) * 0.01, p.z + gauss(mb.r) * 0.06, new THREE.Color(0.9, 0.95, 1.0), 0.012, 0.6);
  }
  const mirrors = materia(mb.data(), { pre: `uniform float uOn;`, move: `em *= uOn; fuente = 1.0;`, uniforms: { uOn: { value: 0 } } });
  mirrors.u.uSpread.value = 0;
  group.add(mirrors.points);

  const nubes: Nube[] = [domes, mirrors];
  const rosa = new THREE.Color(0.85, 0.5, 0.35);
  const azul = new THREE.Color(0.55, 0.7, 0.95);
  return {
    group,
    giro,
    uni,
    /** Its own points (domes, mirrors); the ground draws itself. */
    nubes,
    listo: suelo.listo,
    espejos,
    /**
     * Per frame: the Sun and the camera in the planet's (not turning) frame; how far it has turned
     * (radians); how warm, how green, how many domes, the mirrors.
     */
    update(sunL: THREE.Vector3, camL: THREE.Vector3, time: number, giroY: number, calor: number, verde: number, cupulas: number, espejo: number, vista: Vista) {
      giro.rotation.y = giroY;
      const q = giro.quaternion.clone().invert();
      uni.uSun.value.copy(sunL).applyQuaternion(q);
      uni.uCamL.value.copy(camL).applyQuaternion(q);
      // Its thin pink haze, thicker and bluer as it warms.
      if (suelo.halo) suelo.halo.uColor.value.copy(rosa).lerp(azul, calor * 0.6);
      suelo.brilloHalo = 0.35 + 0.65 * calor;
      suelo.update({ sol: uni.uSun.value, camara: uni.uCamL.value, focal: vista.focal, dpr: vista.dpr });
      uni.uCalor.value = calor;
      uni.uVerde.value = verde;
      domes.u.uCupulas.value = cupulas;
      mirrors.u.uOn.value = espejo;
      mirrors.points.visible = espejo > 0.001;
    },
  };
}

// ---------------------------------------------------------------- Venus

export function venus() {
  const group = new THREE.Group();
  group.scale.setScalar(R_VEN);
  const uni = {
    uSun: { value: V(1, 0, 0) },
    uCamL: { value: V(0, 0, 5) },
    uTime: { value: 0 },
    uSombra: { value: 0 },
    uBarrido: { value: V(0, 0, 1) },
  };
  // The cloud deck: the real one in points, racing round the planet (four days a lap); where the
  // parasol shades it, the sunlight is gone.
  const giro = new THREE.Group();
  group.add(giro);
  const suelo = venusEnPuntos(textura(''), {
    superficie: {
      uniforms: { uSombra: uni.uSombra, uBarrido: uni.uBarrido },
      pre: /* glsl */ `uniform vec3 uBarrido; uniform float uSombra;`,
      glsl: /* glsl */ `sombra *= mix(1.0, 0.04, smoothstep(-0.12, 0.12, dot(n, uBarrido) - 1.15 + 2.3 * uSombra));`,
    },
  });
  giro.add(suelo.group);

  // The cities, ~50 km up, in the cloud deck (riding its wind): glints by day, lights in the shade.
  const b = materiaBuilder(2203);
  for (let c = 0; c < 46; c++) {
    const la = (b.r() * 2 - 1) * 0.9;
    const lo = b.r() * Math.PI * 2;
    const n = 6 + Math.floor(b.r() * 24);
    for (let k = 0; k < n; k++) {
      const p = toXYZ(la + gauss(b.r) * 0.012, lo + gauss(b.r) * 0.012, 1.0083);
      const teal = b.r() < 0.35;
      b.push(p.x, p.y, p.z, teal ? new THREE.Color(0.5, 1.0, 0.85) : new THREE.Color(1.0, 0.8, 0.55), 0.014, k === 0 ? 1.2 : 0.45);
    }
  }
  const cities = materia(b.data(), {
    pre: `${SPHERE_PRE}\nuniform vec3 uBarrido; uniform float uSombra, uOn;`,
    move: /* glsl */ `
      vec3 n = normalize(p);
      float dark = max(1.0 - smoothstep(-0.2, 0.1, dot(n, uSun)), smoothstep(-0.12, 0.12, dot(n, uBarrido) - 1.15 + 2.3 * uSombra));
      em *= mix(0.25, 1.3, dark) * uOn;
      fuente = 1.0;
      ${HORIZONTE}`,
    uniforms: { ...uni, uOn: { value: 0 } },
  });
  cities.u.uSpread.value = 0;
  // They ride the clouds' wind.
  giro.add(cities.points);

  // The parasol at L1: a dark disc facing the Sun (built in Venus radii, along local +X; turned in update).
  const parasol = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(R_PARASOL, 128),
    new THREE.ShaderMaterial({
      uniforms: { uOn: { value: 0 } },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `${LOG_V}
        varying vec2 vP;
        void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `${LOG_F}
        uniform float uOn; varying vec2 vP;
        void main() {
          #include <logdepthbuf_fragment>
          float r = length(vP) / ${R_PARASOL.toFixed(2)};
          if (r > uOn) discard;
          // Its frame: rings and spokes, a teal rim.
          float ring = 1.0 - smoothstep(0.0, 0.012, abs(fract(r * 6.0) - 0.5) - 0.48);
          float spoke = 1.0 - smoothstep(0.0, 0.01, abs(fract(atan(vP.y, vP.x) / 6.2831853 * 24.0) - 0.5) - 0.485);
          vec3 c = vec3(0.012, 0.013, 0.015) + vec3(0.12, 0.14, 0.16) * max(ring, spoke) * 0.25;
          c += vec3(0.45, 1.0, 0.85) * (1.0 - smoothstep(0.0, 0.015, uOn - r)) * 1.2;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  disc.rotation.y = Math.PI / 2;
  parasol.add(disc);
  group.add(parasol);

  const nubes: Nube[] = [cities];
  return {
    group,
    uni,
    /** Its own points (the cities); the clouds draw themselves. */
    nubes,
    listo: suelo.listo,
    parasol,
    /** Per frame: the Sun and the camera in the planet's frame; the time; how far the parasol has opened (0..1) and its shade has swept (0..1); the cities. */
    update(sunL: THREE.Vector3, camL: THREE.Vector3, time: number, abre: number, sombra: number, ciudades: number, vista: Vista) {
      // The clouds turn; everything on them is lit and seen in their turning frame.
      giro.rotation.y = time * 0.03;
      const q = giro.quaternion.clone().invert();
      uni.uSun.value.copy(sunL).applyQuaternion(q);
      uni.uCamL.value.copy(camL).applyQuaternion(q);
      uni.uTime.value = time;
      cities.u.uTime.value = time;
      cities.u.uOn.value = ciudades;
      cities.points.visible = ciudades > 0.001;
      // The parasol sits towards the Sun; its shadow comes in from one side as it opens.
      parasol.position.copy(sunL).multiplyScalar(L1_VEN);
      parasol.quaternion.setFromUnitVectors(V(1, 0, 0), sunL);
      (disc.material as THREE.ShaderMaterial).uniforms.uOn.value = abre;
      parasol.visible = abre > 0.001;
      // The shadow sweeps across the disc, from one side, as the shade slides into place.
      uni.uBarrido.value.copy(sunL).cross(V(0, 1, 0)).normalize().negate().applyQuaternion(q);
      uni.uSombra.value = sombra;
      suelo.brilloHalo = 0.45 * (1 - 0.85 * sombra);
      suelo.update({ sol: uni.uSun.value, camara: uni.uCamL.value, focal: vista.focal, dpr: vista.dpr });
    },
  };
}
