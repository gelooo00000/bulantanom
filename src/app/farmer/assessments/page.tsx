"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, LoaderCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { AssessmentRow } from "@/components/risk/assessment-row";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { fetchFarmerRiskHistory } from "@/lib/api/risk-api";
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
        title={t("history.title")}
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
            shown.map((assessment) => (
              <AssessmentRow
                key={assessment.id}
                assessment={assessment}
                href={`/farmer/assessments/${assessment.id}`}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
