# Planetas en puntitos

El diseño que Diego eligió el 27 de octubre de 2026 para todos los planetas: el planeta como una nube de puntos, como en Espacio y Tiempo, coloreada con mapas reales. Debajo lleva la foto tratada y tenue, y cerca de la cámara aparecen puntos cada vez más finos. Se decidió en el estudio `prototypes/estudios.html?m=planetas&s=3` (capturas: `docs/estudios/planetas.jpg`, `docs/estudios/planetas-cerca.jpg`).

Hoy vive en un repo privado y común a la serie, **drayzu/horizontes-cuerpos**, junto con el Sol, los gigantes y los anillos de Saturno. Allí están la receta completa (`docs/receta.md`), el estudio de todos los cuerpos y la herramienta de copia. Destino lleva una copia en `src/horizontes/`, que no se edita aquí:

```bash
node ../horizontes-cuerpos/tools/copiar.mjs . --cuerpos tierra,luna,mercurio,venus,marte
```

Lo propio de Destino en cada planeta va en el GLSL de su superficie, en `src/mundo/`: el foso y las fábricas de Mercurio (`obras.ts`), el verde de Marte y la sombra del parasol sobre Venus (`planetas.ts`).
