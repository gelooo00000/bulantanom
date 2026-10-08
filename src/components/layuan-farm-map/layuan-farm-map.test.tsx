import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INFO, KEY, PINS, buildFarmMap } from "./farmMapCore";
import { LayuanFarmMap } from "./LayuanFarmMap";

describe("farmMapCore", () => {
  it("has the 20 facilities of the map key, each with a pin", () => {
    expect(KEY).toHaveLength(20);
    for (const k of KEY) expect(PINS.some((p) => p.id === `f${k.n}`)).toBe(true);
    for (const p of PINS) expect(INFO[p.id]).toBeDefined();
  });

  it("builds a finite SVG with an anchor for every pin at every slider extreme", () => {
    for (const [tilt, height] of [[0.6, 0.5], [1, 1], [1.4, 2]]) {
      const map = buildFarmMap(tilt, height);
      expect(map.width).toBeGreaterThan(0);
      expect(map.height).toBeGreaterThan(0);
      expect(map.inner).not.toMatch(/NaN|Infinity|undefined/);
      for (const p of PINS) {
        const [x, y] = map.anchors[p.id];
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(map.width);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(map.height);
      }
    }
  });
});

describe("LayuanFarmMap", () => {
  // jsdom lays nothing out: report a desktop-sized stage.
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private cb: ResizeObserverCallback) {}
        observe() {
          this.cb([{ contentRect: { width: 1000, height: 620 } } as ResizeObserverEntry], this as never);
        }
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders a button for every pin", () => {
    const { container } = render(<LayuanFarmMap theme="light" />);

    expect(container.querySelector(".lfm")).toHaveAttribute("data-theme", "light");
    expect(container.querySelectorAll("button[data-pin]")).toHaveLength(PINS.length);
    expect(screen.getByRole("button", { name: "1. Multi-purpose hall (future development)" })).toBeInTheDocument();
  });

  it("shows a facility's details when its pin is chosen", () => {
    const { container } = render(<LayuanFarmMap />);

    fireEvent.click(container.querySelector('[data-pin="f7"]') as HTMLButtonElement);

    const detail = container.querySelector(".lfm-detail") as HTMLElement;
    expect(within(detail).getByText("Fishpond")).toBeInTheDocument();
    expect(within(detail).getByText("Future development")).toBeInTheDocument();
    expect(container.querySelector('[data-pin="f7"]')).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles a sticky selection from a pin, and keeps the same pin node", () => {
    const { container } = render(<LayuanFarmMap />);
    const pin = container.querySelector('[data-pin="f3"]') as HTMLButtonElement;

    fireEvent.click(pin);
    expect(pin).toHaveAttribute("aria-pressed", "true");
    // A state change must not re-create the pins (focus would be lost).
    expect(container.querySelector('[data-pin="f3"]')).toBe(pin);
    fireEvent.click(pin);
    expect(pin).toHaveAttribute("aria-pressed", "false");
  });

  it("hides a layer and its pins from its chip", () => {
    const { container } = render(<LayuanFarmMap />);
    const chip = screen.getByRole("button", { name: "Water" });

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector(".lfm")).toHaveClass("lfm-hide-water");
    expect(container.querySelector('[data-pin="w1"]')).toBeNull();
  });

  it("zooms with the buttons", () => {
    const { container } = render(<LayuanFarmMap />);
    const svg = container.querySelector("svg.lfm-svg") as SVGSVGElement;
    const before = svg.getAttribute("viewBox");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    });
    expect(svg.getAttribute("viewBox")).not.toBe(before);

  });
});
