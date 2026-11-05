import type * as THREE from 'three';
import type { Timeline } from '../estudios/timeline';
import type { Cuenta, Rotulo } from '../estudios/placa';

/**
 * The chassis (CHASIS.md). An act is scenery and choreography; it never places the camera.
 *
 * The film's camera is baked into keys (chasis/camaras.json, tools/hornear.mjs, tools/plano.mjs), as
 * Tiempo's is: the film flows through them. Every act reads the camera, already placed in its own
 * units, and only lights and moves what it owns. Its spark, its lights and its words come from its
 * own timeline. (The rig tracks some acts still keep, `cx … fov`, are no longer the camera: only
 * where the act's content reads them.)
 */

/** One frame, for an act: the camera is already where it is, in the act's own units. */
export interface FrameActo {
  /** Ambient seconds (still with reduced motion). */
  time: number;
  dt: number;
  /** Beats into the act (clamped to it: an act drawn past its end holds its last picture). */
  p: number;
  W: number;
  H: number;
  u: number;
  dpr: number;
  /** The camera's focal length in device pixels. */
  focal: number;
  camera: THREE.PerspectiveCamera;
  /** Where the spark is (act units), when there is one now. */
  chispa: THREE.Vector3 | null;
  /** Whether this act holds the camera now (false: it is the act before, still drawn across the seam). */
  propio: boolean;
  /** The journey's page draws its own chrome. */
  chasis?: boolean;
  /** Going out across a `continuo` seam: hide what the act coming in draws too. */
  saliente?: boolean;
  /** How much of the act's light is up (1, or less across a seam). */
  presencia: number;
  /** The film's spark (its points' uniforms: an act sets what hides it, `uOcc`). */
  nubeChispa: import('../estudios/motor/materia').Nube;
}

/** A camera: where it is, where it looks, its fov (degrees), how far what it frames is, and how much
 * it frames the spark (0..1: the guards keep the spark in the frame where it does). */
export interface PlanoCamara {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  fov: number;
  dist: number;
  lw: number;
}

export interface Film {
  strength: number;
  radius: number;
  threshold: number;
  exposure: number;
}

export interface Acto {
  id: string;
  tl: Timeline;
  /** The group it built into (the engine places it). */
  grupo: THREE.Group;
  /** The camera's near and far planes in the act's units. */
  cerca: number;
  lejos: number;
  /** Its film (bloom, exposure). The engine blends them across a seam. */
  film: Film;
  /**
   * How the film comes into this act from the one before (the camera needs nothing at a seam: its
   * baked keys already go on; only the scene is placed and the light crosses over for RELEVO beats):
   * - `chispa` (default): through the spark. The camera and the spark are the same on both sides, and
   *   those two points place this act's world in the last one's.
   * - `mundo`: through a world both acts show (the Earth, the Sun): this act's `entrada` lands on the
   *   last act's `salida`.
   * - `corte`: a cut, hidden by the last act's own cover (`tapa` at 1 there: its light filling the frame).
   * - `cuadro`: through the frame (CHASIS.md, the contract): this act starts with the very picture the
   *   last one ends with (the spark where it was on the screen, the same size of things), and the
   *   engine lays the two cameras on each other. Neither act knows the other: any act that keeps the
   *   contract can follow any other.
   */
  costura?: 'chispa' | 'corte' | 'mundo' | 'cuadro';
  /** A seam through a world: where this act meets the last one, and a size there (the two sizes match). */
  entrada?: { pos: THREE.Vector3; escala: number };
  salida?: { pos: THREE.Vector3; escala: number };
  /** A seam through the spark in mid flight, where both acts draw the same worlds: this act is all
   * there from its first beat, and the one going out (told `saliente`) leaves those worlds to it. */
  continuo?: boolean;
  /** Where the spark is at beat p (act units), at ambient time t (seconds; a ring turning by itself
   * carries it); false when there is none. Pure in both. */
  chispa(p: number, out: THREE.Vector3, t: number): boolean;
  /** Going out across a seam, its points no bigger than this many px (its far stars, seen at the next
   * act's scale, would swell). */
  relevoMaxPx?: number;
  /** How lit the spark is (0..1); the `on` track when absent. */
  luz?(p: number): number;
  /** How much the spark flickers (0..1); the `tit` track when absent. */
  titila?(p: number): number;
  /** How much the frame is covered by the act's own light or dark (0..1): a cut may happen only under it. */
  tapa?(p: number): number;
  /**
   * The act's own camera at beat p, written as Tiempo's (chasis/toma.ts), given where its spark is
   * (its units; null when it has none). When absent, its baked keys (chasis/camaras.json).
   */
  camara?(p: number, chispa: THREE.Vector3 | null, out: PlanoCamara): void;
  /** Lights and moves what the act owns. Never touches the camera. */
  update(f: FrameActo): void;
  placa?(g: CanvasRenderingContext2D, f: FrameActo): void;
  cuenta(p: number): Cuenta | null;
  anio?(p: number): number | null;
  rotulo(p: number): Rotulo | null;
  outro?(p: number): number;
  escalera?: boolean;
  efectos?(p: number): { calor?: number; vel?: number };
  /**
   * What the act shows and hides on its own, by name: each a track of the timeline (0..1). The
   * guard checks none of them comes or goes faster than the film allows (FUNDIDO_MIN beats).
   */
  presencias?: string[];
  listo?: Promise<unknown>;
}

/** A study scene built for the new chassis: builds its act into the stage's root. */
export interface EscenaChasis {
  id: string;
  montar(stage: import('../estudios/stage').Stage): Acto;
}
