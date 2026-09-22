"use client";

import { CircleHelp, Leaf, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ElementType } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { useFarmerLanguage, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type RiskCounts = {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  unassessed: number;
};

const TILES: {
  key: keyof RiskCounts;
  label: MessageKey;
  icon: ElementType;
  className: string;
}[] = [
  { key: "HIGH", label: "risk.highRisk", icon: OctagonAlert, className: "text-risk-high" },
  { key: "MEDIUM", label: "risk.mediumRisk", icon: TriangleAlert, className: "text-risk-medium" },
  { key: "LOW", label: "risk.lowRisk", icon: Leaf, className: "text-risk-low" },
  {
    key: "unassessed",
    label: "riskCounts.noReading",
    icon: CircleHelp,
    className: "text-muted-foreground",
  },
];

/**
 * Counts are taken verbatim from the API, which derives them from the
 * latest assessment per plant. Nothing here is estimated client-side.
 */
export function RiskCountsRow({ counts }: { counts: RiskCounts }) {
  const { t } = useFarmerLanguage();
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((tile) => (
        <Card key={tile.key} className="gap-1 py-4">
          <CardContent className="px-4">
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                tile.className,
              )}
            >
              <tile.icon className="size-3.5" />
              {t(tile.label)}
            </span>
            <p className="mt-1.5 text-2xl font-medium tabular-nums">{counts[tile.key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
