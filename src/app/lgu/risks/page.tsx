"use client";

import { Radar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { RiskOverview } from "@/components/lgu/risk-overview";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchLguFarmers, fetchLguPlants } from "@/lib/api/lgu-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { livePlants } from "@/lib/lgu-plant-stats";

export default function LguRiskOverviewPage() {
  // One plant list feeds every chart and the list below them, so the page
  // can never show two different answers to the same question.
  const { data, loading, error, refetch } = useAuthedQuery(fetchLguPlants);
  const plants = useMemo(() => livePlants(data ?? []), [data]);

  // Online status for the Farmers to visit cards. Nice to have: if it fails,
  // the cards simply show each Farmer's email instead.
  const { data: farmers } = useAuthedQuery((token) => fetchLguFarmers(token, "ALL"));
  const presence = useMemo(
    () =>
      farmers
        ? new Map(
            farmers.map((f) => [f.id, { is_online: f.is_online, last_seen_at: f.last_seen_at }]),
          )
        : undefined,
    [farmers],
  );

  // `?crop=` from a crop picked on the Plants page. Read from
  // `window.location` rather than `useSearchParams`, which would oblige this
  // page to sit inside a Suspense boundary (as on the Add Plant page).
  const [cropId, setCropId] = useState<string | null>(null);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("crop");
    if (!requested) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on arrival
    setCropId(requested);
    // The filter now lives in the page; drop it from the address so a
    // reload does not bring it back after it is cleared.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Risk Overview"
        description="How healthy Layuan's plants are, who to visit first, and which crops need attention."
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
        // Keyed on the requested crop so arriving from the Plants page starts
        // the list already filtered to it.
        <RiskOverview
          key={cropId ?? "all"}
          plants={plants}
          presence={presence}
          initialCropId={cropId}
        />
      )}
    </div>
  );
}
