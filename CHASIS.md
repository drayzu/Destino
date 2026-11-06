# Destino · el chasis

*Rama `sin-chispa` (worktree `civilizacion-chasis`). La versión publicada (`main`) no se toca hasta que Diego lo apruebe. El guion de cámara está en DIRECCION.md.*

## Por qué

Destino se rompía cada vez que se le agregaba algo. Las causas, en orden de descubrimiento:

1. **Doce películas pegadas**, cada una con su cámara, mezcladas en cada relevo y corregidas encima (4 nov: el chasis, un motor para toda la obra).
2. **Una cámara que perseguía a la chispa**: la causa de los giros bruscos y los temblores (4 nov: la cámara se grabó en claves).
3. **Una cámara que nadie decidió** y uniones que exigían que la chispa calzara entre dos escalas (5 nov: la dirección escrita).
4. **La chispa misma**: un punto chico que dobla esquinas obliga a la cámara a doblarlas (5 nov: Destino sin chispa; «tú eres el que viaja»).
5. **Nada avisaba** cuando algo aprobado se rompía (las revisiones, abajo).

## Las reglas de la casa

1. **Cada acto escribe su cámara, como en Tiempo** (`camara(p, guia, out)`): pocas claves de su propia línea de tiempo, por las que la película pasa con una curva suave. Nada persigue nada y nada corrige la cámara después.
2. **Tú eres el que viaja.** Donde se viaja, la cámara va en primera persona y dentro de las cosas (DIRECCION.md); la pausa también va adentro, nunca lejos mirando.
3. **Ningún acto conoce a sus vecinos.** Se unen por un mundo compartido (`mundo`: `entrada` sobre `salida`), por el cuadro (`cuadro`: la escala de `salida`/`entrada`, o lo que encuadran las cámaras) o por un corte bajo la tapa del anterior (`corte`). La revisión comprueba que la imagen sea la misma a ambos lados.
4. **Todo depende del compás.** Lo que respira o gira solo (el tiempo ambiente) nunca mueve la cámara.
5. **Lo que aparece se declara** (`presencias`, con un fundido mínimo) y lo que pasa junto al lente se desvanece (`LENTE` en los shaders de puntos) en lugar de cortarse o reventar en un destello.
6. **Los cambios al motor van separados de los de contenido.**

## Las cámaras (`chasis/toma.ts`, `chasis/primera.ts`)

- **`toma`**: la cámara orbita lo que mira (`cx, cy, cz`; `az`, `el`, `ld` = log10 de la distancia), corrida por `ox, oy, oz`; mira al centro o, con `pitch` y `yaw`, a otro lado (un horizonte); `roll`, `mx`, `my` y `fov`. Sobre un planeta, en el marco del suelo (`marcoRadial`).
- **`vuelo`**: primera persona por una curva leída por su largo (pista `vu`): mira adelante, hacia `cx…` tanto como `vm`, alzada `vh`; `nivel` gira la mirada como una cabeza (alrededor del «arriba», nunca por encima, donde la imagen gira); `arriba` para el suelo de un mundo.
- **`primeraPersona`** (`chasis/primera.ts`): primera persona por un camino que es función del compás (la guía del acto, `guia(p)`: el camino que hacía la chispa): mira adelante y cada mundo atrae la mirada por cercanía (`cerca`), como destino lejano con teleobjetivo (`destino`) o mientras se lo rodea, por reloj (`visita`); la mirada se promedia sobre un compás.
- **`mezclar`** pasa de una a otra (posición recta, mirada por slerp); **`escribir`**, tablas de claves (`TOMA_*`).

Se usan así: la mente y despierta son un solo `vuelo`; la apertura vuela entre los planetas con `vuelo`; la Tierra vuela sobre el mar con `vuelo`; el sistema solar y Mercurio, con `primeraPersona`; el resto, con `toma`.

## Dónde está cada cosa

Cada acto es una carpeta en `chasis/actos/<acto>/`:

- **`index.ts`**: el acto. Arriba, qué cuenta; dentro de `montar`, primero arma sus piezas, después **sus momentos** (desde `const tl = new Timeline()`: cada uno es `tl.label('…').caption(duración, 'Título', 'Texto')` seguido de lo que pasa en él y las claves de su cámara) y al final cómo se enciende cada pieza en cada cuadro (`update`).
- **`mundo.ts`**: de qué está hecho (datos, formas, shaders). Otros actos pueden usar sus piezas (despierta usa las luces de la Tierra).
- **`camara.ts`** (si la tiene): las tablas de cámara escritas (`TOMA_*`, `VUELO_*`).

El orden de los actos es la lista de `chasis/main.ts`. No hay chispa: lo que antes era su camino es la **guía** de cada acto (`guia(p)`), que nada dibuja; las tomas la siguen (`lw`) y lo que pasa junto a ella se enciende.

## Cambios comunes

- **Un texto**: su `caption` en el `index.ts` del acto.
- **Cuánto dura un momento**: el primer número de su `caption`; los momentos se encadenan, así que todo lo que viene después en ese acto se corre solo. Ojo con los tiempos fijos que quedan: la galaxia (`PB`, `P_TOCA`, `P_UNE`, `P_ROJO`) y el sistema solar (`T0`).
- **Un momento nuevo dentro de un acto**: otro `tl.label(…).caption(…)` donde corresponda, con sus claves de cámara.
- **Una escena nueva**: copiar `chasis/actos/plantilla.ts`, escribir su cámara (empieza y termina en un plano que la una con sus vecinas por un mundo o por el cuadro) y agregarla a la lista en `chasis/main.ts`. Las guardias dicen si la unión calza.
- **Quitar o mover un acto**: en la lista de `chasis/main.ts` (y revisar la costura que queda con las guardias).

## Antes de cada commit

```
npx tsc --noEmit -p .
node tools/guardias.mjs          # cámara (giros, saltos, tirones), presencias, costuras (dev server 5213)
node tools/destellos.mjs         # la imagen misma: nada aparece, se apaga ni destella de golpe
```

Para un cambio que no debe cambiar la imagen (ordenar código): `node tools/huella.mjs guardar antes.json` antes, `guardar despues.json` después y `comparar antes.json despues.json` (la cámara exacta y un cuadro cada medio compás; los cuadros 206 y 213,5 del Sol varían solos entre corridas). Si el servidor se queja de archivos que ya no existen tras mover archivos, reiniciarlo.

Para medir un tramo: `viaje.movimiento(a, b)`, `viaje.tirones(a, b)`, `viaje.contratos()`, `viaje.entradaDe(i)`, `viaje.trayecto(a, b)`. Las hojas de cuadros (`viaje.cuadro`) no incluyen la placa 2D (rótulos, la luz que llena el cuadro al final de la apertura).

## Estado (6 de noviembre)

- Sin chispa en toda la obra, y desde el 6 de noviembre tampoco en el motor ni en las guardias.
- Primera persona en la mente, despierta (la célula, la medusa, el cerebro, el salto a la Tierra), la Tierra (el mar y el cable), el sistema solar y Mercurio. La galaxia vuela entre sus encuentros por estrellas (campos en todas las escalas y corredores).
- Pendiente: tirones heredados en la galaxia (319, 331: la cámara cruza la galaxia muy cerca de lo que mira); publicar (main + Pages), el móvil, el sonido.
