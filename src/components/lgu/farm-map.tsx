"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { ExternalLink, Layers, LoaderCircle, MapPinOff, RotateCw, Undo2 } from "lucide-react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The farm and the land around it as a 3D map: a satellite photograph draped
 * over real elevation, which the Officer can tilt, turn and zoom.
 *
 * Drawn with MapLibre from free public tiles, so it needs the internet but no
 * account or API key:
 *  - the photograph: Esri World Imagery
 *  - the street map: OpenStreetMap
 *  - the elevation: AWS Terrain Tiles (Mapzen's "terrarium" encoding)
 * Each is credited in the map's attribution, as their terms require.
 *
 * The library is loaded on the client only, after the page is on screen: it
 * needs WebGL and a window, and nothing else on the page should wait for it.
 */

const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const STREET_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

/** The opening view: close enough to see fields, tilted enough to see hills. */
const VIEW = { zoom: 14.2, pitch: 62, bearing: -25 };

// Real relief, stretched a little: Bulan's hills are low, and at true scale
// they barely lift off the page.
const EXAGGERATION = 1.6;

const DEM_SOURCE: StyleSpecification["sources"][string] = {
  type: "raster-dem",
  tiles: [TERRAIN_TILES],
  tileSize: 256,
  maxzoom: 15,
  encoding: "terrarium",
  attribution: "Terrain: Mapzen, AWS Terrain Tiles",
};

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [SATELLITE_TILES],
      tileSize: 256,
      maxzoom: 18,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
    streets: {
      type: "raster",
      tiles: [STREET_TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
    // Two sources from the same tiles: one shapes the ground, one shades it.
    // Sharing a single source between the two makes the shading flicker.
    terrain: DEM_SOURCE,
    hillshade: DEM_SOURCE,
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "streets", type: "raster", source: "streets", layout: { visibility: "none" } },
    // The street map is flat colour, so it gets shading to show the relief.
    {
      id: "hills",
      type: "hillshade",
      source: "hillshade",
      layout: { visibility: "none" },
      paint: { "hillshade-exaggeration": 0.45, "hillshade-shadow-color": "#3d4a3a" },
    },
  ],
  terrain: { source: "terrain", exaggeration: EXAGGERATION },
  sky: {
    "sky-color": "#8fc1ea",
    "horizon-color": "#e6eef2",
    "fog-color": "#dfe9e6",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.6,
    "fog-ground-blend": 0.35,
  },
};

type Basemap = "satellite" | "streets";

export function FarmMap({
  name,
  latitude,
  longitude,
  className,
}: {
  /** Shown on the marker. */
  name: string;
  latitude: number;
  longitude: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;

    (async () => {
      try {
        const maplibre = (await import("maplibre-gl")).default;
        if (cancelled || !containerRef.current) return;

        map = new maplibre.Map({
          container: containerRef.current,
          style: STYLE,
          center: [longitude, latitude],
          ...VIEW,
          maxPitch: 80,
          // The page scrolls; a map that swallowed every wheel turn and
          // one-finger swipe would trap the reader on it.
          cooperativeGestures: true,
          attributionControl: { compact: true },
        });
        mapRef.current = map;

        map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");
        map.addControl(new maplibre.FullscreenControl(), "top-right");
        map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");

        // The popup is always white, so its text is set dark here rather
        // than inheriting the page's (white, in Dark Mode) text colour.
        const label = document.createElement("p");
        label.textContent = name;
        label.style.cssText = "margin:0;color:#14261a;font-weight:600;font-size:13px";
        new maplibre.Marker({ color: "#2f9e44" })
          .setLngLat([longitude, latitude])
          .setPopup(new maplibre.Popup({ offset: 30, closeButton: false }).setDOMContent(label))
          .addTo(map);

        map.once("load", () => {
          if (!cancelled) setStatus("ready");
        });
        // Taking hold of the map stops the slow turn, so it never fights the hand.
        for (const event of ["mousedown", "touchstart", "wheel"] as const) {
          map.on(event, () => setRotating(false));
        }
      } catch {
        // No WebGL, or the library could not start: say so instead of
        // leaving an empty box.
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current = null;
      map?.remove();
    };
  }, [latitude, longitude, name]);

  // The slow turn around the farm, one small step a frame.
  useEffect(() => {
    if (!rotating) return;
    let frame = 0;
    const step = () => {
      const map = mapRef.current;
      if (!map) return;
      map.setBearing(map.getBearing() + 0.12);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [rotating]);

  function chooseBasemap(next: Basemap) {
    setBasemap(next);
    const map = mapRef.current;
    if (!map) return;
    map.setLayoutProperty("satellite", "visibility", next === "satellite" ? "visible" : "none");
    map.setLayoutProperty("streets", "visibility", next === "streets" ? "visible" : "none");
    map.setLayoutProperty("hills", "visibility", next === "streets" ? "visible" : "none");
  }

  function resetView() {
    setRotating(false);
    // `flyTo` already skips the flight for people who ask for less motion.
    mapRef.current?.flyTo({ center: [longitude, latitude], ...VIEW, duration: 1200 });
  }

  const coordinates = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? "N" : "S"}, ${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? "E" : "W"}`;

  return (
    <div className={className}>
      <div className="border-border relative h-[26rem] overflow-hidden rounded-xl border sm:h-[32rem]">
        <div
          ref={containerRef}
          role="region"
          aria-label={`3D map of ${name}`}
          className="farm-map size-full"
        />

        {status === "loading" && (
          <div className="bg-card/80 text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            Loading the map…
          </div>
        )}

        {status === "failed" && (
          <div className="bg-card absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <MapPinOff className="text-muted-foreground size-6" />
            <p className="font-heading text-sm font-medium">The 3D map could not be shown</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              This browser or device does not support 3D graphics (WebGL). The farm is at{" "}
              {coordinates}.
            </p>
          </div>
        )}

        {/* The toolbar stops short of the zoom buttons on the right, and
            wraps on a narrow screen instead of running under them. */}
        {status === "ready" && (
          <div className="absolute top-2.5 right-14 left-2.5 flex flex-wrap items-center gap-1.5">
            <div
              role="group"
              aria-label="Map type"
              className="flex overflow-hidden rounded-lg bg-white shadow-md"
            >
              {(
                [
                  ["satellite", "Satellite"],
                  ["streets", "Map"],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={basemap === value}
                  onClick={() => chooseBasemap(value)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-black/30",
                    basemap === value ? "bg-[#2f9e44] text-white" : "text-[#14261a] hover:bg-black/5",
                  )}
                >
                  {value === "satellite" && <Layers className="size-3.5" />}
                  {text}
                </button>
              ))}
            </div>
            <MapButton pressed={rotating} onClick={() => setRotating((on) => !on)}>
              <RotateCw className={cn("size-3.5", rotating && "animate-spin [animation-duration:3s]")} />
              {rotating ? "Stop" : "Rotate"}
            </MapButton>
            <MapButton onClick={resetView}>
              <Undo2 className="size-3.5" />
              Reset view
            </MapButton>
          </div>
        )}
      </div>

      <p className="text-muted-foreground mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span>
          Drag to move · right-drag or Ctrl + drag to tilt and turn · Ctrl + scroll to zoom. On a
          phone, use two fingers.
        </span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground inline-flex shrink-0 items-center gap-1 underline underline-offset-2"
        >
          {coordinates} · Open in Google Maps
          <ExternalLink className="size-3" />
        </a>
      </p>
    </div>
  );
}

/** A control drawn on the map itself: white in both themes, like the map's own. */
function MapButton({
  pressed,
  onClick,
  children,
}: {
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium shadow-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-black/30",
        pressed ? "bg-[#2f9e44] text-white" : "bg-white text-[#14261a] hover:bg-[#eef3ee]",
      )}
    >
      {children}
    </button>
  );
}
