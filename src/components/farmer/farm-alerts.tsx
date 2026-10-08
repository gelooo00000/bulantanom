"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ElementType } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { FarmAlert } from "@/lib/api/dashboard-api";
import { useLanguage } from "@/lib/i18n";

/**
 * What needs the farmer's attention right now.
 *
 * Every entry is produced by Django from a count it has just read — an
 * unassessed plant, a harvest window opening, a stale soil reading. There
 * is no alert that fires on a guess, so an empty list is a real answer and
 * is shown as one rather than hiding the section.
 *
 * Severity is carried by an icon and the wording as well as colour: the
 * app's risk hues are weak against each other for red-green colourblind
 * readers, so colour alone would leave "needs attention now" and "worth
 * knowing" indistinguishable.
 */

const STYLES: Record<
  FarmAlert["severity"],
  { icon: ElementType; accent: string }
> = {
  high: {
    icon: OctagonAlert,
    accent: "text-risk-high",
  },
  medium: {
    icon: TriangleAlert,
    accent: "text-risk-medium",
  },
  info: {
    icon: Info,
    accent: "text-muted-foreground",
  },
};

type FarmAlertsProps = {
  alerts: FarmAlert[];
  /** False while the farm has no plants at all — nothing to alert about. */
  hasPlants: boolean;
};

export function FarmAlerts({ alerts, hasPlants }: FarmAlertsProps) {
  const { t } = useLanguage();
  if (!hasPlants) return null;

  if (alerts.length === 0) {
    return (
      <Card className="gap-0 py-4">
        <CardContent className="flex items-center gap-2.5 px-4">
          <CircleCheck className="text-risk-low size-4 shrink-0" aria-hidden="true" />
          <p className="text-sm">{t("alerts.none")}</p>
        </CardContent>
      </Card>
    );
  }

  // One compact card with divided rows rather than a stack of tinted
  // boxes: the alerts are a to-do list, not the page's headline, so they
  // should not push the risk and harvest sections below the fold.
  return (
    <section aria-label={t("alerts.title")}>
      <Card className="gap-0 py-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <h2 className="text-sm font-medium">{t("alerts.title")}</h2>
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums">
            {alerts.length}
          </span>
        </div>
        <ul className="divide-y">
          {alerts.map((alert, index) => {
            const style = STYLES[alert.severity];
            const Icon = style.icon;
            return (
              <li key={`${alert.severity}-${index}`}>
                <Link
                  href={alert.href}
                  className="hover:bg-muted/50 flex items-center gap-2.5 px-3 py-2 transition-colors"
                >
                  <Icon
                    className={`size-4 shrink-0 ${style.accent}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-sm leading-snug">{alert.message}</span>
                  <span className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium">
                    {alert.action}
                    <ArrowRight className="size-3" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
