import { CalendarCheck, CloudRain, TriangleAlert } from "lucide-react";

import type { PlantingAdvice } from "@/lib/api/plants-api";
import { cn } from "@/lib/utils";

/**
 * Whether this month suits this crop at Layuan Farm, and why.
 *
 * Sits under the crop's growing-period line and answers the question that
 * line cannot: the same crop planted in March and in October has two very
 * different outcomes here.
 *
 * Every word of the guidance comes from the payload. This file only decides
 * how it looks — so correcting the agronomy is a Django change, never a
 * change in the UI layer.
 */

const STYLES: Record<
  PlantingAdvice["status"],
  { icon: typeof CalendarCheck; container: string; accent: string; label: string }
> = {
  good: {
    icon: CalendarCheck,
    container: "border-risk-low/30 bg-risk-low/5",
    accent: "text-risk-low",
    label: "In season",
  },
  caution: {
    icon: CloudRain,
    container: "border-risk-medium/30 bg-risk-medium/5",
    accent: "text-risk-medium",
    label: "Outside the ideal window",
  },
  poor: {
    icon: TriangleAlert,
    container: "border-risk-high/30 bg-risk-high/5",
    accent: "text-risk-high",
    label: "Not the season for this crop",
  },
};

type PlantingSeasonNoteProps = {
  advice: PlantingAdvice | null;
  className?: string;
};

export function PlantingSeasonNote({ advice, className }: PlantingSeasonNoteProps) {
  // No window on record for this crop — say nothing rather than guess.
  if (!advice) return null;

  const style = STYLES[advice.status];
  const Icon = style.icon;

  return (
    <div
      className={cn("rounded-xl border px-3 py-2.5", style.container, className)}
      // Announced when the farmer changes the planting date, but not urgent
      // enough to interrupt whatever they are typing.
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 size-4 shrink-0", style.accent)} aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="text-sm leading-snug font-medium">
            <span className={cn("sr-only")}>{style.label}. </span>
            {advice.headline}
          </p>
          {advice.detail && (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {advice.detail}
            </p>
          )}
          {advice.preferred_months.length > 0 && advice.status !== "good" && (
            <p className="text-muted-foreground text-xs">
              Usually planted here in{" "}
              <span className="text-foreground font-medium">
                {advice.preferred_label}
              </span>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
