"use client";

import {
  Archive,
  ClipboardList,
  HeartCrack,
  type LucideIcon,
  ListChecks,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type MessageKey, useLanguage } from "@/lib/i18n";
import { CARD_OUTLINE } from "@/lib/crop-colors";

/**
 * How to use the Risk Indicator page, in two parts: reading and acting on a
 * plant's risk, and reporting a plant that died. Each step names the button
 * the farmer will see on the page.
 */

type Step = { icon: LucideIcon; title: MessageKey; body: MessageKey };

const SECTIONS: { title: MessageKey; color: string; steps: Step[] }[] = [
  {
    title: "riskGuide.riskSection",
    color: "var(--primary)",
    steps: [
      { icon: Stethoscope, title: "riskGuide.assessTitle", body: "riskGuide.assessBody" },
      { icon: ShieldCheck, title: "riskGuide.levelTitle", body: "riskGuide.levelBody" },
      { icon: ClipboardList, title: "riskGuide.todoTitle", body: "riskGuide.todoBody" },
    ],
  },
  {
    title: "riskGuide.diedSection",
    color: "var(--risk-high)",
    steps: [
      { icon: HeartCrack, title: "riskGuide.diedOpenTitle", body: "riskGuide.diedOpenBody" },
      { icon: ListChecks, title: "riskGuide.diedFormTitle", body: "riskGuide.diedFormBody" },
      { icon: Archive, title: "riskGuide.diedArchiveTitle", body: "riskGuide.diedArchiveBody" },
    ],
  },
];

export function RiskIndicatorGuide({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();

  return (
    <Card className={`gap-0 py-4 ${CARD_OUTLINE}`} aria-labelledby="risk-guide-title">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="risk-guide-title" className="text-sm font-medium">
              {t("riskGuide.title")}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">{t("riskGuide.intro")}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
            {t("plantsGuide.hide")}
          </Button>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.title} aria-label={t(section.title)}>
              <h3 className="font-heading text-sm font-medium" style={{ color: section.color }}>
                {t(section.title)}
              </h3>
              <ol className="mt-2 flex flex-col gap-2">
                {section.steps.map(({ icon: Icon, title, body }, index) => (
                  <li key={title} className="border-border/60 flex gap-3 rounded-lg border p-3">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full"
                      style={{
                        color: section.color,
                        backgroundColor: `color-mix(in oklch, ${section.color}, transparent 88%)`,
                      }}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-heading text-sm font-medium">
                        <span className="text-muted-foreground mr-1">{index + 1}.</span>
                        {t(title)}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                        {t(body)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
