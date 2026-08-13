# CLAUDE.md

Guia de trabajo para este repositorio. `AGENTS.md` describe las **reglas de negocio**
(siguen siendo la fuente de verdad del dominio), pero su seccion de "Contexto" describe
un prototipo local en Windows que ya no corresponde a este repo. Para todo lo operativo
(como correr, donde vive el codigo, como validar) manda este archivo.

## Que es esto

Sitio **estatico puro** publicado en GitHub Pages que simula el transporte de flor
cortada desde los bloques de cultivo hasta las poscosechas de la finca El Trigal.
Calcula rutas sobre la red real de cable via y de vias de tractor, planifica la jornada
minuto a minuto con conflictos de recursos, y la reproduce como animacion sobre un mapa SVG.

- Sin build, sin bundler, sin dependencias, sin `package.json`.
- Sin backend. Todo corre en el navegador con ES modules nativos.
- La rama por defecto es **`gh-pages`** y es tambien la rama que se publica.
  `.nojekyll` evita que Jekyll procese el sitio.

## Como correr y validar

No hay `npm start`. Hace falta un servidor estatico porque `app.js` es un modulo ES y
carga GeoJSON con `fetch` (abrir `index.html` con `file://` falla por CORS).

```bash
python3 -m http.server 8080     # o: npx serve .
# luego http://127.0.0.1:8080/index.html
```

Validacion minima antes de commitear:

```bash
node --check app.js
```

No hay tests automatizados. Cualquier cambio a la simulacion se verifica a mano:
cargar la pagina, confirmar que `#dataStatus` muestra
`58 bloques, 2 poscosechas, 1005 tramos cable via, 146 tramos tractor`,
que `#routeSummary` deja de decir "Sin simulacion.", y que la consola no tiene errores.

## Mapa del codigo

| Archivo | Estado | Rol |
|---|---|---|
| `index.html` + `app.js` + `styles.css` | **activo** | La aplicacion. Es lo unico que se usa. |
| `data/*.geojson` | activo | Bloques, cable via, via de tractor, poscosechas. |
| `legacy-data/Lagos y Construcciones.geojson` | activo | Capa de fondo (lagos/construcciones). |

Ya no queda nada mas: `scheduler.js`, `tracking-dashboard.js` y el transmisor GPS
(`tracker.html` + `tracker.js` + `tracker.css`, con su CSS y sus capas SVG) se borraron
porque dependian de endpoints `/api/...` que no existen en un host estatico. El tracker
se servia publicado y roto. Todo esta en el historial de git si se retoma con backend.

`app.js` es un unico archivo de ~3050 lineas sin modulos internos. Secciones, en orden:

1. **Constantes de dominio** (1-80): capacidades, jornada, rendimientos, productos y
   `CONTROL_LIMITS`.
2. **Geometria y GeoJSON** (167-500): centroides, poligonos, interseccion segmento/bloque.
3. **Construccion del grafo** (502-690): parte los tramos en sus intersecciones y arma
   nodos/aristas. `graphFromSegments` (638) corre una sola vez al cargar.
4. **Ruteo** (693-995): `calculateRoute` (753) engancha origen y destino a la red y corre
   `dijkstra` (896). Soporta excluir bloques (`blockedBlockIds`) para calcular desvios.
5. **Render del mapa y de la animacion** (1027-1600).
6. **Plan del dia y demanda** (1616-1930): filas de bloque/flor, reparto semanal vs diario.
7. **Motor de simulacion** (2030-2700): `simulateDailyPlanMethod` (2184) es el corazon.
   Adentro, `scheduleWith` es un greedy que asigna operarios a bloques respetando
   reservas de tramo, de maniobra y de ocupacion de bloque. `nextRouteStart` (2077) es el
   punto caliente.
8. **Render de resultados y arranque** (2707-3059).

Las lineas son orientativas: sirven para ubicarse, no para citar.

### Flujo principal

`init()` (3045) -> `loadData()` -> `calculateSimulation()` (2851), que es tambien el
handler de **cada** cambio en los controles. `calculateSimulation` arma el plan, llama
`simulateDailyPlanMethod` por metodo (garruchas y/o tractor), calcula el plan de
cortadores, dibuja rutas y prepara la reproduccion.

## Reglas de dominio

Estan en `AGENTS.md` y siguen vigentes. Los limites de los controles tienen **una sola
fuente en el codigo**: la tabla `CONTROL_LIMITS`, de la que salen tanto los atributos
`min`/`max`/`step`/`value` del DOM (`applyControlLimits`, llamada desde `init`) como el
recorte al leerlos (`readControl`). Los inputs de `index.html` van sin esos atributos a
proposito: ponerlos ahi volveria a duplicar la regla.

Para cambiar "maximo 9 garrucheros" basta editar `simGarruchas` en `CONTROL_LIMITS` (y la
prosa de `AGENTS.md`, que sigue siendo la referencia de negocio).

Constantes que solo viven en `app.js` (1-60): `BLOCK_MINUTES`, `POST_MINUTES`,
`WORK_DAYS_PER_WEEK`, `GARRUCHERO_STEMS_PER_HOUR`, `WORK_START_MINUTES`,
`BREAK_START_CLOCK_MINUTES`, `BREAK_DURATION_MINUTES`, `FLOWER_CONFIGS`.

### Tiempo: "work minutes" vs "wall minutes"

Distincion facil de romper. El motor razona en **minutos de trabajo** (el desayuno no
existe); la UI muestra **minutos de reloj** (el desayuno de 45 min a las 11:00 si cuenta,
y el dia arranca 06:15). La conversion es `workToWallStart` / `workToWallEnd` /
`wallToWorkMinutes` (`app.js:1997-2009`). Antes de comparar dos tiempos hay que
confirmar que estan en la misma escala.

## Trampas conocidas

- **Un recalculo completo cuesta ~120-240 ms con garruchas** (plan de 4-12 bloques,
  Chromium); el tractor es un orden de magnitud mas barato. Los eventos `input` pasan por
  `scheduleSimulation` (debounce de 150 ms), asi que al teclear se agrupa; los clics y los
  `change` llaman `calculateSimulation` directo. **Al agregar un control nuevo,
  engancharlo a `scheduleSimulation` si es de teclear.**
- **El punto caliente es `nextRouteStart`, no el ruteo.** Es contraintuitivo y ya costo
  una optimizacion equivocada, asi que conviene dejarlo escrito: en un recalculo tibio
  `dijkstra` es el 0,2% del tiempo, porque el cache local de `simulateDailyPlanMethod`
  reduce el ruteo a ~16 busquedas por recalculo. Subir ese cache a nivel de modulo se
  probo y **no mejora nada medible**; no vale la pena reintentarlo. El costo real esta en
  que `nextRouteStart` se llama ~13.600 veces por recalculo desde el greedy de
  `scheduleWith`, multiplicado por las ~30 llamadas del binary search de
  `findCutterMultiplier`. Ya usa cursores que solo avanzan (aprovechando que `start` solo
  crece y que las reservas estan ordenadas por inicio); sigue siendo el ~30% del tiempo.
  Bajarlo mas exige reducir el numero de llamadas, es decir tocar el greedy. **Si vas a
  optimizar, perfila un solo recalculo primero: el perfil de varios seguidos enganna.**
- **`isBlock46` (`app.js:709`)** es un caso especial cableado para el bloque "46" sin
  explicacion. Al tocar el enganche a la red, tenerlo presente.
- **Todo el repo es ASCII estricto**, sin tildes ni enies, aunque los archivos declaran
  UTF-8. Es la convencion vigente; respetarla al editar texto visible.
- `renderCutterSummaryCard` y `renderMethodCard` usan `innerHTML` con etiquetas de bloque
  que vienen del GeoJSON. Hoy el dato es propio y confiable; preferir `textContent` en
  codigo nuevo.

## Convenciones

- Espanol en identificadores de dominio (`garruchero`, `bloque`, `poscosecha`, `tallos`)
  e ingles en los tecnicos (`route`, `schedule`, `network`). Mantener la mezcla existente.
- Indentacion de 2 espacios, comillas dobles, punto y coma. Sin linter configurado.
- SVG: el eje Y del mundo se invierte al dibujar (`y = -point[1]`). Siempre.
- Mantener el proyecto como MVP estatico. Evitar refactors grandes no pedidos y no
  introducir dependencias ni pasos de build sin que se pidan explicitamente.

## Git

Rama por defecto y de publicacion: `gh-pages`. Un merge ahi es un deploy inmediato a
GitHub Pages, asi que no se pushea a `gh-pages` sin pedirlo. Trabajar en ramas aparte.
