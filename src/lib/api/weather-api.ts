import { apiFetch } from "./client";

/** The conditions Django groups Open-Meteo's weather codes into. */
export type WeatherCondition =
  | "clear"
  | "mostly_clear"
  | "partly_cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "light_rain"
  | "rain"
  | "heavy_rain"
  | "thunderstorm";

export type FarmWeather =
  | { available: false }
  | {
      available: true;
      temperature_c: number;
      condition: WeatherCondition;
      is_day: boolean;
      /** Local farm time of the reading, e.g. "2026-09-24T11:15". */
      observed_at: string;
    };

/**
 * Current weather at Layuan Farm. Django fetches it from Open-Meteo and
 * caches it, so the browser never calls a third party. Never rejects for an
 * outage: that comes back as `{ available: false }`.
 */
export function fetchFarmWeather(accessToken: string): Promise<FarmWeather> {
  return apiFetch("/weather/", { accessToken });
}
