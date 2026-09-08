import { Leaf, OctagonAlert, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/mock-data";

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; icon: typeof Leaf; className: string }
> = {
  low: {
    label: "Low Risk",
    icon: Leaf,
    className: "bg-risk-low/15 text-risk-low border-risk-low/30",
  },
  medium: {
    label: "Medium Risk",
    icon: TriangleAlert,
    className: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  },
  high: {
    label: "High Risk",
    icon: OctagonAlert,
    className: "bg-risk-high/15 text-risk-high border-risk-high/40",
  },
};

type RiskBadgeProps = {
  level: RiskLevel;
  size?: "sm" | "default";
  className?: string;
};

export function RiskBadge({ level, size = "default", className }: RiskBadgeProps) {
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
      {config.label}
    </span>
  );
}
