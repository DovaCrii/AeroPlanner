# Referencias — AeroPlanner

Verificado el 2026-08-17. Antes de portar una línea de código de cualquiera de
estos proyectos, confirmar la licencia aquí y registrar el origen en el archivo
destino.

## Regla de licencias

AeroPlanner es MIT y debe seguir siéndolo.

| Licencia del origen | Qué se puede hacer |
| --- | --- |
| **MIT / BSD / Apache-2.0** | Portar y adaptar código, manteniendo el aviso de copyright del original |
| **GPL / LGPL** | **Solo leer como referencia conceptual.** No copiar código |
| **AGPL** | **Solo consumir como servicio separado**, en su propio contenedor y por su API. No enlazar su código |

Una línea copiada de un proyecto GPL contamina el repositorio completo. Ante la
duda, se reimplementa desde la documentación, no desde el código.

## Base del proyecto

### DroneRoute — MIT
<https://github.com/fcsonline/droneroute>

**El punto de partida.** Monorepo npm con React 19 + TypeScript + Vite + Tailwind
+ Zustand + Leaflet en el frontend, Express 5 + SQLite + JWT en el backend, y una
CLI que empuja el KMZ al control DJI por USB. Se despliega con Docker.

Ya trae: waypoints con altitud, velocidad, rumbo y gimbal; POI con apuntado
automático de cámara; acciones por waypoint; plantillas de grilla, órbita,
fachada y *pencil path*; **import y export DJI WPML/KMZ**; mapa 3D con terreno y
edificios; gráfico de perfil de elevación; obstáculos; zonas de restricción de
espacio aéreo; y visualización del frustum de cámara.

Lo que le falta y el MVP agrega: motor fotogramétrico paramétrico (GSD → altura),
corredores lineales, terrain following con DEM propio, simulación animada y
validación contra el permiso.

*Por confirmar en Fase 0:* qué librería usa el mapa 3D y de dónde saca la
elevación (`F0.5`) — la documentación pública sugiere Mapbox, lo que implicaría
un token comercial.

## Referencias de las que se porta código

### GeoFlight Planner — MIT
<https://github.com/OpenGeoOne/qgis-drone-flight-planner>

Plugin de QGIS en Python. **La referencia matemática del proyecto**: implementa
GSD, traslapes, separación, altura, velocidad ideal, *motion blur*, intervalo de
disparo, PPK, terrain following con DEM y corredores lineales de 2 a 5 rutas
paralelas. Se porta la matemática a TypeScript en `packages/mission-core`.

No se usa su salida: exporta CSV compatible con Litchi, que no sirve para la
línea Enterprise de DJI. El export lo cubre el WPML de DroneRoute.

También sirve como **oráculo de verificación**: los mismos parámetros sobre el
mismo polígono en QGIS deben dar las mismas cifras.

### Potree — BSD (TU Wien)
<https://github.com/potree/potree>

Visor WebGL de nubes de puntos masivas, el estándar de facto y el que embebe
WebODM. Se integra en la Fase 6.

### PDAL / Untwine — BSD
<https://pdal.io/>

Conversión de LAZ a COPC (nube de puntos optimizada para la nube), para
streaming multi-resolución sin servidor especializado.

### georaster-layer-for-leaflet — MIT
<https://github.com/GeoTIFF/georaster-layer-for-leaflet>

Dibuja un Cloud Optimized GeoTIFF directamente en Leaflet mediante *range
requests*, sin servidor de teselas. La vía simple para poner la ortofoto propia
como capa base.

Alternativa si se necesitan teselas servidas: **TiTiler** (FastAPI, MIT), que
además produce URLs XYZ que el Leaflet de AeroControl podría consumir sin cambiar
su arquitectura.

### Fields2Cover — BSD-3-Clause
<https://github.com/Fields2Cover/Fields2Cover>

Biblioteca de *coverage path planning*: descomposición de polígonos no convexos,
obstáculos, Boustrophedon y optimización del orden de pasadas con OR-Tools.
**Fuera del MVP** — entra cuando generar una grilla quede corto.

## Referencias conceptuales (no se copia código)

### QGroundControl — GPL / Apache
<https://github.com/mavlink/qgroundcontrol>

La mejor referencia de **cómo debe comportarse** un planificador profesional: su
modelo de misión (Home, Waypoint, Survey, Corridor, Structure Scan, RTL), sus
parámetros de survey y la distinción entre ítems simples y complejos en el
formato `.plan`. Se estudia el modelo, **no se copia el código** — es GPL.

### Mission Planner — GPL
<https://github.com/ArduPilot/MissionPlanner>

Referencia de generación de survey/grid maduro y, sobre todo, de **operación sin
conexión**: caché de mapas y elevación con SRTM, GeoTIFF, DTED, WMS, WMTS y GDAL.
Relevante para faenas con mala conectividad. C#/.NET/Windows y GPL — solo
conceptos.

### PX4-Autopilot — BSD
<https://github.com/PX4/PX4-Autopilot>

Referencia para una eventual simulación física con SITL + Gazebo. **Fuera del
MVP**: validaría el comportamiento de un autopiloto PX4, que no es el que vuela
en la flota.

### uavRmp — GPL
Planificación consciente del terreno y **división de misiones según batería** en
R. La idea de dividir por autonomía se toma; el código no (GPL, y el proyecto
declaró modo de mantenimiento).

### tmplanner — ETH Zürich, archivado
<https://github.com/ethz-asl/tmplanner>

*Informative path planning*: decidir dónde volar para obtener la información más
útil, replanificando con los datos del sensor. Repositorio archivado (solo
lectura desde enero de 2024). Referencia de investigación para inspección
autónoma; no es un componente de producción.

## Servicio externo

### WebODM / OpenDroneMap — AGPL-3.0
<https://webodm.org/>

Pipeline fotogramétrico completo self-hosted: fotos → ortofoto, nube de puntos,
DSM y modelo 3D texturizado. Trae su propio visor (Potree + Leaflet).

**Se despliega como contenedor aparte y se le habla por su API HTTP.** Esa
separación es lo que impide que la AGPL alcance al código MIT de AeroPlanner.
Nunca enlazar su código.

## Datos

### Copernicus DEM GLO-30
Modelo digital de elevación global de 30 m, libre. Fuente base del terrain
following cuando no hay DSM propio de la faena.

### Cloud Optimized GeoTIFF (COG)
<https://cogeo.org/> — Estándar para ortofotos servidas por HTTP: teselado
interno y pirámides de resolución, cargables por rangos sin reprocesar.

### COPC — Cloud Optimized Point Cloud
Equivalente del COG para nubes de puntos: un LAZ con octree interno que permite
streaming multi-resolución.
