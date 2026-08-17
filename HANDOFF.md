# HANDOFF — AeroPlanner

> **Resumen de estado, no bitácora.** La historia detallada vive en `git log`.
> La **fuente de verdad del trabajo pendiente** es [MASTER_PLAN.md](MASTER_PLAN.md).

## Estado al 2026-08-17

**El código base está incorporado y compila.** El repositorio dejó de ser solo
documentación: contiene el código de DroneRoute con su historial completo, y la
aplicación se levanta y planifica misiones DJI.

- **Rama:** `main`. **Licencia:** MIT, conservando el copyright original.
- **Remotos:** `origin` (DovaCrii/AeroPlanner) y `upstream` (fcsonline/droneroute).
- **Build:** `npm install && npm run build` verde en los 4 paquetes (Node 26, npm 11).
- **Repositorio hermano:** [AeroControl](https://github.com/DovaCrii/AeroControl) —
  en **solo lectura** mientras dure el MVP.

## Decisiones tomadas el 2026-08-17

1. **Este repositorio absorbe el código**, en vez de mantener un fork aparte. El
   upstream queda como remoto para traer mejoras — publicó tres versiones en un
   mes, así que ese canal vale.
2. **Se migra de Mapbox a MapLibre** (`F0.10`). Hoy la aplicación **no arranca
   sin un token de Mapbox**, lo que contradice el local-first del proyecto.

## Lo que las auditorías cambiaron

Tres supuestos del plan original resultaron falsos. El detalle está en
`MASTER_PLAN.md` → _Hallazgos de auditoría_; el resumen:

- **No hay fotogrametría.** La grilla usa un `spacingM` manual, sin modelo de
  cámara ni traslapes. La Fase 1 pasa de "conectar" a **construir el motor
  entero**.
- **No hay terreno.** Ni `raster-dem`, ni muestreo de elevación. El gráfico de
  elevación grafica la altitud de los waypoints, no el suelo. La Fase 3 es
  **construcción completa**.
- **El token de Mapbox es peor de lo previsto:** no afecta solo al 3D, el mapa
  entero no renderiza sin él.

El lado bueno: al no haber terreno que portar, la migración a MapLibre es más
simple de lo que se temía. Alcance medido: 15 archivos, ~81 ocurrencias.

## Limpieza aplicada al incorporar el código

El merge traía infraestructura apuntando a cuentas ajenas, eliminada antes de
publicar: el `CNAME` de `droneroute.io`, `fly.toml` y su workflow de despliegue
—que se disparaba **en cada push**—, la publicación de imagen a
`fcsonline/droneroute` en Docker Hub, y el auto-merge de dependabot. Se conservó
`ci.yml` (build y lint en PR).

## Migración a MapLibre: hecha (`F0.10`)

La aplicación ya no necesita ningún token. Fuentes elegidas: **OpenFreeMap**
(callejero vectorial), **Esri World Imagery** (satelital — el mismo proveedor que
ya usa AeroControl, así que no entra un tercero nuevo) y **AWS Terrain Tiles**
(relieve). Todas viven en `packages/frontend/src/lib/mapStyles.ts`.

Tres cosas que costaron y conviene no reaprender:

1. `maplibre-gl` **v6 rompe con `react-map-gl` 8.1.1** — la app queda en blanco.
   Está fijado a v5; no subir sin verificar.
2. npm deja `maplibre-gl` dentro del paquete y `@vis.gl/react-maplibre` en la
   raíz, así que la librería no resuelve su peer. Hay un alias en
   `vite.config.ts` que lo arregla; no borrarlo.
3. MapLibre no tiene `map.project(lngLat, altitude)`. La línea vertical del
   waypoint ahora se aproxima con la escala del mapa y el pitch.

## Qué sigue, exactamente

**`F0.9` es la prioridad:** verificar que el KMZ que genera la aplicación **lo
acepta el control real de la flota**. Es el único riesgo que todavía puede
invalidar la premisa de haber partido de este código, y hasta despejarlo toda
inversión en las fases siguientes es apuesta. Necesita a alguien con el RC
delante.

Después, sin dependencias entre sí:

- **`F0.8`** — desplegar WebODM en su contenedor: procesar y ver ortofoto y nube
  de puntos sin escribir una línea.
- **Fase 1** — el motor fotogramétrico, que las auditorías confirmaron que hay
  que construir entero.

## Decisiones pendientes que solo el usuario puede tomar

- **Nombre de despliegue y dominio** (`planner.<dominio>`), y si comparte VM con
  AeroControl.
- **Autonomía operacional y reserva de batería** por modelo de aeronave: son
  números de política de la operación, no constantes técnicas. Inventarlos
  convierte la validación en un estorbo que alguien va a desactivar.
