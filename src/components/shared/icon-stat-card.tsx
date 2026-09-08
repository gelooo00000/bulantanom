import type { ElementType, ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "primary" | "risk-low" | "risk-medium" | "risk-high";

const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  "risk-low": "bg-risk-low/15 text-risk-low",
  "risk-medium": "bg-risk-medium/15 text-risk-medium",
  "risk-high": "bg-risk-high/15 text-risk-high",
};

const TONE_VALUE_CLASS: Record<Tone, string> = {
  primary: "",
  "risk-low": "text-risk-low",
  "risk-medium": "text-risk-medium",
  "risk-high": "text-risk-high",
};

type IconStatCardProps = {
  icon?: ElementType;
  label: string;
  value: ReactNode;
  tone?: Tone;
  className?: string;
};

export function IconStatCard({ icon: Icon, label, value, tone = "primary", className }: IconStatCardProps) {
  return (
    <Card className={cn("gap-3 py-4", className)}>
      <CardContent className="flex items-start justify-between px-4">
        <div>
          <p className={cn("text-2xl font-medium tabular-nums", TONE_VALUE_CLASS[tone])}>{value}</p>
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
        {Icon && (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              TONE_CLASS[tone],
            )}
          >
            <Icon className="size-4" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
