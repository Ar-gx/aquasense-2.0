import { useCallback, useEffect, useRef, useState } from "react";
import type { LeafletMouseEvent, Map as LMap, Marker as LMarker } from "leaflet";
import { motion } from "framer-motion";
import { api } from "../../services/api";
import type { PlaceResult } from "../../lib/types";
import { SourceChip } from "../ui/primitives";

export interface LocationValue {
  taluk: string | null;
  district: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: string;
}

const EMPTY: LocationValue = {
  taluk: null, district: null, state: null,
  latitude: null, longitude: null, location_precision: "unknown",
};

/**
 * Zero-typing location picker:
 *  1. browser geolocation button → reverse geocode
 *  2. place-search autocomplete (Open-Meteo geocoding)
 *  3. click-to-drop pin on a Leaflet map (reverse geocoded)
 *  4. manual fallback fields
 */
export default function LocationPicker({ value, onChange }: {
  value: LocationValue; onChange: (v: LocationValue) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<LMap | null>(null);
  const marker = useRef<LMarker | null>(null);
  const searchTimer = useRef<number | undefined>(undefined);

  const applyCoords = useCallback(async (lat: number, lon: number,
                                         precision: string) => {
    onChange({
      ...value, latitude: lat, longitude: lon,
      location_precision: precision,
    });
    setNotice("Reverse geocoding location…");
    try {
      const r = await api.reverseLocation(lat, lon);
      onChange({
        taluk: r.taluk ?? value.taluk,
        district: r.district ?? value.district,
        state: r.state ?? value.state,
        latitude: lat, longitude: lon,
        location_precision: r.precision || precision,
      });
      setNotice(null);
    } catch {
      setNotice("Coordinates saved — reverse geocoding unavailable "
                + "(you can type the place names below).");
    }
  }, [value, onChange]);

  // ---- Leaflet map (dynamic import keeps initial bundle light) ----
  useEffect(() => {
    let disposed = false;
    if (!mapRef.current || mapObj.current) return;
    import("leaflet").then((L) => {
      if (disposed || !mapRef.current || mapObj.current) return;
      const map = L.map(mapRef.current, {
        center: [value.latitude ?? 20.59, value.longitude ?? 78.96],
        zoom: value.latitude != null ? 9 : 4,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          subdomains: "abcd", maxZoom: 19,
        }).addTo(map);
      map.on("click", (e: LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (marker.current) marker.current.setLatLng([lat, lng]);
        else marker.current = L.marker([lat, lng]).addTo(map);
        void applyCoords(lat, lng, "map-pin (approximate)");
      });
      mapObj.current = map;
      if (value.latitude != null && value.longitude != null) {
        marker.current = L.marker([value.latitude, value.longitude]).addTo(map);
      }
    }).catch(() => setNotice("Map could not load — use browser location or search."));
    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep marker in sync when coords change from other inputs
  useEffect(() => {
    if (!mapObj.current || value.latitude == null || value.longitude == null) return;
    import("leaflet").then((L) => {
      if (!mapObj.current) return;
      if (marker.current) marker.current.setLatLng([value.latitude!, value.longitude!]);
      else marker.current = L.marker([value.latitude!, value.longitude!]).addTo(mapObj.current);
      mapObj.current.setView([value.latitude!, value.longitude!], 10);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.latitude, value.longitude]);

  // ---- search debounce ----
  useEffect(() => {
    window.clearTimeout(searchTimer.current);
    if (query.trim().length < 2) { setResults([]); return; }
    searchTimer.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.searchPlaces(query.trim());
        setResults(r.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(searchTimer.current);
  }, [query]);

  const useBrowserLocation = () => {
    if (!navigator.geolocation) {
      setNotice("Browser location is not available — search or drop a pin instead.");
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        void applyCoords(pos.coords.latitude, pos.coords.longitude,
                         "device GPS (high precision)");
      },
      () => {
        setLocating(false);
        setNotice("Location permission denied — search for your town or drop a "
                  + "pin on the map instead.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const pickPlace = (p: PlaceResult) => {
    onChange({
      taluk: p.taluk, district: p.district, state: p.state,
      latitude: p.latitude, longitude: p.longitude,
      location_precision: p.precision,
    });
    setResults([]);
    setQuery(p.name ?? "");
    import("leaflet").then((L) => {
      if (!mapObj.current) return;
      if (marker.current) marker.current.setLatLng([p.latitude, p.longitude]);
      else marker.current = L.marker([p.latitude, p.longitude]).addTo(mapObj.current);
      mapObj.current.setView([p.latitude, p.longitude], 10);
    });
  };

  const manual = (patch: Partial<LocationValue>) =>
    onChange({ ...value, ...patch,
               location_precision: "manual entry (approximate)" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={useBrowserLocation} disabled={locating}
                className="btn-primary !py-2 text-xs">
          {locating ? "Locating…" : "📍 Use my location"}
        </button>
        <span className="text-[11px] leading-relaxed text-mist/75 self-center">
          one tap — no typing needed
        </span>
      </div>

      {/* search */}
      <div className="relative">
        <label className="label">Search a place</label>
        <input
          className="field"
          placeholder="e.g. Chamarajanagar, Mysuru, Mandya…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {(searching || results.length > 0) && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl
                          border border-line bg-panel shadow-card">
            {searching && (
              <div className="px-3 py-2 text-xs text-mist/75">Searching…</div>
            )}
            {results.map((p, i) => (
              <button key={`${p.latitude}-${i}`} type="button"
                      onClick={() => pickPlace(p)}
                      className="block w-full px-3 py-2 text-start text-xs
                                 hover:bg-leaf-500/10">
                <span className="text-ink">{p.name}</span>
                <span className="ms-2 text-mist/70">
                  {[p.district, p.state].filter(Boolean).join(", ")}
                </span>
              </button>
            ))}
            {!searching && results.length === 0 && query.length >= 2 && (
              <div className="px-3 py-2 text-xs text-mist/70">
                No matches — try a bigger town nearby.
              </div>
            )}
          </div>
        )}
      </div>

      {/* map */}
      <div>
        <label className="label">Or tap the map to drop a pin</label>
        <div ref={mapRef} className="h-[240px] w-full overflow-hidden
                                     rounded-xl border border-line" />
      </div>

      {/* resolved place */}
      {(value.taluk || value.district || value.state) && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="glass flex flex-wrap items-center gap-2 p-3 text-xs">
          <span className="text-leaf-700 font-medium">
            {[value.taluk, value.district, value.state].filter(Boolean).join(", ")}
          </span>
          {value.latitude != null && (
            <span className="font-mono text-mist/70">
              {value.latitude.toFixed(3)}, {value.longitude?.toFixed(3)}
            </span>
          )}
          <SourceChip source="live_api" label={value.location_precision} />
        </motion.div>
      )}

      {/* manual fallback */}
      <details className="rounded-xl border border-line/70 bg-night/40 p-3">
        <summary className="cursor-pointer text-xs text-mist/70
                            hover:text-leaf-600">
          ✎ Type it manually instead
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Taluk / Mandal</label>
            <input className="field" value={value.taluk ?? ""}
                   onChange={(e) => manual({ taluk: e.target.value || null })} />
          </div>
          <div>
            <label className="label">District</label>
            <input className="field" value={value.district ?? ""}
                   onChange={(e) => manual({ district: e.target.value || null })} />
          </div>
          <div>
            <label className="label">State</label>
            <input className="field" value={value.state ?? ""}
                   onChange={(e) => manual({ state: e.target.value || null })} />
          </div>
        </div>
      </details>

      {notice && <p className="text-xs text-warn-600/90">{notice}</p>}
    </div>
  );
}

export { EMPTY as EMPTY_LOCATION };
