<div align="center">

<img src="assets/aeroplanner-mark.svg" width="140" height="105" alt="Logo de AeroPlanner" />

# AeroPlanner

**Planificación, simulación y visualización de misiones RPA/UAS: del polígono en el mapa al KMZ que vuela.**

[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-FF9F1C.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-1B2A4A.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-19-1B2A4A.svg)](https://react.dev/)
[![Estado](https://img.shields.io/badge/estado-fase%200%20·%20base%20heredada-FF9F1C.svg)](#estado-actual)

Aplicación hermana de **[AeroControl](https://github.com/DovaCrii/AeroControl)** · funcionan por separado, se comunican cuando conviene

</div>

---

## Qué es

AeroPlanner es el planificador de vuelo que le falta a una operación de drones
profesional: se dibuja el área o el corredor, se elige aeronave y cámara, se fija
el GSD y los traslapes, y la misión se genera sola — con su ruta, sus waypoints,
su altura sobre el terreno real y su exportación lista para cargar al control.
Antes de volar se puede **simular**: ver el dron recorrer la ruta, cuándo dispara
cada foto, cuánta batería queda y dónde queda cobertura floja.

Es **local-first**, igual que AeroControl: corre en un servidor de la
organización, sin depender de la nube de un fabricante y sin mandar la
planificación de faena a un tercero.

**Para quién.** Pilotos y jefaturas de operaciones que hoy planifican en la app
del fabricante, en QGIS o directamente en terreno, y necesitan que la misión
quede calculada, verificada contra el permiso vigente y archivada junto al resto
de la operación.

## Qué resuelve

| Módulo                  | Qué hace                                                                                                        | Estado        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | ------------- |
| **Planificación**       | Waypoints, POI, grid survey, órbita y escaneo de fachada                                                        | Heredado      |
| **Exportación**         | DJI WPML/KMZ listo para el control, con carga por USB al RC                                                     | Heredado      |
| **Fotogrametría**       | GSD ↔ altura de vuelo, footprint, traslapes, separación de líneas, intervalo de disparo y velocidad recomendada | Por construir |
| **Corredores**          | Rutas paralelas sobre un eje: líneas eléctricas, caminos, corredores mineros                                    | Por construir |
| **Terreno**             | DEM/DSM, vuelo a altura constante sobre el suelo, clearance mínimo y perfil                                     | Por construir |
| **Simulación**          | Recorrido animado con línea de tiempo, telemetría estimada y footprints de foto                                 | Por construir |
| **Validación**          | Autonomía y baterías, clearance, y contraste contra la envolvente del permiso DGAC                              | Por construir |
| **Visor de resultados** | Carga y muestra ortofotos (COG) y nubes de puntos (COPC) ya procesadas — **no las genera**                      | Por construir |

## Cómo se relaciona con AeroControl

Son **dos aplicaciones independientes**, cada una con su base de datos. Ninguna
necesita a la otra para funcionar.

```
AeroControl                          AeroPlanner
flota · operadores · permisos        geometría · fotogrametría · terreno
cumplimiento · centros de costo      simulación · validación · exportación
vuelos ejecutados · GeoPlan
        │                                        │
        └────────────  KMZ / REST  ──────────────┘
               nunca comparten base de datos
```

AeroControl es el **centro operacional** (quién vuela, con qué aeronave, bajo qué
permiso y con qué documentación al día). AeroPlanner es el **taller de la misión**
(cómo se vuela ese trabajo). La integración parte por el camino más simple —
AeroPlanner exporta un KMZ que AeroControl importa y versiona como GeoPlan — y
recién después pasa a la API. El detalle del contrato está en
[docs/INTEGRATION_AEROCONTROL.md](docs/INTEGRATION_AEROCONTROL.md).

**Por qué separados y no un módulo más de AeroControl:** AeroControl es Django con
Bootstrap y HTMX, sin paso de build en el frontend, y así está definido su límite
técnico. Un planificador necesita React, WebGL, terreno 3D, rasterización de DEM y
animación — meterlo dentro haría más difícil mantener las dos cosas.

## Estado actual

**Fase 0 — base heredada, en auditoría.** El repositorio ya tiene el código de
[DroneRoute](https://github.com/fcsonline/droneroute), incorporado con su
historial completo: la aplicación se levanta y planifica misiones DJI hoy. Lo que
falta es todo lo que define a AeroPlanner — el motor fotogramétrico, los
corredores, el terreno, la simulación y la validación contra el permiso.

**Ya no hace falta ningún token de mapas.** El código heredado exigía un
`MAPBOX_TOKEN` para renderizar; la migración a MapLibre está hecha y las fuentes
son OpenFreeMap (callejero), Esri (satelital) y AWS Terrain Tiles (relieve),
todas sin cuenta ni cuota.

Lo pendiente vive en dos documentos, no en este README:

- **[MASTER_PLAN.md](MASTER_PLAN.md)** — el tablero de fases, con criterio de
  aceptación y oráculo de verificación por ítem.
- **[HANDOFF.md](HANDOFF.md)** — el punto exacto de retome para quien siga el
  trabajo.

## Puesta en marcha

Requisitos: Node.js 20+ y npm. Para el despliegue, Docker.

```bash
git clone https://github.com/DovaCrii/AeroPlanner.git
cd AeroPlanner
npm install
cp .env.example .env
npm run dev
```

Antes de levantar hay que editar el `.env` y poner un `JWT_SECRET` aleatorio de
verdad (mínimo 32 caracteres). **No es opcional:** sin él, el modo self-hosted
arranca con un secreto por defecto que está publicado en el código fuente, y
cualquiera podría firmarse un token de administrador.

### Comandos frecuentes

```bash
npm run build        # obligatorio antes de empujar
npm run lint         # oxlint
npm run fmt          # prettier --write
```

Un hook de `lefthook` corre formato y lint sobre los archivos en stage al
commitear. La guía completa de trabajo está en [AGENTS.md](AGENTS.md).

## Decisiones ya tomadas

No se reabren sin que el usuario lo pida (el fundamento está en `docs/`):

- **Se parte del código de DroneRoute**, no de un desarrollo desde cero — da un
  planificador usable de inmediato y ya resuelve el export DJI WPML/KMZ, que es
  el requisito crítico de la flota.
- **Planifica y visualiza; no procesa.** Calcular una misión es aritmética que
  corre en el navegador. Reconstruir una ortofoto desde cientos de fotos pide
  horas de CPU y decenas de GB de RAM, y eso queda fuera. Abrir productos ya
  generados sí entra: un COG se lee por rangos HTTP y un COPC trae octree, así
  que el navegador descarga solo lo que hay en pantalla.
- **MapLibre en vez de Mapbox** (hecho) — `mapbox-gl` v3 es de licencia
  propietaria, exige token y factura por cargas de mapa. Las fuentes viven en
  `packages/frontend/src/lib/mapStyles.ts`; ese es el único archivo a tocar si
  algún día se sirven teselas propias.
- **Sin CesiumJS en el MVP** — el terreno 3D servido por Cesium ion tiene costo
  comercial.
- **Simulación cinemática, no física** — PX4 SITL y Gazebo quedan fuera: no
  simulan un DJI real y no aportan al objetivo de planificar bien.
- **AeroControl en solo lectura** durante todo el MVP — está en pausa de
  estabilización; cualquier cambio allá entra por su propio `MASTER_PLAN.md`.

## Créditos

AeroPlanner deriva de **[DroneRoute](https://github.com/fcsonline/droneroute)**,
de Ferran Basora, bajo licencia MIT. El planificador de waypoints, el motor de
exportación DJI WPML/KMZ y la CLI de carga al control vienen de ese trabajo. La
documentación heredada del producto original se conserva en `GUIDE.md`, `SPEC.md`
y `specs/`.

## Licencia

MIT, conservando el aviso de copyright original de DroneRoute — ver
[LICENSE](LICENSE). Las licencias del software de referencia y de las
dependencias están detalladas en [docs/REFERENCES.md](docs/REFERENCES.md).
