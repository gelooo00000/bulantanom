"use client";

import { Sprout } from "lucide-react";
import { useMemo } from "react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { PlantsOverview } from "@/components/lgu/plants-overview";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchLguPlants } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";
import { livePlants } from "@/lib/lgu-plant-stats";

export default function LguPlantsPage() {
  const { data, loading, error, refetch } = useLguQuery(fetchLguPlants);
  const plants = useMemo(() => livePlants(data ?? []), [data]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plants"
        description="What is growing at Layuan Farm, and when it comes in."
      />
      {loading ? (
        <LguLoading label="Loading plant records…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : plants.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="No plants yet"
          description="Plants appear here once approved Farmers start tracking their crops."
        />
      ) : (
        <PlantsOverview plants={plants} />
      )}
    </div>
  );
}
