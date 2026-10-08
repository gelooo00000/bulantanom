"use client";

import "./layuan-farm-map.css";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

import { INFO, KEY, buildFarmMap } from "./farmMapCore";

type LayerId = "rice" | "veg" | "buildings" | "water" | "trees";

const LAYERS: { id: LayerId; label: string; swatch: string }[] = [
  { id: "rice", label: "Rice fields", swatch: "var(--lfm-rice)" },
  { id: "veg", label: "Vegetable plots", swatch: "var(--lfm-veg)" },
  { id: "buildings", label: "Buildings", swatch: "var(--lfm-roof-red)" },
  { id: "water", label: "Water", swatch: "var(--lfm-water)" },
  { id: "trees", label: "Trees & flowers", swatch: "var(--lfm-tree)" },
];

/** Pin colour for the detail card badge. */
function badgeColor(id: string, future?: boolean) {
  if (future) return "var(--lfm-future)";
  if (id.startsWith("w")) return "var(--lfm-pin-water)";
  if (id.startsWith("o")) return "var(--lfm-pin-flower)";
  if (id === "mrf") return "var(--lfm-pin-recycle)";
  return "var(--lfm-pin-facility)";
}

function pinFrom(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest("[data-pin]")?.getAttribute("data-pin") ?? null;
}

/**
 * Isometric site map of Layuan Nature Integrated Farm.
 *
 * The scene is built as an SVG string by farmMapCore.js and dropped in once
 * per tilt/height; pins are wired up by event delegation on the <svg>, and
 * highlighting is applied to the existing nodes rather than re-rendering.
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
  const svgRef = useRef<SVGSVGElement>(null);

  const map = useMemo(() => buildFarmMap(tilt, height), [tilt, height]);
  // The same object between renders, so a hover or selection does not make
  // React re-write the SVG (which would replace the pins and drop focus).
  const svgHtml = useMemo(() => ({ __html: map.inner }), [map]);
  const active = hover ?? selected;
  const info = active ? INFO[active] : null;

  // Highlight the active pin and mark the selected one, on the live nodes.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.querySelectorAll<SVGGElement>("[data-pin]").forEach((el) => {
      const id = el.getAttribute("data-pin");
      el.classList.toggle("is-active", id === active);
      el.setAttribute("aria-pressed", String(id === selected));
    });
  }, [active, selected, map]);

  const toggleSelected = (id: string) => setSelected((s) => (s === id ? null : id));

  function toggleLayer(id: LayerId) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // --- Delegated SVG events --------------------------------------------------
  function onPointerOver(e: PointerEvent<SVGSVGElement>) {
    // Touch has no hover: a tap is a click, handled below.
    if (e.pointerType !== "mouse") return;
    setHover(pinFrom(e.target));
  }
  function onClick(e: MouseEvent<SVGSVGElement>) {
    const id = pinFrom(e.target);
    if (id) toggleSelected(id);
    else setSelected(null);
  }
  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const id = pinFrom(e.target);
    if (!id) return;
    e.preventDefault();
    toggleSelected(id);
  }
  function onFocus(e: FocusEvent<SVGSVGElement>) {
    const id = pinFrom(e.target);
    if (id) setHover(id);
  }

  const classes = [
    "lfm",
    ...[...hidden].map((id) => `lfm-hide-${id}`),
    active ? "lfm-has-active" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-theme={theme === "auto" ? undefined : theme}>
      <div className="lfm-toolbar">
        <div className="lfm-chips" role="group" aria-label="Map layers">
          {LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              className="lfm-chip"
              aria-pressed={!hidden.has(layer.id)}
              onClick={() => toggleLayer(layer.id)}
            >
              <span className="lfm-swatch" style={{ background: layer.swatch }} aria-hidden="true" />
              {layer.label}
            </button>
          ))}
        </div>
        <div className="lfm-sliders">
          <label className="lfm-slider">
            Tilt
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={tilt}
              onChange={(e) => setTilt(Number(e.target.value))}
            />
            <output>{tilt.toFixed(2)}</output>
          </label>
          <label className="lfm-slider">
            Height
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
            <output>{height.toFixed(2)}</output>
          </label>
        </div>
      </div>

      <div className="lfm-frame">
        <svg
          ref={svgRef}
          className="lfm-svg"
          viewBox={`0 0 ${map.width} ${map.height}`}
          role="img"
          aria-label="Isometric site map of Layuan Nature Integrated Farm showing its 20 facilities, fields, water sources and ornamental beds"
          onPointerOver={onPointerOver}
          onPointerLeave={() => setHover(null)}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={() => setHover(null)}
          dangerouslySetInnerHTML={svgHtml}
        />
      </div>
      <p className="lfm-note">
        Illustrative layout, not to scale. Items marked as future development are planned and not
        yet built.
      </p>

      <div className="lfm-below">
        <div
          className="lfm-card"
          aria-live="polite"
          style={info ? ({ "--lfm-card-strip": badgeColor(active!, info.future) } as CSSProperties) : undefined}
        >
          {info ? (
            <>
              <div className="lfm-card-head">
                <span className="lfm-badge" style={{ background: badgeColor(active!, info.future) }}>
                  {info.n ?? (active!.startsWith("w") ? "W" : active!.startsWith("o") ? "O" : "R")}
                </span>
                <div>
                  <p className="lfm-card-title">{info.title}</p>
                  <p className="lfm-card-type">
                    {info.n ? `No. ${info.n} · ` : ""}
                    {info.type}
                  </p>
                </div>
              </div>
              {info.future && <span className="lfm-tag">Future development</span>}
              <p className="lfm-card-note">{info.note}</p>
            </>
          ) : (
            <p className="lfm-card-empty">
              <strong>Explore the farm</strong>
              Hover, tap or focus a pin or a row in the map key to see what it is. Click to keep it
              selected.
            </p>
          )}
        </div>

        <div className="lfm-key">
          <h3 className="lfm-key-title">Map key</h3>
          <ol className="lfm-key-list">
            {KEY.map((k) => {
              const id = `f${k.n}`;
              return (
                <li key={k.n}>
                  <button
                    type="button"
                    className={`lfm-key-row${active === id ? " is-active" : ""}`}
                    aria-pressed={selected === id}
                    onMouseEnter={() => setHover(id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(id)}
                    onBlur={() => setHover(null)}
                    onClick={() => toggleSelected(id)}
                  >
                    <span className={`lfm-key-num${k.future ? " is-future" : ""}`}>{k.n}</span>
                    {k.name}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="lfm-legend">
            <span>
              <span className="lfm-dot" style={{ background: "var(--lfm-pin-facility)" }} />
              Facility
            </span>
            <span>
              <span className="lfm-dot" style={{ background: "var(--lfm-pin-water)" }} />
              Water source
            </span>
            <span>
              <span className="lfm-dot" style={{ background: "var(--lfm-pin-flower)" }} />
              Ornamental plants
            </span>
            <span>
              <span className="lfm-dot" style={{ background: "var(--lfm-pin-recycle)" }} />
              Material recovery facility
            </span>
            <span>
              <span className="lfm-dot" style={{ border: "1.5px dashed var(--lfm-future)" }} />
              Future development
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
