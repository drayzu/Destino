# Destino · el chasis

*Rama `chasis` (worktree `civilizacion-chasis`). La versión publicada (`main`) no se toca hasta que Diego lo apruebe.*

## Por qué

Destino se rompía cada vez que se le agregaba algo. Las causas, en orden de descubrimiento:

1. **Doce películas pegadas**, cada una con su cámara, mezcladas en cada relevo y corregidas encima (4 nov: el chasis, un motor para toda la obra).
2. **Una cámara que perseguía a la chispa**: la causa de los giros bruscos y los temblores (4 nov: la cámara se grabó en 2 683 claves).
3. **Una cámara que nadie decidió**: esas claves copiaban la persecución, con sus mañas; y cada unión exigía que la chispa y el mundo calzaran exacto entre dos escalas (5 nov: la dirección escrita y el contrato, abajo).
4. **Nada avisaba** cuando algo que ya estaba aprobado se rompía (las revisiones, abajo).

## Las reglas de la casa

1. **Cada acto escribe su cámara, como en Tiempo** (`camara(p, chispa, out)`, con `toma` de `chasis/toma.ts`): pocas claves de su propia línea de tiempo, por las que la película pasa con una curva suave. Nada persigue nada y nada corrige la cámara después. Cambiar una clave cambia la película solo entre sus dos vecinas.
2. **La chispa y la cámara son un solo plano.** Donde la cámara mira la chispa (`lw`), la chispa está en cuadro por construcción.
3. **Ningún acto conoce a sus vecinos.** Se unen por el contrato (`costura: 'cuadro'`) o por un mundo compartido (`mundo`, `entrada` sobre `salida`), y la revisión comprueba que la imagen sea la misma a ambos lados. Un corte (`corte`) va solo bajo la tapa del acto anterior.
4. **Todo depende del compás.** Lo único que puede depender además del tiempo ambiente es el camino de la chispa en un mundo que gira solo (el anillo de la nave), y se suelta de ese giro antes de una unión.
5. **Lo que aparece se declara** (`presencias`, con un fundido mínimo de `FUNDIDO_MIN`), y lo que pasa junto al lente se desvanece en lugar de cortarse.
6. **Los cambios al motor van separados de los de contenido.**

## El plano (`chasis/toma.ts`)

- La cámara orbita lo que mira: el punto `cx, cy, cz`, o la chispa tanto como `lw` (0..1), a azimut `az`, elevación `el` (grados) y distancia 10^`ld`; corrida por `ox, oy, oz`.
- Desde ahí mira al centro (por defecto) o a otro lado con `pitch` y `yaw` (por ejemplo, el horizonte de un mundo); `roll` gira el horizonte.
- `mx`, `my`: dónde queda lo que mira en la pantalla (grados a la derecha y arriba del centro); `fov`, el lente.
- Sobre un planeta, el plano se escribe en el sistema del suelo bajo la chispa (`marcoRadial`), y `detras` escribe las claves de un vuelo detrás de la chispa a partir del rumbo de su camino. `aMarco` pasa un plano de un sistema a otro sin mover la cámara. `mezclar` va de un plano escrito a otro.
- `escribir(tl, filas)` pone en un acto una tabla de claves (p, az, el, ld, lw, mx, my, fov, roll y, si hace falta, cx, cy, cz). Las tablas de los actos (`TOMA_*`) salieron de transcribir la cámara grabada (`viaje.transcribir`), y se editan a mano.

## Las uniones

- **El contrato** (`costura: 'cuadro'`, `CONTRATO`): el primer y el último cuadro de un acto tienen la chispa un grado bajo el centro, con un lente de 40°. El motor apoya una cámara sobre la otra, con giro incluido. La mente, la apertura, despierta, tierra, el sistema y Mercurio se unen así.
- **Un mundo compartido** (`mundo`): la Tierra, el Sol, la vela, la galaxia y la estrella. La primera clave de un acto es la última imagen del anterior en sus unidades (`viaje.entradaDe(i)`), y su chispa entra donde la dejó el anterior y se une a su camino en uno o dos compases.

## Una escena nueva

Copiar `chasis/actos/plantilla.ts`, escribirla cumpliendo el contrato al entrar y al salir, y agregarla a la lista en `chasis/main.ts`. Probado el 5 de noviembre: la plantilla entre la mente y la apertura, sin tocar a ninguna de las dos; la chispa pasó de una a otra sin moverse en la pantalla.

## Antes de cada commit

```
npx tsc --noEmit -p .
node tools/guardias.mjs          # cámara, chispa en cuadro, presencias, costuras y contrato (dev server 5213)
node tools/destellos.mjs         # la imagen misma: nada aparece, se apaga ni destella de golpe (unos minutos)
```

Para medir un tramo: `viaje.pantalla(a, b)` (la chispa en la pantalla, al píxel), `viaje.movimiento(a, b)` (la cámara), `viaje.contratos()` (las uniones). Para comparar con la versión de antes (`docs/chasis/referencia/`, fuera de git):

```
node tools/referencia.mjs --desde 0 --hasta 74 --paso 0.25 --out docs/chasis/nuevo
node tools/comparar.mjs docs/chasis/referencia docs/chasis/nuevo docs/chasis/x.jpg 12 30 48
```

## Estado (5 de noviembre)

- **Los doce actos escriben su cámara.** Ya no hay claves grabadas (`camaras.json` y las herramientas que lo editaban se borraron).
- Medido en toda la obra: el giro más brusco es de 108 °/compás (antes del chasis, 403; con la cámara grabada, 130). La chispa nunca sale de cuadro donde la cámara la mira. Las once uniones cumplen: la chispa ya no salta, aparece ni se apaga en ninguna (antes lo hacía en cinco).
- El scroll mueve la película con un resorte (sin tirones a cada paso de la rueda), la estela crece sin saltos y la chispa en reposo respira.
- Composición, no error: en algunas escenas cuyo protagonista es otro (el planeta colonizado, el cúmulo rojo, las burbujas de galaxias, la red del agujero negro) la cámara no mira la chispa y esta puede quedar fuera de cuadro, como antes.
- Pendiente: la neblina de estrellas que se va de golpe en el compás 17,7 al salir del disco (ya estaba en la versión vieja); publicar (main + Pages), el README, el móvil, el sonido; la precisión de objetos vistos muy de cerca (orígenes locales, como `enTorno`).
