# Planetas en puntitos · la receta

El diseño que Diego eligió el 27 de octubre de 2026 para todos los planetas de Destino: el planeta como una nube de puntos, como en Espacio y Tiempo, coloreada con mapas reales. Se decidió en el estudio `prototypes/estudios.html?m=planetas&s=3` (capturas: `docs/estudios/planetas.jpg`, `docs/estudios/planetas-cerca.jpg`). Lo descartado: la foto tratada sola (manera 1) y el color procedural suave (manera 2).

Código: `src/mundo/planeta-puntos.ts`. Solo depende de three.js y de `materia` (`src/engine/materia.ts`, la misma partícula de Potencias, Tiempo y Espacio).

## Las tres capas
1. **Puntos globales.** Una esfera de Fibonacci, cada punto movido al azar dentro de su celda (sin eso, sus espirales se ven como rayado). El color se lee del mapa en la CPU. El tamaño es `4,76 / √N` radios, con ±35 %, para que la esfera quede igual de cubierta y de brillante con cualquier cantidad. Con mapa de nubes, una segunda capa de puntos a 1,01 donde está nublado.
2. **La foto, tratada y tenue, debajo** (brillo 0,2, radio 0,994–0,997). Los huecos entre puntos se leen como suelo y no como agujeros, y tapa lo que hay detrás del planeta.
3. **Un parche de puntos cada vez más finos bajo la cámara** (clipmaps de puntos). El nivel L tiene puntos cada `S0 / 2^L` radianes (`S0 = 0,0049`, 9 niveles) en una ventana de 2·80 × 2·80 celdas. Cada punto vive en una celda fija de una grilla latitud–longitud de su nivel: al mover la cámara los puntos no se deslizan, la ventana avanza por celdas enteras y se desvanece en su borde. Cada nivel deja un hueco donde se enciende el siguiente. La altura de la cámara elige el nivel: entre punto y punto, en el suelo, cerca del 0,45 % de la altura. El tamaño de cada punto es 0,8 de su separación. Todos los planetas comparten una sola geometría del parche.

## El tratamiento (igual para todos)
- `grado`: color apagado (60 % de saturación), `pow 1,3`, un poco frío (× 0,9 · 0,96 · 1,04).
- `luzSol`: con aire (`aire = 1`), el paso del día a la noche es suave (`smoothstep(−0,14, 0,42)`); en roca (`aire = 0`) es seco (`smoothstep(−0,02, 0,22)`) y el relieve sale del sombreado del propio mapa (`relieve`).
- Luz del punto: `grado(albedo) · (luz · 0,9 + 0,003)`.
- En la foto de abajo, además, el aire dentro del borde: azul de día y una franja tibia en el terminador.
- Brillo del Sol en el mar (`mar`: los píxeles azules del mapa).
- Halo fuera del borde (`halo`): una esfera un poco mayor, solo su mitad trasera, que brilla de canto del lado del día.

## Lo propio de cada planeta
Lo que la civilización le hace a un planeta es un trozo de GLSL, `superficie.glsl`. Corre en cada punto (las dos capas de puntos) y en cada píxel de la foto. Puede cambiar el color (`alb`), la normal que ilumina el Sol (`nn`), cuánta luz llega (`sombra`) y sumar luz propia (`extra`). `paso` es la separación entre puntos en ese lugar. Para que una línea fina se lea igual de cerca y de lejos, se dibuja con ancho `max(ancho, paso)` y se atenúa por `ancho / paso`. Ejemplos en Destino:
- **Mercurio** (`obras.ts`): el foso escalonado, la red de fábricas, los nudos y chispas de luz, el frente donde cortan.
- **Marte** (`planetas.ts`): el verde y el agua que avanzan desde lo bajo, la línea de luz del frente, el casquete sur que se derrite.
- **Venus** (`planetas.ts`): la sombra del parasol que barre el disco. Sus nubes giran, así que el planeta va dentro de un grupo que rota.

## Mapas
Solar System Scope, https://www.solarsystemscope.com/textures/ (CC BY 4.0, de datos de la NASA). Destino usa los de 2K: `2k_earth_daymap`, `2k_earth_clouds`, `2k_mercury`, `2k_moon`, `2k_mars`, `2k_venus_atmosphere`. Para acercamientos al suelo convienen los de 8K reducidos a 4K (bajarlos requiere el sí de Diego). Los créditos van en `public/texturas/CREDITOS.md`.

Convención de coordenadas: norte en +Y, longitud 0 en +X y el este hacia −Z (la de `esfera` en `tierra.ts`). Así, lo que se ubica por latitud y longitud (ciudades, cúpulas) cae sobre el mapa real.

## Cantidades en Destino
Tierra 520 000 (+ nubes), Mercurio 420 000, Marte 360 000, Luna 320 000, Venus 300 000. El parche suma 230 000 por planeta, encendido solo cerca. Los planetas lejanos se ocultan y los reemplaza un faro.

## Llevarlo a otro proyecto (Espacio, Tiempo, Potencias…)
1. Copiar `src/mundo/planeta-puntos.ts`. Su `materia` debe tener `move` (GLSL sobre `p`, `em`, `sz`), `uGain`, `uSizeUnit` y `uSpread`, como la de `src/engine/materia.ts`.
2. Copiar los mapas a `public/texturas/` con sus créditos.
3. `const p = planetaPuntos({ mapa, aire, … })`. Agregar `p.group` al marco del planeta, escalado a su radio y girado con él. Cuando `p.listo` se cumpla, sumar `p.nubes` a las nubes que se enfocan cada cuadro (`enfocar`, `uSizeUnit` = escala del grupo en el mundo).
4. Cada cuadro, `p.update(solLocal, camaraLocal, presencia)`, con el Sol y la cámara en el marco del planeta, en radios.
5. Las nubes del planeta no deben taparse a sí mismas: excluirlas de su propio oclusor (`uOcc`).
