import * as THREE from 'three';

/**
 * You: the series' point (GUION.md). Infinito's «tú», the same colour and the same breath, which in
 * Destino is also the civilization's light: the light of «us» and the point of «you» are one. A lone
 * point always a few pixels across (it is the one thing the eye follows), a core and a soft halo,
 * drawn over everything; whoever shows it says where it is and how much.
 */

/** Infinito's «tú» (infinito/estudios/comun.ts, TU). */
export const TU = new THREE.Color(0.45, 1.0, 0.85);

const VERT = /* glsl */ `
  uniform float uPx;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uPx;
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    float core = exp(-d2 * 90.0);
    float halo = exp(-d2 * 14.0) * 0.35;
    gl_FragColor = vec4(uColor * (core + halo) * uAlpha, 1.0);
  }
`;

export function crearTu() {
  const u = { uPx: { value: 22 }, uColor: { value: TU.clone().multiplyScalar(1.8) }, uAlpha: { value: 0 } };
  const points = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)),
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: u,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.frustumCulled = false;
  points.renderOrder = 60;
  points.visible = false;
  return {
    points,
    /**
     * Per frame: where it is (in its parent's units), how much (0..1), the ambient seconds (0 when
     * the visitor asks for less motion: it holds its breath) and the device pixel ratio.
     */
    update(at: THREE.Vector3, alpha: number, time: number, dpr: number) {
      points.visible = alpha > 0.002;
      if (!points.visible) return;
      points.position.copy(at);
      // It breathes, as in Infinito.
      const respira = 0.86 + 0.14 * Math.sin(time * 1.5);
      u.uAlpha.value = alpha * respira;
      u.uPx.value = 22 * dpr * (0.97 + 0.03 * respira);
    },
  };
}
