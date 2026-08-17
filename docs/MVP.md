# MVP — AeroPlanner

## La frase que define el alcance

> Dibujar o importar una zona, configurar aeronave y cámara, generar la misión
> automáticamente, verla en 2D/3D, simular su ejecución, validarla y exportarla.

Todo lo que no sirva a esa frase queda fuera de la primera versión. En particular
**no** se está construyendo una estación de control terrestre: AeroPlanner
planifica y verifica en el escritorio; volar y telemetría en vivo son otro
problema.

## Qué entra

| Capacidad                                          | Fase | Notas                                                      |
| -------------------------------------------------- | ---- | ---------------------------------------------------------- |
| Crear proyecto y misión                            | 0    | Ya en el fork                                              |
| Dibujar AOI · importar KML/KMZ                     | 0    | Ya en el fork                                              |
| Waypoints manuales, POI, acciones de cámara        | 0    | Ya en el fork                                              |
| Survey/grilla, órbita, escaneo de fachada          | 0    | Ya en el fork; la grilla se reemplaza o envuelve en Fase 1 |
| Mapa 2D y vista 3D                                 | 0    | Ya en el fork; fuente de elevación por confirmar           |
| Exportar DJI WPML/KMZ · KML · GeoJSON              | 0    | Ya en el fork; **verificar contra el control real**        |
| Seleccionar aeronave y cámara                      | 1    | Catálogo propio, partiendo por el Mavic 3E                 |
| GSD ↔ altura de vuelo                              | 1    |                                                            |
| Traslape frontal y lateral → separación de líneas  | 1    |                                                            |
| Intervalo de disparo y velocidad sin _motion blur_ | 1    |                                                            |
| Distancia, duración, superficie, nº de fotos       | 1    |                                                            |
| Baterías estimadas y división de la misión         | 1    | Con reserva configurable                                   |
| Corredores lineales                                | 2    | Líneas eléctricas, caminos, corredores mineros             |
| Importar DEM/DSM · terrain following               | 3    | Copernicus GLO-30 + GeoTIFF propio                         |
| Perfil terreno/vuelo con clearance mínimo          | 3    |                                                            |
| Simulación animada con línea de tiempo             | 4    | Cinemática, 1x–10x                                         |
| Footprints de foto y análisis de cobertura         | 4    | Hace visible el traslape real y los huecos                 |
| Validación contra el permiso DGAC                  | 5    | Altura máxima, radio, vigencia                             |
| Entrega del plan a AeroControl                     | 5    | KMZ primero, API después                                   |
| Cargar y ver ortofoto y nube de puntos             | 6    | COG + COPC, ya procesados por otro                         |

## Qué no entra, y por qué

Esto no es una lista de "después vemos": son decisiones tomadas.

| Qué                                            | Por qué                                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PX4 SITL + Gazebo** (simulación física)      | No simula un DJI real — validaría el comportamiento de un autopiloto PX4, que no es el que vuela. Para planificar bien no aporta                                    |
| **CesiumJS**                                   | El runtime es Apache 2.0, pero el terreno de Cesium ion tiene costo comercial. El 3D del fork alcanza para el MVP                                                   |
| **Fields2Cover / OR-Tools**                    | Resuelve optimización de cobertura en polígonos irregulares con obstáculos. Recién tiene sentido cuando "generar una grilla" quede corto                            |
| **QGroundControl `.plan` y MAVLink**           | La flota es DJI; el formato que importa es WPML                                                                                                                     |
| **Multi-drone**                                | Un piloto, una aeronave, una misión                                                                                                                                 |
| **Meteorología**                               | AeroControl ya la resuelve con `WeatherReview` sobre Open-Meteo. Duplicarla sería peor que no tenerla                                                               |
| **Mapas de espacio aéreo DGAC**                | Requiere una fuente oficial que hoy no existe como servicio consultable                                                                                             |
| **Procesamiento fotogramétrico**               | Reconstruir ortofoto, nube y DSM desde cientos de fotos pide horas de CPU y 16–64 GB de RAM. No hay hardware. La app **abre** productos ya generados, no los genera |
| **Edición y clasificación de nubes de puntos** | Aquí solo se visualiza. Editar es trabajo de CloudCompare                                                                                                           |
| **Telemetría en vivo y control de vuelo**      | Es una estación de control terrestre, otro producto                                                                                                                 |

## Por qué se parte de un fork y no de cero

El análisis inicial proponía construir desde cero en nueve fases. Contra eso pesa
un hecho verificable: **DroneRoute ya resuelve la mitad de la tabla de arriba**,
con licencia MIT, y lo hace en el punto más caro de reimplementar — la generación
de KMZ WPML que el control DJI acepta sin quejarse.

Partir del fork significa que hay un planificador **usable en la primera semana**,
y que cada fase agrega valor sobre algo que ya funciona en vez de acumular
andamiaje durante meses. El riesgo de heredar decisiones de arquitectura ajenas
se controla poniendo todo lo nuevo en `packages/mission-core`, que no depende de
la interfaz y puede sobrevivir a un cambio de base.

La contrapartida honesta: si el KMZ del fork no le sirve al control de la flota, o
si su vista 3D depende de un token comercial, la premisa se debilita. Por eso
ambas cosas se verifican en la Fase 0, antes de invertir en las demás.

## Qué hace a este planificador distinto de uno genérico

Dos cosas que ninguna herramienta de catálogo puede dar:

**Validación contra el permiso real.** AeroControl ya guarda la altura máxima
autorizada, las coordenadas, el radio y la vigencia de cada permiso DGAC.
Contrastar la misión contra esa envolvente es barato de implementar y convierte
al planificador en un control operacional, no solo en un dibujante de rutas.

**El ciclo cerrado.** La ortofoto y el DSM del vuelo —procesados donde sea— vuelven al
planificador: mejor base cartográfica y mejor terreno que cualquier fuente
pública de 30 metros. Se planifica el vuelo siguiente sobre el resultado del
anterior.
