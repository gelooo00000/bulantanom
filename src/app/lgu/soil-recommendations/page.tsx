"use client";

import { ChevronDown, FlaskConical, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchLguSoilRecommendations,
  type LguSoilRecommendation,
} from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";
import { cn } from "@/lib/utils";

/** One reported soil property, hidden entirely when the Farmer said "Unknown". */
function SoilFact({ label, value }: { label: string; value: string | null }) {
  if (!value || value === "Unknown") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function CropList({
  title,
  crops,
}: {
  title: string;
  crops: LguSoilRecommendation["suitable_fruits"];
}) {
  if (crops.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {crops.map((crop) => (
          <span
            key={crop.id}
            title={crop.reason}
            className="border-border bg-card/60 rounded-lg border px-2 py-1 text-sm"
          >
            <span aria-hidden>{crop.emoji}</span> {crop.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * One submitted soil record, collapsed to a scannable row until opened.
 * Every record used to render its full detail - nine soil facts, notes, every
 * crop chip and all advice lists - so a page of records was unreadable and
 * grew without limit as farmers submitted.
 */
function RecordCard({ record }: { record: LguSoilRecommendation }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const submitted = new Date(record.created_at).toLocaleDateString();
  const cropCount =
    record.suitable_fruits.length +
    record.suitable_vegetables.length +
    record.suitable_crops.length;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{record.farmer_name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {record.soil_type_label} · pH {record.ph_level ?? "unknown"} · {submitted}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
            record.ai_generated
              ? "bg-risk-low/15 text-risk-low border-risk-low/30"
              : "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
          )}
        >
          {record.ai_generated
            ? `${cropCount} crop${cropCount === 1 ? "" : "s"}`
            : "Not analyzed"}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <CardContent id={panelId} className="flex flex-col gap-4 border-t px-4 pt-4 pb-5">
          <p className="text-muted-foreground truncate text-sm">{record.farmer_email}</p>

          {/* What the Farmer actually reported. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SoilFact label="Soil type" value={record.soil_type_label} />
            <SoilFact label="Texture" value={record.soil_texture_label} />
            <SoilFact label="Drainage" value={record.drainage_label} />
            <SoilFact label="Moisture" value={record.soil_moisture_label} />
            <SoilFact label="pH" value={record.ph_level} />
            <SoilFact label="Nitrogen" value={record.nitrogen_label} />
            <SoilFact label="Phosphorus" value={record.phosphorus_label} />
            <SoilFact label="Potassium" value={record.potassium_label} />
            <SoilFact label="Organic matter" value={record.organic_matter_label} />
          </div>

          {record.notes ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">
                Farmer&apos;s observations
              </span>
              <p className="text-sm">{record.notes}</p>
            </div>
          ) : null}

          {/* The AI result, exactly as the Farmer saw it. */}
          {record.ai_generated ? (
            <div className="border-border flex flex-col gap-3 border-t pt-3">
              <CropList title="Suitable fruits" crops={record.suitable_fruits} />
              <CropList title="Suitable vegetables" crops={record.suitable_vegetables} />
              <CropList title="Suitable crops" crops={record.suitable_crops} />

              {record.fertilizer_recommendations.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Fertilizer</span>
                  <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
                    {record.fertilizer_recommendations.map((item, i) => (
                      <li key={i}>• {item.recommendation}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {record.soil_improvement_watering.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">
                    Soil improvement &amp; watering
                  </span>
                  <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
                    {record.soil_improvement_watering.map((item, i) => (
                      <li key={i}>• {item.recommendation}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {record.important_warnings.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Warnings</span>
                  <ul className="text-risk-medium flex flex-col gap-1 text-sm">
                    {record.important_warnings.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                        <span>{item.recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground border-border border-t pt-3 text-sm">
              The soil information was saved, but the AI recommendation could not be
              generated at the time of submission.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function LguSoilRecommendationsPage() {
  const [farmerFilter] = useState<number | undefined>(undefined);
  const { data, loading, error, refetch } = useLguQuery((token) =>
    fetchLguSoilRecommendations(token, farmerFilter),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Soil Recommendation Records"
        description="Soil assessments submitted by farmers at Layuan Farm, read live from the database."
      />

      {loading ? (
        <LguLoading label="Loading soil recommendation records…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No soil recommendations yet"
          description="Records appear here once approved Farmers submit their soil information."
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            {data.length} {data.length === 1 ? "record" : "records"}
          </p>
          {data.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
