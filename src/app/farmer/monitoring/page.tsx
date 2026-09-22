"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import { RiskBadge } from "@/components/risk/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchFarmerRisk, type BackendAssessment } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useLanguage } from "@/lib/i18n";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days since the last assessment, from the stored assessment_date. The
 * cadence copy below is derived from that number only — nothing is
 * scheduled or predicted server-side, so nothing is claimed here either.
 */
function daysSince(dateString: string) {
  const then = new Date(`${dateString}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - then) / DAY_MS));
}

function AssessmentStatus({ assessment }: { assessment: BackendAssessment }) {
  const { t } = useLanguage();
  const elapsed = daysSince(assessment.assessment_date);
  return (
    <span className="text-muted-foreground text-sm">
      {elapsed === 0
        ? t("monitor.lastToday")
        : elapsed === 1
          ? t("monitor.lastYesterday")
          : t("monitor.lastDays", { n: elapsed })}
      {elapsed >= 7 && t("monitor.due")}
    </span>
  );
}

export default function MonitoringPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchFarmerRisk);
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("monitor.title")}
        description={t("monitor.description")}
      />

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("myPlants.loading")}</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="text-sm font-medium">{t("dash.cantConnect")}</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={refetch}>{t("common.tryAgain")}</Button>
        </div>
      ) : !data || data.plants.length === 0 ? (
        <EmptyState icon={Activity} title={t("monitor.empty")} />
      ) : (
        <div className="flex flex-col gap-3">
          {data.plants.map(({ plant, latest_assessment: latest }) => (
            <Card key={plant.id} className="gap-2 py-4">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5">
                <div className="flex flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span aria-hidden="true">{plant.crop.emoji}</span>
                    {plant.display_name}
                    {latest?.risk?.risk_level && (
                      <RiskBadge
                        size="sm"
                        level={
                          latest.risk.risk_level.toLowerCase() as "low" | "medium" | "high"
                        }
                      />
                    )}
                  </p>
                  {latest ? (
                    <AssessmentStatus assessment={latest} />
                  ) : (
                    <span className="text-muted-foreground text-sm">{t("detail.noAssessment")}</span>
                  )}
                </div>
                {plant.assessment_eligibility.can_assess ? (
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/farmer/plants/${plant.id}/assessment`} />}
                  >
                    {t("monitor.start")}
                    <ArrowRight className="size-3.5 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
                  </Button>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <Button size="sm" disabled>
                      <CalendarCheck className="size-3.5" />
                      {t("detail.completed")}
                    </Button>
                    <span className="text-muted-foreground/70 text-xs">
                      {plant.assessment_eligibility.days_remaining === 1
                        ? t("monitor.nextOne")
                        : t("monitor.nextDays", {
                            n: plant.assessment_eligibility.days_remaining,
                          })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
