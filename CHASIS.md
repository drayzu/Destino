# Destino · el chasis nuevo

*4 de noviembre de 2026. Rama `chasis` (worktree `civilizacion-chasis`). La versión publicada y la rama `remake` no se tocan hasta que esto la supere.*

## Por qué

Destino se rompía cada vez que se le agregaba algo. Había cuatro causas:

1. **Doce películas pegadas.** Cada acto tenía su propio mundo y su propia cámara, y en cada relevo se mezclaban dos cámaras. Encima había capas de corrección: la mezcla del relevo, el ajuste de la chispa entre dos cámaras y el encuadre medido al cargar. Si cambiabas el final de un acto, se movían el relevo siguiente, el ajuste y la tabla de encuadre.
2. **Lo que aparece depende de la distancia de la cámara**, con umbrales puestos a mano. Si la cámara se movía un poco, las cosas se encendían y se apagaban en otro momento.
3. **Temblores** por la precisión de la GPU cuando los objetos están lejos de su origen.
4. **Nada avisaba** cuando algo que ya estaba aprobado se rompía.

## Las reglas de la casa

1. **Una sola cámara, la de la película** (`chasis/pelicula.ts`). Los actos no la tocan: ponen el decorado y la leen ya ubicada en sus propias unidades.
2. **Una sola chispa.** Cada acto dice dónde está la chispa en sus unidades (`chispa(p)`). En una costura, el motor ubica el mundo del acto siguiente de modo que su chispa empiece exactamente donde termina la del anterior, a la misma distancia de la cámara. Por eso la cámara simplemente sigue de largo: no hay nada que mezclar.
3. **La cámara sigue la chispa** (`lw` = 1) o se queda en su rig (`lw` = 0). El seguimiento suaviza el camino de la chispa según su largo, no según el compás, así que los vuelos rápidos y los paseos lentos se sienten igual. La chispa queda dentro del cuadro por construcción.
4. **Todo depende solo del compás.** El mismo compás da la misma imagen, llegues desde antes, desde después o directamente. No se mide nada mientras la película corre.
5. **Costuras:** `chispa` (por defecto) o `corte`. Un corte solo es válido bajo la tapa del acto anterior (su luz llenando el cuadro).
6. **Lo que se muestra se declara.** Cada acto nombra sus `presencias` (pistas de 0 a 1), y nada entra ni sale en menos de `FUNDIDO_MIN` compases.
7. **Ojo con `tl.set`:** las pistas fluyen entre claves. Un valor puesto lejos del anterior se desliza durante todo el tramo. Para cambiar los parámetros del seguimiento, primero se fija el valor viejo y después el nuevo (`keyAt`), y solo mientras la cámara está en su rig.
8. **Una sesión por obra.** Los cambios al motor van separados de los cambios de contenido.

## Las pistas que lee la cámara

| Pista | Qué es |
|---|---|
| `cx cy cz az el ld ox oy oz yaw pitch roll fov` | el rig (`estudios/rig.ts`) |
| `lw` | cuánto sigue a la chispa (0..1) |
| `ldm` | a qué distancia detrás de la chispa (log10, unidades del acto) |
| `alto` | cuánto más arriba que el camino (grados) |
| `ade` | cuánto mira por delante de la chispa (fracción de la distancia) |
| `suave`, `suaveMira` | cuánto camino promedia el lugar y la mirada (en distancias; 2,5 y 1 por defecto) |
| `on`, `tit` | la luz de la chispa y su parpadeo |

## Antes de cada commit

```
npx tsc --noEmit -p .
node tools/guardias.mjs          # cámara, chispa en cuadro, presencias, costuras (dev server 5213)
```

Para comparar con la referencia (la versión de antes, en `docs/chasis/referencia/`, fuera de git; se rehace desde la rama `remake` en 0de191a con el mismo comando contra su servidor):

```
node tools/referencia.mjs --puerto 5213 --ruta chasis/index.html --desde 0 --hasta 74 --paso 0.25 --out docs/chasis/nuevo
node tools/comparar.mjs docs/chasis/referencia docs/chasis/nuevo docs/chasis/x.jpg 12 30 48
```

## Estado (fase 1)

- Portados: `mente`, `apertura` y `despierta` (`chasis/actos/`), compases 0–74. La página es `chasis/index.html`.
- La costura mente → apertura es continua por construcción. Apertura → despierta es un corte bajo la luz de la estrella.
- El giro de la galaxia (`giro`) se quitó: la galaxia giraba junto con la cámara, así que en pantalla no se veía nada.
- Pendiente: las mezclas entre rig y seguimiento donde el rig queda delante de la chispa mirándola (despierta 64–67 y la célula 58–61) giran rápido. Hay que arreglarlas en la coreografía, no en el motor.
- Pendiente: la precisión. La cámara no está en el origen; three.js compone las matrices en doble precisión. Lo que falta es que cada objeto que se ve de muy cerca tenga su propio origen local, como ya hace `enTorno`.
