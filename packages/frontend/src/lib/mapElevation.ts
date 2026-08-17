/**
 * Backs the domain's `ElevationSource` with the DEM the map already loads.
 *
 * MapLibre exposes `queryTerrainElevation()` against the terrain source
 * declared in `mapStyles.ts` (AWS Terrain Tiles). That keeps the domain free of
 * any map dependency: `mission-core` asks for a ground height, this answers.
 */

import type { Map as MapLibreMap } from "maplibre-gl";
import type { ElevationSource, LatLng } from "@aeroplanner/mission-core";

/**
 * Reads elevation from the map's terrain.
 *
 * Returns `null` when the tile covering a point has not loaded, which is the
 * honest answer: MapLibre reports 0 for missing tiles, and treating that as sea
 * level would plan a flight straight into a hillside.
 */
export function createMapElevationSource(map: MapLibreMap): ElevationSource {
  return {
    elevationM(point: LatLng): number | null {
      const value = map.queryTerrainElevation({
        lng: point.lng,
        lat: point.lat,
      });
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return null;
      }
      return value;
    },
  };
}

/**
 * Whether the terrain is loaded well enough to trust an elevation query.
 *
 * MapLibre only samples terrain while a terrain source is active, so asking
 * with terrain off returns nothing useful. Callers should check this before
 * offering terrain following, rather than silently producing a flat profile.
 */
export function hasTerrain(map: MapLibreMap): boolean {
  return map.getTerrain() !== null && map.getTerrain() !== undefined;
}
