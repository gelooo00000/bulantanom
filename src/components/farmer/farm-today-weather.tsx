"use client";

import { WeatherIcon } from "@/components/shared/farm-weather";
import { fetchFarmWeather } from "@/lib/api/weather-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useLanguage, type MessageKey } from "@/lib/i18n";

/**
 * Today's weather at the farm, shown beside the watering and soil questions
 * as a reminder while the farmer answers them. The same live reading as the
 * header. Shows nothing while loading or when the weather is unavailable.
 */
export function FarmTodayWeather() {
  const { t } = useLanguage();
  const { data: weather } = useAuthedQuery(fetchFarmWeather);
  if (!weather?.available) return null;

  return (
    <p className="bg-muted/40 border-border flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium">
      <WeatherIcon
        condition={weather.condition}
        isDay={weather.is_day}
        className="text-muted-foreground size-4 shrink-0"
      />
      {t("weather.today", {
        temperature: weather.temperature_c,
        condition: t(`weather.${weather.condition}` as MessageKey),
      })}
    </p>
  );
}
