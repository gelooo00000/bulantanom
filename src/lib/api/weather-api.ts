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

/** The farm's last week of rain and temperature (Django: recent_weather). */
export type RecentFarmWeather =
  | { available: false }
  | {
      available: true;
      days: number;
      from: string;
      to: string;
      rain_total_mm: number;
      rainy_days: number;
      wettest_day_mm: number;
      temperature_max_c: number;
      temperature_min_c: number;
    };

/**
 * The same week of weather Django attaches to each new assessment, so the
 * form can show the farmer what is added for them.
 */
export function fetchRecentFarmWeather(accessToken: string): Promise<RecentFarmWeather> {
  return apiFetch("/weather/recent/", { accessToken });
}
