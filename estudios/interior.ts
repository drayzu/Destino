import * as THREE from 'three';

/**
 * The inner Solar System as acts III shows it (sistema, mercurio, sol share this frame): solar
 * radii, the Sun at the origin, distances drawn short. Each world's place and radius.
 */

const D2R = THREE.MathUtils.degToRad;
export const enOrbita = (r: number, deg: number, y = 0) => new THREE.Vector3(Math.sin(D2R(deg)) * r, y, Math.cos(D2R(deg)) * r);

export const E = enOrbita(36, 140);
export const RE = 0.35;
export const VE = enOrbita(26, 172);
export const RV = 0.34;
export const MA = enOrbita(50, 106, 0.4);
export const RMA = 0.2;

/** Colours for their marks when they are a few pixels. */
export const COLOR = {
  tierra: new THREE.Color(0.45, 0.68, 1.0),
  venus: new THREE.Color(1.0, 0.88, 0.62),
  marte: new THREE.Color(1.0, 0.52, 0.32),
  mercurio: new THREE.Color(0.78, 0.74, 0.7),
};
