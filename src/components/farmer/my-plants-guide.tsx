"use client";

import {
  Camera,
  CircleCheck,
  type LucideIcon,
  Plus,
  ShieldCheck,
  Tag,
  Wheat,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type MessageKey, useLanguage } from "@/lib/i18n";

/**
 * Step-by-step directions for the My Plants page, in the order a farmer
 * meets them: add a plant, read its card, assess it each week, act on the
 * risk reading, harvest, and tidy up.
 *
 * Every step names the button the farmer will actually see, in their own
 * language, so the guide reads as "tap this" rather than as a description
 * of features.
 */

const STEPS: { icon: LucideIcon; title: MessageKey; body: MessageKey }[] = [
  { icon: Plus, title: "plantsGuide.addTitle", body: "plantsGuide.addBody" },
  { icon: Tag, title: "plantsGuide.cardTitle", body: "plantsGuide.cardBody" },
  { icon: Camera, title: "plantsGuide.assessTitle", body: "plantsGuide.assessBody" },
  { icon: ShieldCheck, title: "plantsGuide.riskTitle", body: "plantsGuide.riskBody" },
  { icon: Wheat, title: "plantsGuide.harvestTitle", body: "plantsGuide.harvestBody" },
  { icon: CircleCheck, title: "plantsGuide.removeTitle", body: "plantsGuide.removeBody" },
];

export function MyPlantsGuide({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();

  return (
    <Card className="gap-0 py-4" aria-labelledby="my-plants-guide-title">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="my-plants-guide-title" className="text-sm font-medium">
              {t("plantsGuide.title")}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">{t("plantsGuide.intro")}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
            {t("plantsGuide.hide")}
          </Button>
        </div>

        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="border-border/60 flex gap-3 rounded-lg border p-3">
              <span
                aria-hidden="true"
                className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full"
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground mr-1">{index + 1}.</span>
                  {t(title)}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{t(body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
