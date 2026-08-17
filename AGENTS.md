# AeroPlanner — guía para agentes (Codex / Claude Code)

## Objetivo

Aplicación web local-first para planificar, simular y verificar misiones RPA/UAS
(fotogrametría, corredores, inspección) y exportarlas al formato que la aeronave
entiende. Es un producto **independiente** de [AeroControl](https://github.com/DovaCrii/AeroControl),
su aplicación hermana, con la que se comunica por archivo o API pero **nunca por
base de datos compartida**.

La corrección de los cálculos prevalece sobre todo lo demás: una misión mal
calculada se traduce en un vuelo perdido, o peor, en una aeronave contra un
cerro. Antes de dar por buena una fórmula, se contrasta contra un oráculo
externo (ver *Verificación*).

> **Si existe `HANDOFF.md` en la raíz, léelo antes que nada.** Dice el punto
> exacto de retome. `MASTER_PLAN.md` es la fuente de verdad de qué sigue.

## Decisiones ya tomadas (no reabrir sin que el usuario lo pida)

1. **Se parte de un fork de [DroneRoute](https://github.com/fcsonline/droneroute) (MIT)**,
   no de un desarrollo desde cero. Ya resuelve mapa 2D/3D, waypoints, plantillas
   de misión, import/export DJI WPML/KMZ, Docker y CLI de carga al control. Lo
   que el MVP agrega es lo que le falta: motor fotogramétrico paramétrico,
   corredores, terrain following, simulación y validación.
2. **CesiumJS queda fuera del MVP.** El runtime es Apache 2.0, pero el terreno
   servido por Cesium ion tiene costo comercial. Se usa la vista 3D del fork.
3. **La simulación del MVP es cinemática, no física.** PX4 SITL + Gazebo no
   simulan un DJI real; quedan fuera.
4. **AeroControl es de solo lectura** mientras dure el MVP. Está en pausa de
   estabilización y su ítem afín (`GEO-14`) está diferido. Cualquier cambio allá
   entra por el `MASTER_PLAN.md` de ese repositorio, no desde aquí.
5. **Nunca se comparte la base de datos** entre ambas aplicaciones. La
   integración es por archivo KMZ primero y por REST después.

## Precedencia documental

Cuando dos documentos parezcan contradecirse, este es el orden de autoridad:

`AGENTS.md` (este archivo) > `MASTER_PLAN.md` (qué hacer y en qué orden) >
`docs/ARCHITECTURE.md` > `docs/MVP.md` > `docs/INTEGRATION_AEROCONTROL.md` >
`docs/REFERENCES.md` > `README.md`.

Si un plan externo propone una convención que choca con lo ya establecido aquí
—nombres de rama, estructura de carpetas, alcance del MVP— se reconcilia a favor
de lo vigente en el repo y se deja constancia en el PR o en `MASTER_PLAN.md`. No
se cambia esta guía en silencio.

## Flujo de trabajo Git

- `main` siempre desplegable. Nunca se modifica directamente.
- Una rama por bloque de trabajo: `codex/<area-o-fase>` (p. ej. `codex/fase-1-fotogrametria`).
  Misma convención que AeroControl — no usar `feat/...`.
- Un PR por fase o por entrega vertical. No mezclar fases distintas en el mismo
  commit.
- `git fetch` **antes** de cualquier push y revisar `git log HEAD..origin/<rama>`.
  Puede haber otra sesión de agente empujando a la misma rama; si divergió,
  **nunca** `push --force`.
- Cada fase cerrada marca su fila ✅ en `MASTER_PLAN.md` y actualiza `HANDOFF.md`.

## Convenciones de dominio (no negociables)

- **`packages/mission-core` no depende de la interfaz.** Nada de imports de
  React, Leaflet, del motor 3D ni del DOM. Si un cálculo necesita el navegador
  para probarse, está en el lugar equivocado.
- **Ningún formato de fabricante entra al dominio.** DJI WPML, KML y GeoJSON son
  *adapters* en `packages/*/exporters`. El modelo de misión no sabe que DJI
  existe.
- **Unidades explícitas en el nombre.** `altitudeM`, `gsdCm`, `distanceM`,
  `durationS`. Un número sin unidad en la firma es un bug esperando su turno.
  Internamente todo va en SI (metros, segundos, m/s); la conversión a pies o
  nudos ocurre solo en la capa de presentación.
- **La altura siempre declara su referencia**: AGL (sobre el terreno), AMSL
  (sobre el nivel del mar) o relativa al punto de despegue. Confundirlas es el
  error clásico que estrella aeronaves. El tipo debe hacerlo imposible.
- **Toda geometría declara su CRS.** WGS84 (EPSG:4326) para almacenamiento e
  intercambio; las proyecciones métricas solo dentro del cálculo, nunca
  persistidas sin declarar.
- **TypeScript estricto.** `strict: true`, sin `any` en el dominio.
- Datos operativos, DEM, ortofotos, nubes de puntos y misiones reales viven
  **fuera del repositorio**. Nunca confirmar geodatos de faena ni tokens de mapas.

## Licencias: verificar antes de portar

Este proyecto es MIT y debe seguir siéndolo. Antes de copiar o adaptar código de
un proyecto de referencia, confirmar su licencia en `docs/REFERENCES.md` y
registrar el origen en el archivo destino:

| Origen | Licencia | Se puede |
| --- | --- | --- |
| DroneRoute, GeoFlight Planner, georaster-layer-for-leaflet | MIT | Portar código, manteniendo el aviso de copyright |
| Potree, PDAL, Fields2Cover | BSD | Portar e integrar, manteniendo el aviso |
| QGroundControl, Mission Planner | GPL / LGPL | **Solo leer como referencia conceptual.** No copiar código |
| WebODM / OpenDroneMap | AGPL-3.0 | **Solo como servicio separado** (su propio contenedor). No enlazar su código |

Una línea copiada de un proyecto GPL contamina todo el repositorio. Ante la duda,
se reimplementa desde la documentación, no desde el código.

## Verificación: cada cálculo necesita un oráculo externo

Los tests que solo comparan el código consigo mismo no prueban nada en un motor
de cálculo geométrico. Antes de marcar ✅:

| Qué se calcula | Contra qué se verifica |
| --- | --- |
| GSD, footprint, traslapes, separación de líneas | Salida de **GeoFlight Planner** sobre el mismo polígono en QGIS, y la ficha técnica de la cámara |
| Export DJI WPML/KMZ | El **control real** lo acepta y muestra la misión completa |
| Terrain following y perfil | Muestreo manual del mismo DEM en **QGIS** |
| Simulación | Duración simulada ≈ duración estimada; nº de footprints = nº de fotos calculado |
| Integración | Round-trip KMZ AeroPlanner → AeroControl → export → re-import, sin pérdida |

Antes de entregar: tests verdes, lint y formato, y **verificación en el navegador**
de lo que se ve. Un cálculo correcto con la capa mal dibujada sigue siendo un
entregable roto.

## Referencias

- Plan de trabajo por fases: `MASTER_PLAN.md` (fuente de verdad de qué sigue).
- Punto de retome: `HANDOFF.md`.
- Arquitectura y límites entre paquetes: `docs/ARCHITECTURE.md`.
- Alcance del MVP y lo explícitamente excluido: `docs/MVP.md`.
- Proyectos de referencia, licencias y qué se toma de cada uno: `docs/REFERENCES.md`.
- Contrato con AeroControl: `docs/INTEGRATION_AEROCONTROL.md`.
