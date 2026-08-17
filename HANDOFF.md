# HANDOFF — AeroPlanner

> **Resumen de estado, no bitácora.** La historia detallada vive en `git log`.
> La **fuente de verdad del trabajo pendiente** es [MASTER_PLAN.md](MASTER_PLAN.md).

## Cómo seguir (leer esto primero)

**Hay dos PRs abiertos y apilados.** Nada está en `main` todavía:

| PR                                                   | Rama                         | Qué trae                                  |
| ---------------------------------------------------- | ---------------------------- | ----------------------------------------- |
| [#1](https://github.com/DovaCrii/AeroPlanner/pull/1) | `codex/fase-0-maplibre`      | Fase 0: auditorías + migración a MapLibre |
| [#2](https://github.com/DovaCrii/AeroPlanner/pull/2) | `codex/fase-1-fotogrametria` | Fase 1: motor fotogramétrico              |

El #2 apunta al #1, no a `main`. **Fusionar el #1 primero**; GitHub reapunta el
#2 a `main` solo. No fusionar sin que el usuario lo pida explícitamente.

### El siguiente paso que más vale

**`F0.9`: cargar en el control real un KMZ exportado por la aplicación.**

Es el único riesgo abierto que puede invalidar la premisa completa de haber
partido de este código, y ninguna fase posterior lo despeja. Hasta hacerlo, todo
lo que se construya encima es apuesta. **Necesita a una persona con el RC
delante** — no se puede automatizar.

Cómo: levantar la app, dibujar una grilla, `Export KMZ`, cargar el archivo al
control y confirmar que la misión aparece completa (waypoints, alturas, acciones
de cámara). Si falla, hay que entender por qué **antes** de seguir.

### Y después, en este orden

1. **Terminar la Fase 2 — corredores.** El motor ya está
   (`packages/mission-core/corridor/`, 17 pruebas): offsets con esquinas
   correctas y serpenteo. Falta la **interfaz**: dibujar o importar el eje
   (`F2.1`) y convertir las líneas en waypoints con orientación de cámara
   (`F2.4`).
2. **Fase 3 — terrain following.** `queryTerrainElevation()` de MapLibre es el
   camino directo para muestrear el DEM que la vista 3D ya carga.
3. **Fase 4 — simulación**, y **Fase 5 — integración con AeroControl**.

## Alcance: planificar y visualizar, nunca procesar

Decidido el 2026-08-17. Son dos cosas que la palabra "fotogrametría" confunde:

- **Calcular** una misión (GSD, traslapes, separación) es aritmética: corre en el
  navegador en microsegundos. Es lo que hace `mission-core`.
- **Procesar** un vuelo (ortofoto, nube de puntos, DSM desde cientos de fotos)
  exige horas de CPU y 16–64 GB de RAM. **No hay hardware para eso**, así que
  `F0.8` (WebODM) queda descartado.
- **Visualizar** productos ya generados **sí entra** (Fase 6): un COG se lee por
  rangos HTTP y un COPC trae octree, de modo que el navegador descarga solo lo
  que hay en pantalla. Es lo mismo que hace cualquier herramienta comercial, y no
  pide una estación de trabajo.

Regla corta: **la aplicación abre lo que otro procesó; no lo genera.**

### Antes de tocar código

Leer [AGENTS.md](AGENTS.md). En corto: rama `codex/<fase>`, nunca commitear a
`main`, `npm run build` **antes** de empujar, y `packages/mission-core` no
importa React ni el mapa ni el DOM. Un hook de `lefthook` rechaza el commit si
`prettier` u `oxlint` fallan.

---

## Estado al 2026-08-17

- **Build:** `npm install && npm run build` verde en los 5 paquetes (Node 26).
- **Tests:** 32 en `mission-core` + 33 en el backend.
- **Remotos:** `origin` (DovaCrii/AeroPlanner) y `upstream` (fcsonline/droneroute).
- **Licencia:** MIT, conservando el copyright original de DroneRoute.
- **Repositorio hermano:** [AeroControl](https://github.com/DovaCrii/AeroControl) —
  en **solo lectura** mientras dure el MVP.

La aplicación levanta, planifica misiones DJI y exporta KMZ **sin ningún token**.

## Decisiones tomadas

1. **Este repositorio absorbe el código** de DroneRoute, en vez de mantener un
   fork aparte. El upstream queda como remoto para traer mejoras — publicó tres
   versiones en un mes, así que ese canal vale.
2. **MapLibre en vez de Mapbox**, porque la app no arrancaba sin token y eso
   contradice el local-first del proyecto.

## Lo que las auditorías cambiaron

Cuatro supuestos del plan original resultaron falsos. Detalle en
`MASTER_PLAN.md` → _Hallazgos de auditoría_:

- **No había fotogrametría.** La grilla usaba un `spacingM` manual. La Fase 1
  pasó de "conectar" a **construir el motor entero** — ya está hecho.
- **No hay muestreo de elevación.** Sí hay terreno visual, pero nadie consulta la
  altura del suelo. La Fase 3 sigue siendo construcción completa.
- **El multiusuario ya funciona**; el riesgo real es el `JWT_SECRET` (ver abajo).
- **El modelo de misión es un modelo DJI**, no de dominio. `mission-core` trae el
  modelo propio; el heredado queda como capa de exportación.

> **Ojo:** `services/airspace/provider-dgac.ts` es la DGAC **de Francia**. No hay
> cobertura de espacio aéreo chileno.

## Riesgo de seguridad a cerrar antes de desplegar

**Sin `JWT_SECRET` definido, el modo self-hosted arranca igual**, con un secreto
por defecto que está publicado en el código fuente. Como el registro de usuarios
está abierto, cualquiera que alcance la instancia puede crear cuenta y, con ese
secreto conocido, firmarse un token `isAdmin: true`. Definirlo (≥32 caracteres,
aleatorio) **no es opcional** en el despliegue interno.

## Trampas ya pagadas (no reaprenderlas)

1. `maplibre-gl` **v6 rompe con `react-map-gl` 8.1.1** — la app queda en blanco
   con `Cannot read properties of undefined (reading 'center')`. Fijado a v5.
2. npm deja `maplibre-gl` dentro del paquete y `@vis.gl/react-maplibre` en la
   raíz, así que la librería no resuelve su peer. Hay un alias en
   `vite.config.ts`; **no borrarlo**.
3. MapLibre no tiene `map.project(lngLat, altitude)`. La línea vertical del
   waypoint se aproxima con la escala del mapa y el pitch.
4. El panel de vista previa del entorno de desarrollo **no compone WebGL**: el
   mapa parece roto ahí aunque funcione. Para verlo de verdad hay que renderizar
   fuera de ese panel.

## Decisiones pendientes que solo el usuario puede tomar

- **Autonomía operacional y reserva de batería.** Ya están expuestas en la
  configuración de misión, con la reserva en 0 por defecto para no cambiar en
  silencio lo que reportan las misiones existentes. Los números reales son
  política de la operación, no constantes técnicas.
- **Nombre de despliegue y dominio** (`planner.<dominio>`), y si comparte VM con
  AeroControl.
- **Proveedor de teselas** si OpenFreeMap o Esri no convencen: se cambia en un
  solo archivo, `packages/frontend/src/lib/mapStyles.ts`.
