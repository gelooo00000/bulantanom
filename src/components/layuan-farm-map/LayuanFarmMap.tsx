"use client";

import "./layuan-farm-map.css";

import {
  Droplets,
  Flower2,
  House,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Recycle,
  RotateCcw,
  SlidersHorizontal,
  Sprout,
  Trees,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { INFO, PINS, buildFarmMap, type FarmPin } from "./farmMapCore";

type LayerId = "rice" | "veg" | "buildings" | "water" | "trees";
type View = { cx: number; cy: number; z: number };

const LAYERS: { id: LayerId; label: string; icon: LucideIcon; swatch: string }[] = [
  { id: "rice", label: "Rice fields", icon: Wheat, swatch: "var(--lfm-rice)" },
  { id: "veg", label: "Vegetable plots", icon: Sprout, swatch: "var(--lfm-veg)" },
  { id: "buildings", label: "Buildings", icon: House, swatch: "var(--lfm-roof-red)" },
  { id: "water", label: "Water", icon: Droplets, swatch: "var(--lfm-water)" },
  { id: "trees", label: "Trees & flowers", icon: Trees, swatch: "var(--lfm-tree)" },
];


/** Facilities first by number, then the water, flower and recycling pins. */
const ORDERED_PINS: FarmPin[] = [...PINS].sort((a, b) => (a.n ?? 100) - (b.n ?? 100) || a.id.localeCompare(b.id));

const MIN_Z = 1;
const MAX_Z = 6;

/**
 * The starting zoom. A wide screen shows the whole farm; a narrow or upright
 * one (a phone) starts closer in so the farm fills most of the frame's height
 * and the pins are not crowded together. Moving sideways reveals the rest.
 */
function startZoom(w: number, h: number, mapW: number, mapH: number) {
  if (w >= 640 && w / h >= 1.2) return 1;
  const fit = Math.min(w / mapW, h / mapH);
  return Math.min(2.6, Math.max(1, (0.8 * h) / (fit * mapH)));
}

function pinColor(id: string) {
  if (INFO[id]?.future) return "var(--lfm-future)";
  if (id.startsWith("w")) return "var(--lfm-pin-water)";
  if (id.startsWith("o")) return "var(--lfm-pin-flower)";
  if (id === "mrf") return "var(--lfm-pin-recycle)";
  return "var(--lfm-pin-facility)";
}

function PinGlyph({ pin }: { pin: FarmPin }) {
  if (pin.kind === "water") return <Droplets aria-hidden="true" />;
  if (pin.kind === "flower") return <Flower2 aria-hidden="true" />;
  if (pin.kind === "recycle") return <Recycle aria-hidden="true" />;
  return <>{pin.n}</>;
}

function pinLabel(id: string) {
  const info = INFO[id];
  if (info.n) return `${info.n}. ${info.title}${info.future ? " (future development)" : ""}`;
  return `${info.title}: ${info.note}`;
}

/**
 * Isometric site map of Layuan Nature Integrated Farm.
 *
 * The scene is an SVG string from farmMapCore.js, built once per tilt/height.
 * Panning and zooming only move the viewBox, and the pins are HTML buttons
 * placed over it, so they stay tappable at any size on any screen.
 */
export function LayuanFarmMap({
  theme = "auto",
  className,
}: {
  theme?: "auto" | "light" | "dark";
  className?: string;
}) {
  const [tilt, setTilt] = useState(1);
  const [height, setHeight] = useState(1);
  const [hidden, setHidden] = useState<Set<LayerId>>(() => new Set());
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // cx = 0 means "centred": the real centre depends on the map's size.
  const [view, setView] = useState<View>({ cx: 0, cy: 0, z: 1 });
  const [panning, setPanning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showView, setShowView] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<number | undefined>(undefined);

  const map = useMemo(() => buildFarmMap(tilt, height), [tilt, height]);
  // The same object between renders, so panning or hovering never makes
  // React re-write the SVG (which would also drop focus).
  const svgHtml = useMemo(() => ({ __html: map.inner }), [map]);

  // --- Geometry ---------------------------------------------------------------
  const k0 = size.w && size.h ? Math.min(size.w / map.width, size.h / map.height) : 1;

  const clamp = useCallback(
    (raw: View): View => {
      const z = Math.min(MAX_Z, Math.max(MIN_Z, raw.z));
      const kk = k0 * z;
      const hw = size.w / (2 * kk);
      const hh = size.h / (2 * kk);
      const cx0 = raw.cx || map.width / 2;
      const cy0 = raw.cy || map.height / 2;
      const cx = hw * 2 >= map.width ? map.width / 2 : Math.min(map.width - hw, Math.max(hw, cx0));
      const cy = hh * 2 >= map.height ? map.height / 2 : Math.min(map.height - hh, Math.max(hh, cy0));
      return { cx, cy, z };
    },
    [k0, size.w, size.h, map.width, map.height],
  );

  const v = clamp(view);
  const k = k0 * v.z;
  const vx = v.cx - size.w / (2 * k);
  const vy = v.cy - size.h / (2 * k);
  // The latest geometry, for gesture handlers that run between renders.
  const geom = useRef({ k0, clamp, size, mapW: map.width, mapH: map.height });
  useEffect(() => {
    geom.current = { k0, clamp, size, mapW: map.width, mapH: map.height };
  });

  // Measure the stage.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let first = true;
    const measure = (width: number, h: number) => {
      setSize({ w: width, h });
      if (first) {
        first = false;
        const { mapW, mapH } = geom.current;
        setView((p) => ({ ...p, z: startZoom(width, h, mapW, mapH) }));
      }
    };
    if (typeof ResizeObserver === "undefined") {
      // Very old browsers: measure once.
      const frame = requestAnimationFrame(() => measure(el.clientWidth, el.clientHeight));
      return () => cancelAnimationFrame(frame);
    }
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flashHint = useCallback((text: string) => {
    setHint(text);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 1800);
  }, []);

  /** Zoom by `factor`, keeping the map point under (sx, sy) in place. */
  const zoomAt = useCallback((factor: number, sx?: number, sy?: number) => {
    setView((prev) => {
      const g = geom.current;
      const p = g.clamp(prev);
      const px = sx ?? g.size.w / 2;
      const py = sy ?? g.size.h / 2;
      const k1 = g.k0 * p.z;
      const left = p.cx - g.size.w / (2 * k1);
      const top = p.cy - g.size.h / (2 * k1);
      const z2 = Math.min(MAX_Z, Math.max(MIN_Z, p.z * factor));
      const k2 = g.k0 * z2;
      const mx = left + px / k1;
      const my = top + py / k1;
      return g.clamp({ cx: mx - px / k2 + g.size.w / (2 * k2), cy: my - py / k2 + g.size.h / (2 * k2), z: z2 });
    });
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    setView((prev) => {
      const g = geom.current;
      const p = g.clamp(prev);
      const kk = g.k0 * p.z;
      return g.clamp({ cx: p.cx - dx / kk, cy: p.cy - dy / kk, z: p.z });
    });
  }, []);

  const resetView = useCallback(() => {
    const g = geom.current;
    setView({ cx: 0, cy: 0, z: startZoom(g.size.w, g.size.h, g.mapW, g.mapH) });
  }, []);

  // --- Wheel: Ctrl/⌘ + wheel (and trackpad pinch) zooms; plain wheel scrolls
  // the page, except in full screen where there is no page to scroll.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) && !expanded) {
        flashHint("Hold Ctrl (⌘ on Mac) and scroll to zoom");
        return;
      }
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [expanded, flashHint, zoomAt]);

  // --- Full screen: a fixed overlay, which works on every phone (iPhone
  // Safari has no element Fullscreen API).
  useEffect(() => {
    if (!expanded) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  // --- Pointer gestures: drag to pan, pinch to zoom, double-tap to zoom in.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: false, sx: 0, sy: 0, dist: 0, mx: 0, my: 0, lastTap: 0, tx: 0, ty: 0 });
  const suppressClick = useRef(false);

  const swallowNextClick = () => {
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 0);
  };

  const localPoint = (e: PointerEvent) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (pointers.current.size === 1) {
      g.moved = false;
      g.sx = p.x;
      g.sy = p.y;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.dist = Math.hypot(a.x - b.x, a.y - b.y);
      g.mx = (a.x + b.x) / 2;
      g.my = (a.y + b.y) / 2;
      g.moved = true;
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (g.dist > 0) zoomAt(dist / g.dist, mx, my);
      panBy(mx - g.mx, my - g.my);
      g.dist = dist;
      g.mx = mx;
      g.my = my;
      return;
    }

    if (!g.moved && Math.hypot(p.x - g.sx, p.y - g.sy) > 6) {
      g.moved = true;
      setPanning(true);
      // Capture only once it is a drag, so a plain tap still reaches a pin.
      viewportRef.current?.setPointerCapture(e.pointerId);
    }
    if (g.moved) panBy(p.x - prev.x, p.y - prev.y);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const p = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0) return;
    setPanning(false);
    if (g.moved) {
      swallowNextClick();
      return;
    }
    // Double-tap on touch and pen; a mouse gets the native dblclick.
    if (p && e.pointerType !== "mouse") {
      const now = performance.now();
      if (now - g.lastTap < 320 && Math.hypot(p.x - g.tx, p.y - g.ty) < 30) {
        zoomAt(1.8, p.x, p.y);
        g.lastTap = 0;
        swallowNextClick();
      } else {
        g.lastTap = now;
        g.tx = p.x;
        g.ty = p.y;
      }
    }
  }

  function onPointerCancel(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setPanning(false);
  }

  function onViewportKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const step = 70;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => panBy(step, 0),
      ArrowRight: () => panBy(-step, 0),
      ArrowUp: () => panBy(0, step),
      ArrowDown: () => panBy(0, -step),
      "+": () => zoomAt(1.4),
      "=": () => zoomAt(1.4),
      "-": () => zoomAt(1 / 1.4),
      "0": resetView,
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }

  // --- Selection ----------------------------------------------------------------
  const active = hover ?? selected;
  const info = active ? INFO[active] : null;
  const activePin = active ? PINS.find((p) => p.id === active) : undefined;

  const toggleSelected = (id: string) => setSelected((s) => (s === id ? null : id));

  function toggleLayer(id: LayerId) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const classes = [
    "lfm",
    ...[...hidden].map((id) => `lfm-hide-${id}`),
    active ? "lfm-has-active" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const ready = size.w > 0;

  return (
    <div className={classes} data-theme={theme === "auto" ? undefined : theme}>
      <div ref={stageRef} className={`lfm-stage${expanded ? " is-expanded" : ""}`}>
        <div
          ref={viewportRef}
          className={`lfm-viewport${panning ? " is-panning" : ""}`}
          style={{ touchAction: expanded ? "none" : "pan-y" }}
          role="region"
          aria-roledescription="interactive map"
          aria-label="Layuan Farm site map. Drag to move and use the zoom buttons; arrow keys move the map and plus or minus zoom when it has focus."
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onDoubleClick={(e) => {
            const r = viewportRef.current!.getBoundingClientRect();
            zoomAt(1.8, e.clientX - r.left, e.clientY - r.top);
          }}
          onClick={(e) => {
            if (suppressClick.current) return;
            if (!(e.target as Element).closest("[data-pin]")) setSelected(null);
          }}
          onKeyDown={onViewportKey}
        >
          <svg
            className="lfm-svg"
            viewBox={ready ? `${vx} ${vy} ${size.w / k} ${size.h / k}` : `0 0 ${map.width} ${map.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Isometric illustration of Layuan Nature Integrated Farm"
            dangerouslySetInnerHTML={svgHtml}
          />
          <div className="lfm-clouds" aria-hidden="true">
            <span className="lfm-cloud" style={{ top: "6%" }} />
            <span className="lfm-cloud" style={{ top: "18%" }} />
            <span className="lfm-cloud" style={{ top: "30%" }} />
          </div>
          {ready && (
            <div className="lfm-pins">
              {ORDERED_PINS.map((pin) => {
                if (pin.layer && hidden.has(pin.layer as LayerId)) return null;
                const [ax, ay] = map.anchors[pin.id];
                const x = (ax - vx) * k;
                const y = (ay - vy) * k;
                if (x < -40 || x > size.w + 40 || y < -10 || y > size.h + 70) return null;
                const pinInfo = INFO[pin.id];
                return (
                  <button
                    key={pin.id}
                    type="button"
                    data-pin={pin.id}
                    className={`lfm-pin${pin.id === active ? " is-active" : ""}${pinInfo.future ? " is-future" : ""}`}
                    style={{ "--x": `${x}px`, "--y": `${y}px`, "--pin": pinColor(pin.id) } as CSSProperties}
                    aria-label={pinLabel(pin.id)}
                    aria-pressed={selected === pin.id}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse") setHover(pin.id);
                    }}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(pin.id)}
                    onBlur={() => setHover(null)}
                    onClick={() => {
                      if (suppressClick.current) return;
                      toggleSelected(pin.id);
                    }}
                  >
                    <span className="lfm-pin-head">
                      <PinGlyph pin={pin} />
                    </span>
                    <span className="lfm-pin-stem" aria-hidden="true" />
                    <span className="lfm-pin-foot" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Layer chips */}
        <div className="lfm-layers" role="group" aria-label="Map layers">
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            return (
              <button
                key={layer.id}
                type="button"
                className="lfm-chip lfm-glass"
                aria-pressed={!hidden.has(layer.id)}
                onClick={() => toggleLayer(layer.id)}
              >
                <span className="lfm-chip-icon" style={{ "--swatch": layer.swatch } as CSSProperties} aria-hidden="true">
                  <Icon />
                </span>
                {layer.label}
              </button>
            );
          })}
        </div>

        {/* Zoom, reset, full screen and camera controls */}
        <div className="lfm-controls">
          <div className="lfm-ctrl-group lfm-glass">
            <button type="button" className="lfm-ctrl" aria-label="Zoom in" onClick={() => zoomAt(1.5)} disabled={v.z >= MAX_Z}>
              <Plus />
            </button>
            <button type="button" className="lfm-ctrl" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.5)} disabled={v.z <= MIN_Z}>
              <Minus />
            </button>
            <button type="button" className="lfm-ctrl" aria-label="Reset view" onClick={resetView}>
              <RotateCcw />
            </button>
          </div>
          <div className="lfm-ctrl-group lfm-glass">
            <button
              type="button"
              className="lfm-ctrl"
              aria-label={expanded ? "Exit full screen" : "Full screen"}
              aria-pressed={expanded}
              onClick={() => setExpanded((x) => !x)}
            >
              {expanded ? <Minimize2 /> : <Maximize2 />}
            </button>
            <button
              type="button"
              className="lfm-ctrl"
              aria-label="Camera tilt and building height"
              aria-expanded={showView}
              onClick={() => setShowView((x) => !x)}
            >
              <SlidersHorizontal />
            </button>
          </div>
        </div>

        {showView && (
          <div className="lfm-pop lfm-glass" role="group" aria-label="Camera tilt and building height">
            <p className="lfm-pop-title">View</p>
            <label className="lfm-slider">
              Tilt
              <output>{tilt.toFixed(2)}</output>
              <input type="range" min={0.6} max={1.4} step={0.05} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} />
            </label>
            <label className="lfm-slider">
              Height
              <output>{height.toFixed(2)}</output>
              <input type="range" min={0.5} max={2} step={0.05} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
            </label>
            <button
              type="button"
              className="lfm-pop-reset"
              onClick={() => {
                setTilt(1);
                setHeight(1);
              }}
            >
              Reset camera
            </button>
          </div>
        )}

        {hint && <div className="lfm-hint lfm-glass">{hint}</div>}
        {!info && ready && <div className="lfm-zoom-level lfm-glass">{v.z.toFixed(1)}×</div>}

        {info && active && (
          <div
            key={active}
            className="lfm-detail lfm-glass"
            role="status"
            aria-live="polite"
            style={{ "--pin": pinColor(active) } as CSSProperties}
          >
            <div className="lfm-detail-strip" />
            <div className="lfm-detail-body">
              <div className="lfm-detail-head">
                <span className="lfm-badge">{activePin && <PinGlyph pin={activePin} />}</span>
                <div>
                  <p className="lfm-detail-title">{info.title}</p>
                  <p className="lfm-detail-type">
                    {info.n ? `No. ${info.n} · ` : ""}
                    {info.type}
                  </p>
                </div>
                {selected === active && (
                  <button
                    type="button"
                    className="lfm-detail-close"
                    aria-label="Close details"
                    onClick={() => {
                      setSelected(null);
                      setHover(null);
                    }}
                  >
                    <X />
                  </button>
                )}
              </div>
              {info.future && <span className="lfm-tag">Future development</span>}
              <p className="lfm-detail-note">{info.note}</p>
            </div>
          </div>
        )}
      </div>

      <p className="lfm-note">
        Illustrative layout, not to scale. Items marked as future development are planned and not
        yet built.
      </p>
    </div>
  );
}
