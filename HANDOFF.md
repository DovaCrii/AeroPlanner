# HANDOFF — AeroPlanner

> **Resumen de estado, no bitácora.** La historia detallada vive en `git log`.
> La **fuente de verdad del trabajo pendiente** es [MASTER_PLAN.md](MASTER_PLAN.md).

## Estado al 2026-08-17

**El repositorio existe; la aplicación no.** Lo que hay es la decisión de
arquitectura, el plan de fases y la documentación de producto. Cero código de
aplicación, cero dependencias instaladas.

- **Rama:** `main`.
- **Licencia:** MIT.
- **Repositorio hermano:** [AeroControl](https://github.com/DovaCrii/AeroControl) —
  en **solo lectura** mientras dure el MVP.

## Cómo se llegó hasta aquí

El punto de partida fue un análisis de siete proyectos open source de
planificación UAV, que recomendaba construir AeroPlanner desde cero con React +
CesiumJS en nueve fases. Ese análisis se tomó como **referencial** y se contrastó
contra el repositorio real de AeroControl y contra el estado actual de las
herramientas. Tres conclusiones cambiaron el plan:

1. **DroneRoute ya trae mucho más de lo que el análisis asumía** — mapa 3D con
   terreno, perfil de elevación, obstáculos, frustum de cámara, import/export DJI
   WPML/KMZ, Docker y CLI de carga al control, todo MIT. Partir de un fork da un
   planificador usable en la primera semana, en vez de meses de andamiaje.
2. **CesiumJS no corresponde al MVP** — el runtime es Apache 2.0, pero el terreno
   servido por Cesium ion tiene costo comercial.
3. **AeroControl no puede absorber el planificador** — su límite de frontend
   (Django + Bootstrap + HTMX, sin paso de build) está definido por escrito, y el
   proyecto está en pausa de estabilización.

Además se agregó al alcance algo que el análisis original no cubría: el **visor
de ortofotos y nubes de puntos** (Fase 6), porque cierra el ciclo — el DSM y la
ortofoto del vuelo procesado son mejor insumo para planificar el siguiente que
cualquier fuente pública.

## Qué sigue, exactamente

**Fase 0 completa, empezando por `F0.1`.** No saltar a implementar el motor
fotogramétrico: primero hay que saber qué trae el fork por dentro (auditorías
`F0.4` a `F0.7`), porque de eso depende si la Fase 1 es "conectar" o "reescribir".

Los dos ítems que pueden invalidar el plan y por eso van temprano:

- **`F0.5`** — si el 3D del fork depende de un token comercial, hay que
  reemplazarlo antes de construir encima.
- **`F0.9`** — si el control real de la flota no acepta el KMZ que genera el
  fork, la premisa completa del fork se cae. Verificarlo **antes** de invertir en
  las fases siguientes.

## Decisiones pendientes que solo el usuario puede tomar

- **`F0.2` — estructura del repositorio:** ¿este repo absorbe el código del fork,
  o el fork vive como repositorio aparte y este queda como repositorio de
  producto y documentación? Afecta el historial de git y la trazabilidad del
  upstream.
- **Nombre de despliegue y dominio** (`planner.<dominio>` o similar), y si
  comparte VM con AeroControl.
- **Autonomía operacional y reserva de batería** por modelo de aeronave: son
  números de política de la operación, no constantes técnicas. Inventarlos
  convierte la validación en un estorbo que alguien va a desactivar.
