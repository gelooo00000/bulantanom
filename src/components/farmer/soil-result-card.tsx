"use client";

import {
  Apple,
  ChevronDown,
  Droplets,
  FlaskConical,
  Leaf,
  Sprout,
  TriangleAlert,
  Wheat,
} from "lucide-react";
import { useState, type ElementType, type ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type {
  SoilAdvice,
  SoilCropSuggestion,
  SoilRecommendation,
} from "@/lib/api/soil-api";
import { useSoilStrings } from "@/lib/soil-options";
import { cn } from "@/lib/utils";

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

/** Fertilizer tips shown before "See more". */
const ADVICE_SHOWN = 1;

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
              <p className="font-heading font-medium">{crop.name}</p>
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

/** The same "See more" toggle as the new-plant guidance. */
function SeeMoreButton({
  open,
  onToggle,
  more,
  less,
}: {
  open: boolean;
  onToggle: () => void;
  more: string;
  less: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="font-heading hover:bg-muted -mx-2 -mt-2 flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-sm tracking-wide transition-colors"
      style={{ color: "var(--landing-accent)" }}
    >
      {open ? less : more}
      <ChevronDown
        className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
      />
    </button>
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
  const t = useSoilStrings();
  // The parent keys this card by result, so the toggle resets on a new result.
  const [adviceOpen, setAdviceOpen] = useState(false);

  const groups = [
    { key: "fruits", icon: Apple, title: t.suitableFruits, crops: result.suitable_fruits },
    { key: "vegetables", icon: Leaf, title: t.suitableVegetables, crops: result.suitable_vegetables },
    { key: "crops", icon: Wheat, title: t.suitableCrops, crops: result.suitable_crops },
  ].filter((group) => group.crops.length > 0);

  const fertilizer = result.fertilizer_recommendations;
  const hiddenAdvice = Math.max(0, fertilizer.length - ADVICE_SHOWN);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Sprout className="text-primary size-5" />
        <h2 className="text-base font-medium">{t.resultTitle}</h2>
      </div>

      {groups.map((group) => (
        <Section key={group.key} icon={group.icon} title={group.title}>
          <CropGrid crops={group.crops} />
        </Section>
      ))}

      {fertilizer.length > 0 ? (
        <Section icon={FlaskConical} title={t.fertilizer}>
          <AdviceList items={adviceOpen ? fertilizer : fertilizer.slice(0, ADVICE_SHOWN)} />
          {hiddenAdvice > 0 ? (
            <SeeMoreButton
              open={adviceOpen}
              onToggle={() => setAdviceOpen((open) => !open)}
              more={`${t.seeMoreAdvice} (${hiddenAdvice})`}
              less={t.seeLess}
            />
          ) : null}
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
