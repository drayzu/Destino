import { apertura } from './apertura';
import { despertar } from './despertar';
import { estrellas } from './estrellas';
import { galactica } from './galactica';
import { hoy } from './hoy';
import { sistema } from './sistema';
import type { Acto } from './tipos';

/**
 * The journey, in order (BRIEF.md § 6). Phase 1 built the engine with the first stretch (the
 * opening, the provisional awakening, today up to the first wall); phase 2 adds the Solar System at
 * work; phase 3, the neighbouring stars and the galaxy. The rest arrive in phase 4.
 */
export function crearActos(): Acto[] {
  return [apertura(), despertar(), hoy(), sistema(), estrellas(), galactica()];
}
