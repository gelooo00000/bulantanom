import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { INFO, KEY, PINS, buildFarmMap } from "./farmMapCore";
import { LayuanFarmMap } from "./LayuanFarmMap";

describe("farmMapCore", () => {
  it("has the 20 facilities of the map key, each with a pin", () => {
    expect(KEY).toHaveLength(20);
    for (const k of KEY) expect(PINS.some((p) => p.id === `f${k.n}`)).toBe(true);
    for (const p of PINS) expect(INFO[p.id]).toBeDefined();
  });

  it("builds a finite SVG at every slider extreme", () => {
    for (const [tilt, height] of [[0.6, 0.5], [1, 1], [1.4, 2]]) {
      const map = buildFarmMap(tilt, height);
      expect(map.width).toBeGreaterThan(0);
      expect(map.height).toBeGreaterThan(0);
      expect(map.inner).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe("LayuanFarmMap", () => {
  it("shows a facility in the detail card when its key row is chosen", () => {
    const { container } = render(<LayuanFarmMap theme="light" />);

    expect(container.querySelector(".lfm")).toHaveAttribute("data-theme", "light");
    expect(container.querySelectorAll("svg [data-pin]")).toHaveLength(PINS.length);

    fireEvent.click(screen.getByRole("button", { name: /^7\s*Fishpond/ }));
    const card = container.querySelector(".lfm-card") as HTMLElement;
    expect(within(card).getByText("Fishpond")).toBeInTheDocument();
    expect(within(card).getByText("Future development")).toBeInTheDocument();
    expect(container.querySelector('[data-pin="f7"]')).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles a sticky selection from a pin with the keyboard", () => {
    const { container } = render(<LayuanFarmMap />);
    const pin = container.querySelector('[data-pin="f3"]') as SVGGElement;

    fireEvent.keyDown(pin, { key: "Enter" });
    expect(pin).toHaveAttribute("aria-pressed", "true");
    // The pin is the same node: a state change must not re-write the SVG,
    // or keyboard focus would be lost.
    expect(container.querySelector('[data-pin="f3"]')).toBe(pin);
    fireEvent.keyDown(pin, { key: " " });
    expect(pin).toHaveAttribute("aria-pressed", "false");
  });

  it("hides a layer from its chip", () => {
    const { container } = render(<LayuanFarmMap />);
    const chip = screen.getByRole("button", { name: "Rice fields" });

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector(".lfm")).toHaveClass("lfm-hide-rice");
  });
});
