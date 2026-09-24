import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FarmWeather } from "@/components/shared/farm-weather";
import type { FarmWeather as Weather } from "@/lib/api/weather-api";

let weather: Weather | null = null;
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data: weather, loading: false, error: null, refetch: vi.fn() }),
}));

beforeEach(() => {
  weather = null;
});

describe("FarmWeather", () => {
  it("shows the live temperature and condition", () => {
    weather = {
      available: true,
      temperature_c: 31,
      condition: "light_rain",
      is_day: true,
      observed_at: "2026-09-24T11:15",
    };
    render(<FarmWeather />);
    expect(screen.getByText("31°C · Light rain")).toBeInTheDocument();
  });

  it("uses the labels it is given, so farmers see their language", () => {
    weather = {
      available: true,
      temperature_c: 29,
      condition: "cloudy",
      is_day: false,
      observed_at: "2026-09-24T21:00",
    };
    render(
      <FarmWeather
        labels={{
          clear: "",
          mostly_clear: "",
          partly_cloudy: "",
          cloudy: "Maulap",
          fog: "",
          drizzle: "",
          light_rain: "",
          rain: "",
          heavy_rain: "",
          thunderstorm: "",
        }}
      />,
    );
    expect(screen.getByText("29°C · Maulap")).toBeInTheDocument();
  });

  it("shows nothing, not a made-up reading, when the weather is unavailable", () => {
    weather = { available: false };
    const { container } = render(<FarmWeather />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing while the reading loads", () => {
    const { container } = render(<FarmWeather />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/28°C/)).not.toBeInTheDocument();
  });
});
