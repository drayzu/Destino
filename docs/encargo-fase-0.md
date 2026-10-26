# Encargo para la sesión que construye Despertar · fase 0

Copia este texto como primer mensaje de una sesión nueva (carpeta de trabajo: `E:\Proyectos\ChatGPT\civilizacion`).

---

Vas a construir **Despertar** (antes «Civilización»), la cuarta pieza de la serie *Escalas* de Diego (GitHub `drayzu`): un viaje inmersivo en un mundo abierto, desde la pregunta «¿hay alguien más?» hasta una civilización que crea un universo nuevo, con la escala de Kardashev como eje (la potencia en vatios es el exponente del HUD).

**Lee primero, enteros:**
1. `E:\Proyectos\ChatGPT\civilizacion\BRIEF.md`: la idea, las decisiones que ya tomó Diego (§ 2), los principios, el guion por actos, la interacción (viaje + explorar), la técnica, el rigor, las fases y lo que no hacer.
2. `docs/investigacion.md`: las cifras con sus fuentes.
3. El prototipo de la fase 0: `prototypes/sistema.html` (`npm run dev`, puerto 5197) y sus capturas en `docs/conceptos/` (sobre todo `sistema-estacion.jpg`). Recórrelo con **A**, prueba **E** (explorar) y pasa la estación del enjambre paso a paso con el scroll.
4. Tiempo, el pariente directo del motor: `E:\Proyectos\ChatGPT\tiempo\BIBLIA.md`, `ESTADO.md` y `src/engine/`.

**Tu tarea: terminar la fase 0 (§ 12 del brief).**
- Crea `BIBLIA.md` (dirección visual, a partir de §§ 4 y 5 del brief) y `ESTADO.md` (decisiones, cómo está hecho el prototipo, historial, siguiente paso). Inicializa el repo git local; no crees el remoto sin preguntarle a Diego (propuesta: `drayzu/Despertar`).
- Prepara los **estudios** de la fase 0 que lista § 12 del brief: un muro («El calor nos echa»), una segunda estación («Cómo se sostiene un ascensor espacial»), la apertura «¿Hay alguien más?» y «Dejar de ser materia». La gramática de Despertar es **el muro → la obra → la estación «Cómo funciona»** (§ 4, principio 2): Diego quiere que se entienda viéndolo, no solo que sea espectacular. La estación del enjambre del prototipo es la referencia.
- Revisa cada estudio con hojas de contactos antes de mostrarlo (las lecciones del prototipo en § 9 del brief te ahorran horas: nada de `pow()` con base negativa en GLSL, el límite de profundidad de `materia.ts`, la profundidad logarítmica).
- Muéstrale a Diego capturas y hazle las preguntas de § 14 del brief. Anota sus respuestas en `ESTADO.md`. La fase 1 (motor) empieza cuando Diego elija.

**Cómo trabajar con Diego:** escríbele en español, corto y claro. Va por lo visual: muéstrale capturas en lugar de describir. La inmersión en primera persona es la regla. Commits en Conventional Commits, en inglés, **sin atribución a Claude**.
