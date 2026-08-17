<div align="center">

<img src="assets/aeroplanner-mark.svg" width="140" height="105" alt="Logo de AeroPlanner" />

# AeroPlanner

**Planificación, simulación y visualización de misiones RPA/UAS: del polígono en el mapa al KMZ que vuela.**

[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-FF9F1C.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-1B2A4A.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-19-1B2A4A.svg)](https://react.dev/)
[![Estado](https://img.shields.io/badge/estado-fase%200%20·%20sin%20código-FF9F1C.svg)](#estado-actual)

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

| Módulo | Qué hace |
| --- | --- |
| **Planificación** | Área/survey, corredores lineales, waypoints manuales y órbitas, desde geometría dibujada o importada (KML/KMZ) |
| **Fotogrametría** | GSD ↔ altura de vuelo, footprint de cámara, traslape frontal y lateral, separación de líneas, intervalo de disparo y velocidad recomendada |
| **Terreno** | Muestreo de DEM/DSM, vuelo a altura constante sobre el suelo (*terrain following*), clearance mínimo y perfil terreno/vuelo |
| **Simulación** | Recorrido animado de la misión en 2D/3D con línea de tiempo, telemetría estimada y footprints de foto para ver traslapes y huecos |
| **Validación** | Autonomía y división por baterías, clearance, y contraste contra la envolvente del permiso DGAC (altura máxima, radio, vigencia) |
| **Exportación** | DJI WPML/KMZ listo para el control, más KML y GeoJSON |
| **Visor de resultados** | Ortofotos (COG) y nubes de puntos (COPC/Potree) del vuelo ya procesado, reutilizables como base de la siguiente planificación |

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

**Fase 0 — repositorio recién inicializado.** Hoy este repo contiene la decisión
de arquitectura, el plan de trabajo y esta documentación; **todavía no hay código
de aplicación**. El primer paso es partir del fork de
[DroneRoute](https://github.com/fcsonline/droneroute) (MIT) y auditarlo, en vez de
escribir un planificador desde cero.

Lo pendiente vive en dos documentos, no en este README:

- **[MASTER_PLAN.md](MASTER_PLAN.md)** — el tablero de fases, con criterio de
  aceptación y oráculo de verificación por ítem.
- **[HANDOFF.md](HANDOFF.md)** — el punto exacto de retome para quien siga el
  trabajo.

## Puesta en marcha

Todavía no aplica: no hay código que ejecutar. Cuando la Fase 0 cierre, esta
sección tendrá el `git clone` + `docker compose up` correspondiente.

Mientras tanto, para entender el proyecto en orden:

1. [docs/MVP.md](docs/MVP.md) — qué entra en la primera versión y qué no.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — cómo se separa el dominio de la interfaz.
3. [docs/REFERENCES.md](docs/REFERENCES.md) — de dónde sale cada pieza y bajo qué licencia.
4. [MASTER_PLAN.md](MASTER_PLAN.md) — por dónde se empieza.

## Decisiones ya tomadas

No se reabren sin que el usuario lo pida (el fundamento está en `docs/`):

- **Fork de DroneRoute**, no desarrollo desde cero — da un planificador usable
  desde la primera semana y ya resuelve el export DJI WPML/KMZ, que es el
  requisito crítico de la flota.
- **Sin CesiumJS en el MVP** — el terreno 3D servido por Cesium ion tiene costo
  comercial; se usa la vista 3D que el fork ya trae.
- **Simulación cinemática, no física** — PX4 SITL y Gazebo quedan fuera: no
  simulan un DJI real y no aportan al objetivo de planificar bien.
- **AeroControl en solo lectura** durante todo el MVP — está en pausa de
  estabilización; cualquier cambio allá entra por su propio `MASTER_PLAN.md`.

## Licencia

MIT. Ver [LICENSE](LICENSE). Las licencias del software de referencia y de las
dependencias previstas están detalladas en [docs/REFERENCES.md](docs/REFERENCES.md).
