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
| `mLd` | a qué distancia detrás de la chispa (log10, unidades del acto) |
| `mAlto` | cuánto más arriba que el camino (grados) |
| `mAde` | cuánto mira por delante de la chispa (fracción de la distancia) |
| `mSuave`, `mSuaveMira` | cuánto camino promedia el lugar y la mirada (en distancias; 2,5 y 1 por defecto) |
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

## Estado (4 de noviembre, fase 2 completa)

- **Toda la obra corre en el chasis** (`chasis/index.html`, 449 compases, 12 actos en `chasis/actos/`). La imagen es la misma que antes (hojas en `docs/chasis/cmp-*.jpg`).
- Costuras: mente → apertura, despierta → tierra y sistema → mercurio, por la **chispa** (sistema → mercurio es `continuo`); apertura → despierta, un **corte** bajo la luz de la estrella; las demás, por un **mundo** (la Tierra, Mercurio, el Sol, la vela, la galaxia…), la única mezcla de cámaras que queda, pura y en un solo lugar.
- Los actos con un seguimiento propio (el vuelo del sistema interior, la vuelta al Sol, la nave, la galaxia y el cosmos) lo dan con `rig()`. El motor les mantiene la chispa en cuadro con una rodilla suavizada en el tiempo, calculada para cada compás (sin tabla medida al cargar). Suelta la chispa donde cruza rápido o pasa junto a la cámara: sale de cuadro en los mismos compases que ya estaban aprobados (180–186, 269–274, 308–309, 332).
- Medido en toda la obra: el giro más brusco bajó de 403 a 275 °/compás. Los giros de más de 150 °/compás quedaron casi todos en despierta (la célula, 58–61), con 93 muestras contra 69 de antes.
- Lo que el motor ganó en el camino: `costura: 'mundo'` con `entrada`/`salida`; `continuo` y `saliente`; `rig(p, paseo, t)` para planos propios; `radial` para caminos sobre un planeta; la chispa y los planos reciben el tiempo ambiente (el anillo de la nave gira solo); `luz` y `titila` para la chispa; `relevoMaxPx`; las pistas del seguimiento con prefijo `m` (`mLd`, `mAlto`, …).
- Pendiente (fase 3): quitar los actos viejos de `estudios/` y `viaje/`, que ahora están duplicados; que `chasis/` sea la página publicada (`index.html` del sitio, README); el móvil; el sonido.
- Pendiente: la precisión. Cada objeto que se ve de muy cerca debe tener su propio origen local, como `enTorno`.
