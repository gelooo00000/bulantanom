"use client";

import Link from "next/link";
import { ArrowRight, FlaskConical, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { SoilCropSuggestion, SoilRecommendation } from "@/lib/api/soil-api";
import { SOIL_STRINGS as t } from "@/lib/soil-options";

/**
 * Dashboard summary of the Farmer's latest soil assessment.
 *
 * Deliberately a summary, not the full result: the reported soil facts, a
 * row of suggested crops per category, and a link through to the complete
 * six-section recommendation. The full advice lives on the Soil
 * Recommendation page.
 */

/** One reported soil property, omitted when the Farmer answered "Unknown". */
function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value || value.toLowerCase() === "unknown") return null;
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

/** Compact emoji chips — no reasons, those belong on the full page. */
function CropChips({ title, crops }: { title: string; crops: SoilCropSuggestion[] }) {
  if (crops.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-xs">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {crops.map((crop) => (
          <span
            key={crop.id}
            className="border-border bg-card/60 rounded-lg border px-2 py-1 text-sm"
          >
            <span aria-hidden>{crop.emoji}</span> {crop.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Turns the stored value back into its display label, e.g. sandy_loam. */
function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function SoilSummaryCard({ soil }: { soil: SoilRecommendation | null }) {
  if (!soil) {
    return (
      <EmptyState
        icon={FlaskConical}
        title={t.noAssessmentTitle}
        description={t.noAssessmentBody}
        action={
          <Button nativeButton={false} render={<Link href="/farmer/soil-recommendation" />}>
            {t.submit}
            <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
          </Button>
        }
      />
    );
  }

  return (
    <Card className="gap-3 py-5">
      <CardContent className="flex flex-col gap-4 px-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label={t.soilType} value={titleCase(soil.soil_type)} />
          <Fact label={t.phLevel} value={soil.ph_level} />
          <Fact label={t.soilMoisture} value={titleCase(soil.soil_moisture)} />
          <Fact label={t.drainage} value={titleCase(soil.drainage)} />
        </div>

        {soil.ai_generated ? (
          <div className="border-border flex flex-col gap-3 border-t pt-4">
            <CropChips title={t.suitableFruits} crops={soil.suitable_fruits} />
            <CropChips title={t.suitableVegetables} crops={soil.suitable_vegetables} />
            <CropChips title={t.suitableCrops} crops={soil.suitable_crops} />
          </div>
        ) : (
          /*
            Saved without an AI result. Only a set `failure_reason` means
            Gemini was called and failed; otherwise it was simply never asked.
          */
          <div className="border-border flex gap-3 border-t pt-4">
            <TriangleAlert className="text-risk-medium mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">{t.assessmentSaved}</p>
              <p className="text-muted-foreground text-sm">
                {soil.failure_reason ? t.aiUnavailable : t.notAnalyzed}
              </p>
            </div>
          </div>
        )}

        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            <p className="text-muted-foreground text-xs">{t.latestAssessment}</p>
            <p className="text-sm">{formatDisplayDate(soil.created_at.slice(0, 10))}</p>
          </div>
          <Link
            href="/farmer/soil-recommendation"
            className="flex items-center gap-1 text-sm"
            style={{ color: "var(--landing-accent)" }}
          >
            {t.viewRecommendation}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
