# Destino · el chasis nuevo

*4 de noviembre de 2026. Rama `chasis` (worktree `civilizacion-chasis`). La versión publicada y la rama `remake` no se tocan hasta que esto la supere.*

## Por qué

Destino se rompía cada vez que se le agregaba algo. Había cuatro causas:

1. **Doce películas pegadas.** Cada acto tenía su propio mundo y su propia cámara, y en cada relevo se mezclaban dos cámaras. Encima había capas de corrección: la mezcla del relevo, el ajuste de la chispa entre dos cámaras y el encuadre medido al cargar. Si cambiabas el final de un acto, se movían el relevo siguiente, el ajuste y la tabla de encuadre.
2. **Lo que aparece depende de la distancia de la cámara**, con umbrales puestos a mano. Si la cámara se movía un poco, las cosas se encendían y se apagaban en otro momento.
3. **Temblores** por la precisión de la GPU cuando los objetos están lejos de su origen.
4. **Nada avisaba** cuando algo que ya estaba aprobado se rompía.

## Las reglas de la casa

1. **La cámara son claves, como en Tiempo** (`chasis/camaras.json`, leídas por `chasis/pista.ts`). La película pasa por ellas con la misma curva suave de las pistas de los actos. Nada persigue nada y nada corrige la cámara después. Cambiar una clave cambia la película solo entre sus dos vecinas.
2. **Los actos ponen el decorado, no la cámara.** La leen ya ubicada en sus propias unidades. Las pistas de rig que algunos actos conservan (`cx … fov`) ya no son la cámara: quedan solo donde el contenido las usa (por ejemplo, para ubicar «tú»).
3. **Una sola chispa.** Cada acto dice dónde está (`chispa(p)`, pura). La chispa ya no mueve la cámara.
4. **Costuras:** `chispa` (la cámara y la chispa son las mismas a ambos lados y fijan la escala), `mundo` (`entrada` sobre `salida`) o `corte` (solo bajo la tapa del acto anterior). En la costura solo se cruza la luz; la cámara no necesita nada, porque sus claves ya siguen de largo.
5. **Todo depende del compás.** Lo único que puede depender además del tiempo ambiente es el camino de la chispa en un mundo que gira solo (el anillo de la nave).
6. **Lo que aparece se declara** (`presencias`, con un fundido mínimo de `FUNDIDO_MIN`), y lo que pasa junto al lente se desvanece en lugar de cortarse (por ejemplo, los resplandores de las galaxias).
7. **Una sesión por obra.** Los cambios al motor van separados de los cambios de contenido.

## Cómo se edita la cámara

- **Un plano nuevo en un tramo:** `node tools/plano.mjs <acto> <desde> <hasta> --centro x,y,z --az … --el … --ld … [--az2 … --el2 … --ld2 … --centro2 …] [--fov …] [--mezcla 0.8]`. Usa compases dentro del acto y sus unidades. Se funde con la cámara de antes y después.
- **El horneado** (`tools/hornear.mjs`) se hizo una sola vez, desde la cámara vieja, el 4 de noviembre: limitó el giro a ~110 °/compás y mantuvo la chispa en cuadro donde la cámara la seguía. Las claves son ahora la fuente; no hace falta volver a hornear.

## Antes de cada commit

```
npx tsc --noEmit -p .
node tools/guardias.mjs          # cámara, chispa en cuadro, presencias, costuras (dev server 5213)
node tools/destellos.mjs         # la imagen misma: nada aparece, se apaga ni destella de golpe (unos minutos)
```

Para comparar con la referencia (la versión de antes, en `docs/chasis/referencia/`, fuera de git; se rehace desde la rama `remake` en 0de191a con el mismo comando contra su servidor):

```
node tools/referencia.mjs --desde 0 --hasta 74 --paso 0.25 --out docs/chasis/nuevo
node tools/comparar.mjs docs/chasis/referencia docs/chasis/nuevo docs/chasis/x.jpg 12 30 48
```

## Estado (4 de noviembre, fase 2 completa)

- **Toda la obra corre en el chasis** (la página del sitio, `index.html` → `chasis/main.ts`, 449 compases, 12 actos en `chasis/actos/`). La imagen es la misma que antes (hojas en `docs/chasis/cmp-*.jpg`).
- Costuras: mente → apertura, despierta → tierra y sistema → mercurio, por la **chispa** (sistema → mercurio es `continuo`); apertura → despierta, un **corte** bajo la luz de la estrella; las demás, por un **mundo** (la Tierra, Mercurio, el Sol, la vela, la galaxia…), la única mezcla de cámaras que queda, pura y en un solo lugar.
- Los actos con un seguimiento propio (el vuelo del sistema interior, la vuelta al Sol, la nave, la galaxia y el cosmos) lo dan con `rig()`. El motor les mantiene la chispa en cuadro con una rodilla suavizada en el tiempo, calculada para cada compás (sin tabla medida al cargar). Suelta la chispa donde cruza rápido o pasa junto a la cámara: sale de cuadro en los mismos compases que ya estaban aprobados (180–186, 269–274, 308–309, 332).
- Medido en toda la obra: el giro más brusco bajó de 403 a 275 °/compás. Los giros de más de 150 °/compás quedaron casi todos en despierta (la célula, 58–61), con 93 muestras contra 69 de antes.
- Lo que el motor ganó en el camino: `costura: 'mundo'` con `entrada`/`salida`; `continuo` y `saliente`; `rig(p, paseo, t)` para planos propios; `radial` para caminos sobre un planeta; la chispa y los planos reciben el tiempo ambiente (el anillo de la nave gira solo); `luz` y `titila` para la chispa; `relevoMaxPx`; las pistas del seguimiento con prefijo `m` (`mLd`, `mAlto`, …).
- Hecho (4 nov): los actos viejos, el banco de estudios y la página vieja del viaje se borraron; `index.html` carga el chasis (8 858 líneas menos, la imagen idéntica píxel a píxel). `estudios/` queda con lo compartido (motor de materia, rig, chispa, placa, etc.) y `viaje/` con el ritmo, la lámina y los textos.
- Pendiente (fase 3): publicar (main + Pages), el README, el móvil, el sonido.
- Hecho (4 nov): borrado también el código de la primera Destino (`src/actos`, `src/mundo`, `src/engine`, `prototypes/`). En `src/` quedan `i18n.ts`, `horizontes/` (los planetas) y `lib/` (lo usa el agujero negro).
- Pendiente: la precisión. Cada objeto que se ve de muy cerca debe tener su propio origen local, como `enTorno`.

## Estado (4 de noviembre, noche): la cámara horneada

- Toda la obra lee su cámara de claves (2 683, unos 320 KB). Se borraron el seguimiento de la chispa, sus suavizadores, los planos propios de los actos, el encuadre en vivo y la mezcla de cámaras en las costuras.
- Medido en toda la obra: el giro más brusco es de 130 °/compás (antes del chasis eran 403). Las revisiones no encuentran ningún salto ni tirón. La chispa sale de cuadro solo en 9 puntos sueltos (casi todos aprobados antes).
- `tools/destellos.mjs` (la imagen, cada 0,05 compases) encuentra seis lugares. Cuatro son destellos buscados (86.5, 87.6, 272.5 y 275, los estallidos de la burbuja). El de 396.9 (el resplandor de una galaxia que la cámara atraviesa) quedó arreglado. El de 319.85 (la cámara subiendo sobre el borde de la galaxia) ya existía igual en la versión vieja: revisar con Diego.
- La medusa (despierta 6.8–9.8) es ahora un plano: la campana entera desde afuera.

## La dirección escrita (5 de noviembre): el contrato y los planos

La cámara horneada copiaba la de antes, que perseguía a la chispa: miles de claves que nadie decidió. Cada acto pasa ahora a una dirección escrita, como en Tiempo, y a uniones que no lo atan a sus vecinos.

- **El plano** (`chasis/toma.ts`): la cámara orbita lo que mira (`cx…` o la chispa, tanto como `lw`), a `az`, `el` y `ld`; `mx`, `my` dicen dónde queda eso en la pantalla, y `roll`, `fov`. Son pistas de la línea de tiempo del acto. Mirando la chispa, la chispa está en cuadro por construcción: la cámara y la chispa son un solo plano. Un acto que escribe su cámara declara `camara(p, chispa, out) { toma(tl, p, chispa, out) }` y no necesita claves horneadas.
- **El contrato** (`costura: 'cuadro'`, `CONTRATO` en `toma.ts`): el primer y el último cuadro de un acto tienen la chispa en el mismo lugar de la pantalla (un grado bajo el centro) y el mismo lente (40°). El motor apoya una cámara sobre la otra, con giro incluido. Ningún acto conoce a sus vecinos: cualquier acto que cumpla el contrato puede ir antes o después de cualquier otro.
- **Una escena nueva:** copiar `chasis/actos/plantilla.ts`, escribirla cumpliendo el contrato al entrar y al salir, y agregarla a la lista en `chasis/main.ts`. Probado el 5 de noviembre: la plantilla entre la mente y la apertura, sin tocar a ninguna de las dos; la chispa pasa de una a otra sin moverse en la pantalla.
- **La chispa en reposo respira** (su corazón late lento), y el scroll la mueve con un resorte (sin tirones a cada paso de la rueda).
- `viaje.pantalla(a, b)`: la chispa en la pantalla, al píxel, para revisar temblores, frenazos y saltos.

Estado: **la apertura** es el piloto, ya escrita así (cámara en ~40 claves con intención en vez de las horneadas; giro máximo 81 °/compás; la chispa nunca sale de cuadro; arranca mientras la cámara baja a los planetas y descansa junto al último sistema). Pendiente: los otros once actos, y en la apertura la neblina de estrellas que se va de golpe en el compás 17,7 al salir del disco (ya estaba en la versión vieja).
