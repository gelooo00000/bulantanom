"use client";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";

import { fetchFarmWeather, type WeatherCondition } from "@/lib/api/weather-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

/** Matches Django's cache window, so a page left open stays current. */
const REFRESH_MS = 30 * 60 * 1000;

export const ENGLISH_WEATHER: Record<WeatherCondition, string> = {
  clear: "Clear",
  mostly_clear: "Mostly clear",
  partly_cloudy: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Foggy",
  drizzle: "Drizzle",
  light_rain: "Light rain",
  rain: "Rain",
  heavy_rain: "Heavy rain",
  thunderstorm: "Thunderstorm",
};

const ICONS: Record<WeatherCondition, { day: LucideIcon; night: LucideIcon }> = {
  clear: { day: Sun, night: Moon },
  mostly_clear: { day: Sun, night: Moon },
  partly_cloudy: { day: CloudSun, night: CloudMoon },
  cloudy: { day: Cloud, night: Cloud },
  fog: { day: CloudFog, night: CloudFog },
  drizzle: { day: CloudDrizzle, night: CloudDrizzle },
  light_rain: { day: CloudRain, night: CloudRain },
  rain: { day: CloudRain, night: CloudRain },
  heavy_rain: { day: CloudRainWind, night: CloudRainWind },
  thunderstorm: { day: CloudLightning, night: CloudLightning },
};

function WeatherIcon({ condition, isDay }: { condition: WeatherCondition; isDay: boolean }) {
  const { day: DayIcon, night: NightIcon } = ICONS[condition];
  return isDay ? (
    <DayIcon className="size-3.5" aria-hidden="true" />
  ) : (
    <NightIcon className="size-3.5" aria-hidden="true" />
  );
}

/**
 * The header's live weather at Layuan Farm, e.g. "31°C · Light rain".
 *
 * Renders nothing while loading or when the reading is unavailable: showing
 * no temperature is honest, a placeholder one is not.
 */
export function FarmWeather({
  labels = ENGLISH_WEATHER,
}: {
  labels?: Record<WeatherCondition, string>;
}) {
  const { data: weather, refetch } = useAuthedQuery(fetchFarmWeather);

  useEffect(() => {
    const timer = window.setInterval(refetch, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refetch]);

  if (!weather?.available) return null;

  return (
    <span className="text-muted-foreground hidden items-center gap-1.5 sm:flex">
      <WeatherIcon condition={weather.condition} isDay={weather.is_day} />
      {weather.temperature_c}°C · {labels[weather.condition]}
    </span>
  );
}
