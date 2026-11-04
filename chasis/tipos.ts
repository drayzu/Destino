import type * as THREE from 'three';
import type { Timeline } from '../estudios/timeline';
import type { Cuenta, Rotulo } from '../estudios/placa';

/**
 * The new chassis (CHASIS.md). An act is scenery and choreography; it never places the camera.
 *
 * The film has ONE camera, the engine's (pelicula.ts): it rides the spark, which is one continuous
 * path through every act, and it lets go of it for the act's own shots (the rig tracks). Every act
 * reads the camera, already placed in its own units, and only lights and moves what it owns.
 *
 * Tracks the engine reads from an act's timeline (any it lacks take their default):
 * - the rig (rig.ts): `cx cy cz az el ld ox oy oz yaw pitch roll fov`;
 * - `lw` (0..1): how much the camera rides the spark instead of standing in the rig;
 * - `mLd`: how far behind the spark it rides (log10, the act's units);
 * - `mAlto` (degrees): how far above the spark's way; `mAde` (fraction of that distance): how far
 *   ahead of the spark it looks; `mSuave`, `mSuaveMira`: how much way its place and gaze smooth
 *   (in ride distances). (The `m` keeps them apart from an act's own tracks: tierra's `alto`.)
 * - `on`, `tit` (0..1): the spark's light and its flicker.
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

/** The ride at a beat (act units): where the camera would stand, the point it would look at, its up and the way ahead. */
export interface Paseo {
  lugar: THREE.Vector3;
  mira: THREE.Vector3;
  arriba: THREE.Vector3;
  delante: THREE.Vector3;
  quat: THREE.Quaternion;
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
   * How the film comes into this act from the one before:
   * - `chispa` (default): through the spark. The engine places this act's world so that its spark at
   *   its first beat is the last act's spark at its last beat, and the camera's ride is the same
   *   distance there: nothing to blend, the camera simply goes on. Both acts are drawn for `relevo`
   *   beats, the last one fading.
   * - `corte`: a cut, hidden by the last act's own cover (`tapa` at 1 there: its light filling the frame).
   * - `mundo`: through a world both acts show (the Earth, the Sun): this act's `entrada` lands on the
   *   last act's `salida`, and the camera goes from where the last act left it to this act's own over
   *   the seam, turning round that world (the one blend in the film).
   */
  costura?: 'chispa' | 'corte' | 'mundo';
  /** A seam through a world: where this act meets the last one, and a size there (the two sizes match). */
  entrada?: { pos: THREE.Vector3; escala: number };
  salida?: { pos: THREE.Vector3; escala: number };
  /** A seam through the spark in mid flight, where both acts draw the same worlds: this act is all
   * there from its first beat, and the one going out (told `saliente`) leaves those worlds to it. */
  continuo?: boolean;
  /** Where the spark is at beat p (act units); false when there is none. Pure. */
  chispa(p: number, out: THREE.Vector3): boolean;
  /** How much the spark's way runs over a sphere round the act's origin now (0..1): the ride keeps to its height. */
  radial?(p: number): number;
  /** The ride's «up» at a place (act units, unit vector); +Y when absent. */
  arriba?(p: number, donde: THREE.Vector3, out: THREE.Vector3): THREE.Vector3;
  /**
   * A shot of the act's own where the rig tracks will not do (a rig in a turned frame: tierra's hall
   * at Mumbai, level with its floor). It gets the ride (act units) when there is a spark, blends it
   * itself, and says how much it rides; null where the tracks' rig serves.
   */
  rig?(p: number, paseo: Paseo | null): { pos: THREE.Vector3; dir: THREE.Vector3; up: THREE.Vector3; fov: number; lw: number; /** a chase of its own: the film's ride is not needed */ propio?: boolean } | null;
  /** How much the frame is covered by the act's own light or dark (0..1): a cut may happen only under it. */
  tapa?(p: number): number;
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
