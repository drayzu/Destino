/**
 * Languages. The journey is written in Spanish; English is a dictionary keyed by the Spanish text,
 * applied where text reaches the screen (the moments' names and sentences, the page's own copy). A
 * missing entry simply shows the Spanish. The title stays «Destino» in both languages.
 *
 * The language: `?lang=en|es`, else the visitor's last choice, else the browser's language (Spanish
 * for Spanish speakers, English for everyone else).
 */

export type Lang = 'es' | 'en';
const KEY = 'destino.lang';

export const lang: Lang = (() => {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
  if (q === 'en' || q === 'es') return q;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    /* storage unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
})();

/** The text in the current language. */
export const tx = (es: string) => (lang === 'en' ? (EN[es] ?? es) : es);

/** Switches language (remembered) and reloads in place. */
export function switchLang() {
  const next: Lang = lang === 'en' ? 'es' : 'en';
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable */
  }
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  location.replace(url.toString());
}

const EN: Record<string, string> = {
  // ---- The page.
  'Un solo scroll de una civilización que deja atrás su planeta: de ¿hay alguien más? a la última obra posible.': 'One scroll of a civilization outgrowing its planet: from “is anyone out there?” to the last possible work.',
  '¿Adónde podemos llegar?': 'How far?',
  'Desliza para empezar': 'Scroll to begin',
  'Lámina': 'Plate',
  'Sonido': 'Sound',
  'Reproducir': 'Play',
  'Actos': 'Acts',
  'acto provisional': 'provisional act',
  'Continuará': 'To be continued',
  'Destino se está construyendo: lo que sigue son las estrellas vecinas.': 'Destino is being built: next come the neighbouring stars.',

  // ---- The clock and the ladder.
  'tipo —': 'type —',
  'vatios de pensar': 'watts of thinking',
  'una persona': 'a person',
  'hoy': 'today',
  'fotosíntesis': 'photosynthesis',
  'I · un planeta': 'I · a planet',
  'luz del Sol en la Tierra': 'sunlight on the Earth',
  'II · una estrella': 'II · a star',
  'el Sol': 'the Sun',
  'III · una galaxia': 'III · a galaxy',
  'la Vía Láctea': 'the Milky Way',
  'fuera del planeta': 'off the planet',
  'muro · el calor': 'wall · the heat',

  // ---- Act 0, the plate.
  'la Vía Láctea · 13 000 millones de años · nuestra radio: 100 años luz': 'the Milky Way · 13 billion years · our radio: 100 light years',
  'la Vía Láctea · 13 000 millones de años · 6 451 planetas confirmados': 'the Milky Way · 13 billion years · 6,451 confirmed planets',
  'una estrella amarilla · el Sol': 'a yellow star · the Sun',
  'la luz del Sol que llega a un planeta azul': 'the sunlight reaching a blue planet',
  'nuestra radio · 100 años luz': 'our radio · 100 light years',
  'nuestra voz · todo cabe en este punto': 'our voice · all of it fits in this dot',
  '100 000 años luz': '100,000 light years',
  'planetas confirmados': 'confirmed planets',
  'planetas en la galaxia, al menos': 'planets in the galaxy, at least',
  'una estrella con planetas': 'a star with planets',
  'uno en la zona habitable': 'one in the habitable zone',
  'lo que hemos escuchado: casi nada': 'what we have listened to: almost nothing',
  'una civilización · a 0,1 c': 'one civilization · at 0.1 c',
  'años': 'years',
  'bastaría una · no vemos ninguna': 'one would be enough · we see none',
  'una estrella amarilla': 'a yellow star',
  'un planeta azul': 'a blue planet',

  // ---- Act I, the plate.
  'una célula · alrededor de un picovatio': 'a cell · about a picowatt',
  'un cerebro humano · unos 20 W': 'a human brain · about 20 W',
  'todos los cerebros humanos · 1,6 × 10¹¹ W': 'all human brains · 1.6 × 10¹¹ W',
  'centros de datos · unos 47 GW (2024)': 'data centres · about 47 GW (2024)',

  // ---- Act II, the plate.
  'año': 'year',
  'luz visible': 'visible light',
  'infrarrojo · falso color': 'infrared · false colour',
  'infrarrojo · falso color · el calor de nuestras máquinas, realzado': 'infrared · false colour · the heat of our machines, enhanced',
  'calor de nuestra energía': 'heat of our energy',
  'órbita geoestacionaria · 36 000 km': 'geostationary orbit · 36,000 km',
  'anillo orbital · 500 km': 'orbital ring · 500 km',
  'equilibrio': 'balance',
  'la gravedad gana': 'gravity wins',
  'el giro gana': 'the spin wins',
  'fábricas y cómputo en órbita': 'factories and computing in orbit',
  'calor que se queda en la Tierra': 'heat that stays on Earth',

  // ---- Act III.
  'Hacia el Sol': 'Towards the Sun',
  'Un mundo por dentro': 'A world from the inside',
  'Un cilindro de 8 km de ancho y 32 de largo, en un punto de Lagrange. Gira una vez cada dos minutos: ese giro es su gravedad, y el paisaje sube por los lados hasta el cielo (O’Neill, 1976).': 'A cylinder 8 km wide and 32 km long at a Lagrange point. It turns once every two minutes: that turn is its gravity, and the land climbs up the sides into the sky (O’Neill, 1976).',
  '8 km de ancho · 32 km de largo': '8 km wide · 32 km long',
  'espejo: mete la luz del Sol': 'mirror: lets the sunlight in',
  'una vuelta cada 2 minutos: el giro es la gravedad': 'one turn every 2 minutes: the spin is the gravity',
  'Alargar la vida del Sol': 'Lengthening the Sun’s life',
  'Campos magnéticos sacan materia por los polos del Sol. Con menos masa, arde más despacio: hasta unos 3 000 millones de años más de vida (Scoggins y Kipping, 2023).': 'Magnetic fields draw matter out of the Sun’s poles. With less mass it burns more slowly: up to some 3 billion more years of life (Scoggins & Kipping, 2023).',
  'materia que sale por los polos': 'matter leaving through the poles',
  'corriente en anillo: canaliza el plasma': 'ring current: it channels the plasma',
  'millones de años de vida, como mucho': 'million years of life, at most',
  'Mover el Sol': 'Moving the Sun',
  'Un espejo gigante le devuelve parte de su luz y el Sol se desplaza hacia él: 34 000 años luz en mil millones de años (Shkadov, 1987). Con chorros de su propia materia, mil veces más rápido (Caplan, 2019).': 'A giant mirror sends part of its light back and the Sun drifts towards it: 34,000 light years in a billion years (Shkadov, 1987). With jets of its own matter, a thousand times faster (Caplan, 2019).',
  'espejo de Shkadov': 'Shkadov’s mirror',
  'motor de Caplan: su chorro': 'Caplan’s engine: its jet',
  'el Sol se mueve': 'the Sun moves',
  'años luz en un millón de años, con chorros': 'light years in a million years, with jets',
  'años luz en mil millones de años, con el espejo': 'light years in a billion years, with the mirror',
  'Todo pasa a la vez: la Luna lanza roca, el cinturón se mina y alrededor del Sol empieza a crecer un enjambre.': 'Everything happens at once: the Moon throws rock, the belt is mined and a swarm begins to grow around the Sun.',
  'Desarmar Mercurio': 'Taking Mercury apart',
  'Máquinas que se copian a sí mismas convierten un planeta entero en colectores: unos 31 años, casi todo en los últimos cuatro.': 'Machines that copy themselves turn a whole planet into collectors: about 31 years, most of it in the last four.',
  'La catapulta': 'The catapult',
  'Un riel de 2 000 km lanza la materia al espacio sin cohetes: Mercurio no tiene aire que la frene. Viajamos en una carga.': 'A 2,000 km rail throws the matter into space with no rockets: Mercury has no air to slow it. We ride a payload.',
  'La pared que tapa el Sol': 'The wall that covers the Sun',
  'No es una esfera: es un enjambre de velas en órbita, cada una de cara al Sol (Dyson, 1960). La estrella se va apagando para los demás.': 'Not a sphere: a swarm of sails in orbit, each facing the Sun (Dyson, 1960). To everyone else, the star is going dark.',
  'Visto desde lejos': 'Seen from afar',
  'Desde otra estrella, el Sol se apaga en luz visible y brilla en infrarrojo con el calor de los colectores. Así buscamos a otros: entre millones de estrellas, siete candidatas, y varias resultaron galaxias lejanas.': 'From another star, the Sun goes dark in visible light and glows in the infrared with the collectors’ heat. That is how we look for others: among millions of stars, seven candidates, and several turned out to be distant galaxies.',
  'Tipo II': 'Type II',
  'Toda la luz del Sol: 3,8 × 10²⁶ W. Creciendo un 2,3 % al año, se llegaría en unos 1 350 años. Y la luz de una estrella se acaba.': 'All of the Sun’s light: 3.8 × 10²⁶ W. Growing 2.3% a year, we would get there in about 1,350 years. And the light of one star runs out.',
  'muro · la luz de una estrella': 'wall · the light of one star',
  'la Luna lanza roca al espacio': 'the Moon throws rock into space',
  'Tierra': 'Earth',
  'Venus': 'Venus',
  'Mercurio · se desarma': 'Mercury · being taken apart',
  'el Sol y su enjambre': 'the Sun and its swarm',
  'riel de 2 000 km': '2,000 km rail',
  'nuestra carga': 'our payload',
  'colector · tamaño ilustrativo': 'collector · size illustrative',
  'máquinas que se copian a sí mismas': 'machines that copy themselves',
  'espectro visto desde lejos': 'spectrum seen from afar',
  'luz del Sol · 5 800 K': 'sunlight · 5,800 K',
  'calor del enjambre · 300 K': 'heat of the swarm · 300 K',
  'Mercurio': 'Mercury',
  'Marte': 'Mars',
  'Júpiter': 'Jupiter',
  'cinturón · minas': 'belt · mines',
  'el Sol, casi cubierto': 'the Sun, almost covered',

  // ---- Act 0.
  '¿Hay alguien más?': 'Is anyone out there?',
  'La Vía Láctea: cientos de miles de millones de estrellas que brillan con unos 10³⁷ vatios desde hace 13 000 millones de años. Que sepamos, nadie los usa.': 'The Milky Way: hundreds of billions of stars shining with some 10³⁷ watts for 13 billion years. As far as we know, nobody uses them.',
  'Nuestra voz': 'Our voice',
  'Las primeras radios salieron hace un siglo. Desde entonces, nuestra voz llena una burbuja de unos 100 años luz.': 'The first radios went out a century ago. Since then our voice has filled a bubble some 100 light years across.',
  'Cien mil años luz': 'A hundred thousand light years',
  'A la escala de la galaxia, esa burbuja es un punto. Todo lo que hemos dicho no ha salido de nuestro barrio.': 'At the scale of the galaxy that bubble is a dot. Everything we have ever said has not left our neighbourhood.',
  'Planetas por todas partes': 'Planets everywhere',
  'Ya confirmamos 6 451 planetas. En promedio hay al menos uno por estrella: cientos de miles de millones, muchos en la zona donde puede haber agua líquida.': 'We have confirmed 6,451 planets. On average there is at least one per star: hundreds of billions, many where liquid water can exist.',
  'Lo que hemos escuchado': 'What we have listened to',
  'Lo que llevamos escuchado equivale a buscar peces en un jacuzzi sacado del océano (Wright y otros, 2018).': 'All our listening so far is like looking for fish in a hot tub of water taken from the ocean (Wright et al., 2018).',
  'El silencio': 'The silence',
  'A una décima de la velocidad de la luz, una sola civilización llenaría la galaxia en 650 000 años. Ha tenido 13 000 millones. ¿Dónde están todos?': 'At a tenth of the speed of light a single civilization would fill the galaxy in 650,000 years. There have been 13 billion. Where is everybody?',
  'Una estrella amarilla': 'A yellow star',
  'La pregunta queda abierta. La respuesta empieza aquí: en un planeta azul, alrededor de una estrella amarilla.': 'The question stays open. The answer begins here: on a blue planet around a yellow star.',

  // ---- Act I.
  'Una célula': 'A cell',
  'En ese planeta, hace unos 3 500 millones de años, la materia empezó a reaccionar: una célula vive con una billonésima de vatio.': 'On that planet, some 3.5 billion years ago, matter began to react: a cell lives on a trillionth of a watt.',
  'Un cerebro': 'A brain',
  'Unos 86 000 millones de neuronas, lo más complejo que conocemos, piensan con unos 20 vatios: lo que gasta una bombilla.': 'Some 86 billion neurons, the most complex thing we know, think on about 20 watts: a light bulb.',
  'Ocho mil millones de cerebros': 'Eight billion brains',
  'Todos nuestros cerebros juntos, pensando a la vez: una central eléctrica grande.': 'All our brains together, thinking at once: one big power station.',
  'Las máquinas que piensan': 'Machines that think',
  'Hoy los centros de datos ya gastan casi un tercio de lo que gastan todos nuestros cerebros. Y crecen.': 'Data centres already use almost a third of what all our brains use. And they are growing.',

  // ---- Act II.
  'Doscientos años de luces': 'Two hundred years of lights',
  'Desde 1800 las ciudades se encienden: primero de a poco, después de golpe. De 0,6 a 19 billones de vatios.': 'Since 1800 the cities light up: slowly at first, then all at once. From 0.6 to 19 trillion watts.',
  'Hoy': 'Today',
  'Usamos unos 19 TW: tipo 0,73. La luz del Sol que llega a la Tierra son 174 000 TW. Toda la energía que usamos termina en calor.': 'We use about 19 TW: type 0.73. The sunlight reaching the Earth is 174,000 TW. All the energy we use ends up as heat.',
  'Más energía, más calor': 'More energy, more heat',
  'Si seguimos creciendo, las luces llenan la Tierra y el calor que sueltan crece con ellas.': 'If we keep growing, the lights fill the Earth and the heat they give off grows with them.',
  'El calor nos echa': 'The heat drives us out',
  'Un planeta solo suelta su calor radiando. Con 10¹⁶ W en su superficie, la Tierra se calentaría al menos 6 grados.': 'A planet can only shed heat by radiating it. With 10¹⁶ W on its surface the Earth would warm at least 6 degrees.',
  'Subir sin cohetes': 'Up without rockets',
  'Un cable desde el ecuador hasta más allá de la órbita geoestacionaria: el giro de la Tierra lo mantiene tenso. Falta un material dos veces más fuerte que el mejor de hoy.': 'A cable from the equator to beyond geostationary orbit, kept taut by the Earth’s spin. It needs a material twice as strong as the best we have.',
  'La industria sale al espacio': 'Industry moves into space',
  'En órbita, el calor se va directo al vacío sin calentar el planeta. Así se puede seguir creciendo: tipo I hacia el año 2370.': 'In orbit the heat goes straight to the void without warming the planet. Growth can go on: type I around the year 2370.',
};
