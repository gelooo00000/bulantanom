"use client";

import { CloudRain } from "lucide-react";

import { fetchRecentFarmWeather } from "@/lib/api/weather-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useLanguage } from "@/lib/i18n";

/**
 * The farm's last week of rain and temperature, shown on the weekly
 * assessment. The server attaches the same figures to the assessment for the
 * AI, so the farmer no longer has to describe the weather; this note tells
 * them so. Shows nothing while loading or when the weather is unavailable.
 */
export function FarmWeekWeather() {
  const { t } = useLanguage();
  const { data: weather } = useAuthedQuery((token) => fetchRecentFarmWeather(token), []);
  if (!weather?.available) return null;

  const temperatures = { min: weather.temperature_min_c, max: weather.temperature_max_c };
  const summary =
    weather.rainy_days === 0
      ? t("weather.weekDry", temperatures)
      : weather.rainy_days === 1
        ? t("weather.weekOneRainyDay", { rain: weather.rain_total_mm, ...temperatures })
        : t("weather.week", {
            rain: weather.rain_total_mm,
            days: weather.rainy_days,
            ...temperatures,
          });

  return (
    <div className="bg-muted/40 border-border flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
      <CloudRain className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{summary}</p>
        <p className="text-muted-foreground">{t("weather.added")}</p>
      </div>
    </div>
  );
}
