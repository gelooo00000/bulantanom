"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, User } from "lucide-react";
import { useState } from "react";

import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { BackendAssessment } from "@/lib/api/risk-api";
import { useFarmerLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type RiskFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";

const FILTERS: RiskFilter[] = ["ALL", "HIGH", "MEDIUM", "LOW"];

/**
 * Assessment History as a grid of small tiles with a risk-level filter.
 * Shared by the Farmer and LGU screens so both read alike; each tile opens
 * the full result at `hrefFor(assessment)`. The LGU variant names the
 * owning Farmer on every tile, since its list spans every Farmer.
 */
export function AssessmentHistoryGrid({
  assessments,
  hrefFor,
  showFarmer = false,
  filterEmptyText,
}: {
  assessments: BackendAssessment[];
  hrefFor: (assessment: BackendAssessment) => string;
  showFarmer?: boolean;
  /** Overrides the Farmer-worded hint shown when a filter matches nothing. */
  filterEmptyText?: string;
}) {
  const { t } = useFarmerLanguage();
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("ALL");

  // History only grows, so without this the readings worth revisiting sink
  // below weeks of routine low-risk entries.
  const shown = assessments.filter(
    (a) => riskFilter === "ALL" || a.risk?.risk_level === riskFilter,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {shown.length === assessments.length
            ? assessments.length === 1
              ? t("history.countOne")
              : t("history.count", { n: assessments.length })
            : t("history.countOf", {
                shown: shown.length,
                total: assessments.length,
              })}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={riskFilter === value}
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
          description={filterEmptyText ?? t("history.tryFilter")}
        />
      ) : (
        // Just enough to pick one out; the full result, photo and
        // explanation open when a tile is tapped.
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {shown.map((assessment) => (
            <AssessmentTile
              key={assessment.id}
              assessment={assessment}
              href={hrefFor(assessment)}
              showFarmer={showFarmer}
            />
          ))}
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
function AssessmentTile({
  assessment,
  href,
  showFarmer,
}: {
  assessment: BackendAssessment;
  href: string;
  showFarmer: boolean;
}) {
  const { t, dateLocale } = useFarmerLanguage();
  const level = assessment.risk?.risk_level?.toLowerCase() as BadgeLevel | undefined;
  const farmer = showFarmer ? assessment.farmer : undefined;

  return (
    <Link
      href={href}
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
          <p className="font-heading line-clamp-2 text-sm leading-snug font-medium break-words">
            {assessment.plant_display_name}
          </p>
          <p className="text-muted-foreground text-xs">
            {t("row.day", { n: assessment.plant_age_days })}
          </p>
        </div>
        {/* Hidden on phones, where the name needs the room more. */}
        <ChevronRight className="text-muted-foreground mt-0.5 hidden size-4 shrink-0 sm:block" />
      </div>

      {farmer && (
        <p className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
          <User className="size-3 shrink-0" />
          <span className="truncate">{farmer.full_name || farmer.email}</span>
        </p>
      )}

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
