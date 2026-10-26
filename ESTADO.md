# Destino · estado

## Dónde estamos
**Fase 0 · Dirección.** El plan nuevo («Destino», tercera obra de Horizontes) está aprobado. Faltan los estudios de estilo para que Diego elija: el muro, la apertura y «Dejar de ser materia». La fase 1 (motor) empieza cuando elija.

## Decisiones
- **26 de octubre de 2026 · plan nuevo.** Despertar pasa a llamarse **Destino** y se rehace con el formato de Espacio y Tiempo: un solo viaje con scroll de ~10–12 minutos, teclas A/S/I/L, lámina opcional; sin modo explorar y sin estaciones. Se mantienen el muro → la obra y la galaxia de las posibilidades. La simulación, lo computable y los multiversos pasan a Infinito. Termina creando un universo y pasándole el relevo a Infinito. Detalle en `BRIEF.md` § 2.
- **26 de octubre · al aprobar el brief:**
  - Sin enlace al Atlas en cada momento. El Atlas se alcanza desde la lámina (rótulos enlazados a su ficha) y desde un solo enlace al final; el Atlas enlaza de vuelta a Destino.
  - En el acto 0, el reloj muestra la galaxia sin usar (~10³⁷ W, «tipo —»).
  - En el acto I, el reloj cuenta los vatios de pensar (célula → cerebro → todos los cerebros → las máquinas → hoy).
- **26 de octubre · estilos de la fase 0 (Diego):**
  - Muro «El calor nos echa»: **manera 1**, la Tierra que se tiñe del color de su calor (infrarrojo detrás de una cortina).
  - Apertura «¿Hay alguien más?»: **manera 3, Escuchar** (nuestra burbuja de radio de 100 años luz contra la galaxia, y lo poco que hemos escuchado).
  - «Dejar de ser materia»: **una mezcla**. Le gusta la red neuronal de las maneras 1 y 2, y de la 3 le gustan mucho los cuadros (bits) que se encienden y apagan cuando la cámara entra: «es inmersivo, súper cool». La versión elegida une las dos: entrar entre los bits y que de ellos nazca la red.
- Pendiente: confirmar repo y URL (`drayzu/Destino` → drayzu.github.io/Destino) antes de crear el remoto.

## Los estudios de la fase 0
`npm run dev` (puerto 5197) → `prototypes/estudios.html?m=<momento>&s=<manera>`. Capturas en `docs/estudios/`.

| Estudio | Estado con el plan nuevo |
|---|---|
| Muro «El calor nos echa» (`?m=muro`, 3 maneras) | Sigue valiendo. Por elegir. |
| Ascensor (`?m=ascensor`) | Hecho como estación paso a paso, formato que ya no va. Su subida y su dibujo de fuerzas sirven como la escena del ascensor con la lámina encendida. No necesita elección. |
| Apertura «¿Hay alguien más?» (`?m=apertura`, 3 maneras: Dentro, Desde fuera, Escuchar) | Terminada con el nombre Destino. El reloj muestra la potencia que hay y nadie usa (10³⁷ W, «tipo —», escalera vacía con un anillo hueco) y en la caída baja con lo que se ve: el Sol (10²⁶), la luz en la Tierra (10¹⁷), nosotros (10¹³, ahí se llena la escalera). Zona habitable rotulada. Resumen: `docs/estudios/resumen-apertura.jpg`. Por elegir. |
| «Dejar de ser materia» (`?m=mente`, 3 maneras: Capas, Reordenar, Calor) | Hecho, sin simulación. Un cerebro Matrioshka con un corte; «El frío piensa más» (10⁴⁷ → 10⁴⁹ operaciones/s); la materia se vuelve lámina viva; muro «el frío» con un termómetro hasta 2,7 K. Resumen: `docs/estudios/resumen-mente.jpg`. Por elegir. |

## Historial
- **26 de octubre de 2026 · planificación (como «Despertar»):** brief, investigación (`docs/investigacion.md`), prototipo del sistema solar (`prototypes/sistema.html`) con su estación del enjambre y modo explorar.
- **26 de octubre · fase 0 (como «Despertar»):** página de estudios; el muro en tres maneras; la estación del ascensor; la apertura en tres maneras (en curso).
- **26 de octubre · plan nuevo:** brief y biblia reescritos como Destino; este documento.
- **26 de octubre · fase 0 con el plan nuevo:** la apertura terminada como Destino (reloj de la potencia sin usar: `hudLibre` y `escalera(…, vacia)` en `placa.ts`, `libre` en `estudios/tipos.ts`); «Dejar de ser materia» en tres maneras (`estudios/mente.ts`).

## Siguiente paso
Diego elige el estilo del muro, la apertura y «Dejar de ser materia» (resúmenes en `docs/estudios/resumen-*.jpg`); anotarlo aquí y en `BIBLIA.md` («Estilo elegido»). Después, la fase 1 (motor).
