/**
 * Estilos de mapa para MapLibre.
 *
 * Ninguno requiere token ni cuenta: es la condición que impuso la migración
 * desde Mapbox (tarea `F0.10` del MASTER_PLAN). Si algún día se sirven teselas
 * propias, este es el único archivo que cambia.
 */

import type { StyleSpecification } from "maplibre-gl";

/** Fuente vectorial OSM (esquema OpenMapTiles), sin token ni cuota. */
const OPENFREEMAP_TILES = "https://tiles.openfreemap.org/planet";

/** Nombre de la fuente vectorial. La capa `building` cuelga de aquí. */
export const VECTOR_SOURCE_ID = "openmaptiles";

/**
 * Callejero vectorial. Trae la capa `building`, que `SceneSetup` extruye
 * para la vista 3D.
 */
export const STREET_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Imagen satelital de Esri — el mismo proveedor que ya usa AeroControl, así
 * que no introduce un tercero nuevo en la operación.
 *
 * Va sin etiquetas a propósito: sobre faena la imagen limpia se lee mejor, y
 * el callejero está a un clic de distancia. Se le adjunta la fuente vectorial
 * para que los edificios 3D funcionen también en esta vista.
 */
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "esri-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    },
    [VECTOR_SOURCE_ID]: {
      type: "vector",
      url: OPENFREEMAP_TILES,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: "esri-imagery",
      type: "raster",
      source: "esri-imagery",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

/**
 * Terreno: AWS Terrain Tiles (proyecto Terrarium), datos abiertos servidos sin
 * token ni cuota. Reemplaza a `mapbox://mapbox.mapbox-terrain-dem-v1`.
 *
 * El formato de codificación es `terrarium`, no el `mapbox` por defecto: la
 * altura se despeja distinto de los canales RGB, y confundirlos produce un
 * relieve absurdo en vez de un error. MapLibre lo soporta de fábrica.
 *
 * Esta misma fuente es la candidata natural para el muestreo de elevación de
 * la Fase 3 (terrain following), vía `map.queryTerrainElevation()`.
 */
export const TERRAIN_SOURCE_ID = "terrain-dem";

export const TERRAIN_TILES = [
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
];

export const TERRAIN_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>';

export type MapStyleName = "street" | "satellite";

export function getMapStyle(name: MapStyleName) {
  return name === "street" ? STREET_STYLE : SATELLITE_STYLE;
}
