import type * as THREE from 'three';
import type { Timeline } from './timeline';
import type { Stage } from './stage';
import type { Cuenta, Rotulo } from './placa';

/** One frame of a study scene. */
export interface Frame {
  /** Ambient seconds (still with reduced motion). */
  time: number;
  dt: number;
  /** Progress through the moment, in beats. */
  p: number;
  /** Canvas size in device pixels, and the plate's unit (px per layout unit). */
  W: number;
  H: number;
  u: number;
  dpr: number;
  /** The camera's focal length in device pixels (after the scene places the camera). */
  focal: number;
  camera: THREE.PerspectiveCamera;
}

/** Where an act hands over or takes over (journey): a point in its world and a size there. */
export interface Ancla {
  pos: THREE.Vector3;
  escala: number;
}

export interface Instancia {
  tl: Timeline;
  /** Journey: what this act starts from (it lands on the last act's `salida`). */
  entrada?: Ancla;
  /** Journey: what this act ends on (the next act's `entrada` lands here). */
  salida?: Ancla;
  /** Places the camera and moves the world (before rendering). */
  update(f: Frame): void;
  /** Draws its share of the plate (notes, numbers on the film) on the 2D layer, in device pixels. */
  placa?(g: CanvasRenderingContext2D, f: Frame): void;
  /** What the clock counts now (null: no clock). */
  cuenta(p: number): Cuenta | null;
  /** The moment's chapter, name and sentence. */
  rotulo(p: number): Rotulo | null;
  /** False: no ladder. */
  escalera?: boolean;
  /** Resolves when the scene has everything it loads (maps). */
  listo?: Promise<unknown>;
  dispose(): void;
}

export interface Estilo {
  key: string;
  nombre: string;
  /** One line on what the way is. */
  nota: string;
}

export interface Escena {
  id: string;
  nombre: string;
  estilos: Estilo[];
  /** `viaje`: the act as GUION.md has it, inside the journey (its moments, its voice, its bridges). */
  montar(stage: Stage, estilo: number, viaje?: boolean): Instancia;
}
