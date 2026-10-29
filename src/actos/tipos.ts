import type * as THREE from 'three';
import type { Timeline } from '../engine/timeline';
import type { Lectura, Muro } from '../engine/placa';
import type { Vista } from '../engine/vista';
import type { P2 } from '../engine/lamina';
import type { Mundo } from '../mundo/mundo';

/** One frame, as an act sees it. */
export interface Cuadro {
  /** Ambient seconds (still with reduced motion). */
  time: number;
  dt: number;
  /** Progress through the whole journey, in beats. */
  p: number;
  /** Canvas size in device pixels; the plate's unit (px per layout unit); the device pixel ratio. */
  W: number;
  H: number;
  u: number;
  dpr: number;
  /** The camera's focal length in device pixels. */
  focal: number;
  camera: THREE.PerspectiveCamera;
  vista: Vista;
  /** Scene units per world unit (AU): the pivot's scale this frame. */
  k: number;
  /** The plate (key I) is on. */
  lamina: boolean;
  /** A world point (AU) on the screen, or null behind the camera. */
  proj(w: THREE.Vector3): P2 | null;
}

/** Before there is a civilization to measure: the power that is there and nobody uses. */
export interface Libre {
  lp: number;
  linea: string;
  /** What the power is of, at the right of the figure (instead of the type). */
  tipo?: string;
  /** A figure in plain watts instead of the power of ten («20 W»), shown as much as `a` (0..1). */
  cifra?: { valor: string; unidad: string; linea: string; a: number };
}

/**
 * An act of the journey. It writes its moments into the shared timeline, builds what only it needs
 * into the shared world, says where the camera is and what the clocks read, and draws its share of
 * the plate. Acts follow each other without cuts: each one starts where the last one left the
 * camera.
 */
export interface Acto {
  id: string;
  /** «0», «I», «II»… and its name. */
  numero: string;
  nombre: string;
  /** Still a sketch of what it will be (the page says so). */
  provisional?: boolean;
  /**
   * Whether the view's width can be shown (false where the world is not drawn to scale: small
   * worlds, compressed distances, things drawn with the camera). A function decides moment by moment.
   */
  regla?: boolean | ((p: number) => boolean);
  /** Writes the act's moments (captions, labels, tracks) at the timeline's cursor. */
  coreografia(tl: Timeline): void;
  /** Builds what only this act needs into the world (once). */
  montar(m: Mundo): void | Promise<unknown>;
  /** Where the camera is at beat p (world units). */
  vista(p: number, time: number): Vista;
  /** What the power clock reads; null when there is no civilization yet (see `libre`). */
  lectura(p: number): Lectura | null;
  libre?(p: number): Libre | null;
  /** A wall on the ladder. */
  muro?(p: number): Muro | null;
  /** Sets the world's state for this frame (before the world updates). Called while the act is on. */
  estado?(m: Mundo, p: number): void;
  /** Moves its own things; called every frame (it hides them when they are not in view). */
  update?(f: Cuadro, m: Mundo): void;
  /** Its share of the plate (the canvas over the film). */
  placa?(g: CanvasRenderingContext2D, f: Cuadro): void;
}
