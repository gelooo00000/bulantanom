"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CircleHelp,
  LoaderCircle,
  Sprout,
  TriangleAlert,
} from "lucide-react";

import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { RiskCountsRow } from "@/components/risk/risk-counts";
import { RiskInfoNote } from "@/components/risk/risk-result-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BackendPlant } from "@/lib/api/plants-api";
import { fetchFarmerRisk, type BackendAssessment } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function RiskIndicatorPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchFarmerRisk);
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("riskPage.title")}
        description={t("riskPage.description")}
      />

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("riskPage.loading")}</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="text-sm font-medium">{t("dash.cantConnect")}</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={refetch}>{t("common.tryAgain")}</Button>
        </div>
      ) : !data || data.plants.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title={t("riskPage.emptyTitle")}
          description={t("riskPage.emptyText")}
          action={
            <Button nativeButton={false} render={<Link href="/farmer/plants/new" />}>
              {t("suited.addPlant")}
              <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
            </Button>
          }
        />
      ) : (
        <>
          <RiskCountsRow counts={data.counts} compact />

          {/* Plants side by side, like My Plants: two across on a phone,
              more as the screen widens. */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
            {data.plants.map(({ plant, latest_assessment }) => (
              <PlantRiskCard key={plant.id} plant={plant} latest={latest_assessment} />
            ))}
          </div>

          <RiskInfoNote />
        </>
      )}
    </div>
  );
}

/** The thin strip along a card's top edge, in the colour of its level. */
const ACCENT: Record<BadgeLevel | "none", string> = {
  low: "bg-risk-low",
  medium: "bg-risk-medium",
  high: "bg-risk-high",
  inconclusive: "bg-muted-foreground/30",
  none: "bg-border",
};

/**
 * One plant as a small tile: its level, when it was last checked, and this
 * week's check. The explanation and photo are shown in Assessment History
 * only, behind "Details".
 */
function PlantRiskCard({
  plant,
  latest,
}: {
  plant: BackendPlant;
  latest: BackendAssessment | null;
}) {
  const { t, dateLocale } = useLanguage();
  const level = latest?.risk?.risk_level?.toLowerCase() as BadgeLevel | undefined;

  return (
    <Card className="h-full gap-0 overflow-hidden py-0">
      <div aria-hidden="true" className={cn("h-1 shrink-0", ACCENT[level ?? "none"])} />
      <CardContent className="flex h-full flex-col gap-2.5 p-3 sm:p-4">
        <div className="flex min-w-0 items-start gap-2 sm:gap-2.5">
          <span
            aria-hidden="true"
            className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg text-base sm:size-9 sm:text-lg"
          >
            {plant.crop.emoji}
          </span>
          <div className="min-w-0">
            {/* Two lines before cutting off: half a phone is too narrow for
                "Oyster Mushroom" on one. */}
            <p className="line-clamp-2 text-sm leading-snug font-medium break-words">
              {plant.display_name}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {t("row.day", { n: plant.age_days })}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1.5">
          {/* Only a real Low / Medium / High reading gets a badge here. A
              "Too Early" check is not a verdict, so it shows just its date;
              the reason is in Details. */}
          {level && level !== "inconclusive" && <RiskBadge size="sm" level={level} />}
          {latest ? (
            <span className="bg-muted text-foreground inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] leading-tight font-medium sm:px-2 sm:text-xs">
              <CalendarCheck className="size-3 shrink-0 sm:size-3.5" />
              {t("riskPage.checked", {
                date: new Date(`${latest.assessment_date}T00:00:00`).toLocaleDateString(
                  dateLocale,
                  { month: "short", day: "numeric" },
                ),
              })}
            </span>
          ) : (
            // Dashed, so it reads as "still to do" rather than as a level.
            <span className="border-primary/50 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-lg border border-dashed px-1.5 py-0.5 text-[11px] leading-tight font-medium sm:px-2 sm:text-xs">
              <CircleHelp className="size-3 shrink-0 sm:size-3.5" />
              {t("riskCounts.noReading")}
            </span>
          )}
        </div>

        {/* Pinned to the bottom so the actions line up across a row. */}
        <div className="border-border mt-auto flex flex-col gap-2 border-t pt-2.5">
          <WeeklyCheck plant={plant} />
          {latest && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={<Link href={`/farmer/assessments/${latest.id}`} />}
            >
              {t("riskPage.details")}
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * This week's check for one plant: a button when it is due, otherwise when
 * the next one opens. Straight from the server's `assessment_eligibility`,
 * so it offers only what the API will accept.
 */
function WeeklyCheck({ plant }: { plant: BackendPlant }) {
  const { t } = useLanguage();
  const { can_assess, days_remaining } = plant.assessment_eligibility;

  if (can_assess) {
    return (
      <Button
        size="sm"
        className="w-full"
        nativeButton={false}
        render={<Link href={`/farmer/plants/${plant.id}/assessment`} />}
      >
        {t("riskPage.assessNow")}
      </Button>
    );
  }
  return (
    <span className="bg-primary/10 text-primary flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-center text-[11px] leading-tight font-medium sm:px-2 sm:text-xs">
      <CalendarClock className="size-3 shrink-0 sm:size-3.5" />
      {days_remaining === 1 ? t("riskPage.nextInOne") : t("riskPage.nextIn", { n: days_remaining })}
    </span>
  );
}
