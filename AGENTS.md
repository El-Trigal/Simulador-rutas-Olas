# Instrucciones del proyecto

Esta app es un MVP local para simular rutas y capacidad de transporte en una finca productora de flor.

## Contexto

- Proyecto local: `C:\Users\HP\Desktop\prototipo app rutas\mvp-rutas`
- App web local servida con Node.
- Comando usual de ejecucion:
  ```powershell
  cd "C:\Users\HP\Desktop\prototipo app rutas\mvp-rutas"
  npm.cmd start
  ```
- URL local esperada: `http://127.0.0.1:5177/`

## Datos geograficos

- Los datos principales estan en GeoJSON.
- La app usa capas de bloques, cable via, vias de tractor, poscosechas, lagos y construcciones.
- El sistema de coordenadas del trabajo es MAGNA SIRGAS Bogota / EPSG:3116.

## Reglas operativas

- La simulacion debe tratar la jornada como restriccion fija, no como un tiempo libre que puede terminar antes o pasarse sin marcar problema.
- Horas semanales por defecto: `42`.
- Dias de trabajo por semana: `6`.
- Jornada efectiva diaria: `42 / 6 = 7 h`.
- Desayuno: `45 min` a las `11:00`, fuera de la jornada efectiva.
- Hora de inicio asumida para el reloj visual: `06:15`.

## Productos

- Productos actuales:
  - Pompon
  - Spider
  - Supermun
- Pompon siempre va a `Olas2`.
- Spider y Supermun siempre van a `Olas1`.

## Rendimientos de corte

- Pompon: `490 tallos/hora`.
- Spider: `450 tallos/hora`.
- Supermun: `450 tallos/hora`.

## Capacidades

- Cada balde lleva `150 tallos`.
- Garrucha:
  - Maximo `13` vagones.
  - Maximo `2` baldes por vagon.
  - Maximo `18` garruchas disponibles.
  - Maximo `9` garrucheros disponibles.
  - Cada garruchero trabaja con `2` garruchas.
  - Velocidad teorica base: `55 m/min`.
- Tractor:
  - Maximo `2` tractores/conductores.
  - Maximo `4` series de trailers.
  - Cada tractor/conductor trabaja con `2` series.
  - Cada serie tiene hasta `7` trailers.
  - Cada trailer lleva hasta `12` baldes.
  - Velocidad teorica base: `250 m/min`.

## Reglas de movimiento

- En cable via, dos garruchas no pueden ocupar el mismo tramo al mismo tiempo.
- El rendimiento operativo de cada garruchero es 2500 tallos/hora.
- Se asignan tantos garrucheros por bloque como requiera la demanda diaria.
- No existe un maximo de garrucheros por bloque; el unico limite es la disponibilidad global de 9 garrucheros en la finca.
- Si una garrucha ocupa un bloque, otra garrucha en movimiento no espera para atravesarlo: ese bloque se excluye temporalmente del grafo y se usa la ruta alternativa mas rapida.
- La espera por conflicto se conserva unicamente cuando dos garruchas intentan ocupar el mismo tramo fisico del cable via.
- En via de tractor, los tractores si pueden compartir tramo porque la via es doble sentido y doble carril.
- Dos garrucheros o conductores no pueden hacer maniobra dentro del mismo bloque al mismo tiempo.
- La maniobra dentro del bloque dura `5 min`.
- La descarga en poscosecha dura `5 min`.

## Ciclo real de garrucha o serie

El ciclo debe modelarse asi:

1. El operario lleva una garrucha o serie vacia desde poscosecha hasta el bloque.
2. Deja la vacia en el bloque para que la llenen.
3. Regresa sin garrucha o sin serie hasta poscosecha.
4. Luego vuelve con otra garrucha o serie vacia.
5. Antes de meter la vacia, saca la llena del bloque.
6. Deja la llena a un lado sin bloquear el camino.
7. Mete la vacia al bloque.
8. Toma la llena y la lleva a poscosecha.
9. Espera descarga.
10. Repite el ciclo.

## Visualizacion de simulacion

- La simulacion debe mostrar varios operarios/vehiculos, no un solo objeto por metodo.
- La velocidad maxima de reproduccion es 250x.
- El mapa debe mostrar la ruta planificada de todos los bloques seleccionados, incluso si un viaje queda sin servir.
- Los desvios calculados durante la simulacion deben mostrarse junto con las rutas planificadas.
- Etiquetas actuales:
  - `V`: lleva vacio.
  - `L`: lleva lleno.
  - `S`: vuelve solo, sin garrucha o serie.
  - `M`: maniobra/cambio en bloque.
  - `D`: desayuno.
  - `P`: parado/disponible.
- La garrucha o serie que queda en el bloque debe mostrarse con una barra:
  - Azul como fondo.
  - Verde como progreso de llenado.

## Objetivo del simulador

El simulador debe ayudar a calcular:

- Cantidad de vehiculos/equipos necesarios.
- Cantidad de viajes.
- Cantidad de operarios requeridos.
- Cortadores requeridos por bloque/producto.
- Tallos transportados por viaje y por hora.
- Gabela teorica de optimizacion.
- Casos donde la flota disponible no alcanza dentro de la jornada.

El objetivo futuro sera comparar el modelo teorico contra datos reales para evidenciar tiempos muertos y posibles ahorros operativos.

## Reglas tecnicas para edicion

- Mantener la app como MVP local simple.
- Evitar refactors grandes no pedidos.
- Validar `public/app.js` con:
  ```powershell
  node --check "C:\Users\HP\Desktop\prototipo app rutas\mvp-rutas\public\app.js"
  ```
- Si PowerShell bloquea `npm`, usar:
  ```powershell
  npm.cmd start
  ```
