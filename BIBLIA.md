# Despertar · biblia visual

**Una idea:** la materia que despierta y empieza a transformar el universo. Un solo viaje desde la pregunta «¿hay alguien más?» hasta la última obra posible de una mente, crear un universo nuevo, **recorrido en un mundo abierto donde todo pasa a la vez**. El eje es la escala de Kardashev: la potencia en vatios es el exponente del HUD.

Cuarta pieza de la serie *Escalas* y la que la cierra: Potencias responde *how small*, Tiempo *how brief* y Despertar *how far*. AstroIngeniería es la biblioteca; Despertar es el lugar donde esas cosas existen y se ven funcionar. De la misma familia que Potencias y Tiempo, pero no igual: **ellas se miran; Despertar además se entiende.**

## Principios
0. **El viaje más largo y más ancho de la serie.** De 10¹³ W a 10⁴⁶ W y más; de una ciudad a todas las galaxias alcanzables; de hoy al final del tiempo. De 15 a 20 minutos con autoplay. Algo que ver en cada tramo y algo pasando en cada dirección.
1. **Lo visual va primero.** Cada momento tiene un nombre, **una frase** y su lectura en el HUD. Lo que necesita un párrafo va a la ficha del modo explorar o a AstroIngeniería.
2. **Se mira y se entiende: el muro, la obra, la estación.** Despertar es una historia de causas, así que cada etapa tiene tres tiempos:
   - **El muro:** la civilización choca con un límite físico **y se ve** (la Tierra que se calienta, la luz del Sol que no alcanza, la luz que es demasiado lenta, las galaxias que se alejan, el frío final). La escalera de la derecha marca cada muro con una línea que la cruza.
   - **La obra:** el viaje y el espectáculo, la cámara montada en la civilización, todo pasando a la vez.
   - **La estación «Cómo funciona»:** el viaje se frena y **la escena misma se vuelve el diagrama**. Nada de láminas pegadas encima: el objeto real se aísla y se le dibujan sus fuerzas, su luz, su calor, su materia. **Cada gesto de scroll avanza un paso** (4 o 5), con una frase por paso y el indicador arriba («Cómo funciona · enjambre de Dyson», un punto por paso). Después la escena vuelve a la normalidad.
   - **Ritmo:** el viaje es rápido y la estación es lenta. El mismo contenido con muros y estaciones dura tres o cuatro veces más y se entiende.
3. **Un mundo que se extiende, no un centro.** El escenario crece por etapas (planeta → sistema → estrellas vecinas → galaxia → cosmos) y en cada etapa **muchas cosas ocurren a la vez en lugares distintos**: una línea de carga que cruza, el destello de una catapulta, una vela que se aleja. Nunca se apaga el mundo para mostrar una sola cosa.
4. **Tú viajas por la red.** En el viaje la cámara **va montada en las rutas de la civilización** (el ascensor, una carga, un haz, una vela, una sonda, el frente de expansión) y su alcance crece con el de la civilización. Lo omnisciente queda para el modo explorar, que es una pausa.
5. **Cada límite empuja el paso siguiente** (el hilo que da unidad y enseña sin texto): más energía en la Tierra la calentaría → la industria sale al espacio; la luz de un planeta no alcanza → se rodea la estrella; una estrella no basta → otras estrellas, pero la luz pone el freno; la expansión aleja las galaxias → hay prisa; todo se agota → ¿se puede escapar del final? Cada obra aparece porque resuelve el problema de su etapa.
6. **Nada se crea: la mente reordena** (la ley de la serie: en Potencias lo grande se arma con lo pequeño; en Tiempo el tiempo reordena). La materia de cada obra viene de un lugar visible: Mercurio se vuelve enjambre, la roca de la Luna sale por la catapulta, el Sol entrega su propia materia. Se ve el flujo, nunca un objeto que aparece.
7. **Se entiende viéndolo funcionar.** Cada estructura muestra su mecanismo: el ascensor se sostiene por el giro, las velas giran de cara al Sol, el espejo de Shkadov empuja la luz a un lado y la estrella se mueve, las capas del cerebro Matrioshka se enfrían hacia afuera. **Si una frase afirma algo que se puede ver, se ve** (la «frase dibujada» de Potencias).
8. **Lo nuestro es luz.** La naturaleza es materia en sus colores físicos; lo que hace la civilización emite luz propia, verde azulado. Se ve de lejos, como una ciudad de noche, y el visitante siempre sabe qué es obra y qué es naturaleza.
9. **Lo observado, lo que la física permite y lo especulativo se distinguen a la vista:** continuo, discontinuo, punteado (como en Tiempo). Las otras civilizaciones y todo lo que está más allá del tipo II son hipótesis: se dibujan en lenguaje de lámina, nunca como hechos.
10. **Momentos con nombre**, pocos y solo donde pasa algo que no pasa en otro lado.
11. **Nunca un cuadro vacío por accidente; nada parpadea sin razón física.** Los destellos de las velas son reflejos del Sol. Lo invisible (un haz láser, la materia oscura, el calor infrarrojo) se dibuja en lámina y se dice.
12. **Los números son el espectáculo** en los extremos: 2⁴⁰ máquinas, 10⁹ galaxias en seis horas, 10⁴⁶ W, el número finito de pensamientos que le quedan al universo.

## Estilo elegido
*(Se completa cuando Diego elija entre los estudios de la fase 0: el muro, la apertura y «Dejar de ser materia». Ver `ESTADO.md`.)*

## Lenguaje
| Capa | Qué es | Dónde |
|---|---|---|
| **Superficies** | Planetas que se ven de cerca: malla con sombreado propio (la Tierra con el mapa de Natural Earth y el Sol reflejado en el mar; Mercurio con cráteres procedurales) | Lo natural, de cerca |
| **Partículas de luz** | La civilización (luces, colectores, cargas, minas) y la materia lejana (estrellas, polvo, galaxias), con tamaño físico | Todo el viaje |
| **Fuentes** | Partículas que no se apagan bajo un píxel (`fuente` en `materia.ts`): lo que emite luz se ve de lejos | Rutas, enjambre, minas, sondas |
| **Faros** | Un punto de luz para lo que es demasiado pequeño para verse (un planeta, la vela), que se apaga cuando el objeto ya se resuelve | Vistas generales |
| **Lámina** | Líneas finas, notas con guía, órbitas, flechas de fuerza, fichas; lo invisible y lo hipotético | Estaciones, capa opcional (I), modo explorar y lo especulativo |

**El cambio de estética en lo especulativo:** a medida que la civilización deja de ser biológica, la imagen deja de ser materia: primero la luz de las obras, después estructuras de lámina, al final la mente como dibujo vivo (cómputo). En la simulación, el mundo que veníamos viendo se revela calculado. Es el único lugar donde lo abstracto ocupa toda la pantalla, porque ahí el tema es la abstracción.

## Color
Interfaz: tinta `#ece7db`, tenue al 50 %, fondo negro. **Acento verde azulado `#6fe3c1`** (tema oscuro) / `#1f8f73` (claro): **el color de la obra**. Potencias es naranja `#ff5b2e`; Tiempo, azul `#8fb4ff`; Despertar, verde azulado.

- Es la luz de la civilización: ciudades nuevas, colectores, rutas, el frente de expansión, el marcador del HUD.
- Las ciudades de hoy conservan su color real (sodio y LED cálidos). Lo que se agrega después ya es verde azulado: así se ve qué es nuevo.
- Lo que es calor (infrarrojo, falso color) va en rojos y naranjas de lámina (`#ff6a3d`, `#ff9a6a`); la luz del Sol en lámina, crema `#ffe0a0`; un error físico o un choque, rojo `#ff5b4a`.

| Acto | Paleta |
|---|---|
| 0 · ¿Hay alguien más? | La Vía Láctea desde dentro: bulbo dorado, brazos azulados, polvo; los planetas en lámina; la burbuja que debería existir, verde azulado punteado |
| I · La materia despierta | Lo vivo en sus colores; lo que piensa (neuronas, máquinas) empieza a tener luz propia |
| II · Nosotros, hoy | La Tierra de noche: océano azul profundo, ciudades cálidas, el *airglow* verde en el borde (real y casi verde azulado) |
| III · El sistema solar | Sol blanco cálido, Mercurio gris duro, el enjambre como polvo de vidrio que destella |
| IV · Estrellas vecinas | Doppler y aberración a velocidades relativistas: el arcoíris estelar al frente |
| V · La galaxia | Luz dorada del bulbo, brazos azules, la burbuja verde azulada; en infrarrojo, falso color de lámina |
| VI · Hacia adentro | Las capas del cerebro Matrioshka del color de su temperatura; después, lámina viva |
| VII y VIII · Cosmos y final | Negro, rojos de agujeros negros, el destello blanco de un universo que nace |

## Tipografía
- **Instrument Serif:** nombres de momentos (cursiva), el exponente grande, las cifras que son espectáculo.
- **Geist:** frases e interfaz.
- **Geist Mono:** cifras, unidades, notas de lámina, el indicador de la estación. Geist Mono no trae todos los superíndices: los exponentes se dibujan elevados a mano.

## HUD: tres relojes
- Grande, en Instrument Serif: **la potencia, 10¹³ W**, con el exponente como protagonista. Al lado, en cursiva verde azulada: **tipo 0,73** (Sagan: K = (log₁₀ P − 6) / 10).
- Debajo, en Geist Mono: la potencia en palabras (19 TW), **cuándo** («2026 · hoy», «año 2370», «dentro de 10⁶ años») y **hasta dónde llega** («alcance 400 km», «3,4 UA», «12 años luz»). Une Despertar con Tiempo y Potencias.
- **La escalera de la derecha:** de una persona (10² W) a una galaxia (10³⁷ W) y más allá; se llena de verde azulado hasta donde está la civilización; peldaños con nombre (hoy, fotosíntesis, I, la luz del Sol en la Tierra, II, el Sol, III, la Vía Láctea); continua hasta hoy, discontinua hasta el II, punteada después. **Los muros la cruzan.**

## La estación «Cómo funciona» (la gramática)
- Arriba al centro: «CÓMO FUNCIONA · <OBRA>» en Geist Mono verde azulado, y un punto por paso (el actual lleno y más grande, los hechos a medias, los que faltan vacíos).
- Abajo a la izquierda, donde va el nombre del momento: el nombre del paso en cursiva y su frase.
- Cada paso: **una toma de cámara** sobre el objeto real, **un estado del mundo** (lo demás se atenúa sin apagarse) y **un dibujo de lámina** sobre el objeto (flechas, rótulos con guía, una curva).
- La transición va al principio del paso (~0,4 beats) y el resto es para leer y mirar (~1,35 beats). Dentro del paso la cámara sigue derivando un poco: el mundo está vivo mientras lees.
- Lo que se dibuja más grande de lo que es lo dice («tamaño ilustrativo»); lo invisible se dibuja en lámina y lo dice.
- Referencia: la estación del enjambre del prototipo (`docs/conceptos/sistema-estacion.jpg`) y la del ascensor (`docs/estudios/`).

## Movimiento y cámara
- Primera persona y montada: la cámara viaja en algo (el cable, una carga, la vela, el frente) y se mueve mucho, entre cosas reales. Nada de túneles ni figuras abstractas sobre la escena (Diego los rechazó en Tiempo).
- El mouse inclina la vista unos grados (paralaje), nunca más.
- **El scroll se siente** (de Tiempo): cuanto más rápido empuja la mano, más se inclina la cámara hacia adelante (lente más abierta, desenfoque radial, franjas de color).
- Lo que pasa demasiado rápido se ve como exposición larga (los días como bandas), nunca como estroboscopio.
- **Explorar (E):** el viaje se detiene y el mundo sigue vivo; cámara orbital libre, sitios con nombre, fichas cortas (certeza, una o dos frases con cifra y fuente, «Leer en AstroIngeniería →»).

## Sonido
- Opcional y apagado al empezar (**S**), generado en el navegador.
- **La potencia se oye:** la densidad del ambiente crece con log P. Pocas voces graves hoy; un coro inmenso y lento en lo cósmico.
- Cada obra tiene su firma (el golpe sordo de la catapulta, el siseo de vidrio del enjambre, el zumbido del ascensor).
- **El silencio de Fermi es silencio de verdad.** Una campana suave al llegar a cada momento; la última, el universo que nace.
- Ambiente, no música.

## Técnica (reglas del motor)
- Todo es función del progreso del scroll → pistas de la línea de tiempo. Reversible siempre.
- Pistas principales: `lp` (log₁₀ de la potencia en W), `ly` (log₁₀ de los años desde hoy), `lr` (log₁₀ del alcance en m); `paso` (la estación, entre tomas) y su progreso lineal para lo que se mueve dentro de un paso.
- **Mundo abierto multiescala** con la cadena de Potencias (doble precisión relativa a un pivote; marcos anidados: radios terrestres → UA → años luz → kiloparsecs → megaparsecs). Cada cuerpo es un grupo en sus propias unidades.
- **Obras persistentes** con dos niveles de detalle (faro o puntos de lejos; malla, instancias y sombreado de cerca), cada una con su animación ambiental aunque nadie la mire.
- GLSL: **nunca `pow()` con base negativa** (NaN en esta GPU, y el bloom lo esparce por el cuadro, que queda negro): usar `x * x`; `pow(0, y)` → `sqrt(max(x, 0.0))`.
- `logarithmicDepthBuffer: true` y, en los `ShaderMaterial` con profundidad, `logdepthbuf_pars_vertex/fragment` y `logdepthbuf_vertex/fragment`. Límite de profundidad de `materia.ts` ínfimo y `uSizeUnit` a la escala del mundo de cada nube.
- 60 fps en escritorio, workers para lo pesado, calidad adaptable, modo liviano en teléfonos, «reducir movimiento». Hoja de contactos que dibuja cada cuadro a mano (sin depender de `requestAnimationFrame`) y guarda en `docs/`.
