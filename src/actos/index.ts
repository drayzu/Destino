import { apertura } from './apertura';
import { despertar } from './despertar';
import { hoy } from './hoy';
import { sistema } from './sistema';
import type { Acto } from './tipos';

/**
 * The journey, in order (BRIEF.md § 6). Phase 1 built the engine with the first stretch (the
 * opening, the provisional awakening, today up to the first wall); phase 2 adds the Solar System at
 * work. The rest of the acts arrive in phases 3 and 4.
 */
export function crearActos(): Acto[] {
  return [apertura(), despertar(), hoy(), sistema()];
}
