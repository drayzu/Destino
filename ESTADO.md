# Destino · estado

## Dónde estamos
**Fase 2 · Prueba de fuego, acto III completo en el motor.** El sitio real corre (`index.html` + `src/`): un solo mundo compartido, la cámara con pivote, el reloj de potencia con su escalera y sus muros, la lámina (I), las teclas A/S/I/L, sonido básico y hojas de contactos. El viaje va de la portada hasta el tipo II y su muro (actos 0, I provisional, II y III): ~99 beats, unos 3 minutos con autoplay. Capturas: `docs/fase1/` (primer tramo) y `docs/fase2/momentos.jpg` y `docs/fase2/viaje.jpg` (acto III). Nada publicado: el repo es solo local.

## Decisiones
- **26 de octubre de 2026 · plan nuevo.** Despertar pasa a llamarse **Destino** y se rehace con el formato de Espacio y Tiempo: un solo viaje con scroll de ~10–12 minutos, teclas A/S/I/L, lámina opcional; sin modo explorar y sin estaciones. Se mantienen el muro → la obra y la galaxia de las posibilidades. La simulación, lo computable y los multiversos pasan a Infinito. Termina creando un universo y pasándole el relevo a Infinito. Detalle en `BRIEF.md` § 2.
- **26 de octubre · al aprobar el brief:**
  - Sin enlace al Atlas en cada momento. El Atlas se alcanza desde la lámina (rótulos enlazados a su ficha) y desde un solo enlace al final; el Atlas enlaza de vuelta a Destino.
  - En el acto 0, el reloj muestra la galaxia sin usar (~10³⁷ W, «tipo —»).
  - En el acto I, el reloj cuenta los vatios de pensar (célula → cerebro → todos los cerebros → las máquinas → hoy).
- **26 de octubre · estilos de la fase 0 (Diego):**
  - Muro «El calor nos echa»: **manera 1**, la Tierra que se tiñe del color de su calor (infrarrojo detrás de una cortina).
  - Apertura «¿Hay alguien más?»: **manera 3, Escuchar** (nuestra burbuja de radio de 100 años luz contra la galaxia, y lo poco que hemos escuchado).
  - «Dejar de ser materia»: **una mezcla**. Le gusta la red neuronal de las maneras 1 y 2, y de la 3 le gustan mucho los cuadros (bits) que se encienden y apagan cuando la cámara entra: «es inmersivo, súper cool». Hecha como la manera 4 del estudio («Elegida»): la materia de las capas se vuelve bits, la cámara entra entre ellos parpadeando al azar, se ordenan y de ellos nace la red. Resumen: `docs/estudios/resumen-mente-elegida.jpg`.
- **26 de octubre · fase 1 (decisiones técnicas, sin pasar por Diego):**
  - La Tierra se colocó en su órbita de modo que su lado de noche, visto desde fuera, tenga detrás el centro de la galaxia: la caída del acto 0 y la Tierra de noche llevan la Vía Láctea al fondo. El prototipo del sistema solar usaba otra posición; el acto III se arma sobre la nueva.
  - En el acto 0 se agregaron a «Escuchar» los dos momentos que le faltaban del guion: «Planetas por todas partes» y «El silencio» (la burbuja que una civilización habría llenado en 650 000 años).
  - El acto 0 deja el reloj en 10¹⁷ W (la luz del Sol que llega a la Tierra) y el acto I empieza a contar desde una célula; el acto II sube con la curva histórica hasta los 19 TW de hoy.
- **26 de octubre · fase 2 (decisiones de contenido y técnicas, sin pasar por Diego):**
  - El acto III suma lo que el brief pedía «a la vez», como momentos propios y cortos: **Mundos que giran** (un anillo de Bishop de 2 000 km y un cilindro de McKendree de 4 600 km en L5, con el de O'Neill como un punto; un toro de Stanford y una esfera de Bernal junto al cilindro), **Calentar Marte** y **Venus, a la sombra**. El orden queda: salida → hábitats → el cilindro por dentro → Marte → vista de todo el sistema → Venus → Mercurio → catapulta → enjambre → visto desde lejos → alargar la vida del Sol → mover el Sol → tipo II.
  - Marte, con honestidad: espejos sobre el polo sur (Zubrin y McKay, 1993), pero su CO₂ da como mucho ~20 mbar (Jakosky y Edwards, 2018), así que se vive bajo cúpulas; el verde que avanza es la parte especulativa. La distancia de los espejos es ilustrativa (ellos los ponían a ~60 radios).
  - Venus: ciudades flotantes a ~50 km, 1 bar y 0–50 °C (Landis, 2003); parasol en L1, a ~1 millón de km (Birch, 1991), de unas dos veces el ancho de Venus para tapar todo el disco. Se termina viendo desde atrás, como un eclipse.
  - Alargar la vida del Sol (Scoggins y Kipping, 2023: hasta ~3 000 millones de años) y moverlo (Shkadov, 1987: 34 000 años luz en mil millones de años; Caplan, 2019: ~50 años luz en un millón de años).
- Pendiente: confirmar repo y URL (`drayzu/Destino` → drayzu.github.io/Destino) antes de crear el remoto.

## Cómo está hecho
`npm run dev` (puerto 5197) → `http://localhost:5197/`. `?p=beat` arranca ahí, `?ver=beat` congela, `?lamina` abre con la lámina, `?lang=es|en`. Con `?debug`, `destino` en la consola: `destino.hoja('docs/…/x.jpg', [beats], columnas, ancho)`, `destino.foto(ruta, beat)`, `destino.at('a2.muro')`, `destino.seek(b)`. **Sin ventana:** `node tools/hoja.mjs "await destino.hoja(…)"` abre Chrome sin ventana (con la GPU, 1600 × 900) contra el servidor de desarrollo; así las hojas no dependen del tamaño del panel del navegador.

- **Un solo mundo** (`src/mundo/mundo.ts`): unidades astronómicas, el Sol en el origen; la galaxia (en años luz, escalada a UA), el Sol, la Tierra con sus ciudades, el anillo y el ascensor (`cercanias`), la Luna, faros. Los actos ajustan su `estado` cada cuadro (luces, giro de la Tierra, obras visibles) y el mundo mantiene todo vivo.
- **La cámara con pivote** (`src/engine/vista.ts`): la cámara queda en el origen y el mundo se mueve y escala para que lo que mira esté a una unidad. Así conviven exactos los kilómetros del ascensor y los 100 000 años luz de la galaxia. `mezcla` pasa de una vista a otra con la distancia en logaritmo; los actos se entregan la cámara sin cortes.
- **Los actos** (`src/actos/`): cada uno escribe sus momentos en la línea de tiempo compartida (etiquetas `a0.*`, `a1.*`, `a2.*`), arma lo suyo en el mundo, dice dónde está la cámara (`vista`), qué marca el reloj (`lectura`, o `libre` antes de que haya civilización) y su muro, y dibuja su parte de la lámina.
  - `apertura.ts` (acto 0, Escuchar): nuestra voz, cien mil años luz, planetas por todas partes, lo que hemos escuchado, el silencio, una estrella amarilla.
  - `despertar.ts` (acto I, **provisional**): la Tierra oscura mientras el reloj cuenta los vatios de pensar. La página lo dice («acto provisional»).
  - `hoy.ts` (acto II): doscientos años de luces (curva de OWID, el año como cifra), hoy, más energía más calor, el muro con la cortina infrarroja (`src/mundo/calor.ts`, del estudio), subir sin cohetes montados en el ascensor (con la lámina, las fuerzas sobre el cable cuando se ve de lado), la industria sale al espacio.
  - `sistema.ts` (acto III): ver el orden en Decisiones. Los objetos nuevos viven en `src/mundo/`: `habitat.ts` (el cilindro de O'Neill por dentro), `habitats.ts` (Bishop, McKendree, Stanford, Bernal), `planetas.ts` (Marte y Venus), `estrella.ts` (el levante por los polos, el espejo de Shkadov, el motor de Caplan) y `obras.ts` (el Sol, el enjambre y sus placas, Mercurio y su riel, rutas, cinturón, faros).
  - Para viajar entre lugares lejanos, `vuelo` (la distancia desde el origen crece en logaritmo y la distancia al destino decrece en logaritmo) y `mirar` (la mirada gira por ángulo; deslizar el objetivo por el espacio la desvía de golpe).
- **El reloj y la escalera** (`src/engine/placa.ts`): potencia, tipo, cuándo (o un año del pasado) y alcance; la escalera vacía con un anillo hueco para la potencia que nadie usa; los muros la cruzan.
- **Lecciones nuevas** (evitan horas):
  - Las partículas no prueban profundidad: un planeta tapa lo que tiene detrás con `uOcc` (su centro en espacio de vista y su radio), que el mundo pone a todas las nubes salvo las del propio planeta.
  - Lo que se carga tarde (las luces de la Tierra llegan con el mapa) tiene que entrar a la lista de nubes cuando llega; si no, queda sin enfocar y se dibuja cuatro veces más grande.
  - El resplandor con los valores de Tiempo (umbral 0,12) vuelve manchas las ciudades y quema el infrarrojo: Destino usa los de los estudios (0,55 · 0,4 · 0,6).
  - **Un NaN en un solo píxel vuelve negro todo el cuadro** (el resplandor lo esparce; la placa 2D sigue viéndose). Casi siempre es `pow(1.0 - mu, n)` con `mu` apenas mayor que 1: usar `pow(max(1.0 - mu, 0.0), n)`.
  - `smoothstep` con los bordes al revés no está definido en GLSL; en este equipo (ANGLE sobre D3D11) a veces invierte el resultado. Escribir siempre `1.0 - smoothstep(a, b, x)` con `a < b`.
  - Otro planeta también tapa las estrellas: `estado.oclusor` (centro, radio y sus propias nubes) toma el lugar de la Tierra cuando se ve más grande.
  - Puntos de luz más chicos que un píxel se pierden aunque tengan `fuente`: el punto se muestrea fuera de su centro. Las luces de ciudades necesitan al menos 2–3 px.

## Pendiente del acto III (para pulir)
- Algunos traslados largos tienen cuadros casi vacíos (de la Tierra a los hábitats; de Marte a la vista general).
- Los rótulos de la vista general y del tipo II a veces se tocan.
- Marte: el verde aparece sobre todo en el norte; podría verse avanzar más en la cara visible.
- Lámina: los rótulos todavía no enlazan a sus fichas del Atlas; sonido propio del acto (fase 5).

## Pendiente del primer tramo (para pulir)
- El acto I tiene solo el reloj: sus imágenes (células, una neurona, una ciudad, un centro de datos) son de la fase 4.
- «Hoy»: pasa la Estación Espacial (enlace con Espacio).
- Las luces de 1800 se encienden en orden al azar; deberían empezar por Europa y la costa este de EE. UU.
- Los textos del reloj (vatios, cuándo, alcance) todavía no se traducen al inglés; el sonido es básico (fase 5).
- La escalera todavía no salta al tocar sus peldaños; no hay enlaces cruzados (Espacio, Tiempo, el Atlas).
- En las hojas de contactos, el salto entre cuadros deja un poco del barrido de velocidad.
- Móvil y modo liviano sin probar.

## Los estudios de la fase 0
`npm run dev` (puerto 5197) → `prototypes/estudios.html?m=<momento>&s=<manera>`. Capturas en `docs/estudios/`.

| Estudio | Estado |
|---|---|
| Muro «El calor nos echa» (`?m=muro`) | Elegida la manera 1. Ya está en el motor (acto II). |
| Ascensor (`?m=ascensor`) | Estación paso a paso del plan antiguo. Su idea (las fuerzas sobre el cable) está en la lámina del acto II. |
| Apertura «¿Hay alguien más?» (`?m=apertura`) | Elegida la manera 3, Escuchar. Ya está en el motor (acto 0). |
| «Dejar de ser materia» (`?m=mente`) | Elegida la mezcla (manera 4). Va al acto VI (fase 4). |

## Historial
- **26 de octubre de 2026 · planificación (como «Despertar»):** brief, investigación (`docs/investigacion.md`), prototipo del sistema solar (`prototypes/sistema.html`) con su estación del enjambre y modo explorar.
- **26 de octubre · fase 0 (como «Despertar»):** página de estudios; el muro en tres maneras; la estación del ascensor; la apertura en tres maneras (en curso).
- **26 de octubre · plan nuevo:** brief y biblia reescritos como Destino; este documento.
- **26 de octubre · fase 0 con el plan nuevo:** la apertura terminada como Destino (reloj de la potencia sin usar); «Dejar de ser materia» en tres maneras y la mezcla elegida; Diego eligió los estilos.
- **26 de octubre · fase 1:** el motor y el primer tramo del viaje (actos 0, I provisional y II).
- **26 de octubre · fase 2:** el acto III completo: el cilindro de O'Neill por dentro, los otros hábitats, Marte, Venus, Mercurio y su catapulta, el enjambre, visto desde lejos, alargar la vida del Sol, moverlo y el tipo II con su muro. Arreglos de shaders (NaN y `smoothstep`) que también afectaban al acto II.

## Siguiente paso
Que Diego vea el acto III (`docs/fase2/momentos.jpg`, y en vivo en `http://localhost:5197/?p=45`) y diga si la prueba de fuego impresiona. Si sí, la **fase 3**: actos IV (estrellas vecinas: velas de luz, a un quinto de la luz, frenar, el muro de la luz) y V (la galaxia: la burbuja, el tipo III, la galaxia de las posibilidades), con la misma lógica.
