/**
 * The language of what the journey draws itself (the moments, the clock, the names on the map). The
 * acts are written in Spanish; English comes from a dictionary keyed by the Spanish text (the page
 * hands it over: src/i18n.ts, Destino's own), plus the few lines whose numbers change as they go.
 */

export const idioma = { en: false };
let dic: Record<string, string> = {};

/** Called once by the page: whether to draw in English, and the dictionary. */
export function usarIdioma(en: boolean, d: Record<string, string>) {
  idioma.en = en;
  dic = d;
}

const ANTES: Record<string, string> = {
  'hoy · ': 'today · ',
  'vela · ': 'sail · ',
  'todos los cerebros · ': 'all the brains · ',
  'la Vía Láctea · ': 'the Milky Way · ',
};

/** The text in the journey's language (Spanish when nothing is known for it). */
export function tr(s: string): string {
  if (!idioma.en || !s) return s;
  const d = dic[s];
  if (d) return d;
  // A chapter: «IV · Estrellas vecinas».
  const cap = /^([0IVX]+) · (.+)$/.exec(s);
  if (cap) return `${cap[1]} · ${dic[cap[2]] ?? cap[2]}`;
  // The clock's type: «hoy · tipo 0,73» → «today · type 0.73».
  const t = /^(.*?)tipo (\d+)(?:,(\d+))?$/.exec(s);
  if (t) return `${ANTES[t[1]] ?? t[1]}type ${t[2]}${t[3] ? `.${t[3]}` : ''}`;
  // How far we reach: «3 mundos», «1 estrella».
  const n = /^(\d+) (mundos?|estrellas?|galaxias?)$/.exec(s);
  if (n) {
    const una = n[1] === '1';
    const w = n[2].startsWith('mundo') ? 'world' : n[2].startsWith('estrella') ? 'star' : 'galaxy';
    return `${n[1]} ${una ? w : w === 'galaxy' ? 'galaxies' : `${w}s`}`;
  }
  return s;
}

/** Thousands grouped as each language writes them (a thin space, or a comma). */
export const agrupar = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, idioma.en ? ',' : ' ');
