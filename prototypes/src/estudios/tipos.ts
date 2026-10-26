import type * as THREE from 'three';
import type { Timeline } from '../timeline';
import type { Stage } from '../stage';
import type { Lectura, Rotulo } from '../placa';

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

/** A wall crossing the ladder: where (log10 W), its name, and how strongly it shows (0..1). */
export interface MuroEscalera {
  lp: number;
  label: string;
  a: number;
  /** 0..1: the fill is pressing on it (the line glows). */
  choque?: number;
  /** 0..1: the climb goes on beyond the wall, off the planet. */
  fuera?: number;
}

export interface Instancia {
  tl: Timeline;
  /** Places the camera and moves the world (before rendering). */
  update(f: Frame): void;
  /** Draws its share of the plate (notes, diagrams) on the 2D layer, in device pixels. */
  placa?(g: CanvasRenderingContext2D, f: Frame): void;
  /** The HUD reading; null hides the power clock (the opening has no power yet). */
  lectura(p: number): Lectura | null;
  /** Without power on the HUD: what the clock reads instead (big figure, unit, mono line). */
  reloj?(p: number): { cifra: string; unidad: string; linea: string; a?: number } | null;
  /** The moment's name and sentence. */
  rotulo(p: number): Rotulo | null;
  /** A wall on the ladder at this moment. */
  muro?(p: number): MuroEscalera | null;
  /** False: the scene draws the ladder itself (or none). */
  escalera?: boolean;
  /** Resolves when the scene has everything it loads (the Earth's land). */
  listo?: Promise<unknown>;
  dispose(): void;
}

export interface Estilo {
  key: string;
  nombre: string;
  /** One line on what the style is. */
  nota: string;
}

export interface Escena {
  id: string;
  nombre: string;
  estilos: Estilo[];
  montar(stage: Stage, estilo: number): Instancia;
}
