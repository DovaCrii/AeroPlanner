# MASTER_PLAN — AeroPlanner

> **Fuente única de verdad del trabajo pendiente.** Consolida el análisis de
> alternativas open source y el contraste contra el repositorio real de
> AeroControl en un tablero ejecutable con seguimiento de estado.
> **Creado:** 2026-08-17 · **Actualizado:** 2026-08-17 (auditorías de Fase 0)
> **Rama base:** `main`
> **Regla de oro:** cada fase termina en algo **usable en terreno**. No se abre
> una fase nueva con la anterior a medio cerrar, y no se agrega alcance fuera de
> lo listado aquí sin que el usuario lo pida.

---

## Por dónde se empieza

**Fases 0 y 1 cerradas**, salvo `F0.9`. La aplicación levanta sin ningún token,
el motor fotogramétrico existe y la grilla se calcula por traslape.

**`F0.9` es la prioridad y no se puede automatizar:** verificar que el KMZ que
genera la aplicación lo acepte el control real de la flota. Es el único riesgo
que todavía puede invalidar la premisa de haber partido de este código.

En paralelo se avanza la **Fase 2 (corredores)**. `F0.8` y la Fase 6 salieron del
alcance por falta de hardware de procesamiento — ver la nota bajo `F0.8`.

---

## FASE 0 — Incorporar y auditar

**Objetivo de salida:** una instancia corriendo con la que ya se puede planificar
una misión y exportar un KMZ, más un informe de qué trae el código por dentro.

| #       | Tarea                                                                                                    | Estado                   |
| ------- | -------------------------------------------------------------------------------------------------------- | ------------------------ |
| `F0.1`  | Incorporar el código de DroneRoute con su historial                                                      | ✅                       |
| `F0.2`  | Estructura: **este repo absorbe el código**, con `upstream` como remoto para traer mejoras               | ✅                       |
| `F0.3`  | Build local del monorepo (`npm install && npm run build`) verde en los 4 paquetes                        | ✅                       |
| `F0.4`  | **Auditoría A — generación de grilla**                                                                   | ✅ ver hallazgos         |
| `F0.5`  | **Auditoría B — mapa y elevación**                                                                       | ✅ ver hallazgos         |
| `F0.6`  | **Auditoría C — autenticación y multiusuario**                                                           | ✅ ver hallazgos         |
| `F0.7`  | **Auditoría D — modelo de misión interno** (`packages/shared/src/types.ts`)                              | ✅ ver hallazgos         |
| `F0.8`  | ~~Desplegar **WebODM** como contenedor aparte~~                                                          | ❌ descartado, ver abajo |
| `F0.9`  | Verificar el KMZ exportado **en el control real** y su importación en AeroControl (`/geo/plans/import/`) | ⬜                       |
| `F0.10` | **Migrar de Mapbox a MapLibre** — ya no hace falta ningún token                                          | ✅                       |

**Criterio de aceptación:** el KMZ generado por la instancia local vuela desde el
control, y el mismo archivo importa limpio en AeroControl.

### Hallazgos de auditoría (2026-08-17)

Tres supuestos del plan original resultaron falsos. Quedan corregidos aquí.

**`F0.4` — La generación de grilla NO es GSD-driven.** El panel expone un único
`spacingM` (separación de líneas en metros) que el usuario fija a mano. **No
existe modelo de cámara, ni GSD, ni traslape frontal/lateral, ni footprint, ni
cálculo de intervalo de disparo.** Consecuencia: la Fase 1 no es "conectar el
motor a la grilla existente", es **construir el motor completo** y sustituir el
parámetro manual. El alcance de la Fase 1 sube.

**`F0.5` — Todo el mapa dependía de Mapbox, terreno incluido.** El código usaba
`mapbox-gl` v3 con `MAPBOX_TOKEN` **obligatorio para renderizar el mapa** (no
solo el 3D), con estilos `satellite-streets-v12` y `dark-v11`, edificios 3D
extruidos desde `mapbox.mapbox-streets-v8`, geocoder de Mapbox y terreno desde
`mapbox://mapbox.mapbox-terrain-dem-v1`.

> Corrección: una versión anterior de este documento afirmó que no había terreno.
> Era falso — sí existía `raster-dem` con `setTerrain`. Lo que no existe es
> **muestreo de elevación por waypoint**, que es otra cosa: el terreno se dibuja,
> pero nadie consulta la altura del suelo para calcular nada.

Consecuencias:

1. El "elevation chart" grafica la altitud programada de los waypoints, no el
   perfil del suelo.
2. La Fase 3 (terrain following) sigue siendo **construcción completa**: hay
   terreno visual, no datos de terreno para calcular. La buena noticia es que
   MapLibre expone `queryTerrainElevation()`, que da un camino directo.
3. La migración a MapLibre debía reemplazar **cuatro** piezas, no una: estilo
   base, imagen satelital, fuente de edificios y fuente DEM.

**`F0.6` — El multiusuario ya funciona; el riesgo es otro.** El supuesto de
"instancia personal de una sola cuenta" era falso: el registro con correo y
contraseña (`POST /auth/register`, con rate limit) está disponible **precisamente
en modo self-hosted** — lo que se desactiva ahí es el ingreso con Google, que es
solo para la versión en la nube. Hay `bcrypt`, JWT de 7 días y un flag `isAdmin`
en el token. No hace falta trabajo para tener varios usuarios.

El riesgo real es otro: **si no se define `JWT_SECRET`, el modo self-hosted
arranca igual con un secreto por defecto que está publicado en el código fuente**.
Con el registro abierto, cualquiera que alcance la instancia puede crear cuenta, y
con ese secreto conocido puede firmarse un token con `isAdmin: true`. Para el
despliegue interno, definir `JWT_SECRET` (≥32 caracteres, aleatorio) **no es
opcional**.

**`F0.7` — El modelo de misión es un modelo DJI, no un modelo de dominio.**
`MissionConfig` está lleno de conceptos WPML del fabricante (`droneEnumValue`,
`payloadEnumValue`, `flyToWaylineMode`, `executeRCLostAction`), justo lo que la
convención de `AGENTS.md` prohíbe en el dominio. Y `DRONE_MODELS` **no es un
catálogo de aeronaves**: son códigos numéricos para el archivo KMZ, sin sensor,
focal, resolución ni autonomía. El Mavic 3E ya está (enum 77), lo que sirve para
exportar, no para calcular.

Lo aprovechable: `heightMode` ya distingue `EGM96` / `relativeToStartPoint` /
`aboveGroundLevel`, y `maxBatteryMinutes` existe en la configuración.

Consecuencia: `packages/mission-core` introduce el modelo propio y el actual queda
degradado a **capa de exportación DJI**. Falta además el nivel de _proyecto_ —
`Mission` es plana, sin agrupación — que la integración con AeroControl necesita
para colgar `cost_center_id`.

**Ojo con el nombre "DGAC" en este código.** `services/airspace/provider-dgac.ts`
es la **Direction Générale de l'Aviation Civile de Francia**, consultada vía la
Géoplateforme francesa. No tiene relación con la DGAC de Chile. Los otros
proveedores son ENAIRE (España) y NATS (Reino Unido): **no hay cobertura de
espacio aéreo chileno**, y esa es una pieza a construir si algún día se necesita.

### `F0.8` descartado: AeroPlanner planifica, no procesa (2026-08-17)

Decisión del usuario, y conviene entender la distinción porque el plan original
las mezclaba bajo la misma palabra:

|                                               | Qué es                                                            | Qué cuesta                                 |
| --------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| **Cálculo de planificación** (`mission-core`) | GSD, traslapes, separación de líneas, intervalo                   | Aritmética. Microsegundos, en el navegador |
| **Procesamiento fotogramétrico** (WebODM)     | Reconstruir ortofoto, nube de puntos y DSM desde cientos de fotos | Horas de CPU y 16–64 GB de RAM             |

**No hay hardware para lo segundo.** Con 8 GB de RAM, WebODM no pasa de unas 100
imágenes; con 16 GB, de 100–300. Un vuelo del Mavic 3E produce fácilmente 500 o
1000 fotos. Montar el contenedor sería instalar algo que no se puede correr.

Consecuencias en el plan:

- **`F0.8` sale.** Si algún día hace falta procesar, las vías son un equipo
  dedicado o un servicio en la nube (WebODM Lightning, del mismo proyecto), y esa
  es una decisión de presupuesto, no de código.
- **La Fase 6 se mantiene, reformulada como visor puro.** Ver abajo.
- **La Fase 3 no se toca.** El terrain following usa DEM público (AWS Terrain
  Tiles, ya integrado); nunca dependió de procesar nada.

**Nada de esto afecta a las Fases 1 a 5**, que es donde vive el producto:
planificar, calcular, seguir el terreno, simular y validar contra el permiso.

#### Visualizar no es procesar

La distinción importa porque el visor **no** cae del lado caro. Abrir una
ortofoto o una nube de puntos ya generadas es trabajo de la GPU del navegador,
por streaming y a demanda:

- Un **COG** se lee por rangos HTTP: el navegador pide solo las teselas del nivel
  de zoom que está mirando, nunca el archivo completo.
- Un **COPC** trae un octree interno: se descargan los puntos que caben en
  pantalla, no los mil millones del archivo.

Por eso cualquier aplicación de terceros muestra estos archivos sin pedir una
estación de trabajo. AeroPlanner hará lo mismo: **carga y muestra lo que otro
procesó**, y no intenta generarlo.

**Infraestructura ajena eliminada.** El merge traía el `CNAME` de `droneroute.io`,
`fly.toml` y un workflow de Fly que se disparaba en cada push, la publicación a
`fcsonline/droneroute` en Docker Hub, y el auto-merge de dependabot. Todo
eliminado; se conservó `ci.yml`.

### `F0.10` — Migración de Mapbox a MapLibre ✅ (2026-08-17)

Bloqueaba el despliegue interno: la aplicación no arrancaba sin un token de
Mapbox, lo que contradecía el local-first del proyecto. **Ninguna fuente exige
hoy cuenta, token ni cuota.**

| Pieza            | Antes                        | Ahora                                                    |
| ---------------- | ---------------------------- | -------------------------------------------------------- |
| Librería         | `mapbox-gl` v3 (propietaria) | `maplibre-gl` 5.x (BSD) vía `react-map-gl/maplibre`      |
| Estilo base      | `mapbox://styles/mapbox/*`   | OpenFreeMap Liberty (teselas vectoriales OSM)            |
| Imagen satelital | Mapbox satellite             | Esri World Imagery — el proveedor que ya usa AeroControl |
| Edificios 3D     | `mapbox.mapbox-streets-v8`   | Capa `building` de OpenMapTiles (OpenFreeMap)            |
| Terreno          | `mapbox.mapbox-terrain-dem`  | AWS Terrain Tiles, codificación `terrarium`              |
| Geocoder         | `@mapbox/mapbox-gl-geocoder` | Nominatim, en `GeocoderControl.tsx`                      |
| CSS              | `.mapboxgl-*`                | `.maplibregl-*`                                          |

Las fuentes viven todas en `packages/frontend/src/lib/mapStyles.ts`: si algún día
se sirven teselas propias, ese es el único archivo que cambia.

**Verificado:** las cinco fuentes responden 200; el satelital y el 3D con relieve
renderizan (capturas en el PR), y la atribución confirma el cambio de proveedor
en cada modo. El render de teselas **vectoriales** no se pudo capturar en headless
con WebGL por software — se validó por la atribución, que sí cambia a OpenFreeMap.

**Tres tropiezos que vale registrar:**

1. `maplibre-gl` v6 (lo que instala npm por defecto) **rompe con `react-map-gl`
   8.1.1**: la app quedaba en blanco con `Cannot read properties of undefined
(reading 'center')`. Hay que fijar la v5.
2. npm hoistea `@vis.gl/react-maplibre` a la raíz pero deja `maplibre-gl` dentro
   del paquete, así que la librería no resuelve su propio peer. Se fija con un
   alias en `vite.config.ts`.
3. MapLibre **no tiene `map.project(lngLat, altitude)`**, que Mapbox GL v3 sí
   ofrece y que usaba la línea vertical del waypoint. Se sustituyó por una
   aproximación desde la escala del mapa y el pitch.

---

## FASE 1 — Motor fotogramétrico

**Objetivo de salida:** el usuario fija GSD y traslapes, y la misión se calcula
sola con estadísticas confiables.

| #      | Tarea                                                                                                                                                                         | Estado |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `F1.1` | `packages/mission-core/photogrammetry`: GSD ↔ altura, footprint, traslape frontal/lateral → separación de líneas y de disparos, intervalo, velocidad máxima sin _motion blur_ | ✅     |
| `F1.2` | Catálogo de cámaras y aeronaves, partiendo por el **DJI Mavic 3E** (sensor, focal, resolución, autonomía)                                                                     | ✅     |
| `F1.3` | **Sustituir** el `spacingM` manual del panel de grilla por la separación derivada del traslape y la altura                                                                    | ✅     |
| `F1.4` | Panel de estadísticas: distancia, duración, nº de fotos, baterías estimadas                                                                                                   | ✅     |
| `F1.5` | División por baterías: si la misión excede la autonomía operacional, proponer el corte en N vuelos                                                                            | ✅     |

### El motor (`packages/mission-core`)

Paquete de dominio puro: **no importa React, ni el mapa, ni el DOM, ni formato de
fabricante alguno**. 32 pruebas en Node, sin navegador.

- `photogrammetry/camera.ts` — GSD por eje, GSD nominal (el eje más grueso, para
  no prometer una resolución que la imagen no entrega en toda dirección),
  altura para un GSD objetivo, y footprint con orientación de cámara explícita.
- `photogrammetry/coverage.ts` — traslapes → separación de líneas y de disparos,
  y velocidad recomendada limitada por lo que primero muerda: _motion blur_,
  intervalo mínimo de la cámara o techo de la aeronave. El plan dice **cuál** fue.
- `catalog/aircraft.ts` — Mavic 3E con su fuente citada.
- `mission/battery.ts` — división por baterías, en tramos **iguales**: partir en
  un vuelo completo más un muñón de tres minutos es aritmética correcta y mala
  operación.
- `mission/statistics.ts` — distancia, duración y nº de fotos.

**Verificación.** El oráculo es la ficha técnica de DJI por dos caminos
independientes: la fórmula sensor/focal debe coincidir con pitch × altura /
focal usando el pitch publicado de 3,3 µm, y el resultado a 100 m debe dar los
~2,7 cm/px que DJI publica. Valores que produce hoy:

| Altura | GSD        | Separación @70 % | Ancho de barrido |
| ------ | ---------- | ---------------- | ---------------- |
| 50 m   | 1,34 cm/px | 21,3 m           | 70,9 m           |
| 80 m   | 2,15 cm/px | 34,0 m           | 113,4 m          |
| 100 m  | 2,68 cm/px | 42,5 m           | 141,7 m          |

Un GSD de 2 cm/px cae en 74,5 m, que es la cifra que da cualquier calculadora
fotogramétrica para este equipo.

**Decisión registrada:** `planBatteries` **no tiene autonomía por defecto**. La
cifra del fabricante es de laboratorio; la que decide si una tripulación vuela es
política de la operación. Inventar una convertiría un control de seguridad en un
estorbo que alguien termina desactivando.

### Lo que cambió en la interfaz

- **El panel de grilla pide traslape, no separación.** La separación se deriva y
  se muestra junto al GSD que resulta.
- **El aviso de batería dice cuántas y dónde cortar.** Antes era un binario
  "excede el máximo"; ahora informa `N baterías — split evenly: 18:20 + 18:20`.
  Saber que la misión necesita tres baterías es accionable; saber que "es
  demasiado larga" no lo es.
- **La configuración separa autonomía de reserva.** Son dos números distintos y
  ambos son decisión de la operación, así que el panel lo dice explícitamente.
  La reserva entra con valor 0 a propósito: reproduce el comportamiento anterior
  en vez de cambiar en silencio lo que las misiones existentes reportan.

Queda fuera la **superficie cubierta**: exige el polígono del AOI, no solo la
ruta, y llega con la Fase 2.

**Oráculo:** mismo polígono y mismos parámetros en **GeoFlight Planner** sobre
QGIS; las cifras deben coincidir. Tests unitarios puros, sin navegador.

---

## FASE 2 — Corredores

**Objetivo de salida:** planificar una línea eléctrica, un camino o un corredor
minero sin dibujarlo waypoint por waypoint.

| #      | Tarea                                                                                                         | Estado                                               |
| ------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `F2.1` | Entrada del eje: arrastrando sobre el mapa                                                                    | ✅ eje recto; polilínea e importación KML pendientes |
| `F2.2` | `packages/mission-core/corridor`: eje → líneas paralelas con la separación del motor fotogramétrico           | ✅                                                   |
| `F2.3` | Tratamiento de curvas y vértices cerrados (sin waypoints imposibles ni giros que la aeronave no pueda seguir) | ✅                                                   |
| `F2.4` | Waypoints con orientación de cámara adecuada al corredor                                                      | ✅                                                   |

**Oráculo:** corredor real de faena, comparado contra el generado por GeoFlight.

### El motor de corredores (`corridor/corridor.ts`)

17 pruebas nuevas. Dos problemas que había que resolver bien:

**Las esquinas se pinchan.** Desplazar una polilínea lateralmente no es mover
cada punto en perpendicular: en un vértice hay que moverse por la bisectriz y
estirar por `1 / cos(giro/2)`, o la línea desplazada se acorta en las curvas y
deja de ser paralela. Verificado: un giro de 90° empuja la esquina exterior
exactamente `√2 × separación`.

**Ese estiramiento se dispara en una horquilla.** El factor tiende a infinito
cuando el giro se acerca a 180°, y un vértice cerrado del eje mandaría un
waypoint kilómetros afuera. Va limitado a 3×: deforma un poco la esquina, en vez
de producir una misión imposible de volar.

**Serpenteo por defecto.** Volar todas las líneas en el mismo sentido obliga a
regresar en vacío al inicio de cada una — en un corredor largo eso es la mitad
del vuelo. Alternando el sentido, cada giro cuesta una separación de línea. La
diferencia está medida en las pruebas.

Los offsets son simétricos respecto al eje: un número impar de líneas deja una
por el centro, uno par lo cabalga. En ambos casos el corredor queda centrado en
lo que el operador dibujó.

### Waypoints del corredor (`corridor/waypoints.ts`)

**Se camina por distancia, no por vértice.** Un eje dibujado a mano tiene
vértices cada pocos metros en una curva y ninguno durante un kilómetro en la
recta; la cámara tiene que disparar a intervalo constante sin importar cómo se
dibujó. El recorrido acumula longitud de arco y arrastra el resto de un segmento
al siguiente, así que el espaciado **no se reinicia en cada vértice** — ese es el
error clásico, y hay una prueba que lo vigila.

La última posición siempre recibe waypoint aunque quede a menos de un espaciado,
para que la línea se vuele hasta el final en vez de cortarse antes.

**Dos formas de apuntar la cámara:** `nadir` (gimbal a −90°, el estándar de
mapeo) y `side`, que gira 90° para fotografiar una cara — una torre de alta
tensión, un talud de corte. En modo lateral la aeronave sigue el eje y lo que
cambia es hacia dónde mira la cámara.

### En la interfaz

**Corridor** entra al menú de plantillas (atajo `C`). Se arrastra sobre el mapa
para fijar el eje y el panel pide altura, número de líneas, traslape lateral y
frontal, y el modo de cámara. Debajo muestra lo que esos parámetros producen:
GSD, ancho de corredor cubierto y separación entre líneas.

Verificado con un eje de 2 km a 80 m y traslape 80/70:

| Líneas | Ancho cubierto | Largo total | Giros | Waypoints |
| ------ | -------------- | ----------- | ----- | --------- |
| 1      | 113 m          | 1,99 km     | 0 m   | 119       |
| 3      | 181 m          | 5,98 km     | 68 m  | 357       |
| 5      | 249 m          | 9,97 km     | 136 m | 595       |

Los giros salen exactamente `(N−1) × 34 m`, una separación de línea cada uno:
la prueba de que el serpenteo hace lo que promete. La separación real entre
disparos midió 17,0 m constante, igual al valor calculado.

**Limitación conocida:** el eje es hoy un **tramo recto** (se arrastra de un
punto a otro). El motor acepta polilíneas de N vértices, así que dibujar un eje
quebrado o importarlo desde KML es cambiar la entrada, no el cálculo.

---

## FASE 3 — Terrain following

**Objetivo de salida:** volar a altura constante sobre el suelo en terreno con
pendiente, que es donde el vuelo a altura fija falla.

| #      | Tarea                                                                                                           | Estado |
| ------ | --------------------------------------------------------------------------------------------------------------- | ------ |
| `F3.1` | Fuente base: **Copernicus GLO-30** (libre, 30 m)                                                                | ⬜     |
| `F3.2` | Importar DEM/DSM propio en GeoTIFF (fotogrametría previa de la faena — mejor dato que los 30 m)                 | ⬜     |
| `F3.3` | `packages/mission-core/terrain`: muestreo de elevación por waypoint, altitud = terreno + AGL objetivo           | ⬜     |
| `F3.4` | Perfil terreno/vuelo con **clearance mínimo** destacado                                                         | ⬜     |
| `F3.5` | Advertencia cuando la pendiente exige una tasa de ascenso que la aeronave no alcanza a la velocidad planificada | ⬜     |

**Oráculo:** muestreo manual del mismo DEM en QGIS sobre los mismos puntos.

---

## FASE 4 — Simulación cinemática

**Objetivo de salida:** ver la misión antes de volarla, y detectar la cobertura
floja en el escritorio y no en el informe.

| #      | Tarea                                                                                                                                 | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `F4.1` | `packages/mission-core/simulation`: interpolación de posición, rumbo, altura y AGL contra el tiempo                                   | ⬜     |
| `F4.2` | Línea de tiempo con play/pausa y velocidades 1x–10x, en 2D y 3D                                                                       | ⬜     |
| `F4.3` | Telemetría estimada durante la simulación: velocidad, AGL, distancia recorrida, batería, fotos tomadas                                | ⬜     |
| `F4.4` | **Footprints de foto** dibujados en el mapa a medida que se dispara — la funcionalidad que hace visible el traslape real y los huecos | ⬜     |
| `F4.5` | Resumen de cobertura: superficie cubierta, zonas con traslape bajo el mínimo                                                          | ⬜     |

**Oráculo:** duración simulada ≈ duración estimada por el motor; nº de footprints
= nº de fotos calculado en `F1.4`.

---

## FASE 5 — Integración con AeroControl

**Objetivo de salida:** la misión planificada queda archivada y trazable en el
sistema operacional, y verificada contra el permiso vigente.

| #      | Tarea                                                                                                                                                             | Estado |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `F5.1` | Export "para AeroControl": KMZ en el formato canónico que su importador acepta                                                                                    | ⬜     |
| `F5.2` | `packages/mission-core/validation`: contraste contra la envolvente del permiso — altura ≤ máxima autorizada, geometría dentro del radio, fecha dentro de vigencia | ⬜     |
| `F5.3` | Alimentar `F5.2` primero con un JSON exportado a mano; después vía `GET /api/v1/...` de AeroControl                                                               | ⬜     |
| `F5.4` | Envío directo del plan por `POST /api/v1/geo/plans/<uuid>/versions/`                                                                                              | ⬜     |
| `F5.5` | Enlace profundo "Abrir en AeroPlanner" con `cost_center_id`, `aircraft_id`, `flight_permission_id`                                                                | ⬜     |

**Oráculo:** round-trip completo sin pérdida de waypoints, y el validador
rechazando una misión con AGL por sobre la altura máxima del permiso.

> `F5.4` y `F5.5` requieren cambios del lado de AeroControl. **No se implementan
> desde este repositorio**: entran por el `MASTER_PLAN.md` de AeroControl, donde
> encajan con su ítem diferido `GEO-14`.

---

## FASE 6 — Visor de resultados

**Visor puro: carga y muestra, nunca procesa.** Los archivos llegan ya generados
—por un tercero, por un servicio en la nube o por un equipo prestado— y la
aplicación los abre como lo hace cualquier herramienta comercial. Todo el trabajo
ocurre en el navegador, por streaming: ver _Visualizar no es procesar_, arriba.

**Objetivo de salida:** cerrar el ciclo — lo que produjo el vuelo alimenta la
planificación del siguiente.

| #      | Tarea                                                                                                               | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------ |
| `F6.1` | Cargar y registrar productos por proyecto/misión: ortofoto, nube de puntos, DSM — vengan de donde vengan            | ⬜     |
| `F6.2` | Ortofoto (**COG**) como capa base de planificación, por rangos HTTP y sin servidor de teselas                       | ⬜     |
| `F6.3` | Nube de puntos (**COPC**) en un visor embebido, con streaming del octree                                            | ⬜     |
| `F6.4` | DSM cargado como fuente del motor de terreno de `F3.3` — mejor dato que los 30 m públicos                           | ⬜     |
| `F6.5` | Aceptar también GeoTIFF y LAZ planos, avisando que conviene convertirlos a COG/COPC **fuera** de la app (QGIS/GDAL) | ⬜     |

**Oráculo:** planificar un corredor sobre una ortofoto real cargada por el
usuario; la nube de puntos de ese mismo vuelo abre y se navega con fluidez; el
terrain following con el DSM cargado entrega clearances distintos —y más
realistas— que con el DEM público.

> **Límite explícito:** la aplicación no genera ortofotos, nubes ni DSM, y no
> intentará hacerlo. Tampoco edita ni clasifica nubes de puntos. Solo visualiza.

---

## Fuera de alcance (decidido, no pendiente)

No entran sin que el usuario lo pida explícitamente:

| Qué                                        | Por qué queda fuera                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| PX4 SITL + Gazebo (simulación física)      | No simula un DJI real; no aporta a planificar mejor                                                       |
| CesiumJS                                   | El terreno de Cesium ion tiene costo comercial; el 3D del fork alcanza                                    |
| Fields2Cover / OR-Tools                    | Recién cuando "generar grilla" deba pasar a "optimizar cobertura" en polígonos irregulares con obstáculos |
| QGroundControl `.plan` y MAVLink           | La flota es DJI; el formato crítico es WPML                                                               |
| Multi-drone                                | Un piloto, una aeronave, una misión                                                                       |
| Meteorología                               | AeroControl ya la resuelve con `WeatherReview` sobre Open-Meteo                                           |
| Mapas de espacio aéreo DGAC                | Requiere fuente de datos oficial que hoy no existe como servicio                                          |
| Edición y clasificación de nubes de puntos | Aquí solo se visualiza; el procesamiento es de WebODM/CloudCompare                                        |

---

## Riesgos abiertos

| Riesgo                                                        | Impacto                                                  | Estado                                                                                                                            |
| ------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| El mapa depende de un token comercial                         | Bloqueaba el despliegue interno sin costo                | ✅ **Cerrado en `F0.10`** — sin tokens: OpenFreeMap, Esri y AWS Terrain Tiles                                                     |
| La generación de grilla no es GSD-driven                      | La Fase 1 pasa de "conectar" a "construir"               | ⚠️ **Confirmado en `F0.4`** — no hay modelo de cámara ni traslapes. El motor se construye entero                                  |
| No hay muestreo de elevación                                  | La Fase 3 es construcción completa                       | ⚠️ **Confirmado en `F0.5`** — hay terreno visual, pero nadie consulta la altura del suelo. `queryTerrainElevation()` es el camino |
| El KMZ no lo acepta el control de la flota                    | Invalidaría la premisa completa de partir de este código | Abierto — se verifica en `F0.9` con el control real, **antes** de invertir en las demás fases                                     |
| Autonomía de batería estimada vs real                         | Una misión que "cabía" se corta en terreno               | Abierto — reserva configurable, y ajuste con datos reales de vuelo cuando existan                                                 |
| Deriva entre el modelo de misión y el canónico de AeroControl | Integración cara al final                                | Abierto — se cierra en `F0.7`                                                                                                     |
| El upstream avanza y el fork se queda atrás                   | Se pierden correcciones de seguridad y mejoras           | Abierto — `git fetch upstream` periódico; publicó 3 versiones en un mes                                                           |
