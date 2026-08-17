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

## Qué sigue, exactamente

**`F0.10`, la migración a MapLibre**, es lo más urgente: sin ella no hay
despliegue interno posible sin contratar Mapbox. Requiere una decisión previa —
**de dónde salen las teselas base y la imagen satelital** (OpenFreeMap,
Protomaps, teselas propias), que es donde el usuario tiene que opinar.

En paralelo, sin dependencias entre sí:

- **`F0.9`** — verificar que el KMZ que genera la aplicación **lo acepta el
  control real**. Es el único riesgo que todavía puede invalidar la premisa de
  haber partido de este código; conviene despejarlo pronto.
- **`F0.8`** — desplegar WebODM en su contenedor: procesar y ver ortofoto y nube
  de puntos sin escribir una línea.
- **`F0.6`** y **`F0.7`** — auditorías de autenticación multiusuario y del modelo
  de misión frente al contrato con AeroControl.

## Decisiones pendientes que solo el usuario puede tomar

- **Proveedor de teselas** para la migración a MapLibre (afecta calidad visual y
  si hace falta servir teselas propias).
- **Nombre de despliegue y dominio** (`planner.<dominio>`), y si comparte VM con
  AeroControl.
- **Autonomía operacional y reserva de batería** por modelo de aeronave: son
  números de política de la operación, no constantes técnicas. Inventarlos
  convierte la validación en un estorbo que alguien va a desactivar.
