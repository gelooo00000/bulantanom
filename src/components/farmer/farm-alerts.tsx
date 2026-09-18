import Link from "next/link";
import { ArrowRight, CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ElementType } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { FarmAlert } from "@/lib/api/dashboard-api";

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
  { icon: ElementType; accent: string; ring: string }
> = {
  high: {
    icon: OctagonAlert,
    accent: "text-risk-high",
    ring: "border-risk-high/40 bg-risk-high/10",
  },
  medium: {
    icon: TriangleAlert,
    accent: "text-risk-medium",
    ring: "border-risk-medium/40 bg-risk-medium/10",
  },
  info: {
    icon: Info,
    accent: "text-muted-foreground",
    ring: "border-border bg-card",
  },
};

type FarmAlertsProps = {
  alerts: FarmAlert[];
  /** False while the farm has no plants at all — nothing to alert about. */
  hasPlants: boolean;
};

export function FarmAlerts({ alerts, hasPlants }: FarmAlertsProps) {
  if (!hasPlants) return null;

  if (alerts.length === 0) {
    return (
      <Card className="gap-0 py-4">
        <CardContent className="flex items-center gap-2.5 px-4">
          <CircleCheck className="text-risk-low size-4 shrink-0" aria-hidden="true" />
          <p className="text-sm">
            Nothing needs your attention right now.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-label="Needs attention" className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">Needs attention</h2>
      <ul className="flex flex-col gap-2">
        {alerts.map((alert, index) => {
          const style = STYLES[alert.severity];
          const Icon = style.icon;
          return (
            <li key={`${alert.severity}-${index}`}>
              <Link
                href={alert.href}
                className={`hover:border-primary/40 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${style.ring}`}
              >
                <Icon
                  className={`size-4 shrink-0 ${style.accent}`}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm">{alert.message}</span>
                <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                  {alert.action}
                  <ArrowRight className="size-3" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
