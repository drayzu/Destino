import { FONT, VIOLETA, ink } from '../estudios/placa';
import { idioma } from '../estudios/idioma';

/**
 * The plate (Lámina): the didactic layer, off by default. For each moment, its figures and where
 * they come from, small, at the right; in either language. Keyed by the moment's Spanish name.
 */
type Linea = [es: string, en: string];

const LAMINA: Record<string, Linea[]> = {
  'Un pensamiento': [['El cerebro humano usa unos 20 W, una quinta parte de la energía del cuerpo · Raichle y Gusnard, PNAS 2002', 'The human brain runs on about 20 W, a fifth of the body’s energy · Raichle & Gusnard, PNAS 2002']],
  'Nuestra voz': [['Las primeras emisiones de radio salieron hace un siglo: hoy van a unos 100 años luz', 'The first radio broadcasts left a century ago: they are about 100 light years out now']],
  'Cien mil años luz': [['La Vía Láctea mide unos 100 000 años luz de lado a lado', 'The Milky Way is about 100,000 light years across']],
  'Toda esa luz': [['La Vía Láctea brilla con unos 10³⁷ W', 'The Milky Way shines with about 10³⁷ W'], ['Escala de Kardashev (1964), con la fórmula de Sagan: tipo = (log₁₀ P − 6) / 10, con P en vatios', 'Kardashev scale (1964), with Sagan’s formula: type = (log₁₀ P − 6) / 10, P in watts']],
  '¿Hay alguien más?': [['Entre 100 000 y 400 000 millones de estrellas', 'Between 100 and 400 billion stars']],
  'Planetas por todas partes': [
    ['En promedio, al menos un planeta por estrella · Cassan et al., Nature 2012', 'On average, at least one planet per star · Cassan et al., Nature 2012'],
    ['Más de 6 000 planetas confirmados · NASA Exoplanet Archive', 'Over 6,000 confirmed planets · NASA Exoplanet Archive'],
  ],
  'Lo que hemos escuchado': [['El vaso de agua del mar es de Jill Tarter (2010); Wright et al. (2018) lo estiman como una tina en todos los océanos', 'The glass of water from the sea is Jill Tarter’s (2010); Wright et al. (2018) put it at a hot tub in all the oceans']],
  'El silencio': [['A una fracción de la velocidad de la luz, llenar la galaxia toma entre uno y cien millones de años; ella tiene trece mil millones · Hart 1975; Newman y Sagan 1981', 'At a fraction of light speed, filling the galaxy takes one to a hundred million years; it is thirteen billion years old · Hart 1975; Newman & Sagan 1981']],
  'Una célula que reacciona': [['La vida en la Tierra tiene al menos 3 500 millones de años', 'Life on Earth is at least 3.5 billion years old']],
  'Nervios': [['Las primeras neuronas aparecen hace unos 600 millones de años', 'The first neurons appear some 600 million years ago']],
  'Un cerebro': [['86 000 millones de neuronas · Azevedo et al., 2009', '86 billion neurons · Azevedo et al., 2009']],
  'Ocho mil millones de cerebros': [['8 000 millones × 20 W ≈ 1,6 × 10¹¹ W; la humanidad usa unos 1,9 × 10¹³ W', '8 billion × 20 W ≈ 1.6 × 10¹¹ W; humanity uses about 1.9 × 10¹³ W']],
  'Al otro lado del mundo': [['Casi todo el tráfico de datos entre continentes va por cables submarinos', 'Almost all data traffic between continents runs through undersea cables']],
  'Las máquinas que piensan': [['Los centros de datos usan cerca del 1,5 % de la electricidad del mundo, y crecen rápido · IEA, Energy and AI, 2025', 'Data centres use about 1.5% of the world’s electricity, and grow fast · IEA, Energy and AI, 2025']],
  'Doscientos años de luces': [['Consumo de energía, 1800–2024 · Smil; Our World in Data', 'Energy use, 1800–2024 · Smil; Our World in Data']],
  'Hoy': [['Unos 19 billones de vatios (≈ 620 EJ al año) · Energy Institute, Statistical Review 2024', 'About 19 trillion watts (≈ 620 EJ a year) · Energy Institute, Statistical Review 2024']],
  'Más energía, más calor': [['Al disco de la Tierra le llegan unos 1,7 × 10¹⁷ W de sol', 'About 1.7 × 10¹⁷ W of sunlight reach the Earth’s disc']],
  'El calor nos echa': [['Creciendo un 2,3 % al año, en unos 400 años el calor que liberamos haría hervir la superficie · Murphy, Do the Math, 2011', 'Growing 2.3% a year, in about 400 years our waste heat would boil the surface · Murphy, Do the Math, 2011']],
  'La industria sale al espacio': [['Escala de Kardashev (1964), con la fórmula de Sagan: tipo = (log₁₀ P − 6) / 10, con P en vatios', 'Kardashev scale (1964), with Sagan’s formula: type = (log₁₀ P − 6) / 10, P in watts']],
  'La Luna, cantera': [['Sacar de la Luna el material de las colonias, con lanzadores electromagnéticos · O’Neill, 1974', 'Mining the Moon for the colonies’ material, with mass drivers · O’Neill, 1974']],
  'Mundos que giran': [['Cilindro de O’Neill: 8 km de diámetro y 32 de largo · O’Neill, 1974', 'O’Neill cylinder: 8 km across, 32 km long · O’Neill, 1974']],
  'Calentar Marte': [['Espejos en órbita para calentar sus polos · Zubrin y McKay, 1993', 'Orbiting mirrors to warm its poles · Zubrin & McKay, 1993']],
  'Venus, a la sombra': [['A unos 50 km de altura: una atmósfera de presión, entre 0 y 50 °C · Landis, 2003', 'About 50 km up: one atmosphere of pressure, 0–50 °C · Landis, 2003']],
  'Desarmar Mercurio': [['Desarmar Mercurio con máquinas que se copian, en décadas · Armstrong y Sandberg, 2013', 'Taking Mercury apart with self-copying machines, in decades · Armstrong & Sandberg, 2013']],
  'La catapulta': [['Lanzador electromagnético · O’Neill, 1977', 'Mass driver · O’Neill, 1977']],
  'La pared que tapa el Sol': [['Enjambre de Dyson · Dyson, Science 1960', 'Dyson swarm · Dyson, Science 1960']],
  'Visto desde lejos': [['Se buscó ese brillo infrarrojo en el cielo: sin candidatos claros · Wright et al., 2014', 'That infrared glow has been searched for: no clear candidates · Wright et al., 2014']],
  'Alargar la vida del Sol': [['Levantar materia de una estrella · Criswell, 1985', 'Star lifting · Criswell, 1985']],
  'Mover el Sol': [['Propulsor estelar de Shkadov, 1987', 'Shkadov stellar thruster, 1987']],
  'Tipo II': [['Toda la luz del Sol: unos 3,8 × 10²⁶ W', 'All the Sun’s light: about 3.8 × 10²⁶ W']],
  'Velas de luz': [['Breakthrough Starshot (2016): velas de gramos a un quinto de la luz, unos 20 años hasta Alfa Centauri', 'Breakthrough Starshot (2016): gram-scale sails at a fifth of light speed, about 20 years to Alpha Centauri']],
  'La luz es lenta': [['Alfa Centauri está a 4,37 años luz', 'Alpha Centauri is 4.37 light years away']],
  'Frenar con su luz': [['Frenar con la luz de Alfa Centauri · Heller y Hippke, ApJL 2017', 'Braking with Alpha Centauri’s light · Heller & Hippke, ApJL 2017']],
  'La burbuja': [['Con sondas que se copian, la galaxia se llena en unos millones de años · Nicholson y Forgan, 2013', 'With self-copying probes, the galaxy fills in a few million years · Nicholson & Forgan, 2013']],
  'Tipo III': [['Se buscó en 100 000 galaxias: ninguna tipo III evidente · Griffith et al., ApJS 2015', '100,000 galaxies searched: no obvious type III · Griffith et al., ApJS 2015']],
  'El zoológico': [['Hipótesis del zoológico · Ball, 1973', 'The zoo hypothesis · Ball, 1973']],
  'El Gran Filtro': [['El Gran Filtro · Hanson, 1998', 'The Great Filter · Hanson, 1998']],
  'El borde y el silencio': [['Hipótesis de la transcendencia · Smart, 2012', 'The transcension hypothesis · Smart, 2012']],
  'Pensar con una estrella': [['Cerebro de Matrioshka · Bradbury, 1997', 'Matrioshka brain · Bradbury, 1997']],
  'El frío piensa más': [['Borrar un bit cuesta al menos kT ln 2: cuanto más frío, más barato · Landauer, 1961', 'Erasing a bit costs at least kT ln 2: the colder, the cheaper · Landauer, 1961']],
  'El frío': [['El fondo del universo está a 2,7 K · Sandberg, Armstrong y Ćirković, 2017', 'The universe’s background is at 2.7 K · Sandberg, Armstrong & Ćirković, 2017']],
  'La eternidad en seis horas': [['Armstrong y Sandberg, «Eternity in six hours», Acta Astronautica 2013', 'Armstrong & Sandberg, “Eternity in six hours”, Acta Astronautica 2013']],
  'La prisa': [['Lo que hoy está a más de unos 16 000 millones de años luz ya no se puede alcanzar', 'Whatever is now beyond about 16 billion light years can no longer be reached']],
  'Las expansivas se tocan': [['Civilizaciones expansivas · Hanson et al., 2021', 'Grabby civilizations · Hanson et al., 2021']],
  'Tipo IV': [['Unos 4 000 millones de galaxias alcanzables a 0,99 c · Armstrong y Sandberg, 2013', 'About 4 billion galaxies within reach at 0.99 c · Armstrong & Sandberg, 2013']],
  'El horizonte': [['En unos cien mil millones de años, desde aquí solo se verá el Grupo Local', 'In about a hundred billion years, only the Local Group will be visible from here']],
  'Las últimas centrales': [['Proceso de Penrose: hasta un 29 % de la masa de un agujero que gira · Penrose, 1969', 'Penrose process: up to 29% of a spinning hole’s mass · Penrose, 1969']],
  'Pensamientos contados': [['Dyson, «Time without end», 1979; Krauss y Starkman, 2000', 'Dyson, “Time without end”, 1979; Krauss & Starkman, 2000']],
  'Crear un universo': [['Farhi y Guth, 1987; Linde, 1992', 'Farhi & Guth, 1987; Linde, 1992']],
};

/** Draws the plate for the moment named `nombre` (Spanish), with `a` its light. */
export function lamina(g: CanvasRenderingContext2D, u: number, W: number, H: number, nombre: string | undefined, a: number) {
  const lineas = nombre ? LAMINA[nombre] : undefined;
  if (!lineas || a < 0.01) return;
  // (beside the moment's words where there is room; on a narrow screen, above them)
  const estrecho = W / u < 900;
  const ancho = estrecho ? W - 88 * u : Math.min(340 * u, W * 0.32);
  const x = estrecho ? 44 * u : W - 44 * u - ancho;
  g.save();
  g.globalAlpha = a;
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 12 * u;
  // From the bottom up, so it sits level with the moment's words.
  const filas: string[][] = lineas.map((l) => partir(g, idioma.en ? l[1] : l[0], ancho, u));
  let y = estrecho ? H - 300 * u : H - 52 * u;
  g.font = FONT.sans(12.5 * u);
  for (let k = filas.length - 1; k >= 0; k--) {
    for (let i = filas[k].length - 1; i >= 0; i--) {
      g.fillStyle = ink(0.68);
      g.fillText(filas[k][i], x, y);
      y -= 18 * u;
    }
    y -= 8 * u;
  }
  g.font = FONT.mono(10.5 * u);
  g.letterSpacing = `${1.6 * u}px`;
  g.fillStyle = VIOLETA;
  g.fillText(idioma.en ? 'PLATE · FIGURES AND SOURCES' : 'LÁMINA · CIFRAS Y FUENTES', x, y);
  g.restore();
}

function partir(g: CanvasRenderingContext2D, s: string, ancho: number, u: number) {
  g.font = FONT.sans(12.5 * u);
  const out: string[] = [];
  let linea = '';
  for (const w of s.split(' ')) {
    const prueba = linea ? `${linea} ${w}` : w;
    if (g.measureText(prueba).width > ancho && linea) {
      out.push(linea);
      linea = w;
    } else linea = prueba;
  }
  if (linea) out.push(linea);
  return out;
}
