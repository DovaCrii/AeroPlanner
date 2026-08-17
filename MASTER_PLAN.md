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

**Fase 0.** El código base ya está incorporado y las auditorías están hechas.
Queda cerrar `F0.6`, `F0.8` y `F0.9`, y ejecutar la migración a MapLibre
(`F0.10`) que las auditorías dejaron como bloqueador de despliegue.

---

## FASE 0 — Incorporar y auditar

**Objetivo de salida:** una instancia corriendo con la que ya se puede planificar
una misión y exportar un KMZ, más un informe de qué trae el código por dentro.

| #       | Tarea                                                                                                                               | Estado           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `F0.1`  | Incorporar el código de DroneRoute con su historial                                                                                 | ✅               |
| `F0.2`  | Estructura: **este repo absorbe el código**, con `upstream` como remoto para traer mejoras                                          | ✅               |
| `F0.3`  | Build local del monorepo (`npm install && npm run build`) verde en los 4 paquetes                                                   | ✅               |
| `F0.4`  | **Auditoría A — generación de grilla**                                                                                              | ✅ ver hallazgos |
| `F0.5`  | **Auditoría B — mapa y elevación**                                                                                                  | ✅ ver hallazgos |
| `F0.6`  | **Auditoría C — autenticación:** el self-host es instancia personal de una cuenta; qué cuesta habilitar multiusuario                | ⬜               |
| `F0.7`  | **Auditoría D — modelo de misión interno** (`packages/shared/src/types.ts`) frente al contrato de `docs/INTEGRATION_AEROCONTROL.md` | ⬜               |
| `F0.8`  | Desplegar **WebODM** como contenedor aparte (Nivel 1 del visor: procesar y ver ortofoto y nube desde ya, sin escribir código)       | ⬜               |
| `F0.9`  | Verificar el KMZ exportado **en el control real** y su importación en AeroControl (`/geo/plans/import/`)                            | ⬜               |
| `F0.10` | **Migrar de Mapbox a MapLibre** — bloqueador de despliegue, ver abajo                                                               | ⬜               |

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

**`F0.5` — No hay terreno. En absoluto.** El código usa `mapbox-gl` v3 con
`MAPBOX_TOKEN` **obligatorio para renderizar el mapa**, con estilos
`satellite-streets-v12` y `dark-v11`, edificios 3D extruidos desde
`mapbox.mapbox-streets-v8`, y el geocoder de Mapbox. **No hay ninguna fuente
`raster-dem`, ni `setTerrain`, ni muestreo de elevación.** El "elevation chart"
grafica la altitud programada de los waypoints, no el perfil del terreno.
Consecuencias:

1. La vista 3D es pitch + edificios extruidos, no un terreno real. La descripción
   de "3D con terreno" del producto original se refiere a eso.
2. La Fase 3 (terrain following) es **construcción completa**, sin nada que
   reutilizar.
3. La migración a MapLibre es **más simple** de lo temido — no hay terreno que
   portar — pero exige elegir proveedor de teselas.

**Infraestructura ajena eliminada.** El merge traía el `CNAME` de `droneroute.io`,
`fly.toml` y un workflow de Fly que se disparaba en cada push, la publicación a
`fcsonline/droneroute` en Docker Hub, y el auto-merge de dependabot. Todo
eliminado; se conservó `ci.yml`.

### `F0.10` — Migración de Mapbox a MapLibre

Bloquea el despliegue interno: hoy **la aplicación no arranca sin un token de
Mapbox**, lo que contradice el local-first del proyecto. Alcance medido: 15
archivos, ~81 ocurrencias, concentradas en `MapView.tsx`, `index.css` (clases
`.mapboxgl-*`), `SharedMissionPage.tsx`, `configStore.ts` y `Marker3D.tsx`.

| Pieza            | Hoy                          | Reemplazo                                                              |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Librería         | `mapbox-gl` v3 (propietaria) | `maplibre-gl` (BSD); `react-map-gl/maplibre` ya está soportado         |
| Estilo base      | `mapbox://styles/mapbox/*`   | Teselas vectoriales libres (OpenFreeMap / Protomaps) o teselas propias |
| Imagen satelital | Mapbox satellite             | Por decidir: ortofoto propia (Fase 6) o proveedor libre                |
| Edificios 3D     | `mapbox.mapbox-streets-v8`   | Capa `building` de OpenMapTiles                                        |
| Geocoder         | `@mapbox/mapbox-gl-geocoder` | Nominatim u otro; función secundaria                                   |
| CSS              | `.mapboxgl-*`                | `.maplibregl-*`                                                        |

**Criterio de aceptación:** la aplicación levanta y planifica una misión completa
**sin ninguna variable de entorno de un proveedor comercial**.

---

## FASE 1 — Motor fotogramétrico

**Objetivo de salida:** el usuario fija GSD y traslapes, y la misión se calcula
sola con estadísticas confiables.

| #      | Tarea                                                                                                                                                                         | Estado |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `F1.1` | `packages/mission-core/photogrammetry`: GSD ↔ altura, footprint, traslape frontal/lateral → separación de líneas y de disparos, intervalo, velocidad máxima sin _motion blur_ | ⬜     |
| `F1.2` | Catálogo de cámaras y aeronaves, partiendo por el **DJI Mavic 3E** (sensor, focal, resolución, autonomía)                                                                     | ⬜     |
| `F1.3` | **Sustituir** el `spacingM` manual del panel de grilla por la separación derivada del traslape y la altura (ver hallazgo `F0.4`: no hay nada que envolver, se construye)      | ⬜     |
| `F1.4` | Panel de estadísticas: distancia, duración, superficie, nº de fotos, baterías estimadas                                                                                       | ⬜     |
| `F1.5` | División por baterías: si la misión excede la autonomía operacional, proponer el corte en N vuelos                                                                            | ⬜     |

**Oráculo:** mismo polígono y mismos parámetros en **GeoFlight Planner** sobre
QGIS; las cifras deben coincidir. Tests unitarios puros, sin navegador.

---

## FASE 2 — Corredores

**Objetivo de salida:** planificar una línea eléctrica, un camino o un corredor
minero sin dibujarlo waypoint por waypoint.

| #      | Tarea                                                                                                         | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------- | ------ |
| `F2.1` | Entrada del eje: dibujado en el mapa o importado desde KML                                                    | ⬜     |
| `F2.2` | `packages/mission-core/corridor`: eje → buffer → 2–5 líneas paralelas con traslape correcto                   | ⬜     |
| `F2.3` | Tratamiento de curvas y vértices cerrados (sin waypoints imposibles ni giros que la aeronave no pueda seguir) | ⬜     |
| `F2.4` | Waypoints con orientación de cámara adecuada al corredor                                                      | ⬜     |

**Oráculo:** corredor real de faena, comparado contra el generado por GeoFlight.

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

## FASE 6 — Visor de resultados (nivel 2)

**Objetivo de salida:** cerrar el ciclo — lo que produjo el vuelo alimenta la
planificación del siguiente.

| #      | Tarea                                                                                                                     | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| `F6.1` | Registro de productos por proyecto/misión: ortofoto, nube de puntos, DSM                                                  | ⬜     |
| `F6.2` | Conversión a formatos web: GeoTIFF → **COG** (GDAL), LAZ → **COPC** (PDAL/Untwine)                                        | ⬜     |
| `F6.3` | Ortofoto propia como capa base de planificación (georaster-layer-for-leaflet, o TiTiler si se necesitan teselas servidas) | ⬜     |
| `F6.4` | **Potree** embebido para la nube de puntos                                                                                | ⬜     |
| `F6.5` | El DSM propio como fuente del motor de terreno de `F3.3` — mejora directa del terrain following                           | ⬜     |

**Oráculo:** planificar un corredor sobre la ortofoto de un vuelo real; la nube
COPC de ese mismo vuelo abre en el visor; el terrain following con DSM propio
entrega clearances distintos y más realistas que con Copernicus 30 m.

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

| Riesgo                                                        | Impacto                                                  | Estado                                                                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| El mapa depende de un token comercial                         | Bloquea el despliegue interno sin costo                  | ⚠️ **Confirmado en `F0.5`** — es peor de lo previsto: no es solo el 3D, el mapa entero no renderiza sin token. Mitigación: `F0.10` |
| La generación de grilla no es GSD-driven                      | La Fase 1 pasa de "conectar" a "construir"               | ⚠️ **Confirmado en `F0.4`** — no hay modelo de cámara ni traslapes. El motor se construye entero                                   |
| No hay datos de terreno que reutilizar                        | La Fase 3 es construcción completa                       | ⚠️ **Confirmado en `F0.5`** — sin `raster-dem` ni muestreo de elevación                                                            |
| El KMZ no lo acepta el control de la flota                    | Invalidaría la premisa completa de partir de este código | Abierto — se verifica en `F0.9` con el control real, **antes** de invertir en las demás fases                                      |
| Autonomía de batería estimada vs real                         | Una misión que "cabía" se corta en terreno               | Abierto — reserva configurable, y ajuste con datos reales de vuelo cuando existan                                                  |
| Deriva entre el modelo de misión y el canónico de AeroControl | Integración cara al final                                | Abierto — se cierra en `F0.7`                                                                                                      |
| El upstream avanza y el fork se queda atrás                   | Se pierden correcciones de seguridad y mejoras           | Abierto — `git fetch upstream` periódico; publicó 3 versiones en un mes                                                            |
