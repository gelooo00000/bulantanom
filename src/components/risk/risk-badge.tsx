"use client";

import { Clock, Leaf, OctagonAlert, TriangleAlert } from "lucide-react";

import { useFarmerLanguage, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Lower-case so both the mock data and the API's levels fit. */
export type BadgeLevel = "low" | "medium" | "high" | "inconclusive";

const RISK_CONFIG: Record<
  BadgeLevel,
  { label: MessageKey; icon: typeof Leaf; className: string }
> = {
  low: {
    label: "riskBadge.low",
    icon: Leaf,
    className: "bg-risk-low/15 text-risk-low border-risk-low/30",
  },
  medium: {
    label: "riskBadge.medium",
    icon: TriangleAlert,
    className: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  },
  high: {
    label: "riskBadge.high",
    icon: OctagonAlert,
    className: "bg-risk-high/15 text-risk-high border-risk-high/40",
  },
  // Deliberately colourless: this is the absence of a reading, and giving it
  // a risk hue would read as a mild verdict.
  inconclusive: {
    label: "early.badge",
    icon: Clock,
    className: "bg-muted text-muted-foreground border-border",
  },
};

type RiskBadgeProps = {
  level: BadgeLevel;
  size?: "sm" | "default";
  className?: string;
};

export function RiskBadge({ level, size = "default", className }: RiskBadgeProps) {
  const { t } = useFarmerLanguage();
  const config = RISK_CONFIG[level];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.className,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      {t(config.label)}
    </span>
  );
}
