# MASTER_PLAN — AeroPlanner

> **Fuente única de verdad del trabajo pendiente.** Consolida el análisis de
> alternativas open source y el contraste contra el repositorio real de
> AeroControl en un tablero ejecutable con seguimiento de estado.
> **Creado:** 2026-08-17 · **Rama base:** `main`
> **Regla de oro:** cada fase termina en algo **usable en terreno**. No se abre
> una fase nueva con la anterior a medio cerrar, y no se agrega alcance fuera de
> lo listado aquí sin que el usuario lo pida.

---

## Por dónde se empieza

**Fase 0, y nada más.** No hay código en el repositorio: lo primero es levantar
el fork y auditarlo. La tentación de saltar a implementar el motor fotogramétrico
antes de saber qué hace la generación de grilla que ya existe es exactamente el
error que este plan trata de evitar.

---

## FASE 0 — Desplegar y auditar

**Objetivo de salida:** una instancia corriendo con la que ya se puede planificar
una misión y exportar un KMZ, más un informe de qué trae el fork por dentro.

| # | Tarea | Estado |
|---|---|---|
| `F0.1` | Fork de DroneRoute a `DovaCrii/AeroPlanner-app` (o merge del código al presente repo, según resultado de `F0.2`) | ⬜ |
| `F0.2` | Decidir estructura: ¿este repo absorbe el fork, o el fork vive aparte y este queda como repo de producto? Documentar en `docs/ARCHITECTURE.md` | ⬜ |
| `F0.3` | `docker compose up` local del fork sin modificar. Planificar un survey y exportar KMZ | ⬜ |
| `F0.4` | **Auditoría A — generación de grilla:** ¿es GSD-driven o solo espaciado fijo? ¿Dónde vive el cálculo? ¿Modelo de cámara parametrizable? | ⬜ |
| `F0.5` | **Auditoría B — mapa 3D:** qué librería y qué fuente de elevación usa; **si depende de un token comercial (Mapbox), plan de reemplazo** por MapLibre + teselas libres | ⬜ |
| `F0.6` | **Auditoría C — autenticación:** el self-host es instancia personal de una cuenta; qué cuesta habilitar multiusuario | ⬜ |
| `F0.7` | **Auditoría D — modelo de misión interno:** qué tan lejos está del contrato de `docs/INTEGRATION_AEROCONTROL.md` | ⬜ |
| `F0.8` | Desplegar **WebODM** como contenedor aparte (Nivel 1 del visor: procesar y ver ortofoto y nube desde ya, sin escribir código) | ⬜ |
| `F0.9` | Verificar el KMZ exportado **en el control real** y su importación en AeroControl (`/geo/plans/import/`) | ⬜ |

**Criterio de aceptación:** el KMZ generado por la instancia local vuela desde el
control, y el mismo archivo importa limpio en AeroControl.

---

## FASE 1 — Motor fotogramétrico

**Objetivo de salida:** el usuario fija GSD y traslapes, y la misión se calcula
sola con estadísticas confiables.

| # | Tarea | Estado |
|---|---|---|
| `F1.1` | `packages/mission-core/photogrammetry`: GSD ↔ altura, footprint, traslape frontal/lateral → separación de líneas y de disparos, intervalo, velocidad máxima sin *motion blur* | ⬜ |
| `F1.2` | Catálogo de cámaras y aeronaves, partiendo por el **DJI Mavic 3E** (sensor, focal, resolución, autonomía) | ⬜ |
| `F1.3` | Conectar el motor a la generación de grilla del fork (reemplazando o envolviendo lo auditado en `F0.4`) | ⬜ |
| `F1.4` | Panel de estadísticas: distancia, duración, superficie, nº de fotos, baterías estimadas | ⬜ |
| `F1.5` | División por baterías: si la misión excede la autonomía operacional, proponer el corte en N vuelos | ⬜ |

**Oráculo:** mismo polígono y mismos parámetros en **GeoFlight Planner** sobre
QGIS; las cifras deben coincidir. Tests unitarios puros, sin navegador.

---

## FASE 2 — Corredores

**Objetivo de salida:** planificar una línea eléctrica, un camino o un corredor
minero sin dibujarlo waypoint por waypoint.

| # | Tarea | Estado |
|---|---|---|
| `F2.1` | Entrada del eje: dibujado en el mapa o importado desde KML | ⬜ |
| `F2.2` | `packages/mission-core/corridor`: eje → buffer → 2–5 líneas paralelas con traslape correcto | ⬜ |
| `F2.3` | Tratamiento de curvas y vértices cerrados (sin waypoints imposibles ni giros que la aeronave no pueda seguir) | ⬜ |
| `F2.4` | Waypoints con orientación de cámara adecuada al corredor | ⬜ |

**Oráculo:** corredor real de faena, comparado contra el generado por GeoFlight.

---

## FASE 3 — Terrain following

**Objetivo de salida:** volar a altura constante sobre el suelo en terreno con
pendiente, que es donde el vuelo a altura fija falla.

| # | Tarea | Estado |
|---|---|---|
| `F3.1` | Fuente base: **Copernicus GLO-30** (libre, 30 m) | ⬜ |
| `F3.2` | Importar DEM/DSM propio en GeoTIFF (fotogrametría previa de la faena — mejor dato que los 30 m) | ⬜ |
| `F3.3` | `packages/mission-core/terrain`: muestreo de elevación por waypoint, altitud = terreno + AGL objetivo | ⬜ |
| `F3.4` | Perfil terreno/vuelo con **clearance mínimo** destacado | ⬜ |
| `F3.5` | Advertencia cuando la pendiente exige una tasa de ascenso que la aeronave no alcanza a la velocidad planificada | ⬜ |

**Oráculo:** muestreo manual del mismo DEM en QGIS sobre los mismos puntos.

---

## FASE 4 — Simulación cinemática

**Objetivo de salida:** ver la misión antes de volarla, y detectar la cobertura
floja en el escritorio y no en el informe.

| # | Tarea | Estado |
|---|---|---|
| `F4.1` | `packages/mission-core/simulation`: interpolación de posición, rumbo, altura y AGL contra el tiempo | ⬜ |
| `F4.2` | Línea de tiempo con play/pausa y velocidades 1x–10x, en 2D y 3D | ⬜ |
| `F4.3` | Telemetría estimada durante la simulación: velocidad, AGL, distancia recorrida, batería, fotos tomadas | ⬜ |
| `F4.4` | **Footprints de foto** dibujados en el mapa a medida que se dispara — la funcionalidad que hace visible el traslape real y los huecos | ⬜ |
| `F4.5` | Resumen de cobertura: superficie cubierta, zonas con traslape bajo el mínimo | ⬜ |

**Oráculo:** duración simulada ≈ duración estimada por el motor; nº de footprints
= nº de fotos calculado en `F1.4`.

---

## FASE 5 — Integración con AeroControl

**Objetivo de salida:** la misión planificada queda archivada y trazable en el
sistema operacional, y verificada contra el permiso vigente.

| # | Tarea | Estado |
|---|---|---|
| `F5.1` | Export "para AeroControl": KMZ en el formato canónico que su importador acepta | ⬜ |
| `F5.2` | `packages/mission-core/validation`: contraste contra la envolvente del permiso — altura ≤ máxima autorizada, geometría dentro del radio, fecha dentro de vigencia | ⬜ |
| `F5.3` | Alimentar `F5.2` primero con un JSON exportado a mano; después vía `GET /api/v1/...` de AeroControl | ⬜ |
| `F5.4` | Envío directo del plan por `POST /api/v1/geo/plans/<uuid>/versions/` | ⬜ |
| `F5.5` | Enlace profundo "Abrir en AeroPlanner" con `cost_center_id`, `aircraft_id`, `flight_permission_id` | ⬜ |

**Oráculo:** round-trip completo sin pérdida de waypoints, y el validador
rechazando una misión con AGL por sobre la altura máxima del permiso.

> `F5.4` y `F5.5` requieren cambios del lado de AeroControl. **No se implementan
> desde este repositorio**: entran por el `MASTER_PLAN.md` de AeroControl, donde
> encajan con su ítem diferido `GEO-14`.

---

## FASE 6 — Visor de resultados (nivel 2)

**Objetivo de salida:** cerrar el ciclo — lo que produjo el vuelo alimenta la
planificación del siguiente.

| # | Tarea | Estado |
|---|---|---|
| `F6.1` | Registro de productos por proyecto/misión: ortofoto, nube de puntos, DSM | ⬜ |
| `F6.2` | Conversión a formatos web: GeoTIFF → **COG** (GDAL), LAZ → **COPC** (PDAL/Untwine) | ⬜ |
| `F6.3` | Ortofoto propia como capa base de planificación (georaster-layer-for-leaflet, o TiTiler si se necesitan teselas servidas) | ⬜ |
| `F6.4` | **Potree** embebido para la nube de puntos | ⬜ |
| `F6.5` | El DSM propio como fuente del motor de terreno de `F3.3` — mejora directa del terrain following | ⬜ |

**Oráculo:** planificar un corredor sobre la ortofoto de un vuelo real; la nube
COPC de ese mismo vuelo abre en el visor; el terrain following con DSM propio
entrega clearances distintos y más realistas que con Copernicus 30 m.

---

## Fuera de alcance (decidido, no pendiente)

No entran sin que el usuario lo pida explícitamente:

| Qué | Por qué queda fuera |
|---|---|
| PX4 SITL + Gazebo (simulación física) | No simula un DJI real; no aporta a planificar mejor |
| CesiumJS | El terreno de Cesium ion tiene costo comercial; el 3D del fork alcanza |
| Fields2Cover / OR-Tools | Recién cuando "generar grilla" deba pasar a "optimizar cobertura" en polígonos irregulares con obstáculos |
| QGroundControl `.plan` y MAVLink | La flota es DJI; el formato crítico es WPML |
| Multi-drone | Un piloto, una aeronave, una misión |
| Meteorología | AeroControl ya la resuelve con `WeatherReview` sobre Open-Meteo |
| Mapas de espacio aéreo DGAC | Requiere fuente de datos oficial que hoy no existe como servicio |
| Edición y clasificación de nubes de puntos | Aquí solo se visualiza; el procesamiento es de WebODM/CloudCompare |

---

## Riesgos abiertos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El 3D del fork depende de un token comercial | Bloquea el despliegue interno sin costo | Se detecta en `F0.5`, antes de construir nada encima |
| La generación de grilla del fork no es GSD-driven | La Fase 1 pasa de "conectar" a "reescribir" | Se sabe en `F0.4`; el motor propio ya está previsto como paquete separado |
| El KMZ del fork no lo acepta el control de la flota | Invalida la premisa completa del fork | Se verifica en `F0.9` con el control real, **antes** de invertir en las demás fases |
| Autonomía de batería estimada vs real | Una misión que "cabía" se corta en terreno | Reserva configurable, y ajuste con datos reales de vuelo cuando existan |
| Deriva entre el modelo de misión y el canónico de AeroControl | Integración cara al final | El contrato se define en Fase 0, no en Fase 5 |
