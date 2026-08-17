/// <reference types="vite/client" />
// El namespace global `GeoJSON` lo aportaban los tipos de mapbox-gl. Al migrar
// a MapLibre hay que declararlo explícitamente.
/// <reference types="geojson" />

declare const __COMMIT_SHA__: string;
declare const __APP_VERSION__: string;
