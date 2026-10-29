import * as THREE from 'three';
import { pantalla } from './pantalla';

/**
 * Each moment has its own colour (as Tiempo's eras and Espacio's worlds): a faint nebula at
 * infinity, behind everything, tinted with it, and the chapter's label in it. The colours glide from
 * one moment to the next. The film stays mostly black: the colour is a breath around the subject.
 */

/** The moment's colour, by its name (Spanish, as written in the acts). */
const COLORES: Record<string, [number, number, number]> = {
  // 0 · Listening
  'Un pensamiento': [0.2, 0.62, 0.58],
  '¿Hay alguien más?': [0.32, 0.24, 0.62],
  'Nuestra voz': [0.2, 0.62, 0.58],
  'Cien mil años luz': [0.26, 0.34, 0.7],
  'Planetas por todas partes': [0.22, 0.42, 0.85],
  'Lo que hemos escuchado': [0.36, 0.28, 0.7],
  'El silencio': [0.08, 0.08, 0.12],
  'Hacia el Sol': [0.85, 0.55, 0.22],
  'Una estrella amarilla': [0.95, 0.62, 0.22],
  // I · Matter awakens
  'A la Tierra, hace 3 500 millones de años': [0.15, 0.4, 0.62],
  'Una célula que reacciona': [0.12, 0.45, 0.7],
  '3 000 millones de años después': [0.4, 0.24, 0.7],
  Nervios: [0.5, 0.25, 0.8],
  'Hasta nosotros': [0.8, 0.35, 0.3],
  'Un cerebro': [0.9, 0.38, 0.32],
  'De vuelta a la Tierra': [0.25, 0.7, 0.62],
  'Ocho mil millones de cerebros': [0.25, 0.75, 0.66],
  'Las máquinas que piensan': [0.45, 0.62, 0.95],
  // II · Us, today
  'Doscientos años de luces': [0.95, 0.66, 0.28],
  Hoy: [0.3, 0.5, 0.95],
  'Más energía, más calor': [0.95, 0.5, 0.2],
  'El calor nos echa': [1.0, 0.32, 0.14],
  'Por el ascensor espacial, hasta 36 000 km': [0.35, 0.8, 0.75],
  'La industria sale al espacio': [0.3, 0.8, 0.72],
  // III · The Solar System at work
  'Más allá de la Luna': [0.5, 0.55, 0.7],
  'Mundos que giran': [0.35, 0.75, 0.45],
  'Hacia el cilindro': [0.45, 0.7, 0.9],
  'Un mundo por dentro': [0.45, 0.72, 0.95],
  'Hacia Marte': [0.85, 0.4, 0.25],
  'Calentar Marte': [0.95, 0.38, 0.22],
  'Hacia Mercurio': [0.6, 0.7, 0.75],
  'Venus, a la sombra': [0.95, 0.8, 0.35],
  'Desarmar Mercurio': [0.35, 0.85, 0.75],
  'La catapulta': [0.3, 0.9, 0.8],
  'La pared que tapa el Sol': [1.0, 0.7, 0.3],
  'Lejos del Sol': [0.9, 0.45, 0.25],
  'Visto desde lejos': [1.0, 0.42, 0.18],
  'Alargar la vida del Sol': [0.95, 0.4, 0.62],
  'Alrededor del Sol': [0.75, 0.5, 0.8],
  'Mover el Sol': [0.62, 0.55, 0.95],
  'Tipo II': [1.0, 0.82, 0.5],
  // IV · Neighbouring stars
  'Hacia la vela': [0.95, 0.65, 0.45],
  'Velas de luz': [1.0, 0.6, 0.4],
  'A un quinto de la luz': [0.3, 0.5, 1.0],
  'Frenar con su luz': [1.0, 0.78, 0.45],
  'Hacia una nave que llega': [0.4, 0.55, 0.85],
  'Naves que son mundos': [0.45, 0.6, 1.0],
  Alejándonos: [0.6, 0.35, 0.3],
  'La luz pone el freno': [1.0, 0.35, 0.25],
  // V · The galaxy
  'La burbuja': [0.3, 0.85, 0.7],
  'Tipo III': [1.0, 0.5, 0.2],
  'Hacia una estrella joven': [0.5, 0.8, 0.55],
  'El zoológico': [0.45, 0.9, 0.5],
  'Más lejos en la galaxia': [0.35, 0.5, 0.8],
  'Los que callan': [0.4, 0.55, 0.95],
  'Hacia una estrella muerta': [0.55, 0.35, 0.35],
  'El Gran Filtro': [0.7, 0.3, 0.25],
  'El borde y el silencio': [0.25, 0.6, 0.6],
  // VI · Inward
  'Hacia una sola estrella': [0.9, 0.5, 0.3],
  'Pensar con una estrella': [1.0, 0.35, 0.3],
  'El frío piensa más': [0.85, 0.25, 0.4],
  'Dejar de ser materia': [0.3, 0.9, 0.78],
  'El frío': [0.45, 0.7, 1.0],
  // VII · The cosmos
  'La eternidad en seis horas': [0.6, 0.8, 1.0],
  'La prisa': [0.62, 0.42, 0.95],
  'Las expansivas se tocan': [0.95, 0.45, 0.8],
  'Tipo IV': [0.75, 0.5, 1.0],
  'El horizonte': [0.8, 0.25, 0.3],
  // VIII · The end
  'Billones de años después': [0.25, 0.2, 0.18],
  'Las últimas centrales': [1.0, 0.68, 0.32],
  'Pensamientos contados': [0.8, 0.45, 0.25],
  'Crear un universo': [1.0, 0.9, 0.7],
  Adentro: [0.79, 0.7, 1.0],
  Alguien: [0.32, 0.42, 0.85],
  '¿Y el nuestro?': [0.05, 0.14, 0.12],
};

export function colorDe(nombre: string | undefined) {
  return nombre ? COLORES[nombre] : undefined;
}

export function ambiente() {
  const color = new THREE.Color(0.2, 0.2, 0.3);
  const meta = new THREE.Color(0.2, 0.2, 0.3);
  const fondo = pantalla(
    /* glsl */ `
    uniform vec3 uColor; uniform float uOn;
    float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n3(p); p = p * 2.07 + 1.3; a *= 0.5; } return s; }
    void main() {
      vec3 d = normalize(vDir);
      // A slow nebula at infinity: broad clouds, darker lanes, brighter towards the screen's lower half.
      float t = uTime * 0.006;
      float n = fbm(d * 1.6 + vec3(t, 0.0, -t));
      float lanes = fbm(d * 4.0 + vec3(3.1) + n);
      float neb = smoothstep(0.35, 0.85, n) * (0.55 + 0.45 * lanes);
      float vig = 1.0 - smoothstep(0.2, 1.15, length(vUv - vec2(0.5, 0.42)) * 1.4);
      vec3 c = uColor * (0.016 + 0.095 * neb) * (0.45 + 0.55 * vig);
      gl_FragColor = vec4(c * uOn, 1.0);
    }`,
    { uColor: { value: color }, uOn: { value: 0 } },
  );
  const fm = fondo.mesh.material as THREE.ShaderMaterial;
  fm.transparent = true;
  fm.blending = THREE.AdditiveBlending;
  fondo.mesh.renderOrder = -98;
  return {
    mesh: fondo.mesh,
    /** The colour now (for the plate). */
    color,
    /** Per frame: the moment's name (the colour it glides to), the frame's dt, how present (0..1). */
    update(nombre: string | undefined, dt: number, on: number) {
      const c = colorDe(nombre);
      if (c) meta.setRGB(c[0], c[1], c[2]);
      color.lerp(meta, 1 - Math.exp(-dt * 1.6));
      fondo.u.uOn.value = on;
    },
    /** Jump straight to the moment's colour (a capture, a seek). */
    saltar(nombre: string | undefined) {
      const c = colorDe(nombre);
      if (c) color.setRGB(c[0], c[1], c[2]);
    },
  };
}
