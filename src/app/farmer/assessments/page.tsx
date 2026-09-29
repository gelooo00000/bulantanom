"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { fetchFarmerRiskHistory, type BackendAssessment } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function AssessmentHistoryPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchFarmerRiskHistory);
  const [riskFilter, setRiskFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const { t } = useLanguage();

  // History only grows, so without this the readings worth revisiting sink
  // below weeks of routine low-risk entries.
  const shown = (data ?? []).filter(
    (a) => riskFilter === "ALL" || a.risk?.risk_level === riskFilter,
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("nav.assessments")}
        description={t("history.description")}
      />

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("history.loading")}</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="text-sm font-medium">{t("dash.cantConnect")}</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={refetch}>{t("common.tryAgain")}</Button>
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("history.emptyTitle")}
          description={t("history.emptyText")}
          action={
            <Button nativeButton={false} render={<Link href="/farmer/plants" />}>
              {t("history.goToPlants")}
              <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              {shown.length === data.length
                ? data.length === 1
                  ? t("history.countOne")
                  : t("history.count", { n: data.length })
                : t("history.countOf", { shown: shown.length, total: data.length })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRiskFilter(value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    riskFilter === value
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === "ALL"
                    ? t("history.all")
                    : t(
                        value === "HIGH"
                          ? "risk.highRisk"
                          : value === "MEDIUM"
                            ? "risk.mediumRisk"
                            : "risk.lowRisk",
                      )}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t("history.noneAtLevel")}
              description={t("history.tryFilter")}
            />
          ) : (
            // Just enough to pick one out; the full result, photo and
            // explanation open when a tile is tapped.
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {shown.map((assessment) => (
                <AssessmentTile key={assessment.id} assessment={assessment} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One assessment as a small tile: which plant, how old it was, when, and
 * its level when there is a real one ("Too Early" is not a verdict, so it
 * is left to the full result). The whole tile opens that result.
 */
function AssessmentTile({ assessment }: { assessment: BackendAssessment }) {
  const { t, dateLocale } = useLanguage();
  const level = assessment.risk?.risk_level?.toLowerCase() as BadgeLevel | undefined;

  return (
    <Link
      href={`/farmer/assessments/${assessment.id}`}
      className="bg-card border-border hover:border-primary/50 focus-visible:ring-ring/50 flex h-full flex-col gap-2.5 rounded-xl border p-3 shadow-sm transition-colors outline-none focus-visible:ring-3 sm:p-4"
    >
      <div className="flex min-w-0 items-start gap-2 sm:gap-2.5">
        <span
          aria-hidden="true"
          className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg text-lg sm:size-10 sm:text-xl"
        >
          {assessment.crop_emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-snug font-medium break-words">
            {assessment.plant_display_name}
          </p>
          <p className="text-muted-foreground text-xs">
            {t("row.day", { n: assessment.plant_age_days })}
          </p>
        </div>
        {/* Hidden on phones, where the name needs the room more. */}
        <ChevronRight className="text-muted-foreground mt-0.5 hidden size-4 shrink-0 sm:block" />
      </div>

      <div className="mt-auto flex flex-col items-start gap-1.5">
        {level && level !== "inconclusive" && <RiskBadge size="sm" level={level} />}
        <span className="text-muted-foreground flex items-center gap-1 text-[11px] sm:text-xs">
          <CalendarDays className="size-3 shrink-0" />
          {new Date(`${assessment.assessment_date}T00:00:00`).toLocaleDateString(dateLocale, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
    </Link>
  );
}
