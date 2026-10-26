import { apertura } from './apertura';
import { despertar } from './despertar';
import { hoy } from './hoy';
import type { Acto } from './tipos';

/**
 * The journey, in order (BRIEF.md § 6). Phase 1 builds the engine with the first stretch: the
 * opening, the provisional awakening and today up to the first wall and the way out. The rest of the
 * acts arrive in phases 2 to 4.
 */
export function crearActos(): Acto[] {
  return [apertura(), despertar(), hoy()];
}
