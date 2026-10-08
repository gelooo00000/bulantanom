"use client";

import "leaflet/dist/leaflet.css";

import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { MapPin } from "lucide-react";
import { useEffect, useRef } from "react";

import type { SoilMap, SoilMapRecord } from "@/lib/api/analytics-api";
import { useTheme } from "@/lib/theme/theme-context";
import { cn } from "@/lib/utils";

/** One colour per soil type, readable on both map themes. */
export const SOIL_COLORS: Record<string, string> = {
  loamy: "#8b5a2b",
  clay: "#b5452f",
  sandy: "#d9a93a",
  silty: "#7d8a8f",
  sandy_loam: "#c9874a",
  clay_loam: "#9a3f6b",
  not_recorded: "#8a948e",
};

const soilColor = (key: string) => SOIL_COLORS[key] ?? SOIL_COLORS.not_recorded;

// OpenStreetMap's standard tiles (no key needed); darkened with a CSS filter
// in Dark mode (see .lfm-map-dark in globals.css).
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * The farm's popup, built with DOM nodes and textContent rather than an
 * HTML string, so a farmer's name can never be read as markup.
 */
function popupFor(data: SoilMap): HTMLElement {
  const el = (tag: string, text?: string, className?: string) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const root = el("div", undefined, "lfm-popup");
  root.append(el("strong", data.farm.name), el("div", data.farm.location, "lfm-popup-muted"));
  const latest: SoilMapRecord | undefined = data.records[0];
  root.append(el("div", `${data.record_count} soil record${data.record_count === 1 ? "" : "s"} in view`, "lfm-popup-muted"));
  if (latest) {
    const dl = el("dl");
    const row = (k: string, v: string) => dl.append(el("dt", k), el("dd", v));
    row("Soil type", data.farm.dominant_soil?.label ?? latest.soil_type);
    row("pH", latest.ph != null ? String(latest.ph) : "Not recorded");
    row("Moisture", latest.moisture);
    row("Texture", latest.texture);
    row("Recommended", latest.recommended.length ? latest.recommended.join(", ") : "None");
    row("Last updated", latest.updated);
    root.append(el("div", "Latest record", "lfm-popup-head"), dl);
  }
  return root;
}

/**
 * The soil map, drawn with Leaflet over CARTO/OpenStreetMap tiles.
 *
 * Soil records are not geotagged, so the one real location is the farm: its
 * marker is coloured by the most common recorded soil type, and the records
 * themselves are listed beside the map rather than placed at invented
 * positions.
 */
export function MapPanel({
  data,
  height = 360,
  selectedSoil,
  onSelectSoil,
  showList = true,
}: {
  data: SoilMap;
  height?: number;
  selectedSoil: string;
  onSelectSoil: (key: string) => void;
  showList?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const { theme } = useTheme();
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || mapRef.current) return;
      const d = dataRef.current;
      const map = L.map(box.current, { scrollWheelZoom: false, attributionControl: true }).setView([d.farm.lat, d.farm.lng], 16);
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      markerRef.current = L.circleMarker([d.farm.lat, d.farm.lng], {
        radius: 14,
        weight: 3,
        color: "#ffffff",
        fillOpacity: 0.95,
        fillColor: soilColor(d.farm.dominant_soil?.key ?? "not_recorded"),
      })
        .addTo(map)
        .bindPopup(() => popupFor(dataRef.current), { maxWidth: 280 });
      L.circle([d.farm.lat, d.farm.lng], { radius: 120, weight: 1, color: "#2f7a46", fillOpacity: 0.06, dashArray: "4 4" }).addTo(map);
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Recolour the marker when the data (and so the dominant soil) changes.
  useEffect(() => {
    markerRef.current?.setStyle({ fillColor: soilColor(data.farm.dominant_soil?.key ?? "not_recorded") });
  }, [data]);

  return (
    <div className={cn("grid gap-3", showList && "lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]")}>
      <div className="relative isolate min-w-0">
        <div
          ref={box}
          role="region"
          aria-label={`Map of ${data.farm.name}. The marker is coloured by the most common recorded soil type.`}
          className={cn("border-border z-0 overflow-hidden rounded-xl border", theme === "dark" && "lfm-map-dark")}
          style={{ height }}
        />
        {/* Legend, which is also the soil-type filter. */}
        <div className="bg-card/90 border-border absolute bottom-2 left-2 z-[400] max-w-[calc(100%-1rem)] rounded-xl border p-2 text-[11px] shadow-md backdrop-blur">
          <p className="mb-1 px-1 font-medium">Soil type</p>
          <div className="flex flex-wrap gap-1">
            {data.soil_types.length === 0 && <span className="text-muted-foreground px-1">No soil records in view</span>}
            {data.soil_types.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={selectedSoil === s.key}
                onClick={() => onSelectSoil(selectedSoil === s.key ? "" : s.key)}
                className={cn(
                  "border-border flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors",
                  selectedSoil === s.key ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                )}
              >
                <span className="size-2.5 rounded-full" style={{ background: soilColor(s.key) }} aria-hidden="true" />
                {s.label} <span className="opacity-70">{s.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {showList && (
        <div className="border-border flex max-h-[var(--h)] min-w-0 flex-col overflow-hidden rounded-xl border" style={{ ["--h" as string]: `${height}px` }}>
          <p className="border-border bg-muted/40 flex items-center gap-1.5 border-b px-3 py-2 text-xs font-medium">
            <MapPin className="size-3.5" aria-hidden="true" />
            Records at {data.farm.name} ({data.record_count})
          </p>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {data.records.length === 0 && <li className="text-muted-foreground px-3 py-6 text-center text-xs">No data yet</li>}
            {data.records.map((r) => (
              <li key={r.id} className="border-border/70 border-b px-3 py-2 text-xs last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: soilColor(r.soil_key) }} aria-hidden="true" />
                    <span className="truncate">{r.soil_type}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0">{r.date}</span>
                </div>
                <p className="text-muted-foreground mt-0.5 truncate">
                  {r.farmer} · pH {r.ph ?? "n/a"} · {r.moisture}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
