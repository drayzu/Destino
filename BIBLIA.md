# Destino · biblia visual

**Una pregunta: ¿adónde podemos llegar?** Un solo viaje con scroll desde «¿hay alguien más?» hasta la última obra posible de una civilización, crear un universo, que le pasa el relevo a Infinito. **La regla es la energía:** la potencia en vatios es el exponente del HUD, con el tipo de Kardashev al lado.

Tercera obra de la serie **Horizontes**: Espacio responde *¿dónde?* (metros), Tiempo *¿cuándo?* (años), Destino *¿adónde podemos llegar?* (energía) e Infinito *¿qué hay más allá?* (números). El Atlas es la biblioteca: **las obras se miran, el Atlas se lee.** Destino es la única obra con agencia: aquí nosotros actuamos. **Emoción y esperanza, con tensión.**

## Principios
0. **El viaje más largo y más ancho de la serie, en el mismo tiempo que las otras.** De 10¹³ W a 10⁴⁶ W; de una ciudad a todas las galaxias alcanzables; de hoy al final del tiempo. **~10–12 minutos con autoplay** (~340 beats). Algo que ver en cada tramo y algo pasando en cada dirección.
1. **Lo visual va primero.** Cada momento tiene un nombre, **una frase** y su lectura en el HUD. Lo que necesita un párrafo va a la lámina o al Atlas. Sin enlace al Atlas en cada momento.
2. **El muro y la obra.** La civilización choca con un límite físico **y se ve** (la Tierra que se calienta, la luz del Sol que no alcanza, la luz que es demasiado lenta, el silencio, el frío, las galaxias que se alejan, el final). El muro empuja la obra siguiente, que lo resuelve. Es un respiro para mirar, no una clase: la escena lo muestra, la escalera lo marca con una línea que la cruza y una frase lo nombra.
3. **Un mundo que crece con muchas cosas a la vez.** El escenario se ensancha por etapas (planeta → sistema → estrellas vecinas → galaxia → cosmos) y en cada etapa muchas cosas ocurren en lugares distintos: una línea de carga que cruza, el destello de una catapulta, una vela que se aleja. Nunca se apaga el mundo para mostrar una sola cosa.
4. **La cámara va montada en la civilización:** el escalador del ascensor, una carga de la catapulta, una placa del enjambre, la vela, la sonda, el frente de expansión. Su alcance crece con el de la civilización.
5. **Cada límite empuja el paso siguiente**, el hilo que da unidad y enseña sin texto.
6. **Nada se crea: la mente reordena.** La materia de cada obra viene de un lugar visible: Mercurio se vuelve enjambre, la roca de la Luna sale por la catapulta, el Sol entrega su propia materia. Se ve el flujo, nunca un objeto que aparece.
7. **Se entiende viéndolo funcionar, sin pararse.** Cada estructura muestra su mecanismo mientras pasa: el ascensor se sostiene por el giro, las velas giran de cara al Sol, el espejo de Shkadov empuja la luz a un lado y la estrella se mueve, las capas del cerebro Matrioshka se enfrían hacia afuera. **Si una frase afirma algo que se puede ver, se ve.**
8. **Lo nuestro es luz.** La naturaleza está en sus colores físicos; lo que hace la civilización emite luz propia, verde azulado. Se ve de lejos, como una ciudad de noche, y el visitante siempre sabe qué es obra y qué es naturaleza.
9. **Lo observado, lo que la física permite y lo especulativo se distinguen a la vista:** continuo, discontinuo, punteado (como en Tiempo). Las otras civilizaciones y todo lo que está más allá del tipo II son hipótesis: lenguaje de lámina, con su autor y año.
10. **Esperanza con tensión.** Cada obra es algo que *hacemos*; cada muro pregunta si llegaremos; el silencio de Fermi acompaña el viaje entero.
11. **Nunca un cuadro vacío por accidente; nada parpadea sin razón física.** Los destellos de las velas son reflejos del Sol. Lo invisible (un haz láser, el calor infrarrojo) se dibuja en lámina y se dice.
12. **Los números son el espectáculo** en los extremos: 2⁴⁰ máquinas, 10⁹ galaxias en seis horas, 10⁴⁶ W, el número finito de pensamientos que le quedan al universo.

## Estilo elegido (fase 0, 26 de octubre de 2026)
- **Los muros se ven en el mundo, en falso color:** el del calor es la Tierra que se tiñe del color de su calor (infrarrojo) detrás de una cortina que barre la pantalla; la industria que sube a órbita se enfría. La escalera marca el muro, pero el protagonista es el mundo. Referencia: `docs/estudios/resumen-muro.jpg`, fila 1.
- **La apertura es escuchar:** desde el Sol hacia afuera, nuestra voz (una burbuja de radio de 100 años luz) contra una galaxia de 100 000, y lo poco que hemos escuchado; luego la caída a la Tierra. Referencia: `docs/estudios/resumen-apertura.jpg`, fila 3.
- **Dejar de ser materia es entrar en el cálculo:** la cámara entra entre las capas y queda rodeada de bits (cuadros que se encienden y apagan, en el color de su temperatura); de los bits nace la red que piensa (nodos y pulsos de lámina viva). Inmersivo ante todo. Referencia: `docs/estudios/resumen-mente.jpg` (cuadros de la fila 3, red de las filas 1 y 2) y la manera 4 del estudio.

## Lenguaje
| Capa | Qué es | Dónde |
|---|---|---|
| **Superficies** | Planetas que se ven de cerca: malla con sombreado propio (la Tierra con el mapa de Natural Earth y el Sol reflejado en el mar; Mercurio con cráteres procedurales) | Lo natural, de cerca |
| **Partículas de luz** | La civilización (luces, colectores, cargas, minas) y la materia lejana (estrellas, polvo, galaxias), con tamaño físico | Todo el viaje |
| **Fuentes** | Partículas que no se apagan bajo un píxel (`fuente` en `materia.ts`): lo que emite luz se ve de lejos | Rutas, enjambre, minas, sondas |
| **Faros** | Un punto de luz para lo que es demasiado pequeño para verse (un planeta, la vela), que se apaga cuando el objeto ya se resuelve | Vistas generales |
| **Lámina** | Líneas finas, notas con guía, órbitas, flechas de fuerza; lo invisible y lo hipotético | Capa opcional (I) y lenguaje de lo especulativo |

**La lámina (I) es la capa para aprender.** Dibuja sobre la escena viva el mecanismo de lo que se ve, sin pausar el viaje: las fuerzas del ascensor, la luz que entra en una vela del enjambre y el calor que sale por detrás, por qué una cáscara de Dyson no funciona, el cono de aberración de la vela, las temperaturas de las capas del cerebro Matrioshka. Es lo que antes hacían las estaciones «Cómo funciona», ahora encima del viaje y no en una parada. Sus rótulos de conceptos protagonistas enlazan a su ficha del Atlas; aparte, un solo enlace al Atlas al final del viaje.

**El cambio de estética hacia adentro** (acto VI): a medida que la civilización deja de ser biológica, la imagen deja de ser materia: primero la luz de las obras, después estructuras de lámina, al final la mente como dibujo vivo (cómputo). Sin simulación: no es el mundo el que resulta calculado; es la civilización la que se vuelve cálculo. Es el único lugar donde lo abstracto ocupa toda la pantalla, porque ahí el tema es la abstracción.

## Color
Interfaz: tinta `#ece7db`, tenue al 50 %, fondo negro. **Acento verde azulado `#6fe3c1`** (tema oscuro) / `#1f8f73` (claro): **el color de la obra**. Espacio es naranja `#ff5b2e`; Tiempo, azul `#8fb4ff`; Destino, verde azulado.

- Es la luz de la civilización: ciudades nuevas, colectores, rutas, el frente de expansión, el marcador del HUD.
- Las ciudades de hoy conservan su color real (sodio y LED cálidos). Lo que se agrega después ya es verde azulado: así se ve qué es nuevo.
- Lo que es calor (infrarrojo, falso color) va en rojos y naranjas de lámina (`#ff6a3d`, `#ff9a6a`); la luz del Sol en lámina, crema `#ffe0a0`; un muro, un error físico o un choque, rojo `#ff5b4a`.

| Acto | Paleta |
|---|---|
| 0 · ¿Hay alguien más? | La Vía Láctea desde dentro: bulbo dorado, brazos azulados, polvo; los planetas y sus zonas habitables en lámina; la burbuja que debería existir, verde azulado punteado |
| I · La materia despierta | Lo vivo en sus colores; lo que piensa (neuronas, máquinas) empieza a tener luz propia |
| II · Nosotros, hoy | La Tierra de noche: océano azul profundo, ciudades cálidas, el *airglow* verde en el borde (real y casi verde azulado); el muro, la Tierra teñida del color de su calor |
| III · El sistema solar | Sol blanco cálido, Mercurio gris duro, el enjambre como polvo de vidrio que destella; el Sol en infrarrojo, falso color |
| IV · Estrellas vecinas | Doppler y aberración a velocidades relativistas: el arcoíris estelar al frente |
| V · La galaxia | Luz dorada del bulbo, brazos azules, la burbuja verde azulada; las hipótesis de Fermi en lámina punteada; en infrarrojo, falso color |
| VI · Hacia adentro | Las capas del cerebro Matrioshka del color de su temperatura; después, lámina viva |
| VII y VIII · Cosmos y final | Negro, rojos de agujeros negros, el destello blanco de un universo que nace |

## Tipografía
- **Instrument Serif:** el título, los nombres de momentos (cursiva), el exponente grande, las cifras que son espectáculo.
- **Geist:** frases e interfaz.
- **Geist Mono:** cifras, unidades, notas de lámina. Geist Mono no trae todos los superíndices: los exponentes se dibujan elevados a mano.

## HUD: la potencia
- Grande, en Instrument Serif: **la potencia, 10¹³ W**, con el exponente como protagonista. Al lado, en cursiva verde azulada: **tipo 0,73** (Sagan: K = (log₁₀ P − 6) / 10).
- Debajo, en Geist Mono: la potencia en palabras (19 TW), **cuándo** («2026 · hoy», «año 2370», «dentro de 10⁶ años») y **hasta dónde llega** («alcance 400 km», «3,4 UA», «12 años luz»).
- **La escalera de la derecha:** de una persona (10² W) a una galaxia (10³⁷ W) y más allá; se llena de verde azulado hasta donde está la civilización; peldaños con nombre (hoy, fotosíntesis, I, la luz del Sol en la Tierra, II, el Sol, III, la Vía Láctea, IV); continua hasta hoy, discontinua hasta el II, punteada después. **Los muros la cruzan** con una línea roja y su nombre.
- Abajo a la izquierda, el nombre del momento en cursiva y su frase (una).

## Movimiento y cámara
- Primera persona y montada: la cámara viaja en algo (el cable, una carga, la vela, la sonda, el frente) y se mueve mucho, entre cosas reales.
- El mouse inclina la vista unos grados (paralaje), nunca más.
- **El scroll se siente** (de Tiempo): cuanto más rápido empuja la mano, más se inclina la cámara hacia adelante (lente más abierta, desenfoque radial, franjas de color).
- Lo que pasa demasiado rápido se ve como exposición larga (los días como bandas), nunca como estroboscopio.
- En los muros el ritmo se frena un poco: un respiro para mirar, no una parada.

## Sonido
- Opcional y apagado al empezar (**S**), generado en el navegador.
- **La potencia se oye:** la densidad del ambiente crece con log P. Pocas voces graves hoy; un coro inmenso y lento en lo cósmico.
- Cada obra tiene su firma (el golpe sordo de la catapulta, el siseo de vidrio del enjambre, el zumbido del ascensor).
- **El silencio de Fermi es silencio de verdad.** Una campana suave al llegar a cada momento; la última, el universo que nace.
- Ambiente, no música.

## Técnica (reglas del motor)
- Todo es función del progreso del scroll → pistas de la línea de tiempo. Reversible siempre. Teclas A, S, I, L.
- Pistas principales: `lp` (log₁₀ de la potencia en W), `ly` (log₁₀ de los años desde hoy), `lr` (log₁₀ del alcance en m), más las de cada obra.
- **Mundo multiescala** con la cadena de Espacio (doble precisión relativa a un pivote; marcos anidados: radios terrestres → UA → años luz → kiloparsecs → megaparsecs). Cada cuerpo es un grupo en sus propias unidades.
- **Obras persistentes** con dos niveles de detalle (faro o puntos de lejos; malla, instancias y sombreado de cerca), cada una con su animación ambiental aunque nadie la mire.
- GLSL: **nunca `pow()` con base negativa** (NaN en esta GPU, y el bloom lo esparce por el cuadro, que queda negro): usar `x * x`; `pow(0, y)` → `sqrt(max(x, 0.0))`.
- `logarithmicDepthBuffer: true` y, en los `ShaderMaterial` con profundidad, `logdepthbuf_pars_vertex/fragment` y `logdepthbuf_vertex/fragment`. Límite de profundidad de `materia.ts` ínfimo y `uSizeUnit` a la escala del mundo de cada nube.
- 60 fps en escritorio, workers para lo pesado, calidad adaptable, modo liviano en teléfonos, «reducir movimiento». Hoja de contactos que dibuja cada cuadro a mano (sin depender de `requestAnimationFrame`) y guarda en `docs/`.
