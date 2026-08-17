# Integración con AeroControl

> **AeroControl es de solo lectura mientras dure el MVP.** Está en pausa de
> estabilización. Los ítems de este documento que requieren cambios allá se
> señalan explícitamente y entran por el `MASTER_PLAN.md` de ese repositorio,
> donde encajan con su ítem diferido `GEO-14`.

## Reparto de responsabilidades

Cada sistema es dueño de lo suyo y ninguno necesita al otro para funcionar.

| AeroControl | AeroPlanner |
| --- | --- |
| Aeronaves, operadores y habilitaciones | Geometría de la misión |
| Permisos DGAC y su vigencia | Cálculo fotogramétrico |
| Centros de costo | Terreno y clearance |
| Cumplimiento documental y alertas | Simulación y validación técnica |
| Mantenimiento | Exportación al formato de la aeronave |
| Vuelos ejecutados | Productos del vuelo (ortofoto, nube, DSM) |
| Aprobación y trazabilidad del plan | |

**AeroControl aprueba; AeroPlanner calcula.** El flujo corporativo —revisión,
aprobación, versionado inmutable— ya existe y funciona en AeroControl. El
planificador no lo reimplementa.

## Regla dura: nunca compartir la base de datos

Ni lectura directa, ni vistas, ni un archivo SQLite montado en dos contenedores.
La comunicación es por **archivo** primero y por **API HTTP** después. Compartir
base de datos convierte dos productos independientes en uno solo mal acoplado, y
haría que cada migración de AeroControl pudiera romper el planificador en
silencio.

## Nivel 1 — Por archivo (funciona desde el día uno)

Sin API, sin integración, sin acoplamiento:

```
AeroPlanner  ──exporta──→  CC716_Tramo01.kmz  ──importa──→  AeroControl
                                                            (GeoPlan versionado)
```

AeroControl ya tiene un importador de KMZ/KML maduro que valida, versiona con
checksum y guarda el archivo original sin mutarlo. **No requiere ningún cambio en
AeroControl.** Esta es la integración del MVP.

Lo único que hay que respetar es el formato que su importador acepta: geometrías
KML estándar (punto, línea, polígono, colección) organizadas en carpetas, dentro
de los límites que valida al importar. Los parámetros de la misión que el KML no
representa (GSD, traslapes, cámara) viajan como metadatos y como resumen legible,
no como geometría inventada.

## Nivel 2 — Por API (Fase 5)

AeroControl expone una API REST con autenticación por token. Los tres puntos que
interesan:

| Uso | Endpoint | Dirección | ¿Cambia AeroControl? |
| --- | --- | --- | --- |
| Leer el permiso para validar la misión | `GET /api/v1/...` | AeroPlanner lee | No, si el permiso ya es legible por API |
| Leer el padrón de aeronaves | `GET /api/v1/registry/aircraft/` | AeroPlanner lee | No — ya existe |
| Enviar el plan calculado | `POST /api/v1/geo/plans/<uuid>/versions/` | AeroPlanner escribe | Sí — requiere aceptar el contenido desde un cliente externo |
| Abrir el planificador desde un permiso | enlace profundo | AeroControl enlaza | Sí — botón nuevo |

Los dos últimos son los que tocan AeroControl y por eso quedan al final del plan.

## El validador: lo que hace distinto a este planificador

Esta es la razón principal para integrar, y es barata de construir.

AeroControl guarda, por cada permiso DGAC: altura máxima autorizada (en pies),
coordenadas del área, radio en kilómetros, ventana de vigencia y tipo de zona
(poblada, no poblada, mixta).

Con eso, AeroPlanner puede rechazar antes del vuelo:

```
Misión CC716 Tramo 01           Permiso JEJ-2026-001

AGL máximo      94 m            Altura máxima      120 m (400 ft)   ✓
Radio desde el centro  2.8 km   Radio autorizado   3.0 km           ✓
Fecha planificada  2026-09-02   Vigencia  2026-08-01 → 2026-08-31   ✗ fuera de vigencia
```

Ningún planificador de catálogo puede dar esto, porque ninguno sabe qué autorizó
la DGAC para esta operación.

**Cuidado con las unidades:** el permiso está en pies (`max_altitude_ft`) y el
dominio de AeroPlanner trabaja en metros. Ese es exactamente el punto de
conversión donde un error pasa desapercibido y produce una validación que aprueba
lo que debería rechazar. La conversión va en un solo lugar, con test propio.

## Contrato de misión

Cada misión lleva un identificador propio y un campo de referencia externa que
queda nulo mientras no esté integrada:

```json
{
  "schema_version": 1,
  "mission_id": "uuid",
  "external_reference": null,
  "title": "CC716 Tramo 01",
  "mission_type": "corridor",
  "aircraft": "DJI Mavic 3E",
  "distance_m": 8342,
  "duration_s": 1425,
  "photo_count": 687,
  "battery_estimate": 1.6
}
```

Cuando se integra, `external_reference` toma el UUID del GeoPlan de AeroControl.
Eso basta para cerrar la trazabilidad en ambas direcciones sin que ninguno de los
dos sistemas dependa del otro para operar.

> El esquema definitivo se cierra en Fase 0 (`F0.7`), contrastándolo con el
> formato canónico que AeroControl ya usa internamente para versionar sus planes.
> Definirlo temprano evita una integración cara al final.

## Los productos pesados no cruzan

Ortofotos, nubes de puntos y DSM **nunca** entran a AeroControl: son gigabytes, y
su documento canónico tiene un límite muy por debajo de eso. Viven en AeroPlanner
o en WebODM.

Si en algún momento conviene que AeroControl los muestre, la vía es una **URL de
teselas XYZ** servida por AeroPlanner y agregada como una capa más a su mapa
Leaflet — un cambio mínimo, compatible con su límite de frontend, y sin mover un
solo byte de dato pesado.
