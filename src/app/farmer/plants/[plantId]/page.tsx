"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, CalendarDays, Clock, LoaderCircle, Sprout, TriangleAlert } from "lucide-react";

import { PlantingSeasonNote } from "@/components/farmer/planting-season-note";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { fetchPlant } from "@/lib/api/plants-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { humanDuration } from "@/lib/duration";
import { useLanguage } from "@/lib/i18n";
import { plantStatusLabel } from "@/lib/plant-summary";

export default function PlantDetailPage({
  params,
}: {
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = use(params);
  const { t, dateLocale } = useLanguage();
  const date = (iso: string) => formatDisplayDate(iso, dateLocale);
  const { data: plant, loading, error, refetch } = useAuthedQuery(
    (token) => fetchPlant(token, plantId),
    [plantId],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="text-primary size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">{t("detail.loading")}</p>
      </div>
    );
  }

  if (error || !plant) {
    // A plant belonging to another Farmer 404s server-side, so this is also
    // the "not yours / not found" state.
    return (
      <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
        <TriangleAlert className="text-risk-high size-5" />
        <p className="text-sm font-medium">{t("detail.loadFailed")}</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {error ?? t("detail.notFound")}
        </p>
        <div className="flex gap-2">
          <Button onClick={refetch}>{t("common.tryAgain")}</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/farmer/plants" />}>
            {t("add.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* A link, not router.back(): it returns to My Plants even when the
          farmer arrived from a bookmark or a notification. */}
      <Link
        href="/farmer/plants"
        className="text-muted-foreground hover:text-foreground -mb-2 flex items-center gap-1.5 self-start text-sm"
      >
        <ArrowLeft className="size-3.5" />
        {t("add.back")}
      </Link>

      {/* Facts about the plant only. Its weekly assessment is started from
          Risk Indicator, and past results are in Assessment History. */}
      <PageHeader
        title={`${plant.crop.emoji} ${plant.display_name}`}
        description={`${plant.crop.name} · Layuan Farm`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <PlantStat icon={CalendarDays} label={t("detail.plantingDate")} value={date(plant.planting_date)} />
        <PlantStat
          icon={Clock}
          label={t("detail.age")}
          value={humanDuration(plant.age_days, t)}
        />
        <PlantStat
          icon={Sprout}
          label={t("detail.status")}
          value={plant.is_planned ? t("plant.planned") : plantStatusLabel(plant, t)}
        />
        <PlantStat
          icon={CalendarDays}
          label={t("detail.harvestFrom")}
          value={date(plant.expected_harvest_start)}
        />
        <PlantStat
          icon={CalendarDays}
          label={t("detail.harvestUntil")}
          value={date(plant.expected_harvest_end)}
        />
      </div>

      <Card className="gap-3 py-5">
        <CardContent className="px-5">
          <h2 className="text-sm font-medium">
            {t("detail.about", {
              name: plant.variant ? plant.variant.name : plant.crop.name,
            })}
            {plant.variant && (
              <span className="text-muted-foreground font-normal">
                {" "}
                ({plant.crop.name})
              </span>
            )}
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {plant.variant?.description || plant.crop.description}
          </p>
          <p className="text-muted-foreground mt-3 text-sm">
            {t(plant.variant ? "detail.typical" : "detail.typicalNoVariety", {
              growing: humanDuration(
                plant.variant?.growing_duration_days ?? plant.crop.growing_duration_days,
                t,
              ),
              window: humanDuration(
                plant.variant?.harvest_window_days ?? plant.crop.harvest_window_days,
                t,
              ),
            })}
          </p>

          {/* How the month it was actually planted in suits this crop. */}
          <PlantingSeasonNote advice={plant.planting_advice} className="mt-4" />
        </CardContent>
      </Card>
    </div>
  );
}

function PlantStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <Card className="gap-1.5 py-3.5">
      <CardContent className="flex flex-col gap-1 px-3.5">
        <span className="text-muted-foreground flex items-center gap-1 text-[11px] tracking-wide uppercase">
          <Icon className="size-3" />
          {label}
        </span>
        <span className="text-sm font-medium">{value}</span>
      </CardContent>
    </Card>
  );
}
