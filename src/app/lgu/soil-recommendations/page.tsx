"use client";

import { FlaskConical } from "lucide-react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { SoilRecords } from "@/components/lgu/soil-records";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchLguSoilRecommendations } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";

export default function LguSoilRecommendationsPage() {
  const { data, loading, error, refetch } = useLguQuery((token) =>
    fetchLguSoilRecommendations(token),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Crop Recommendation Records"
        description="How healthy Layuan's soil is, which crops suit it, and every soil check behind the numbers."
      />

      {loading ? (
        <LguLoading label="Loading crop recommendation records…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No crop recommendations yet"
          description="Records appear here once approved Farmers submit their soil information."
        />
      ) : (
        <SoilRecords records={data} />
      )}
    </div>
  );
}
