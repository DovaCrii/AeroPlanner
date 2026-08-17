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

## Herencia de DroneRoute

Este repositorio **deriva de [DroneRoute](https://github.com/fcsonline/droneroute)**
(MIT, de Ferran Basora), incorporado con su historial completo el 2026-08-17.

- El upstream está configurado como remoto: `git fetch upstream` trae sus
  novedades, y se integran con un merge deliberado. **Vale la pena hacerlo con
  regularidad**: el proyecto original publicó tres versiones en un mes.
- El aviso de copyright original **no se elimina nunca** del `LICENSE` — lo exige
  la licencia MIT y es la condición que permite este derivado.
- El código heredado trae convenciones propias que se respetan (ver *Convenciones
  del código heredado*). Donde chocan con las nuestras, manda esta guía y el
  choque queda documentado abajo.

## Decisiones ya tomadas (no reabrir sin que el usuario lo pida)

1. **Se parte del código de DroneRoute**, no de un desarrollo desde cero. Ya
   resuelve mapa, waypoints, plantillas de misión, import/export DJI WPML/KMZ,
   Docker y CLI de carga al control. Lo que el MVP agrega es lo que le falta:
   motor fotogramétrico paramétrico, corredores, terrain following, simulación y
   validación.
2. **Se migra de Mapbox a MapLibre.** El código heredado usa `mapbox-gl` v3 con
   `MAPBOX_TOKEN` obligatorio para renderizar el mapa — licencia propietaria,
   cuenta de terceros y facturación por cargas. MapLibre GL (BSD) con teselas
   libres o propias es coherente con el local-first del proyecto. `react-map-gl`
   ya soporta MapLibre oficialmente, así que el cambio es acotado.
3. **CesiumJS queda fuera del MVP.** El runtime es Apache 2.0, pero el terreno
   servido por Cesium ion tiene costo comercial.
4. **La simulación del MVP es cinemática, no física.** PX4 SITL + Gazebo no
   simulan un DJI real; quedan fuera.
5. **AeroControl es de solo lectura** mientras dure el MVP. Está en pausa de
   estabilización y su ítem afín (`GEO-14`) está diferido. Cualquier cambio allá
   entra por el `MASTER_PLAN.md` de ese repositorio, no desde aquí.
6. **Nunca se comparte la base de datos** entre ambas aplicaciones. La
   integración es por archivo KMZ primero y por REST después.

## Precedencia documental

Cuando dos documentos parezcan contradecirse, este es el orden de autoridad:

`AGENTS.md` (este archivo) > `MASTER_PLAN.md` (qué hacer y en qué orden) >
`docs/ARCHITECTURE.md` > `docs/MVP.md` > `docs/INTEGRATION_AEROCONTROL.md` >
`docs/REFERENCES.md` > `README.md` > documentación heredada (`GUIDE.md`,
`SPEC.md`, `specs/`, `CLAUDE.md`), que describe el producto original y puede
estar desalineada con el nuestro.

Si un plan externo propone una convención que choca con lo ya establecido aquí
—nombres de rama, estructura de carpetas, alcance del MVP— se reconcilia a favor
de lo vigente en el repo y se deja constancia en el PR o en `MASTER_PLAN.md`. No
se cambia esta guía en silencio.

## Flujo de trabajo Git

- `main` siempre desplegable. **Nunca se commitea ni se empuja directamente a
  `main`** — regla heredada del upstream y coincide con la nuestra.
- Una rama por bloque de trabajo: `codex/<area-o-fase>` (p. ej.
  `codex/fase-1-fotogrametria`). **Esta es la convención vigente**, la misma de
  AeroControl. El código heredado usa `feat/`/`fix/`; se reconcilia a favor de
  `codex/` por coherencia entre los dos repositorios del usuario.
- Un PR por fase o entrega vertical, con su entrada en `changelog/` (convención
  heredada que el CI espera). No mezclar fases distintas en un commit.
- `git fetch` **antes** de cualquier push. Puede haber otra sesión de agente
  empujando a la misma rama; si divergió, **nunca** `push --force`.
- **Nunca fusionar un PR sin permiso explícito del usuario.** Que diga "dale" o
  "hazlo" significa implementar y empujar, no fusionar.
- Cada fase cerrada marca su fila ✅ en `MASTER_PLAN.md` y actualiza `HANDOFF.md`.

## Calidad obligatoria antes de cada commit/PR

```bash
npm run build && npm run lint && npm run fmt:check
```

`npm run build` es **obligatorio localmente antes de empujar** — no se usa el CI
como primer chequeo de compilación. Un hook de `lefthook` corre `prettier --check`
y `oxlint` sobre los archivos en stage al commitear: si fallan, el commit se
rechaza. Se arregla con `npm run fmt`.

Comandos de uso diario:

```bash
npm run dev          # backend + frontend en paralelo
npm run lint:fix     # corrige lo que oxlint puede arreglar solo
```

## Convenciones de dominio (no negociables)

- **`packages/mission-core` no depende de la interfaz.** Nada de imports de
  React, del motor de mapa ni del DOM. Si un cálculo necesita el navegador para
  probarse, está en el lugar equivocado.
- **Ningún formato de fabricante entra al dominio.** DJI WPML, KML y GeoJSON son
  *adapters*. El modelo de misión no sabe que DJI existe.
- **Unidades explícitas en el nombre.** `altitudeM`, `gsdCm`, `distanceM`,
  `durationS`. Un número sin unidad en la firma es un bug esperando su turno.
  Internamente todo va en SI; la conversión a pies o nudos ocurre solo en la capa
  de presentación.
- **La altura siempre declara su referencia**: AGL, AMSL o relativa al despegue.
  Confundirlas es el error clásico que estrella aeronaves. El tipo debe hacerlo
  imposible.
- **Toda geometría declara su CRS.** WGS84 (EPSG:4326) para almacenar e
  intercambiar; las proyecciones métricas solo dentro del cálculo.
- **TypeScript estricto.** Sin `any` en el dominio.
- Datos operativos, DEM, ortofotos, nubes de puntos y misiones reales viven
  **fuera del repositorio**. Nunca confirmar geodatos de faena ni tokens de mapas.

## Convenciones del código heredado (se respetan)

Reglas del upstream que aplican al código que ahora mantenemos:

**Seguridad.** Toda ruta de API que maneje datos de usuario valida el token JWT
como primera operación, y toda consulta se acota con el ID del usuario
autenticado tomado del JWT — nunca con un `userId` enviado por el cliente. Las
consultas usan sentencias parametrizadas (`?` de `better-sqlite3`), jamás
concatenación. Las cargas de KMZ/WPML se validan por extensión, tipo MIME y
tamaño máximo, y no se usa el nombre de archivo del usuario en el filesystem.
Nunca se exponen errores crudos ni trazas al cliente.

**Entorno.** Los `.env` no se confirman. `JWT_SECRET` debe ser aleatorio de
verdad en producción. En Docker la base de datos va en el montaje `/app/data/`,
nunca en una ruta del host. Antes de correr cualquier script que escriba en una
base de datos, verificar el destino: si apunta a un host remoto, detenerse y
confirmar con el usuario.

**Texto de interfaz en *sentence case*.** Solo la primera palabra y los nombres
propios en mayúscula. Las siglas se mantienen (WP, POI, KMZ, RTH, AGL, MSL).
Correcto: `"Grid survey"`, `"Heading mode"`. Incorrecto: `"Grid Survey"`.

**Versionado sincronizado.** Todos los paquetes del monorepo comparten versión
con la raíz, incluido `packages/cli`.

## Licencias: verificar antes de portar

Este proyecto es MIT y debe seguir siéndolo. Antes de copiar o adaptar código de
un proyecto de referencia, confirmar su licencia en `docs/REFERENCES.md` y
registrar el origen en el archivo destino:

| Origen | Licencia | Se puede |
| --- | --- | --- |
| DroneRoute, GeoFlight Planner, georaster-layer-for-leaflet | MIT | Portar código, manteniendo el aviso de copyright |
| Potree, PDAL, Fields2Cover, MapLibre GL | BSD | Portar e integrar, manteniendo el aviso |
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

Antes de entregar: build, lint y formato en verde, y **verificación en el
navegador** de lo que se ve. Un cálculo correcto con la capa mal dibujada sigue
siendo un entregable roto.

## Referencias

- Plan de trabajo por fases: `MASTER_PLAN.md` (fuente de verdad de qué sigue).
- Punto de retome: `HANDOFF.md`.
- Arquitectura y límites entre paquetes: `docs/ARCHITECTURE.md`.
- Alcance del MVP y lo explícitamente excluido: `docs/MVP.md`.
- Proyectos de referencia, licencias y qué se toma de cada uno: `docs/REFERENCES.md`.
- Contrato con AeroControl: `docs/INTEGRATION_AEROCONTROL.md`.
- Documentación heredada del producto original: `GUIDE.md`, `SPEC.md`, `specs/`.
