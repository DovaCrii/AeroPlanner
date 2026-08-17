import { create } from "zustand";
import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * Holds the live map instance so components outside the `<Map>` subtree can
 * reach it.
 *
 * `useMap()` only works inside the map's own React tree, and the elevation
 * chart lives in the sidebar. Wrapping the whole app in a `MapProvider` would
 * work too, but this keeps the coupling to a single, explicit handle.
 *
 * `terrainVersion` bumps whenever terrain tiles finish loading: elevation
 * queries return nothing until they do, so consumers use it to recompute
 * rather than silently showing a flat profile.
 */
interface MapState {
  map: MapLibreMap | null;
  terrainVersion: number;
  setMap: (map: MapLibreMap | null) => void;
  bumpTerrainVersion: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  map: null,
  terrainVersion: 0,
  setMap: (map) => set({ map }),
  bumpTerrainVersion: () =>
    set((state) => ({ terrainVersion: state.terrainVersion + 1 })),
}));
