# Arquitectura — AeroPlanner

> Estado: **propuesta de Fase 0.** Se confirma o se corrige con el resultado de
> las auditorías `F0.4`–`F0.7` de [MASTER_PLAN.md](../MASTER_PLAN.md).

## Principio rector

**El dominio no sabe que existe una pantalla.** Todo lo que calcula —
fotogrametría, corredores, terreno, simulación, validación — vive en un paquete
sin una sola importación de React, del mapa o del DOM, y se prueba en Node sin
navegador. La interfaz consume ese paquete; nunca al revés.

La razón es práctica: los errores caros de un planificador de vuelo son errores
de cálculo, y un cálculo enterrado en un componente de interfaz no se puede
probar contra un oráculo externo. Si una fórmula necesita el navegador para
verificarse, está en el lugar equivocado.

## Despliegue

```
VM / Docker Compose
├── AeroControl        Django · centro operacional (existente, independiente)
└── AeroPlanner        derivado de DroneRoute (MIT) · planificación y simulación
```

Ambos funcionan por separado. Que uno esté caído no detiene al otro.

**No hay servicio de procesamiento fotogramétrico, y es deliberado.** Reconstruir
una ortofoto o una nube de puntos desde cientos de fotos pide horas de CPU y
decenas de GB de RAM, y no hay hardware para eso. Lo que sí hace la aplicación es
**abrir productos ya generados**: un COG se lee por rangos HTTP y un COPC trae un
octree interno, de modo que el navegador descarga únicamente lo que cabe en
pantalla. El visor es trabajo del cliente, no del servidor.

Si alguna vez hace falta procesar, la vía es un equipo dedicado o un servicio en
la nube — decisión de presupuesto, no de arquitectura.

## Estructura del repositorio

Monorepo npm, heredado de DroneRoute, más el paquete de dominio propio:

```
AeroPlanner/
├── packages/
│   ├── frontend        React 19 + TypeScript + Vite · Leaflet 2D + vista 3D
│   ├── backend         Express + SQLite · proyectos, misiones, usuarios
│   ├── shared          tipos compartidos frontend/backend
│   ├── cli             carga de KMZ al control DJI por USB
│   └── mission-core    ← NUEVO · dominio puro, sin dependencias de interfaz
│       ├── photogrammetry/   GSD ↔ altura, footprint, traslapes, intervalo, velocidad
│       ├── corridor/         eje → buffer → líneas paralelas → waypoints
│       ├── terrain/          DEM/DSM, AGL, clearance, perfil
│       ├── simulation/       cinemática: posición, rumbo, altura, batería, disparos
│       ├── validation/       autonomía, clearance, envolvente del permiso DGAC
│       ├── exporters/        adapters DJI WPML/KMZ · KML · GeoJSON
│       └── contract/         modelo de misión e intercambio con AeroControl
├── docs/
└── assets/
```

## Modelo de misión

El modelo interno es **agnóstico del fabricante**. DJI, KML y GeoJSON son
traducciones de salida, no la representación de trabajo.

```
Mission
├── metadata          id, título, referencia externa, versión de esquema
├── aircraft          modelo, autonomía operacional, velocidades límite
├── camera            sensor, focal, resolución, intervalo mínimo
├── home              punto de despegue
├── items[]           waypoint · survey · corridor · orbit
├── parameters        GSD, traslapes, AGL objetivo, velocidad, orientación de grilla
├── terrain           fuente de DEM, modo de seguimiento, clearance mínimo
├── statistics        distancia, duración, superficie, nº de fotos, baterías
└── validation        resultados de las verificaciones
```

Preparado para incorporar después, sin rehacer el modelo: fachada, _structure
scan_, inspección y survey oblicuo.

## Reglas de tipos que evitan accidentes

Dos convenciones que el compilador debe hacer cumplir, porque los errores que
previenen no son hipotéticos:

**La altura declara su referencia.** AGL (sobre el terreno), AMSL (sobre el nivel
del mar) y relativa al despegue no son intercambiables. Un tipo que las mezcle
permite escribir la confusión que estrella aeronaves en terreno con pendiente.

**Toda medida lleva su unidad en el nombre** y se almacena en SI: `altitudeM`,
`gsdCm`, `distanceM`, `durationS`, `speedMs`. La conversión a pies o nudos ocurre
en la capa de presentación, nunca en el dominio. El permiso DGAC habla en pies
(`max_altitude_ft`), y ese es exactamente el punto de conversión donde un error
pasa desapercibido.

**Toda geometría declara su CRS.** WGS84 (EPSG:4326) para almacenar e
intercambiar; las proyecciones métricas existen solo dentro del cálculo y no se
persisten sin declararse.

## Flujo de datos

```
polígono o eje dibujado / importado (KML)
        ↓
  parámetros: aeronave · cámara · GSD · traslapes · AGL
        ↓
  photogrammetry ──→ separación de líneas, intervalo, velocidad
        ↓
  corridor / survey ──→ geometría de la ruta
        ↓
  terrain ──→ altitud por waypoint sobre el DEM/DSM
        ↓
  Mission ──→ statistics · validation
        ↓
  ┌─────────────┬──────────────┬─────────────────┐
simulación    exporters     integración
(revisión)  (DJI/KML/GeoJSON)  (AeroControl)
```

## Qué se decide en Fase 0

Cuatro puntos quedan deliberadamente abiertos hasta auditar el fork, porque
decidirlos antes sería adivinar:

1. **Motor de mapa 3D y fuente de elevación.** Si depende de un token comercial,
   se reemplaza por MapLibre + teselas libres antes de construir encima (`F0.5`).
2. **Multiusuario.** El self-host del fork es una instancia personal de una sola
   cuenta; habilitar varios usuarios es acotado pero hay que medirlo (`F0.6`).
3. **Persistencia.** SQLite alcanza para el MVP. PostgreSQL cuando haya
   concurrencia real — mismo criterio que AeroControl, no antes.
4. **Almacenamiento de productos pesados.** Ortofotos y nubes de puntos no van a
   la base de datos: filesystem o almacenamiento de objetos, con la ruta
   registrada. Se define en Fase 6.
