"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, LoaderCircle, TriangleAlert } from "lucide-react";

import { AssessmentHistoryGrid } from "@/components/risk/assessment-history-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { fetchFarmerRiskHistory } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useLanguage } from "@/lib/i18n";

export default function AssessmentHistoryPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchFarmerRiskHistory);
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("nav.assessments")} description={t("history.description")} />

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
        <AssessmentHistoryGrid
          assessments={data}
          hrefFor={(assessment) => `/farmer/assessments/${assessment.id}`}
        />
      )}
    </div>
  );
}
