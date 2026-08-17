import { useCallback, useRef, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import { Search, X, Loader2 } from "lucide-react";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Búsqueda de lugares sobre Nominatim (OpenStreetMap).
 *
 * Reemplaza al geocoder de Mapbox, que exigía token. La política de uso de
 * Nominatim pide no más de una consulta por segundo y nada de consultas
 * masivas: por eso se busca al enviar el formulario y no mientras se escribe.
 */
export function GeocoderControl() {
  const { current: map } = useMap();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        format: "json",
        q,
        limit: "5",
      });
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { Accept: "application/json" },
      });
      setResults(res.ok ? await res.json() : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const goTo = useCallback(
    (r: NominatimResult) => {
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      if (!map || Number.isNaN(lat) || Number.isNaN(lon)) return;

      if (r.boundingbox) {
        const [south, north, west, east] = r.boundingbox.map(Number);
        if (![south, north, west, east].some(Number.isNaN)) {
          map.fitBounds(
            [
              [west, south],
              [east, north],
            ],
            { padding: 60, maxZoom: 16, duration: 800 },
          );
          setResults([]);
          return;
        }
      }
      map.flyTo({ center: [lon, lat], zoom: 15, duration: 800 });
      setResults([]);
    },
    [map],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearched(false);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Search places"
        title="Search places"
        className="absolute top-2 left-2 z-10 rounded bg-background/90 border border-border p-2 text-foreground hover:bg-background"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="absolute top-2 left-2 z-10 w-72">
      <form
        className="flex items-center gap-1 rounded bg-background/95 border border-border px-2 py-1"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search places..."
          aria-label="Search places"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {loading && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}
        <button
          type="button"
          aria-label="Close search"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </button>
      </form>

      {results.length > 0 && (
        <ul className="mt-1 max-h-64 overflow-y-auto rounded bg-background/95 border border-border text-sm">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-foreground hover:bg-accent"
                onClick={() => goTo(r)}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="mt-1 rounded bg-background/95 border border-border px-2 py-1.5 text-sm text-muted-foreground">
          No places found
        </p>
      )}
    </div>
  );
}
