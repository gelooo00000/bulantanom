import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FarmMap } from "@/components/lgu/farm-map";

// jsdom has no WebGL, so the real library cannot draw here. What is tested is
// everything around the map: what the Officer sees while it loads, and when
// the device cannot draw it at all.
const mapConstructor = vi.fn();

vi.mock("maplibre-gl", () => ({
  default: {
    Map: class {
      constructor(options: unknown) {
        mapConstructor(options);
        throw new Error("Failed to initialize WebGL");
      }
    },
  },
}));

afterEach(() => mapConstructor.mockClear());

describe("FarmMap", () => {
  it("says so, with the coordinates, when the device cannot draw 3D", async () => {
    render(<FarmMap name="Layuan Farm" latitude={12.67} longitude={123.88} />);

    expect(await screen.findByText("The 3D map could not be shown")).toBeInTheDocument();
    expect(screen.getByText(/12\.6700° N, 123\.8800° E\./)).toBeInTheDocument();
    // No map controls are offered for a map that is not there.
    expect(screen.queryByRole("group", { name: "Map type" })).not.toBeInTheDocument();
  });

  it("centres on the farm, tilted, and leaves page scrolling alone", async () => {
    render(<FarmMap name="Layuan Farm" latitude={12.67} longitude={123.88} />);
    await screen.findByText("The 3D map could not be shown");

    expect(mapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ center: [123.88, 12.67], cooperativeGestures: true }),
    );
    expect(mapConstructor.mock.calls[0][0].pitch).toBeGreaterThan(45);
  });

  it("always offers a plain link to the same place", () => {
    render(<FarmMap name="Layuan Farm" latitude={12.67} longitude={123.88} />);
    expect(screen.getByRole("link", { name: /Open in Google Maps/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=12.67,123.88",
    );
  });
});
