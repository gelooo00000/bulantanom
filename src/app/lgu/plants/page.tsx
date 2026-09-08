"use client";

import { Sprout } from "lucide-react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { fetchLguPlants } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";
import { cn } from "@/lib/utils";

const RISK_STYLE: Record<string, string> = {
  LOW: "bg-risk-low/15 text-risk-low border-risk-low/30",
  MEDIUM: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  HIGH: "bg-risk-high/15 text-risk-high border-risk-high/30",
};

export default function LguPlantsPage() {
  const { data, loading, error, refetch } = useLguQuery(fetchLguPlants);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plants"
        description="Plants tracked across Layuan Farm, read live from the database."
      />

      {loading ? (
        <LguLoading label="Loading plant records…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="No plants yet"
          description="Plants appear here once approved Farmers start tracking their crops."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {data.length} {data.length === 1 ? "plant" : "plants"}
          </p>
          {data.map((plant) => (
            <Card key={plant.id} className="gap-2 py-4">
              <CardContent className="flex flex-col gap-3 px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span aria-hidden="true">{plant.crop.emoji}</span>{" "}
                      {plant.display_name}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {plant.farmer.full_name} · {plant.farmer.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">
                      {plant.status_label}
                    </span>
                    {/* Latest reading only — a recovered plant is not still HIGH. */}
                    {plant.latest_risk?.risk_level ? (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs font-medium",
                          RISK_STYLE[plant.latest_risk.risk_level],
                        )}
                      >
                        {plant.latest_risk.risk_level} risk
                      </span>
                    ) : (
                      <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium">
                        Not assessed
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-border grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground text-xs">Crop</p>
                    <p className="text-sm">{plant.crop.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Planted</p>
                    <p className="text-sm">{formatDisplayDate(plant.planting_date)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Age</p>
                    <p className="text-sm">{plant.age_days} days</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Harvest window</p>
                    <p className="text-sm">
                      {formatDisplayDate(plant.expected_harvest_start)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
