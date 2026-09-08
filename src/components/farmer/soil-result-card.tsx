"use client";

import {
  Apple,
  Droplets,
  FlaskConical,
  Leaf,
  Sprout,
  TriangleAlert,
  Wheat,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type {
  SoilAdvice,
  SoilCropSuggestion,
  SoilRecommendation,
} from "@/lib/api/soil-api";
import { SOIL_STRINGS as t } from "@/lib/soil-options";

/**
 * Renders exactly the six Gemini sections — nothing more. Each is a titled
 * block with an icon so the result reads as structured guidance rather than
 * one long AI paragraph. Sections with no content are omitted entirely,
 * except Important Warnings which always shows something so the Farmer
 * knows it was considered.
 */

function SectionHeading({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="text-primary size-4 shrink-0" />
      <h3 className="text-sm font-medium">{title}</h3>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ElementType;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading icon={icon} title={title} />
      <div className="border-border border-t" />
      {children}
    </section>
  );
}

function CropGrid({ crops }: { crops: SoilCropSuggestion[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {crops.map((crop) => (
        <Card key={crop.id} className="gap-2 py-4">
          <CardContent className="flex flex-col gap-1.5 px-4">
            <div className="flex items-center gap-2">
              {/* The emoji is resolved server-side from the crop catalog. */}
              <span aria-hidden className="text-lg leading-none">
                {crop.emoji}
              </span>
              <p className="font-medium">{crop.name}</p>
            </div>
            {crop.reason ? (
              <p className="text-muted-foreground text-sm">{crop.reason}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AdviceList({ items }: { items: SoilAdvice[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li
          key={`${index}-${item.recommendation.slice(0, 24)}`}
          className="text-muted-foreground flex gap-2 text-sm"
        >
          <span aria-hidden className="text-primary select-none">
            •
          </span>
          <span>{item.recommendation}</span>
        </li>
      ))}
    </ul>
  );
}

function WarningList({ items, emptyText }: { items: SoilAdvice[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li
          key={`${index}-${item.recommendation.slice(0, 24)}`}
          className="text-risk-medium flex gap-2 text-sm"
        >
          <span aria-hidden className="select-none">
            ⚠️
          </span>
          <span>{item.recommendation}</span>
        </li>
      ))}
    </ul>
  );
}

export function SoilResultCard({ result }: { result: SoilRecommendation }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Sprout className="text-primary size-5" />
        <h2 className="text-base font-medium">{t.resultTitle}</h2>
      </div>

      {result.suitable_fruits.length > 0 ? (
        <Section icon={Apple} title={t.suitableFruits}>
          <CropGrid crops={result.suitable_fruits} />
        </Section>
      ) : null}

      {result.suitable_vegetables.length > 0 ? (
        <Section icon={Leaf} title={t.suitableVegetables}>
          <CropGrid crops={result.suitable_vegetables} />
        </Section>
      ) : null}

      {result.suitable_crops.length > 0 ? (
        <Section icon={Wheat} title={t.suitableCrops}>
          <CropGrid crops={result.suitable_crops} />
        </Section>
      ) : null}

      {result.fertilizer_recommendations.length > 0 ? (
        <Section icon={FlaskConical} title={t.fertilizer}>
          <AdviceList items={result.fertilizer_recommendations} />
        </Section>
      ) : null}

      {result.soil_improvement_watering.length > 0 ? (
        <Section icon={Droplets} title={t.soilImprovement}>
          <AdviceList items={result.soil_improvement_watering} />
        </Section>
      ) : null}

      {/* Always rendered: an empty warnings list is itself information. */}
      <Section icon={TriangleAlert} title={t.warnings}>
        <WarningList items={result.important_warnings} emptyText={t.noWarnings} />
      </Section>
    </div>
  );
}
