"use client";

import { Radar } from "lucide-react";
import { useMemo } from "react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { RiskOverview } from "@/components/lgu/risk-overview";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchLguPlants } from "@/lib/api/lgu-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { livePlants } from "@/lib/lgu-plant-stats";

export default function LguRiskOverviewPage() {
  // One plant list feeds every chart, so the page can never show two
  // different answers to the same question.
  const { data, loading, error, refetch } = useAuthedQuery(fetchLguPlants);
  const plants = useMemo(() => livePlants(data ?? []), [data]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Risk Overview"
        description="How healthy Layuan's plants are, and which crops need attention."
      />

      {loading ? (
        <LguLoading label="Loading risk readings…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : plants.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No plants yet"
          description="Risk readings appear here once approved Farmers track plants and submit weekly assessments."
        />
      ) : (
        <RiskOverview plants={plants} />
      )}
    </div>
  );
}
